import XCTest
@testable import MSHFinancialCore

final class MSHFinancialContextTests: XCTestCase {
    private var calendar: Calendar {
        var value = Calendar(identifier: .gregorian)
        value.timeZone = TimeZone(secondsFromGMT: 0)!
        return value
    }

    func testHorizonSaysNothingRequiresActionWhenKnownCommitmentsLeaveRoom() {
        let now = date(2026, 9, 3)
        let commitments = [
            commitment(id: "rent", label: "Housing", cents: 300_000, due: date(2026, 9, 5), kind: .housing),
            commitment(id: "utilities", label: "Utilities", cents: 40_000, due: date(2026, 9, 12), kind: .utilities),
            commitment(id: "groceries", label: "Groceries", cents: 100_000, due: date(2026, 9, 20), kind: .food)
        ]

        let horizon = MSHFinancialCore.deriveHorizon(
            monthlyNetIncome: MSHMoney(cents: 1_000_000),
            commitments: commitments,
            now: now,
            through: date(2026, 10, 3)
        )

        XCTAssertEqual(horizon.knownCommitments.cents, 440_000)
        XCTAssertEqual(horizon.availableAfterKnownCommitments.cents, 560_000)
        XCTAssertEqual(horizon.affordability, .room)
        XCTAssertTrue(horizon.nothingRequiresAction)
    }

    func testHorizonSeparatesHealthCostsWithoutDoubleCountingLinkedCommitment() {
        let now = date(2026, 9, 3)
        let prescription = MSHHealthCost(
            id: "rx-1",
            label: "Prescription refill",
            kind: .medication,
            amount: MSHMoney(cents: 8_400),
            expectedAt: date(2026, 9, 10),
            status: .confirmed,
            healthRecordID: "medication-1",
            provenance: .userCorrected
        )
        let medicationCommitment = MSHFinancialCore.healthCommitment(from: prescription, fallbackDate: now)

        let horizon = MSHFinancialCore.deriveHorizon(
            monthlyNetIncome: MSHMoney(cents: 500_000),
            commitments: [medicationCommitment],
            healthCosts: [prescription],
            now: now,
            through: date(2026, 10, 3)
        )

        XCTAssertEqual(horizon.knownCommitments.cents, 8_400)
        XCTAssertEqual(horizon.knownHealthCosts.cents, 8_400)
        XCTAssertEqual(horizon.availableAfterKnownCommitments.cents, 491_600)
        XCTAssertEqual(horizon.commitments.first?.healthCostID, "rx-1")
    }

    func testUnlinkedExpectedHealthCostIsIncludedInKnownCommitments() {
        let now = date(2026, 9, 3)
        let lab = MSHHealthCost(
            id: "lab-1",
            label: "Lab estimate",
            kind: .lab,
            amount: MSHMoney(cents: 15_000),
            expectedAt: date(2026, 9, 18),
            status: .estimated,
            provenance: .manual
        )

        let horizon = MSHFinancialCore.deriveHorizon(
            monthlyNetIncome: MSHMoney(cents: 200_000),
            commitments: [],
            healthCosts: [lab],
            now: now,
            through: date(2026, 10, 3)
        )

        XCTAssertEqual(horizon.knownHealthCosts.cents, 15_000)
        XCTAssertEqual(horizon.knownCommitments.cents, 15_000)
        XCTAssertEqual(horizon.availableAfterKnownCommitments.cents, 185_000)
    }

    func testAffordabilityIdentifiesTightAndShortfallWithoutCallingEveryChangeAProblem() {
        let cost = MSHHealthCost(
            id: "rx",
            label: "Medication",
            kind: .medication,
            amount: MSHMoney(cents: 18_000)
        )

        let tight = MSHFinancialCore.affordability(
            of: cost,
            availableBeforeCost: MSHMoney(cents: 25_000),
            referenceIncome: MSHMoney(cents: 100_000)
        )
        XCTAssertEqual(tight.availableAfterCost.cents, 7_000)
        XCTAssertEqual(tight.status, .tight)

        let shortfall = MSHFinancialCore.affordability(
            of: cost,
            availableBeforeCost: MSHMoney(cents: 10_000),
            referenceIncome: MSHMoney(cents: 100_000)
        )
        XCTAssertEqual(shortfall.availableAfterCost.cents, -8_000)
        XCTAssertEqual(shortfall.status, .shortfall)
    }

    func testSpendingChangesReturnsMeaningfulDifferenceAndIgnoresSmallNoise() {
        let changes = MSHFinancialCore.spendingChanges(
            current: [.household: 612, .subscriptions: 42],
            baseline: [.household: 410, .subscriptions: 40],
            minimumAbsoluteChange: 25,
            minimumRelativeChange: 0.20
        )

        XCTAssertEqual(changes.count, 1)
        XCTAssertEqual(changes.first?.category, .household)
        XCTAssertEqual(changes.first?.difference.cents, 20_200)
        XCTAssertEqual(changes.first?.baseline.cents, 41_000)
        XCTAssertEqual(changes.first?.current.cents, 61_200)
    }

    func testRecurringPatternBecomesDatedCommitmentWithProvenance() {
        let pattern = MSHRecurringPattern(
            id: "recurring|card|pharmacy|monthly",
            merchantName: "Neighborhood Pharmacy",
            accountID: "card",
            category: .healthcare,
            cadence: "monthly",
            typicalAmount: Decimal(string: "48.75")!,
            lastObservedAt: date(2026, 8, 15),
            nextExpectedAt: date(2026, 9, 15),
            occurrenceCount: 4,
            confidence: 0.92
        )

        let result = MSHFinancialCore.commitment(from: pattern)

        XCTAssertEqual(result.amount.cents, 4_875)
        XCTAssertEqual(result.kind, .healthcare)
        XCTAssertEqual(result.priority, .essential)
        XCTAssertEqual(result.source, .recurringPattern)
        XCTAssertEqual(result.sourceRecordID, pattern.id)
        XCTAssertEqual(result.provenance, .inferred)
    }

    private func commitment(
        id: String,
        label: String,
        cents: Int64,
        due: Date,
        kind: MSHFinancialCommitmentKind
    ) -> MSHFinancialCommitment {
        MSHFinancialCommitment(
            id: id,
            label: label,
            amount: MSHMoney(cents: cents),
            dueAt: due,
            kind: kind,
            priority: .essential,
            source: .userPlanned,
            provenance: .manual
        )
    }

    private func date(_ year: Int, _ month: Int, _ day: Int) -> Date {
        calendar.date(from: DateComponents(year: year, month: month, day: day))!
    }
}
