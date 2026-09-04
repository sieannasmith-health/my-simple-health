import Foundation

public enum MSHAcquisitionChannel: String, Codable, CaseIterable, Sendable {
    case inStore = "in-store"
    case pickup
    case retailerDelivery = "retailer-delivery"
    case instacart
    case doordash
    case uberEats = "uber-eats"
    case otherMarketplace = "other-marketplace"
}

public enum MSHPriceVerificationState: String, Codable, Sendable {
    case verified
    case estimated
    case stale
    case unknown
}

public enum MSHEffortLevel: String, Codable, Comparable, Sendable {
    case low
    case moderate
    case high

    public static func < (lhs: MSHEffortLevel, rhs: MSHEffortLevel) -> Bool {
        rank(lhs) < rank(rhs)
    }

    private static func rank(_ value: MSHEffortLevel) -> Int {
        switch value {
        case .low: return 0
        case .moderate: return 1
        case .high: return 2
        }
    }
}

public struct MSHAcquisitionCostBreakdown: Codable, Equatable, Sendable {
    public let items: MSHMoney
    public let markup: MSHMoney
    public let fees: MSHMoney
    public let tip: MSHMoney
    public let taxes: MSHMoney
    public let travel: MSHMoney
    public let discounts: MSHMoney

    public init(
        items: MSHMoney,
        markup: MSHMoney? = nil,
        fees: MSHMoney? = nil,
        tip: MSHMoney? = nil,
        taxes: MSHMoney? = nil,
        travel: MSHMoney? = nil,
        discounts: MSHMoney? = nil
    ) {
        let currency = items.currency
        self.items = items
        self.markup = markup ?? .zero(currency: currency)
        self.fees = fees ?? .zero(currency: currency)
        self.tip = tip ?? .zero(currency: currency)
        self.taxes = taxes ?? .zero(currency: currency)
        self.travel = travel ?? .zero(currency: currency)
        self.discounts = discounts ?? .zero(currency: currency)
        precondition([self.markup, self.fees, self.tip, self.taxes, self.travel, self.discounts].allSatisfy { $0.currency == currency }, "Acquisition costs must use one currency")
    }

    public var total: MSHMoney {
        items + markup + fees + tip + taxes + travel - discounts
    }
}

public struct MSHAcquisitionQuote: Codable, Equatable, Sendable {
    public let id: String
    public let retailerName: String
    public let storeLocationID: String?
    public let channel: MSHAcquisitionChannel
    public let providerName: String?
    public let basketID: String?
    public let costs: MSHAcquisitionCostBreakdown
    public let roundTripDistanceMiles: Double?
    public let roundTripMinutes: Int?
    public let shoppingMinutes: Int?
    public let effort: MSHEffortLevel
    public let verification: MSHPriceVerificationState
    public let observedAt: Date?
    public let expiresAt: Date?
    public let provenance: MSHFinancialProvenance

    public init(
        id: String,
        retailerName: String,
        storeLocationID: String? = nil,
        channel: MSHAcquisitionChannel,
        providerName: String? = nil,
        basketID: String? = nil,
        costs: MSHAcquisitionCostBreakdown,
        roundTripDistanceMiles: Double? = nil,
        roundTripMinutes: Int? = nil,
        shoppingMinutes: Int? = nil,
        effort: MSHEffortLevel,
        verification: MSHPriceVerificationState,
        observedAt: Date? = nil,
        expiresAt: Date? = nil,
        provenance: MSHFinancialProvenance
    ) {
        self.id = id
        self.retailerName = retailerName
        self.storeLocationID = storeLocationID
        self.channel = channel
        self.providerName = providerName
        self.basketID = basketID
        self.costs = costs
        self.roundTripDistanceMiles = roundTripDistanceMiles
        self.roundTripMinutes = roundTripMinutes
        self.shoppingMinutes = shoppingMinutes
        self.effort = effort
        self.verification = verification
        self.observedAt = observedAt
        self.expiresAt = expiresAt
        self.provenance = provenance
    }

    public var totalMinutes: Int? {
        let travel = roundTripMinutes ?? 0
        let shopping = shoppingMinutes ?? 0
        return (roundTripMinutes == nil && shoppingMinutes == nil) ? nil : travel + shopping
    }
}

public struct MSHAcquisitionComparisonPreferences: Codable, Equatable, Sendable {
    public let maximumExtraSpendForConvenience: MSHMoney?
    public let maximumTotalMinutes: Int?
    public let maximumEffort: MSHEffortLevel?
    public let requireVerifiedPricing: Bool

    public init(
        maximumExtraSpendForConvenience: MSHMoney? = nil,
        maximumTotalMinutes: Int? = nil,
        maximumEffort: MSHEffortLevel? = nil,
        requireVerifiedPricing: Bool = false
    ) {
        self.maximumExtraSpendForConvenience = maximumExtraSpendForConvenience
        self.maximumTotalMinutes = maximumTotalMinutes
        self.maximumEffort = maximumEffort
        self.requireVerifiedPricing = requireVerifiedPricing
    }
}

