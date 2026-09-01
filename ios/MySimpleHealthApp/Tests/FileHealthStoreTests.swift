import Foundation
import XCTest
import MSHHealthCore
@testable import MySimpleHealth

final class FileHealthStoreTests: XCTestCase {
    private struct LegacyFixture: Encodable {
        let records: [String: HealthRecord]
        let states: [String: HealthSyncState]
    }

    private actor MockProvider: HealthDataProvider {
        nonisolated let provider: HealthProvider = .appleHealth
        private var batches: [HealthSyncBatch]

        init(batches: [HealthSyncBatch] = []) {
            self.batches = batches
        }

        nonisolated func availability() -> HealthProviderAvailability { .available }

        func requestAuthorization(for areas: Set<HealthDataArea>) async -> HealthAuthorizationResult {
            HealthAuthorizationResult(outcome: .completed, requestedAreas: areas)
        }

        func sync(_ request: HealthSyncRequest) async throws -> HealthSyncBatch {
            guard !batches.isEmpty else { return HealthSyncBatch(records: []) }
            return batches.removeFirst()
        }

        func disconnect() async {}
    }

    func testSelectedAreaWriteDoesNotLoadOrRewriteBulkRecords() async throws {
        let directory = try makeTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let record = makeRecord(id: "legacy", metadata: ["padding": String(repeating: "x", count: 1_000_000)])
        let checkpoint = Data([1, 2, 3, 4])
        try writeLegacy(
            records: [record.deduplicationKey: record],
            state: HealthSyncState(provider: .appleHealth, selectedAreas: [.sleep], checkpoints: ["steps": checkpoint]),
            to: directory
        )
        let legacyURL = directory.appendingPathComponent("health-records.json")
        let originalRecordData = try Data(contentsOf: legacyURL)

        let store = FileHealthStore(directoryURL: directory)
        let bulkLoadedBefore = await store.diagnosticBulkRecordsLoaded()
        XCTAssertFalse(bulkLoadedBefore)
        var state = try await store.load(provider: .appleHealth)
        state.selectedAreas = [.movement, .sleep]
        try await store.save(state)

        let bulkLoadedAfter = await store.diagnosticBulkRecordsLoaded()
        let stateFileSize = await store.diagnosticStateFileSize()
        let savedState = try await store.load(provider: .appleHealth)
        XCTAssertFalse(bulkLoadedAfter)
        XCTAssertEqual(try Data(contentsOf: legacyURL), originalRecordData)
        XCTAssertFalse(FileManager.default.fileExists(atPath: directory.appendingPathComponent("health-records-v2.json").path))
        XCTAssertFalse(FileManager.default.fileExists(atPath: directory.appendingPathComponent("health-records-v3.sqlite").path))
        XCTAssertLessThan(stateFileSize, UInt64(originalRecordData.count / 100))
        XCTAssertEqual(savedState.checkpoints["steps"], checkpoint)
    }

    func testLegacyMigrationPreservesRecordsProvenanceAndCheckpoints() async throws {
        let directory = try makeTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let record = makeRecord(id: "preserved", metadata: ["sourceActivityType": "walking"])
        let checkpoint = Data([9, 8, 7])
        try writeLegacy(
            records: [record.deduplicationKey: record],
            state: HealthSyncState(provider: .appleHealth, selectedAreas: [.movement], checkpoints: ["workout": checkpoint]),
            to: directory
        )
        let legacyURL = directory.appendingPathComponent("health-records.json")
        let originalRecordData = try Data(contentsOf: legacyURL)

        let store = FileHealthStore(directoryURL: directory)
        let migratedState = try await store.load(provider: .appleHealth)
        XCTAssertEqual(migratedState.checkpoints["workout"], checkpoint)
        let bulkLoaded = await store.diagnosticBulkRecordsLoaded()
        XCTAssertFalse(bulkLoaded)

        let records = try await store.records(provider: .appleHealth)
        XCTAssertEqual(records, [record])
        XCTAssertEqual(records.first?.provenance, "IMPORTED")
        XCTAssertEqual(records.first?.source.sourceRecordID, "preserved")
        XCTAssertEqual(try Data(contentsOf: legacyURL), originalRecordData)
        XCTAssertTrue(FileManager.default.fileExists(atPath: directory.appendingPathComponent("health-records-v3.sqlite").path))
    }

