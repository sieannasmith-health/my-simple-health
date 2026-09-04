import XCTest
@testable import MySimpleHealth

@MainActor
final class MSHCycleTests: XCTestCase {
    private var defaults: UserDefaults!
    private var calendar: Calendar!
    private var suiteName = ""

    override func setUp() {
        super.setUp()
        suiteName = "MSHCycleTests.\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)!
        calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        defaults = nil
        calendar = nil
        super.tearDown()
    }

    private func date(_ value: String) -> Date {
        let parts = value.split(separator: "-").compactMap { Int($0) }
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12))!
    }

    func testSaveEditAndRemovePreserveOneRecordPerDay() {
        let store = MSHCycleStore(defaults: defaults, calendar: calendar)
        let day = date("2026-09-03")

        store.save(date: day, bleeding: .medium, symptoms: ["Fatigue"], note: "First note")
        let originalID = store.record(on: day)?.id

        store.save(date: day, bleeding: .light, symptoms: ["Headache"], note: "Updated")

        XCTAssertEqual(store.records.count, 1)
        XCTAssertEqual(store.record(on: day)?.id, originalID)
        XCTAssertEqual(store.record(on: day)?.bleeding, .light)
        XCTAssertEqual(store.record(on: day)?.symptoms, ["Headache"])
        XCTAssertEqual(store.record(on: day)?.note, "Updated")

        store.remove(on: day)
        XCTAssertNil(store.record(on: day))
        XCTAssertTrue(store.records.isEmpty)
    }

    func testRecordsReloadFromLocalPersistence() {
        let day = date("2026-08-11")
        let first = MSHCycleStore(defaults: defaults, calendar: calendar)
        first.save(date: day, bleeding: .heavy, symptoms: ["Abdominal cramps"], note: "Recorded")

        let second = MSHCycleStore(defaults: defaults, calendar: calendar)

        XCTAssertEqual(second.records.count, 1)
        XCTAssertEqual(second.record(on: day)?.bleeding, .heavy)
        XCTAssertEqual(second.record(on: day)?.symptoms, ["Abdominal cramps"])
    }

    func testPredictionUsesRecordedCycleIntervalsAndRemainsLowConfidenceUntilEnoughHistory() {
        let store = MSHCycleStore(defaults: defaults, calendar: calendar)
        recordPeriod(in: store, starting: "2026-05-01", length: 4)
        recordPeriod(in: store, starting: "2026-05-29", length: 4)
        recordPeriod(in: store, starting: "2026-06-26", length: 4)

        let prediction = store.prediction

        XCTAssertNotNil(prediction)
        XCTAssertEqual(prediction?.averageCycleLength, 28)
        XCTAssertEqual(prediction?.averagePeriodLength, 4)
        XCTAssertEqual(prediction?.confidence, "Low")
        XCTAssertEqual(calendar.dateComponents([.day], from: date("2026-06-26"), to: prediction!.nextPeriodStart).day, 28)
        XCTAssertNotNil(prediction?.estimatedOvulation)
        XCTAssertNotNil(prediction?.fertileWindowStart)
    }

    func testRepeatedObservationRequiresThreeCyclesAndTwoMatchingCycles() {
        let store = MSHCycleStore(defaults: defaults, calendar: calendar)
        for start in ["2026-05-01", "2026-05-29", "2026-06-26"] {
            recordPeriod(in: store, starting: start, length: 4)
            store.save(
                date: date(start),
                bleeding: .medium,
                symptoms: ["Abdominal cramps"],
                note: ""
            )
        }

        let observation = store.repeatedObservation()

        XCTAssertNotNil(observation)
        XCTAssertTrue(observation?.contains("3 of your last 3 recorded cycles") == true)
    }

    private func recordPeriod(in store: MSHCycleStore, starting start: String, length: Int) {
        let first = date(start)
        for offset in 0..<length {
            let day = calendar.date(byAdding: .day, value: offset, to: first)!
            store.save(date: day, bleeding: .medium, symptoms: [], note: "")
        }
    }
}
