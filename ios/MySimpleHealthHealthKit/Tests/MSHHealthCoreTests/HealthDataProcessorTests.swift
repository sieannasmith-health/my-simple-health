import Foundation
import Testing
@testable import MSHHealthCore

@Test("covered duration merges overlaps without double counting")
func coveredDurationMergesOverlaps() {
    let base = Date(timeIntervalSince1970: 1_700_000_000)
    let intervals = [
        HealthTimeInterval(start: base, end: base.addingTimeInterval(600)),
        HealthTimeInterval(start: base.addingTimeInterval(300), end: base.addingTimeInterval(900)),
        HealthTimeInterval(start: base.addingTimeInterval(1_200), end: base.addingTimeInterval(1_500))
    ]

    #expect(HealthDataProcessor.coveredDuration(intervals: intervals) == 1_200)
}

@Test("covered duration ignores invalid intervals")
func coveredDurationIgnoresInvalidIntervals() {
    let base = Date(timeIntervalSince1970: 1_700_000_000)
    let intervals = [
        HealthTimeInterval(start: base, end: base.addingTimeInterval(60)),
        HealthTimeInterval(start: base.addingTimeInterval(120), end: base.addingTimeInterval(120)),
        HealthTimeInterval(start: base.addingTimeInterval(240), end: base.addingTimeInterval(180))
    ]

    #expect(HealthDataProcessor.coveredDuration(intervals: intervals) == 60)
}

@Test("record processing uses the model boundary and skips open-ended records")
func coveredDurationFromHealthRecords() {
    let base = Date(timeIntervalSince1970: 1_700_000_000)
    let timezone = TimeZone(secondsFromGMT: 0)!
    let complete = HealthRecordFactory.imported(
        sourceRecordID: "complete",
        domain: .sleep,
        recordType: .sleepInterval,
        value: nil,
        unit: nil,
        start: base,
        end: base.addingTimeInterval(300),
        timezone: timezone,
        importedAt: base
    )
    let openEnded = HealthRecordFactory.imported(
        sourceRecordID: "open",
        domain: .sleep,
        recordType: .sleepInterval,
        value: nil,
        unit: nil,
        start: base,
        end: nil,
        timezone: timezone,
        importedAt: base
    )

    #expect(HealthDataProcessor.coveredDuration(of: [complete, openEnded]) == 300)
}