    func testSyncPersistsRecordsAndCheckpointWithSplitStore() async throws {
        let directory = try makeTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let imported = makeRecord(id: "sync")
        let provider = MockProvider(batches: [
            HealthSyncBatch(records: [imported], checkpoints: ["step_count": Data([5])])
        ])
        let store = FileHealthStore(directoryURL: directory)
        let coordinator = HealthSyncCoordinator(provider: provider, records: store, states: store)

        _ = try await coordinator.connect(areas: [.movement])
        _ = try await coordinator.sync()

        let savedRecords = try await store.records(provider: .appleHealth)
        let savedState = try await store.load(provider: .appleHealth)
        let recordFileSize = await store.diagnosticFileSize()
        let stateFileSize = await store.diagnosticStateFileSize()
        XCTAssertEqual(savedRecords, [imported])
        XCTAssertEqual(savedState.checkpoints["step_count"], Data([5]))
        XCTAssertGreaterThan(recordFileSize, 0)
        XCTAssertGreaterThan(stateFileSize, 0)
    }

    func testIncrementalApplyDoesNotRewriteExistingCollectionOrDecodeBulkRecords() async throws {
        let directory = try makeTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = FileHealthStore(directoryURL: directory)

        for batchNumber in 0..<10 {
            let batch = (0..<500).map { offset in
                makeRecord(
                    id: "seed-\(batchNumber)-\(offset)",
                    value: Double(offset),
                    date: Date(timeIntervalSince1970: 1_650_000_000 + Double(batchNumber * 500 + offset))
                )
            }
            try await store.apply(records: batch, deletedSourceRecordIDs: [], provider: .appleHealth)
        }

        let storeBytesBefore = await store.diagnosticFileSize()
        let countBefore = try await store.diagnosticRecordCount()
        try await store.apply(
            records: [makeRecord(id: "small-new-batch", value: 99)],
            deletedSourceRecordIDs: [],
            provider: .appleHealth
        )
        let optionalMetrics = await store.diagnosticLastPersistenceMetrics()
        let metrics = try XCTUnwrap(optionalMetrics)
        let countAfter = try await store.diagnosticRecordCount()
        let bulkRecordsLoaded = await store.diagnosticBulkRecordsLoaded()

        XCTAssertEqual(countBefore, 5_000)
        XCTAssertEqual(countAfter, 5_001)
        XCTAssertEqual(metrics.batchRecordCount, 1)
        XCTAssertFalse(metrics.decodedBulkRecordCollection)
        XCTAssertFalse(bulkRecordsLoaded)
        XCTAssertGreaterThan(storeBytesBefore, 0)
        XCTAssertLessThan(metrics.bytesWritten, max(storeBytesBefore / 10, 64 * 1_024))
        XCTAssertLessThan(
            metrics.residentBytesAfter > metrics.residentBytesBefore
                ? metrics.residentBytesAfter - metrics.residentBytesBefore
                : 0,
            32 * 1_024 * 1_024
        )
    }

    func testDeduplicationUpdatesOneRecordWithoutGrowingRecordCount() async throws {
        let directory = try makeTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = FileHealthStore(directoryURL: directory)

        try await store.apply(records: [makeRecord(id: "same", value: 10)], deletedSourceRecordIDs: [], provider: .appleHealth)
        try await store.apply(records: [makeRecord(id: "same", value: 12)], deletedSourceRecordIDs: [], provider: .appleHealth)

        let records = try await store.records(provider: .appleHealth)
        let recordCount = try await store.diagnosticRecordCount()
        XCTAssertEqual(records.count, 1)
        XCTAssertEqual(records.first?.value, 12)
        XCTAssertEqual(recordCount, 1)
    }

