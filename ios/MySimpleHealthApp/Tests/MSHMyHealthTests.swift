import Foundation
import MSHHealthCore
import UIKit
import XCTest
@testable import MySimpleHealth

final class MSHMyHealthTests: XCTestCase {
    private actor StateReader: MSHHealthStateReading {
        let state: HealthSyncState
        private(set) var loadCount = 0

        init(state: HealthSyncState) { self.state = state }

        func load(provider: HealthProvider) -> HealthSyncState {
            loadCount += 1
            return state
        }

        func numberOfLoads() -> Int { loadCount }
    }

    private actor RecentReader: MSHRecentHealthReading {
        let records: [HealthRecord]
        private(set) var requestedLimits: [Int] = []

        init(records: [HealthRecord]) { self.records = records }

        func recentRecords(provider: HealthProvider, limit: Int) -> [HealthRecord] {
            requestedLimits.append(limit)
            return records
        }

        func limits() -> [Int] { requestedLimits }
    }

    private actor DataSource: MSHMyHealthDataLoading {
        let state: HealthSyncState
        let records: [HealthRecord]
        private(set) var requestedLimits: [Int] = []

        init(state: HealthSyncState, records: [HealthRecord]) {
            self.state = state
            self.records = records
        }

        func loadStatus() -> HealthSyncState { state }

        func loadRecentActivity(limit: Int) -> [HealthRecord] {
            requestedLimits.append(limit)
            return records
        }

        func limits() -> [Int] { requestedLimits }
    }

    func testStatusMappingUsesConfirmedMetadataInCanonicalAreaOrder() {
        let syncDate = Date(timeIntervalSince1970: 1_700_000_000)
        let state = HealthSyncState(
            provider: .appleHealth,
            selectedAreas: [.bodyMeasurements, .movement, .heartActivity],
            lastSuccessfulSyncAt: syncDate
        )

        let status = MSHAppleHealthStatus(syncState: state)

        XCTAssertTrue(status.isConnected)
        XCTAssertEqual(status.selectedAreas, [.movement, .heartActivity, .bodyMeasurements])
        XCTAssertEqual(status.lastSuccessfulSyncAt, syncDate)
    }

    func testStatusLoadDoesNotCallRecentRecordReader() async throws {
        let stateReader = StateReader(state: HealthSyncState(
            provider: .appleHealth,
            selectedAreas: [.sleep]
        ))
        let recentReader = RecentReader(records: [makeRecord(id: "should-not-load")])
        let source = MSHMyHealthDataSource(stateReader: stateReader, recentReader: recentReader)

        let state = try await source.loadStatus()
        let statusLoadCount = await stateReader.numberOfLoads()
        let recentRequests = await recentReader.limits()

        XCTAssertEqual(state.selectedAreas, [.sleep])
        XCTAssertEqual(statusLoadCount, 1)
        XCTAssertTrue(recentRequests.isEmpty)
    }

    @MainActor
    func testViewModelRequestsBoundedRecentActivityAndMapsAreaStates() async {
        let records: [HealthRecord] = (0..<20).map { offset in
            let isSleep = offset == 0
            let domain: HealthDomain = isSleep ? .sleep : .movement
            let recordType: HealthRecordType = isSleep ? .sleepSession : .stepSample
            let date = Date(timeIntervalSince1970: 1_700_000_000 - Double(offset))
            return makeRecord(
                id: "recent-" + String(offset),
                domain: domain,
                recordType: recordType,
                date: date
            )
        }
        let source = DataSource(
            state: HealthSyncState(provider: .appleHealth, selectedAreas: [.movement, .sleep]),
            records: records
        )
        let viewModel = MSHMyHealthViewModel(dataSource: source)

        await viewModel.reload()

        let requestedLimits = await source.limits()
        guard case .loaded(let snapshot) = viewModel.loadState else {
            return XCTFail("Expected loaded My Health state")
        }
        XCTAssertEqual(requestedLimits, [MSHMyHealthViewModel.recentActivityLimit])
        XCTAssertEqual(snapshot.recentActivity.count, MSHMyHealthViewModel.recentActivityLimit)
        XCTAssertEqual(snapshot.recentActivity.first?.area, .sleep)
        let mappedAreas: [MSHHealthArea] = snapshot.areaCards.map { card in card.area }
        XCTAssertEqual(mappedAreas, MSHHealthArea.allCases)
        XCTAssertTrue(snapshot.areaCards.first(where: { $0.area == MSHHealthArea.movement })?.isSelected == true)
        XCTAssertTrue(snapshot.areaCards.first(where: { $0.area == MSHHealthArea.sleep })?.isSelected == true)
        XCTAssertFalse(snapshot.areaCards.first(where: { $0.area == MSHHealthArea.heartActivity })?.isSelected == true)
    }

