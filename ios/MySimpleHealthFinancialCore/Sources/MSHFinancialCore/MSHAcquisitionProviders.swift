import Foundation

public struct MSHAcquisitionBasketItem: Codable, Equatable, Sendable {
    public let productID: String?
    public let universalProductCode: String?
    public let name: String
    public let quantity: Decimal
    public let unit: String?

    public init(
        productID: String? = nil,
        universalProductCode: String? = nil,
        name: String,
        quantity: Decimal = 1,
        unit: String? = nil
    ) {
        self.productID = productID
        self.universalProductCode = universalProductCode
        self.name = name
        self.quantity = quantity
        self.unit = unit
    }
}

public struct MSHAcquisitionLocation: Codable, Equatable, Sendable {
    public let latitude: Double
    public let longitude: Double
    public let postalCode: String?

    public init(latitude: Double, longitude: Double, postalCode: String? = nil) {
        self.latitude = latitude
        self.longitude = longitude
        self.postalCode = postalCode
    }
}

public struct MSHAcquisitionStoreTarget: Codable, Equatable, Sendable {
    public let retailerName: String
    public let storeLocationID: String?
    public let location: MSHAcquisitionLocation?

    public init(
        retailerName: String,
        storeLocationID: String? = nil,
        location: MSHAcquisitionLocation? = nil
    ) {
        self.retailerName = retailerName
        self.storeLocationID = storeLocationID
        self.location = location
    }
}

public struct MSHAcquisitionQuoteRequest: Codable, Equatable, Sendable {
    public let basketID: String
    public let items: [MSHAcquisitionBasketItem]
    public let origin: MSHAcquisitionLocation?
    public let store: MSHAcquisitionStoreTarget
    public let currency: String

    public init(
        basketID: String,
        items: [MSHAcquisitionBasketItem],
        origin: MSHAcquisitionLocation? = nil,
        store: MSHAcquisitionStoreTarget,
        currency: String = "USD"
    ) {
        self.basketID = basketID
        self.items = items
        self.origin = origin
        self.store = store
        self.currency = currency
    }
}

public enum MSHAcquisitionProviderKind: String, Codable, CaseIterable, Sendable {
    case retailerDirect = "retailer-direct"
    case instacart
    case doordash
    case uberEats = "uber-eats"
    case route
    case fuel
}

public struct MSHAcquisitionProviderCapability: Codable, Equatable, Sendable {
    public let provider: MSHAcquisitionProviderKind
    public let channels: [MSHAcquisitionChannel]
    public let supportsStoreSpecificPricing: Bool
    public let supportsInventoryAvailability: Bool
    public let supportsFees: Bool
    public let supportsPromotions: Bool
    public let requiresPartnerApproval: Bool

    public init(
        provider: MSHAcquisitionProviderKind,
        channels: [MSHAcquisitionChannel],
        supportsStoreSpecificPricing: Bool,
        supportsInventoryAvailability: Bool,
        supportsFees: Bool,
        supportsPromotions: Bool,
        requiresPartnerApproval: Bool
    ) {
        self.provider = provider
        self.channels = channels
        self.supportsStoreSpecificPricing = supportsStoreSpecificPricing
        self.supportsInventoryAvailability = supportsInventoryAvailability
        self.supportsFees = supportsFees
        self.supportsPromotions = supportsPromotions
        self.requiresPartnerApproval = requiresPartnerApproval
    }
}

public protocol MSHAcquisitionQuoteProvider: Sendable {
    var providerName: String { get }
    var capability: MSHAcquisitionProviderCapability { get }

    func quotes(for request: MSHAcquisitionQuoteRequest) async throws -> [MSHAcquisitionQuote]
}

public struct MSHRouteEstimate: Codable, Equatable, Sendable {
    public let oneWayDistanceMiles: Double
    public let oneWayMinutes: Int

    public init(oneWayDistanceMiles: Double, oneWayMinutes: Int) {
        self.oneWayDistanceMiles = max(0, oneWayDistanceMiles)
        self.oneWayMinutes = max(0, oneWayMinutes)
    }

    public var roundTripDistanceMiles: Double { oneWayDistanceMiles * 2 }
    public var roundTripMinutes: Int { oneWayMinutes * 2 }
}

public protocol MSHRouteEstimateProvider: Sendable {
    func route(from origin: MSHAcquisitionLocation, to destination: MSHAcquisitionLocation) async throws -> MSHRouteEstimate
}

public struct MSHFuelProfile: Codable, Equatable, Sendable {
    public let milesPerGallon: Double
    public let fuelPricePerGallon: MSHMoney

    public init(milesPerGallon: Double, fuelPricePerGallon: MSHMoney) {
        self.milesPerGallon = max(0, milesPerGallon)
        self.fuelPricePerGallon = fuelPricePerGallon
    }
}

public extension MSHFinancialCore {
    static func estimatedTravelCost(
        roundTripDistanceMiles: Double,
        fuel: MSHFuelProfile
    ) -> MSHMoney? {
        guard roundTripDistanceMiles >= 0, fuel.milesPerGallon > 0 else { return nil }
        let gallons = Decimal(roundTripDistanceMiles / fuel.milesPerGallon)
        let cents = Decimal(fuel.fuelPricePerGallon.cents) * gallons
        let rounded = NSDecimalNumber(decimal: cents).rounding(
            accordingToBehavior: NSDecimalNumberHandler(
                roundingMode: .plain,
                scale: 0,
                raiseOnExactness: false,
                raiseOnOverflow: false,
                raiseOnUnderflow: false,
                raiseOnDivideByZero: false
            )
        ).int64Value
        return MSHMoney(cents: rounded, currency: fuel.fuelPricePerGallon.currency)
    }
}
