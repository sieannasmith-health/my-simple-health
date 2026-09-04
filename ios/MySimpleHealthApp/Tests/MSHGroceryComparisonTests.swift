import XCTest
import MSHFinancialCore
@testable import MySimpleHealth

final class MSHGroceryComparisonTests: XCTestCase {
    func testV1RetailerCoverageMatchesGroceryPrioritySet() {
        XCTAssertEqual(MSHGroceryComparisonModel.retailers, [
            "Costco",
            "Sam’s Club",
            "Target",
            "Kroger",
            "BJ’s Wholesale Club",
            "Aldi",
            "Whole Foods Market",
            "Fresh Thyme Market",
            "The Fresh Market",
            "Niemann Harvest Market"
        ])
    }

    func testEditablePreviewUsesRealComparisonEngine() {
        let drafts = [
            MSHGroceryQuoteDraft(
                channel: .inStore,
                itemTotal: "82.00",
                fees: "0",
                tip: "0",
                travel: "3.50",
                minutes: "55",
                effort: .high
            ),
            MSHGroceryQuoteDraft(
                channel: .pickup,
                itemTotal: "84.00",
                fees: "0",
                tip: "0",
                travel: "3.50",
                minutes: "25",
                effort: .moderate
            ),
            MSHGroceryQuoteDraft(
                channel: .instacart,
                itemTotal: "86.00",
                fees: "7.99",
                tip: "8.00",
                travel: "0",
                minutes: "0",
                effort: .low
            )
        ]

        let result = MSHGroceryComparisonModel.compare(
            retailer: "Kroger",
            drafts: drafts,
            convenienceTolerance: "6.00"
        )

        XCTAssertEqual(result.lowestCost?.channel, .inStore)
        XCTAssertEqual(result.bestOverallValue?.channel, .pickup)
        XCTAssertEqual(result.reason, .bestValueWithinConvenienceTolerance)
        XCTAssertTrue(result.personRetainsDecision)
    }

    func testInvalidItemEstimateIsExcludedRatherThanInventingQuote() {
        let invalid = MSHGroceryQuoteDraft(
            channel: .inStore,
            itemTotal: "",
            fees: "0",
            tip: "0",
            travel: "0",
            minutes: "20",
            effort: .moderate
        )

        let result = MSHGroceryComparisonModel.compare(
            retailer: "Costco",
            drafts: [invalid],
            convenienceTolerance: "5"
        )

        XCTAssertTrue(result.quotes.isEmpty)
        XCTAssertNil(result.bestOverallValue)
        XCTAssertEqual(result.reason, .insufficientVerifiedData)
    }
}
