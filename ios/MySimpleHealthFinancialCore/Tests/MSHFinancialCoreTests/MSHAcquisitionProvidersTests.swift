import XCTest
@testable import MSHFinancialCore

final class MSHAcquisitionProvidersTests: XCTestCase {
    func testTravelCostUsesRoundTripDistanceFuelEfficiencyAndLocalFuelPrice() {
        let fuel = MSHFuelProfile(
            milesPerGallon: 25,
            fuelPricePerGallon: MSHMoney(cents: 350, currency: "USD")
        )

        let cost = MSHFinancialCore.estimatedTravelCost(
            roundTripDistanceMiles: 10,
            fuel: fuel
        )

        XCTAssertEqual(cost, MSHMoney(cents: 140, currency: "USD"))
    }

    func testTravelCostReturnsNilWhenFuelEfficiencyIsUnknown() {
        let fuel = MSHFuelProfile(
            milesPerGallon: 0,
            fuelPricePerGallon: MSHMoney(cents: 350, currency: "USD")
        )

        XCTAssertNil(
            MSHFinancialCore.estimatedTravelCost(
                roundTripDistanceMiles: 10,
                fuel: fuel
            )
        )
    }

    func testRouteEstimateExposesRoundTripWithoutDuplicatingProviderLogic() {
        let route = MSHRouteEstimate(oneWayDistanceMiles: 6.25, oneWayMinutes: 14)

        XCTAssertEqual(route.roundTripDistanceMiles, 12.5)
        XCTAssertEqual(route.roundTripMinutes, 28)
    }

    func testQuoteRequestKeepsRetailerLocationAndBasketIdentitySeparate() {
        let request = MSHAcquisitionQuoteRequest(
            basketID: "basket-1",
            items: [MSHAcquisitionBasketItem(universalProductCode: "123", name: "Milk", quantity: 1)],
            origin: MSHAcquisitionLocation(latitude: 40.0, longitude: -86.0, postalCode: "46032"),
            store: MSHAcquisitionStoreTarget(
                retailerName: "Kroger",
                storeLocationID: "store-42",
                location: MSHAcquisitionLocation(latitude: 40.1, longitude: -86.1)
            )
        )

        XCTAssertEqual(request.basketID, "basket-1")
        XCTAssertEqual(request.store.retailerName, "Kroger")
        XCTAssertEqual(request.store.storeLocationID, "store-42")
        XCTAssertEqual(request.items.first?.universalProductCode, "123")
    }
}
