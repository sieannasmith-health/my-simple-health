import XCTest
@testable import MSHFinancialCore

final class MSHAcquisitionComparisonTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_800_000_000)

    func testLowestCostIncludesTravelFeesTipTaxAndDiscounts() {
        let inStore = quote(
            id: "store",
            channel: .inStore,
            costs: .init(
                items: .init(cents: 6_400),
                travel: .init(cents: 500)
            ),
            minutes: 55,
            effort: .high
        )
        let delivery = quote(
            id: "delivery",
            channel: .instacart,
            provider: "Instacart",
            costs: .init(
                items: .init(cents: 6_600),
                markup: .init(cents: 300),
                fees: .init(cents: 400),
                tip: .init(cents: 800),
                taxes: .init(cents: 200),
                discounts: .init(cents: 300)
            ),
            minutes: 0,
            effort: .low
        )

        let result = MSHFinancialCore.compareAcquisitionOptions([delivery, inStore], now: now)

        XCTAssertEqual(inStore.costs.total.cents, 6_900)
        XCTAssertEqual(delivery.costs.total.cents, 8_000)
        XCTAssertEqual(result.lowestCost?.id, "store")
        XCTAssertEqual(result.bestOverallValue?.id, "store")
        XCTAssertEqual(result.reason, .lowestMonetaryCost)
    }

    func testConvenienceToleranceCanChooseDeliveryWithoutPricingTimeInDollars() {
        let pickup = quote(
            id: "pickup",
            channel: .pickup,
            costs: .init(items: .init(cents: 7_100), travel: .init(cents: 300)),
            minutes: 30,
            effort: .moderate
        )
        let delivery = quote(
            id: "delivery",
            channel: .doordash,
            provider: "DoorDash",
            costs: .init(items: .init(cents: 7_200), fees: .init(cents: 250), tip: .init(cents: 500)),
            minutes: 0,
            effort: .low
        )

        let result = MSHFinancialCore.compareAcquisitionOptions(
            [pickup, delivery],
            preferences: .init(maximumExtraSpendForConvenience: .init(cents: 600)),
            now: now
        )

        XCTAssertEqual(pickup.costs.total.cents, 7_400)
        XCTAssertEqual(delivery.costs.total.cents, 7_950)
        XCTAssertEqual(result.lowestCost?.id, "pickup")
        XCTAssertEqual(result.bestOverallValue?.id, "delivery")
        XCTAssertEqual(result.reason, .bestValueWithinConvenienceTolerance)
        XCTAssertTrue(result.personRetainsDecision)
    }

    func testVerifiedPricingRequirementFiltersEstimatedMarketplaceQuote() {
        let verifiedStore = quote(
            id: "verified-store",
            channel: .inStore,
            costs: .init(items: .init(cents: 8_000)),
            minutes: 40,
            effort: .high,
            verification: .verified
        )
        let estimatedDelivery = quote(
            id: "estimated-delivery",
            channel: .uberEats,
            provider: "Uber Eats",
            costs: .init(items: .init(cents: 7_000)),
            minutes: 0,
            effort: .low,
            verification: .estimated
        )

        let result = MSHFinancialCore.compareAcquisitionOptions(
            [estimatedDelivery, verifiedStore],
            preferences: .init(requireVerifiedPricing: true),
            now: now
        )

        XCTAssertEqual(result.quotes.map(\.id), ["verified-store"])
        XCTAssertEqual(result.bestOverallValue?.id, "verified-store")
        XCTAssertEqual(result.reason, .onlyEligibleOption)
    }

    func testExpiredQuoteIsRemoved() {
        let expired = MSHAcquisitionQuote(
            id: "expired",
            retailerName: "Kroger",
            channel: .instacart,
            providerName: "Instacart",
            costs: .init(items: .init(cents: 5_000)),
            roundTripMinutes: 0,
            shoppingMinutes: 0,
            effort: .low,
            verification: .verified,
            observedAt: now.addingTimeInterval(-3_600),
            expiresAt: now.addingTimeInterval(-60),
            provenance: .retailerReceipt
        )
        let current = quote(
            id: "current",
            channel: .pickup,
            costs: .init(items: .init(cents: 5_500)),
            minutes: 20,
            effort: .moderate
        )

        let result = MSHFinancialCore.compareAcquisitionOptions([expired, current], now: now)

        XCTAssertEqual(result.quotes.map(\.id), ["current"])
        XCTAssertEqual(result.lowestCost?.id, "current")
    }

    func testMaximumTimeAndEffortCanExpressContextWithoutChangingMoney() {
        let cheapHighBurden = quote(
            id: "cheap-high-burden",
            channel: .inStore,
            costs: .init(items: .init(cents: 6_000), travel: .init(cents: 200)),
            minutes: 75,
            effort: .high
        )
        let pickup = quote(
            id: "pickup",
            channel: .pickup,
            costs: .init(items: .init(cents: 6_500), travel: .init(cents: 200)),
            minutes: 25,
            effort: .moderate
        )

        let result = MSHFinancialCore.compareAcquisitionOptions(
            [cheapHighBurden, pickup],
            preferences: .init(maximumTotalMinutes: 30, maximumEffort: .moderate),
            now: now
        )

        XCTAssertEqual(result.quotes.map(\.id), ["pickup"])
        XCTAssertEqual(result.bestOverallValue?.id, "pickup")
        XCTAssertEqual(pickup.costs.total.cents, 6_700)
    }

    func testNoEligibleQuotesDoesNotManufactureRecommendation() {
        let stale = quote(
            id: "stale",
            channel: .instacart,
            provider: "Instacart",
            costs: .init(items: .init(cents: 6_000)),
            minutes: 0,
            effort: .low,
            verification: .stale
        )

        let result = MSHFinancialCore.compareAcquisitionOptions(
            [stale],
            preferences: .init(requireVerifiedPricing: true),
            now: now
        )

        XCTAssertNil(result.lowestCost)
        XCTAssertNil(result.bestOverallValue)
        XCTAssertEqual(result.reason, .insufficientVerifiedData)
    }

    private func quote(
        id: String,
        channel: MSHAcquisitionChannel,
        provider: String? = nil,
        costs: MSHAcquisitionCostBreakdown,
        minutes: Int,
        effort: MSHEffortLevel,
        verification: MSHPriceVerificationState = .verified
    ) -> MSHAcquisitionQuote {
        MSHAcquisitionQuote(
            id: id,
            retailerName: "Kroger",
            storeLocationID: "kroger-001",
            channel: channel,
            providerName: provider,
            basketID: "basket-1",
            costs: costs,
            roundTripMinutes: minutes,
            shoppingMinutes: 0,
            effort: effort,
            verification: verification,
            observedAt: now,
            provenance: .manual
        )
    }
}