public enum MSHAcquisitionComparisonReason: String, Codable, Sendable {
    case lowestMonetaryCost = "lowest-monetary-cost"
    case bestValueWithinConvenienceTolerance = "best-value-within-convenience-tolerance"
    case onlyEligibleOption = "only-eligible-option"
    case insufficientVerifiedData = "insufficient-verified-data"
}

public struct MSHAcquisitionComparisonResult: Codable, Equatable, Sendable {
    public let generatedAt: Date
    public let quotes: [MSHAcquisitionQuote]
    public let lowestCost: MSHAcquisitionQuote?
    public let bestOverallValue: MSHAcquisitionQuote?
    public let reason: MSHAcquisitionComparisonReason
    public let comparedCurrency: String?
    public let personRetainsDecision: Bool

    public init(
        generatedAt: Date,
        quotes: [MSHAcquisitionQuote],
        lowestCost: MSHAcquisitionQuote?,
        bestOverallValue: MSHAcquisitionQuote?,
        reason: MSHAcquisitionComparisonReason,
        comparedCurrency: String?,
        personRetainsDecision: Bool = true
    ) {
        self.generatedAt = generatedAt
        self.quotes = quotes
        self.lowestCost = lowestCost
        self.bestOverallValue = bestOverallValue
        self.reason = reason
        self.comparedCurrency = comparedCurrency
        self.personRetainsDecision = personRetainsDecision
    }
}

public extension MSHFinancialCore {
    static func compareAcquisitionOptions(
        _ quotes: [MSHAcquisitionQuote],
        preferences: MSHAcquisitionComparisonPreferences = .init(),
        now: Date = Date()
    ) -> MSHAcquisitionComparisonResult {
        let active = quotes.filter { quote in
            if let expiresAt = quote.expiresAt, expiresAt < now { return false }
            if preferences.requireVerifiedPricing && quote.verification != .verified { return false }
            if let maxMinutes = preferences.maximumTotalMinutes, let minutes = quote.totalMinutes, minutes > maxMinutes { return false }
            if let maxEffort = preferences.maximumEffort, quote.effort > maxEffort { return false }
            return true
        }

        guard let currency = active.first?.costs.total.currency else {
            return MSHAcquisitionComparisonResult(
                generatedAt: now,
                quotes: [],
                lowestCost: nil,
                bestOverallValue: nil,
                reason: .insufficientVerifiedData,
                comparedCurrency: nil
            )
        }

        precondition(active.allSatisfy { $0.costs.total.currency == currency }, "Acquisition quotes must use one currency")

        let sorted = active.sorted {
            if $0.costs.total.cents != $1.costs.total.cents { return $0.costs.total.cents < $1.costs.total.cents }
            let leftMinutes = $0.totalMinutes ?? Int.max
            let rightMinutes = $1.totalMinutes ?? Int.max
            if leftMinutes != rightMinutes { return leftMinutes < rightMinutes }
            return $0.effort < $1.effort
        }

        guard let cheapest = sorted.first else {
            return MSHAcquisitionComparisonResult(
                generatedAt: now,
                quotes: [],
                lowestCost: nil,
                bestOverallValue: nil,
                reason: .insufficientVerifiedData,
                comparedCurrency: currency
            )
        }

        if sorted.count == 1 {
            return MSHAcquisitionComparisonResult(
                generatedAt: now,
                quotes: sorted,
                lowestCost: cheapest,
                bestOverallValue: cheapest,
                reason: .onlyEligibleOption,
                comparedCurrency: currency
            )
        }

        var best = cheapest
        var reason: MSHAcquisitionComparisonReason = .lowestMonetaryCost

        if let tolerance = preferences.maximumExtraSpendForConvenience {
            precondition(tolerance.currency == currency, "Convenience tolerance must match quote currency")
            let ceiling = cheapest.costs.total.cents + max(0, tolerance.cents)
            let candidates = sorted.filter { $0.costs.total.cents <= ceiling }
            if let convenienceWinner = candidates.min(by: { lhs, rhs in
                let leftMinutes = lhs.totalMinutes ?? Int.max
                let rightMinutes = rhs.totalMinutes ?? Int.max
                if leftMinutes != rightMinutes { return leftMinutes < rightMinutes }
                if lhs.effort != rhs.effort { return lhs.effort < rhs.effort }
                return lhs.costs.total.cents < rhs.costs.total.cents
            }) {
                best = convenienceWinner
                if best.id != cheapest.id {
                    reason = .bestValueWithinConvenienceTolerance
                }
            }
        }

        return MSHAcquisitionComparisonResult(
            generatedAt: now,
            quotes: sorted,
            lowestCost: cheapest,
            bestOverallValue: best,
            reason: reason,
            comparedCurrency: currency
        )
    }
}
