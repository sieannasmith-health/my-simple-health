import Foundation
import MSHHealthCore
import XCTest
@testable import MySimpleHealth

final class MSHHealthRecordCorrectionsTests: XCTestCase {
    func testCorrectionPersistsAcrossProviderRefreshAndKeepsProvenance() async throws {
        let directory = try makeTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }

        let store = FileHealthStore(directoryURL: directory)
        let original = makeRecord(id: "sleep-a", value: 420, domain: .sleep, recordType: .sleepInterval)
        try await store.apply(records: [original], deletedSourceRecordIDs: [], provider: .appleHealth)

        let corrections = MSHHealthRecordCorrectionStore(
            databaseURL: directory.appendingPathComponent("health-records-v3.sqlite")
        )
        try await corrections.install()

        let corrected = HealthRecord(
            id: original.id,
            ownerID: original.ownerID,
            domain: original.domain,
            recordType: original.recordType,
            value: 465,
            unit: original.unit,
            eventStart: original.eventStart.addingTimeInterval(900),
            eventEnd: original.eventEnd,
            timezoneIdentifier: original.timezoneIdentifier,
            source: original.source,
            provenance: original.provenance,
            informationClass: original.informationClass,
            importedAt: original.importedAt,
            updatedAt: original.updatedAt,
            lifecycleStatus: .active,
            metadata: original.metadata.merging(["note": "Adjusted in MSH"]) { _, new in new }
        )
        try await corrections.correct(corrected, at: Date(timeIntervalSince1970: 1_800_000_000))

        // Simulate Apple Health returning the original source record on a later sync.
        try await store.apply(records: [original], deletedSourceRecordIDs: [], provider: .appleHealth)

        let records = try await store.records(provider: .appleHealth)
        let saved = try XCTUnwrap(records.first)
        XCTAssertEqual(records.count, 1)
        XCTAssertEqual(saved.id, original.id)
        XCTAssertEqual(saved.value, 465)
        XCTAssertEqual(saved.eventStart, corrected.eventStart)
        XCTAssertEqual(saved.source, original.source)
        XCTAssertEqual(saved.provenance, original.provenance)
        XCTAssertEqual(saved.importedAt, original.importedAt)
        XCTAssertEqual(saved.metadata["note"], "Adjusted in MSH")
        XCTAssertEqual(saved.metadata["msh.correction"], "corrected")
        XCTAssertEqual(try await corrections.kind(for: saved), .corrected)
    }

    func testMSHDeleteDoesNotReappearAfterProviderRefresh() async throws {
        let directory = try makeTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }

        let store = FileHealthStore(directoryURL: directory)
        let original = makeRecord(id: "workout-delete", value: 30, recordType: .workout)
        try await store.apply(records: [original], deletedSourceRecordIDs: [], provider: .appleHealth)

        let corrections = MSHHealthRecordCorrectionStore(
            databaseURL: directory.appendingPathComponent("health-records-v3.sqlite")
        )
        try await corrections.install()
        try await corrections.delete(original, at: Date(timeIntervalSince1970: 1_800_000_100))

        XCTAssertTrue(try await store.records(provider: .appleHealth).isEmpty)

        // A later source upsert must not resurrect the MSH tombstone.
        try await store.apply(records: [original], deletedSourceRecordIDs: [], provider: .appleHealth)
        XCTAssertTrue(try await store.records(provider: .appleHealth).isEmpty)
        XCTAssertEqual(try await corrections.kind(for: original), .deleted)
    }

    func testProviderDeletionCannotEraseMSHCorrectionTombstone() async throws {
        let directory = try makeTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }

        let store = FileHealthStore(directoryURL: directory)
        let original = makeRecord(id: "provider-delete", value: 1)
        try await store.apply(records: [original], deletedSourceRecordIDs: [], provider: .appleHealth)

        let corrections = MSHHealthRecordCorrectionStore(
            databaseURL: directory.appendingPathComponent("health-records-v3.sqlite")
        )
        try await corrections.install()
        try await corrections.delete(original)

        // HealthKit anchored queries report source deletions separately. The protected
        // tombstone must remain so a future source reappearance still cannot restore it.
        try await store.apply(
            records: [],
            deletedSourceRecordIDs: [original.source.sourceRecordID],
            provider: .appleHealth
        )
        XCTAssertEqual(try await corrections.kind(for: original), .deleted)

        try await store.apply(records: [original], deletedSourceRecordIDs: [], provider: .appleHealth)
        XCTAssertTrue(try await store.records(provider: .appleHealth).isEmpty)
    }

    func testDuplicateLookingRecordsAreCorrectedByStableIdentityOnly() async throws {
        let directory = try makeTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }

        let store = FileHealthStore(directoryURL: directory)
        let first = makeRecord(id: "duplicate-a", value: 42)
        let second = makeRecord(id: "duplicate-b", value: 42)
        try await store.apply(records: [first, second], deletedSourceRecordIDs: [], provider: .appleHealth)

        let corrections = MSHHealthRecordCorrectionStore(
            databaseURL: directory.appendingPathComponent("health-records-v3.sqlite")
        )
        try await corrections.install()
        try await corrections.delete(first)

        let records = try await store.records(provider: .appleHealth)
        XCTAssertEqual(records.count, 1)
        XCTAssertEqual(records.first?.id, second.id)
        XCTAssertEqual(records.first?.source.sourceRecordID, "duplicate-b")
    }

    private func makeTemporaryDirectory() throws -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("MSHHealthRecordCorrectionsTests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    private func makeRecord(
        id: String,
        value: Double,
        domain: HealthDomain = .movement,
        recordType: HealthRecordType = .stepSample,
        date: Date = Date(timeIntervalSince1970: 1_700_000_000)
    ) -> HealthRecord {
        HealthRecordFactory.imported(
            sourceRecordID: id,
            domain: domain,
            recordType: recordType,
            value: value,
            unit: domain == .sleep ? "min" : "count",
            start: date,
            end: date.addingTimeInterval(60),
            timezone: TimeZone(identifier: "America/Indiana/Indianapolis")!,
            sourceName: "Apple Health fixture",
            metadata: ["fixture": "true"],
            importedAt: date
        )
    }
}
