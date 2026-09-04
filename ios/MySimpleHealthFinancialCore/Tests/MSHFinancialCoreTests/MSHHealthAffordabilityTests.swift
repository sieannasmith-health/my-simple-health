import XCTest
@testable import MSHFinancialCore

final class MSHHealthAffordabilityTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_800_000_000)

    func testVerifiedLowerCostOptionIsRecognizedWithoutAutoSelectingIt() {
        let cost = medicationCost(amount: 180)
        let option = MSHAffordabilityOption(
            id: "generic",
            healthCostID: cost.id,
            kind: .genericEquivalent,
            title: "Generic equivalent",
            authority: .pharmacy,
            estimatedCost: MSHMoney(cents: 4200),
            requiresPrescriberDecision: true,
            eligibility: .potentiallyEligible,
            verification: .providerReported
        )

        let review = MSHFinancialCore.reviewAffordability(
            cost: cost,
            availableBeforeCost: MSHMoney(cents: 100_000),
            referenceIncome: MSHMoney(cents: 500_000),
            options: [option],
            now: now
        )

        XCTAssertTrue(review.hasVerifiedLowerCostOption)
        XCTAssertEqual(review.bestVerifiedEstimatedCost, MSHMoney(cents: 4200))
        XCTAssertTrue(review.personRetainsDecision)
        XCTAssertEqual(review.nextSteps.first?.owner, .prescriber)
    }

    func testUnverifiedPriceDoesNotBecomeVerifiedSavingsClaim() {
        let cost = medicationCost(amount: 180)
        let option = MSHAffordabilityOption(
            id: "discount",
            healthCostID: cost.id,
            kind: .cashDiscount,
            title: "Cash discount",
            authority: .other,
            estimatedCost: MSHMoney(cents: 3000),
            verification: .unverified
        )

        let review = MSHFinancialCore.reviewAffordability(
            cost: cost,
            availableBeforeCost: MSHMoney(cents: 100_000),
            referenceIncome: MSHMoney(cents: 500_000),
            options: [option],
            now: now
        )

        XCTAssertFalse(review.hasVerifiedLowerCostOption)
        XCTAssertNil(review.bestVerifiedEstimatedCost)
        XCTAssertEqual(review.options.count, 1)
    }

    func testExpiredAndIneligibleOptionsAreRemoved() {
        let cost = medicationCost(amount: 180)
        let expired = MSHAffordabilityOption(
            id: "expired",
            healthCostID: cost.id,
            kind: .manufacturerAssistance,
            title: "Expired assistance",
            authority: .manufacturer,
            estimatedCost: MSHMoney(cents: 1000),
            eligibility: .eligible,
            verification: .providerReported,
            validThrough: now.addingTimeInterval(-1)
        )
        let ineligible = MSHAffordabilityOption(
            id: "ineligible",
            healthCostID: cost.id,
            kind: .nonprofitAssistance,
            title: "Not eligible",
            authority: .nonprofit,
            eligibility: .ineligible,
            verification: .providerReported
        )

        let review = MSHFinancialCore.reviewAffordability(
            cost: cost,
            availableBeforeCost: MSHMoney(cents: 100_000),
            referenceIncome: MSHMoney(cents: 500_000),
            options: [expired, ineligible],
            now: now
        )

        XCTAssertTrue(review.options.isEmpty)
        XCTAssertTrue(review.nextSteps.isEmpty)
    }

    func testOptionsForAnotherHealthCostAreNotMixedIntoReview() {
        let cost = medicationCost(amount: 180)
        let unrelated = MSHAffordabilityOption(
            id: "other-cost",
            healthCostID: "different-cost",
            kind: .differentPharmacy,
            title: "Other pharmacy",
            authority: .pharmacy,
            estimatedCost: MSHMoney(cents: 2000),
            verification: .providerReported
        )

        let review = MSHFinancialCore.reviewAffordability(
            cost: cost,
            availableBeforeCost: MSHMoney(cents: 100_000),
            referenceIncome: MSHMoney(cents: 500_000),
            options: [unrelated],
            now: now
        )

        XCTAssertTrue(review.options.isEmpty)
    }

    func testNormalizeOptionCalculatesSavingsFromCurrentCost() {
        let cost = medicationCost(amount: 180)
        let option = MSHAffordabilityOption(
            id: "mail",
            healthCostID: cost.id,
            kind: .mailOrder,
            title: "Mail-order pharmacy",
            authority: .insurer,
            estimatedCost: MSHMoney(cents: 9000),
            verification: .providerReported
        )

        let normalized = MSHFinancialCore.normalizedOption(option, against: cost)

        XCTAssertEqual(normalized.estimatedSavings, MSHMoney(cents: 9000))
    }

    func testPrescriberAndInsuranceDecisionsRemainOwnedByThoseParties() {
        let cost = medicationCost(amount: 180)
        let formulary = MSHAffordabilityOption(
            id: "formulary",
            healthCostID: cost.id,
            kind: .insuranceCoveredAlternative,
            title: "Covered alternative",
            authority: .insurer,
            requiresPrescriberDecision: true,
            requiresInsuranceReview: true,
            eligibility: .potentiallyEligible,
            verification: .providerReported
        )

        let review = MSHFinancialCore.reviewAffordability(
            cost: cost,
            availableBeforeCost: MSHMoney(cents: 20_000),
            referenceIncome: MSHMoney(cents: 200_000),
            options: [formulary],
            now: now
        )

        XCTAssertEqual(review.nextSteps.first?.owner, .prescriber)
        XCTAssertTrue(review.nextSteps.first?.requiresConsent ?? false)
        XCTAssertTrue(review.personRetainsDecision)
    }

    private func medicationCost(amount: Decimal) -> MSHHealthCost {
        MSHHealthCost(
            id: "rx-cost",
            label: "Prescription",
            kind: .medication,
            amount: MSHFinancialCore.money(from: amount),
            expectedAt: now.addingTimeInterval(86_400),
            status: .confirmed,
            healthRecordID: "medication-record",
            provenance: .manual
        )
    }
}