    func testCalendarProjectionFiltersInDatabaseAndPreservesExpectedLayers() async throws {
        let directory = try makeTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = FileHealthStore(directoryURL: directory)
        let start = Date(timeIntervalSince1970: 1_700_000_000)
        let range = DateInterval(start: start, duration: 86_400)
        let records = [
            makeRecord(id: "workout", domain: .movement, recordType: .workout, date: start.addingTimeInterval(100)),
            makeRecord(id: "raw-step", domain: .movement, recordType: .stepSample, date: start.addingTimeInterval(200)),
            makeRecord(id: "daily-step", domain: .movement, recordType: .stepDailySummary, date: start.addingTimeInterval(300)),
            makeRecord(id: "sleep", domain: .sleep, recordType: .sleepSession, date: start.addingTimeInterval(400)),
            makeRecord(id: "outside", domain: .movement, recordType: .workout, date: start.addingTimeInterval(-1))
        ]
        try await store.apply(records: records, deletedSourceRecordIDs: [], provider: .appleHealth)

        let calendar = try await store.records(
            provider: .appleHealth,
            areas: [.movement, .sleep],
            movementCutoff: .distantPast,
            dateRange: range,
            calendarProjectionOnly: true
        )
        XCTAssertEqual(Set(calendar.map(\.source.sourceRecordID)), ["workout", "sleep"])

        let activity = try await store.records(
            provider: .appleHealth,
            areas: [.movement],
            movementCutoff: .distantPast,
            dateRange: range,
            calendarProjectionOnly: false
        )
        XCTAssertEqual(Set(activity.map(\.source.sourceRecordID)), ["workout", "daily-step"])
    }

    func testFailedRecordMigrationLeavesOriginalJSONUntouchedAndNoActiveDatabase() async throws {
        let directory = try makeTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let legacyURL = directory.appendingPathComponent("health-records.json")
        let corrupt = Data("{\"records\":{\"broken\":".utf8)
        try corrupt.write(to: legacyURL, options: .atomic)
        let store = FileHealthStore(directoryURL: directory)

        do {
            _ = try await store.records(provider: .appleHealth)
            XCTFail("Expected migration to reject a truncated record store")
        } catch {
            XCTAssertEqual(try Data(contentsOf: legacyURL), corrupt)
            XCTAssertFalse(FileManager.default.fileExists(atPath: directory.appendingPathComponent("health-records-v3.sqlite").path))
        }
    }

    func testDisconnectAndReconnectKeepRecordsAndResetOnlyConnectionState() async throws {
        let directory = try makeTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let imported = makeRecord(id: "connected")
        let store = FileHealthStore(directoryURL: directory)
        try await store.apply(records: [imported], deletedSourceRecordIDs: [], provider: .appleHealth)
        try await store.save(HealthSyncState(
            provider: .appleHealth,
            selectedAreas: [.movement],
            checkpoints: ["steps": Data([3])]
        ))
        let recordURL = directory.appendingPathComponent("health-records-v3.sqlite")
        let recordsBefore = try Data(contentsOf: recordURL)
        let provider = MockProvider()
        let coordinator = HealthSyncCoordinator(provider: provider, records: store, states: store)

        try await coordinator.disconnect()
        let disconnected = try await store.load(provider: .appleHealth)
        let recordsAfterDisconnect = try await store.records(provider: .appleHealth)
        XCTAssertTrue(disconnected.selectedAreas.isEmpty)
        XCTAssertTrue(disconnected.checkpoints.isEmpty)
        XCTAssertEqual(recordsAfterDisconnect, [imported])
        XCTAssertEqual(try Data(contentsOf: recordURL), recordsBefore)

        _ = try await coordinator.connect(areas: [.sleep])
        let reconnected = try await store.load(provider: .appleHealth)
        let recordsAfterReconnect = try await store.records(provider: .appleHealth)
        XCTAssertEqual(reconnected.selectedAreas, [.sleep])
        XCTAssertTrue(reconnected.checkpoints.isEmpty)
        XCTAssertEqual(recordsAfterReconnect, [imported])
        XCTAssertEqual(try Data(contentsOf: recordURL), recordsBefore)
    }

    private func makeTemporaryDirectory() throws -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("FileHealthStoreTests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    private func writeLegacy(
        records: [String: HealthRecord],
        state: HealthSyncState,
        to directory: URL
    ) throws {
        let fixture = LegacyFixture(records: records, states: [state.provider.rawValue: state])
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        try encoder.encode(fixture).write(to: directory.appendingPathComponent("health-records.json"), options: .atomic)
    }

    private func makeRecord(
        id: String,
        metadata: [String: String] = [:],
        value: Double = 42,
        domain: HealthDomain = .movement,
        recordType: HealthRecordType = .stepSample,
        date: Date = Date(timeIntervalSince1970: 1_700_000_000)
    ) -> HealthRecord {
        return HealthRecordFactory.imported(
            sourceRecordID: id,
            domain: domain,
            recordType: recordType,
            value: value,
            unit: "count",
            start: date,
            end: date,
            timezone: TimeZone(identifier: "America/Indiana/Indianapolis")!,
            metadata: metadata,
            importedAt: date
        )
    }
}
