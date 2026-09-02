import Foundation
import MSHHealthCore
import XCTest
@testable import MySimpleHealth

final class MSHSmartLayerTests: XCTestCase {
    private let layer = MSHRuleBasedSmartLayer()

    func testDisconnectedSourceProducesDecisionAndApprovalRequiredPreparedAction() {
        let snapshot = MSHMyHealthMapper.snapshot(
            syncState: HealthSyncState(provider: .appleHealth),
            recentRecords: [],
            recentLimit: 8
        )

        let output = layer.evaluate(
            snapshot: snapshot,
            now: Date(timeIntervalSince1970: 1_700_000_000)
        )

        XCTAssertEqual(output.decisions.map(\.kind), [.sourceConnection])
        XCTAssertEqual(output.preparedActions.map(\.kind), [.connectAppleHealth])
        XCTAssertTrue(output.preparedActions.allSatisfy(\.requiresUserApproval))
    }

    func testConnectedAreaWithoutRecentDataWaitsInsteadOfInventingMeaning() {
        let snapshot = MSHMyHealthMapper.snapshot(
            syncState: HealthSyncState(provider: .appleHealth, selectedAreas: [.sleep]),
            recentRecords: [],
            recentLimit: 8
        )

        let output = layer.evaluate(
            snapshot: snapshot,
            now: Date(timeIntervalSince1970: 1_700_000_000)
        )

        XCTAssertTrue(output.preparedActions.isEmpty)
        XCTAssertEqual(output.decisions.count, 1)
        XCTAssertEqual(output.decisions.first?.kind, .awaitingData)
        XCTAssertEqual(output.decisions.first?.area, .sleep)
        XCTAssertEqual(output.summary(for: .sleep)?.value, "No recent data")
        XCTAssertEqual(output.summary(for: .sleep)?.evidenceRecordIDs, [])
    }

    func testSleepSummaryAggregatesSourceIntervalsForSameNight() {
        let night = Date(timeIntervalSince1970: 1_700_000_000)
        let first = MSHRecentHealthActivity(
            id: "sleep-1",
            area: .sleep,
            title: "Sleep",
            detail: "Core",
            systemImage: "moon.stars.fill",
            occurredAt: night,
            durationMinutes: 240,
            sleepStage: "core"
        )
        let second = MSHRecentHealthActivity(
            id: "sleep-2",
            area: .sleep,
            title: "Sleep",
            detail: "REM",
            systemImage: "moon.stars.fill",
            occurredAt: night.addingTimeInterval(4 * 60 * 60),
            durationMinutes: 120,
            sleepStage: "rem"
        )
        let awake = MSHRecentHealthActivity(
            id: "awake",
            area: .sleep,
            title: "Sleep",
            detail: "Awake",
            systemImage: "moon.stars.fill",
            occurredAt: night.addingTimeInterval(6 * 60 * 60),
            durationMinutes: 30,
            sleepStage: "awake"
        )
        let snapshot = snapshot(
            selected: [.sleep],
            activity: [first, second, awake]
        )

        let output = layer.evaluate(
            snapshot: snapshot,
            now: night.addingTimeInterval(8 * 60 * 60)
        )
        let sleep = output.summary(for: .sleep)

        XCTAssertEqual(sleep?.value, "6h 0m")
        XCTAssertEqual(Set(sleep?.evidenceRecordIDs ?? []), Set(["sleep-1", "sleep-2"]))
        XCTAssertFalse(sleep?.evidenceRecordIDs.contains("awake") == true)
    }

    func testOldSourceDataIsLabeledAsOldRatherThanPresentedAsCurrent() {
        let date = Date(timeIntervalSince1970: 1_700_000_000)
        let movement = MSHRecentHealthActivity(
            id: "steps",
            area: .movement,
            title: "Steps",
            detail: "4,200 count",
            systemImage: "shoeprints.fill",
            occurredAt: date,
            numericValue: 4_200,
            unit: "count"
        )
        let snapshot = snapshot(selected: [.movement], activity: [movement])

        let output = layer.evaluate(
            snapshot: snapshot,
            now: date.addingTimeInterval(15 * 24 * 60 * 60)
        )

        XCTAssertEqual(
            output.summary(for: .movement)?.context,
            "This is the latest available source data, but it is more than two weeks old."
        )
        XCTAssertEqual(output.summary(for: .movement)?.evidenceRecordIDs, ["steps"])
    }

    private func snapshot(
        selected: [MSHHealthArea],
        activity: [MSHRecentHealthActivity]
    ) -> MSHMyHealthSnapshot {
        let selectedDataAreas = Set(selected.map(\.healthDataArea))
        let status = MSHAppleHealthStatus(
            syncState: HealthSyncState(
                provider: .appleHealth,
                selectedAreas: selectedDataAreas
            )
        )
        let cards = MSHHealthArea.allCases.map { area in
            MSHHealthAreaCardModel(
                area: area,
                isSelected: selected.contains(area),
                mostRecentActivityAt: activity
                    .filter { $0.area == area }
                    .map(\.occurredAt)
                    .max()
            )
        }
        return MSHMyHealthSnapshot(
            appleHealth: status,
            areaCards: cards,
            recentActivity: activity
        )
    }
}