    func testReadOnlySQLiteReaderEnforcesHardLimitAndNewestFirst() async throws {
        let directory = try makeTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = FileHealthStore(directoryURL: directory)
        let records = (0..<30).map { offset in
            makeRecord(
                id: "database-\(offset)",
                date: Date(timeIntervalSince1970: 1_700_000_000 + Double(offset))
            )
        }
        try await store.apply(records: records, deletedSourceRecordIDs: [], provider: .appleHealth)
        let reader = SQLiteRecentHealthRecordReader(
            databaseURL: directory.appendingPathComponent("health-records-v3.sqlite")
        )

        let five = try await reader.recentRecords(provider: .appleHealth, limit: 5)
        let clamped = try await reader.recentRecords(provider: .appleHealth, limit: 100)

        XCTAssertEqual(five.count, 5)
        XCTAssertEqual(five.map(\.source.sourceRecordID), ["database-29", "database-28", "database-27", "database-26", "database-25"])
        XCTAssertEqual(clamped.count, SQLiteRecentHealthRecordReader.maximumLimit)
    }

    func testDisconnectedAndEmptyRecordsProduceCalmEmptyState() {
        let snapshot = MSHMyHealthMapper.snapshot(
            syncState: HealthSyncState(provider: .appleHealth),
            recentRecords: [],
            recentLimit: 8
        )

        XCTAssertFalse(snapshot.appleHealth.isConnected)
        XCTAssertTrue(snapshot.appleHealth.selectedAreas.isEmpty)
        XCTAssertTrue(snapshot.recentActivity.isEmpty)
        XCTAssertEqual(snapshot.areaCards.count, 4)
        XCTAssertTrue(snapshot.areaCards.allSatisfy { !$0.isSelected && $0.mostRecentActivityAt == nil })
        XCTAssertTrue(snapshot.areaCards.allSatisfy { $0.stateDescription == "Not selected in Apple Health" })
    }

    func testAccentTokensMaintainReadableContrastOnBothCanvases() {
        XCTAssertGreaterThanOrEqual(contrast(MSHColor.accentLight, MSHColor.canvasLight), 4.5)
        XCTAssertGreaterThanOrEqual(contrast(MSHColor.accentDark, MSHColor.canvasDark), 4.5)
    }

    private func makeTemporaryDirectory() throws -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("MSHMyHealthTests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    private func makeRecord(
        id: String,
        domain: HealthDomain = .movement,
        recordType: HealthRecordType = .stepSample,
        value: Double? = 1,
        date: Date = Date(timeIntervalSince1970: 1_700_000_000)
    ) -> HealthRecord {
        HealthRecordFactory.imported(
            sourceRecordID: id,
            domain: domain,
            recordType: recordType,
            value: value,
            unit: "count",
            start: date,
            end: nil,
            timezone: TimeZone(secondsFromGMT: 0)!,
            importedAt: date
        )
    }

    private func contrast(_ first: UIColor, _ second: UIColor) -> Double {
        let lighter = max(luminance(first), luminance(second))
        let darker = min(luminance(first), luminance(second))
        return (lighter + 0.05) / (darker + 0.05)
    }

    private func luminance(_ color: UIColor) -> Double {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        color.getRed(&red, green: &green, blue: &blue, alpha: nil)
        let components = [Double(red), Double(green), Double(blue)]
        let linearized = components.map { component in
                component <= 0.03928
                    ? component / 12.92
                    : pow((component + 0.055) / 1.055, 2.4)
        }
        let weights = [0.2126, 0.7152, 0.0722]
        return zip(linearized, weights).reduce(0) { result, pair in
            result + pair.0 * pair.1
        }
    }
}
