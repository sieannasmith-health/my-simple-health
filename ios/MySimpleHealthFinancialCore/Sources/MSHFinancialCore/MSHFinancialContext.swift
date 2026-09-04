import Foundation

public enum MSHFinancialCommitmentKind: String, Codable, CaseIterable, Sendable {
    case housing
    case utilities
    case food
    case transportation
    case insurance
    case healthcare
    case medication
    case debt
    case subscription
    case family
    case petCare = "pet-care"
    case savings
    case other
}

public enum MSHFinancialCommitmentPriority: String, Codable, Sendable {
    case essential
    case planned
    case flexible
}

public enum MSHFinancialCommitmentSource: String, Codable, Sendable {
    case userPlanned = "user-planned"
    case recurringPattern = "recurring-pattern"
    case bill = "bill"
    case prescription = "prescription"
    case appointment = "appointment"
    case insurance = "insurance"
    case receipt = "receipt"
    case manual = "manual"
}

public struct MSHFinancialCommitment: Codable, Equatable, Sendable {
    public let id: String
    public let label: String
    public let amount: MSHMoney
    public let dueAt: Date
    public let kind: MSHFinancialCommitmentKind
    public let priority: MSHFinancialCommitmentPriority
    public let source: MSHFinancialCommitmentSource
    public let sourceRecordID: String?
    public let healthCostID: String?
    public let provenance: MSHFinancialProvenance

    public init(
        id: String,
        label: String,
        amount: MSHMoney,
        dueAt: Date,
        kind: MSHFinancialCommitmentKind,
        priority: MSHFinancialCommitmentPriority = .planned,
        source: MSHFinancialCommitmentSource = .manual,
        sourceRecordID: String? = nil,
        healthCostID: String? = nil,
        provenance: MSHFinancialProvenance = .manual
    ) {
        self.id = id
        self.label = label
        self.amount = amount
        self.dueAt = dueAt
        self.kind = kind
        self.priority = priority
        self.source = source
        self.sourceRecordID = sourceRecordID
        self.healthCostID = healthCostID
        self.provenance = provenance
    }
}

public enum MSHHealthCostKind: String, Codable, CaseIterable, Sendable {
    case insurancePremium = "insurance-premium"
    case medication
    case appointment
    case lab
    case imaging
    case dental
    case vision
    case medicalDevice = "medical-device"
    case supplies
    case other
}

public enum MSHHealthCostStatus: String, Codable, Sendable {
    case expected
    case estimated
    case confirmed
    case paid
}

public struct MSHHealthCost: Codable, Equatable, Sendable {
    public let id: String
    public let label: String
    public let kind: MSHHealthCostKind
    public let amount: MSHMoney
    public let expectedAt: Date?
    public let status: MSHHealthCostStatus
    public let transactionID: String?
    public let receiptID: String?
    public let receiptLineItemID: String?
    public let healthRecordID: String?
    public let provenance: MSHFinancialProvenance

    public init(
        id: String,
        label: String,
        kind: MSHHealthCostKind,
        amount: MSHMoney,
        expectedAt: Date? = nil,
        status: MSHHealthCostStatus = .expected,
        transactionID: String? = nil,
        receiptID: String? = nil,
        receiptLineItemID: String? = nil,
        healthRecordID: String? = nil,
        provenance: MSHFinancialProvenance = .manual
    ) {
        self.id = id
        self.label = label
        self.kind = kind
        self.amount = amount
        self.expectedAt = expectedAt
        self.status = status
        self.transactionID = transactionID
        self.receiptID = receiptID
        self.receiptLineItemID = receiptLineItemID
        self.healthRecordID = healthRecordID
        self.provenance = provenance
    }
}

public enum MSHAffordabilityStatus: String, Codable, Sendable {
    case room
    case tight
    case shortfall
    case unknown
}

public struct MSHAffordabilityThresholds: Codable, Equatable, Sendable {
    public let reserveFraction: Double

    public init(reserveFraction: Double = 0.10) {
        self.reserveFraction = max(0, min(1, reserveFraction))
    }
}

public struct MSHFinancialHorizon: Codable, Equatable, Sendable {
    public let generatedAt: Date
    public let through: Date
    public let monthlyNetIncome: MSHMoney
    public let knownCommitments: MSHMoney
    public let knownHealthCosts: MSHMoney
    public let availableAfterKnownCommitments: MSHMoney
    public let affordability: MSHAffordabilityStatus
    public let commitments: [MSHFinancialCommitment]
    public let healthCosts: [MSHHealthCost]
    public let requiresAttention: Bool

    public var nothingRequiresAction: Bool {
        !requiresAttention
    }
}

public struct MSHSpendingChange: Codable, Equatable, Sendable {
    public let category: MSHFinancialCategory
    public let baseline: MSHMoney
    public let current: MSHMoney
    public let difference: MSHMoney
    public let relativeChange: Double?
}

public struct MSHHealthCostAffordability: Codable, Equatable, Sendable {
    public let cost: MSHHealthCost
    public let availableBeforeCost: MSHMoney
    public let availableAfterCost: MSHMoney
    public let status: MSHAffordabilityStatus
}

public extension MSHFinancialCore {
    static func commitment(
        from pattern: MSHRecurringPattern,
        currency: String = "USD"
    ) -> MSHFinancialCommitment {
        MSHFinancialCommitment(
            id: "commitment|\(pattern.id)|\(pattern.nextExpectedAt.timeIntervalSince1970)",
            label: pattern.merchantName,
            amount: money(from: pattern.typicalAmount, currency: currency),
            dueAt: pattern.nextExpectedAt,
            kind: commitmentKind(for: pattern.category),
            priority: defaultPriority(for: pattern.category),
            source: .recurringPattern,
            sourceRecordID: pattern.id,
            provenance: .inferred
        )
    }

    static func healthCommitment(
        from cost: MSHHealthCost,
        fallbackDate: Date
    ) -> MSHFinancialCommitment {
        MSHFinancialCommitment(
            id: "health-commitment|\(cost.id)",
            label: cost.label,
            amount: cost.amount,
            dueAt: cost.expectedAt ?? fallbackDate,
            kind: cost.kind == .medication ? .medication : .healthcare,
            priority: .essential,
            source: cost.kind == .medication ? .prescription : .appointment,
            sourceRecordID: cost.healthRecordID,
            healthCostID: cost.id,
            provenance: cost.provenance
        )
    }

    static func deriveHorizon(
        monthlyNetIncome: MSHMoney,
        commitments: [MSHFinancialCommitment],
        healthCosts: [MSHHealthCost] = [],
        now: Date = Date(),
        through: Date? = nil,
        thresholds: MSHAffordabilityThresholds = .init()
    ) -> MSHFinancialHorizon {
        let end = through ?? Calendar(identifier: .gregorian).date(byAdding: .day, value: 30, to: now)!
        let currency = monthlyNetIncome.currency
        precondition(commitments.allSatisfy { $0.amount.currency == currency }, "Commitment currency must match income currency")
        precondition(healthCosts.allSatisfy { $0.amount.currency == currency }, "Health-cost currency must match income currency")

        let windowCommitments = commitments
            .filter { $0.dueAt >= now && $0.dueAt <= end }
            .sorted { $0.dueAt < $1.dueAt }

        let commitmentHealthIDs = Set(windowCommitments.compactMap(\.healthCostID))
        let windowHealthCosts = healthCosts
            .filter { cost in
                guard cost.status != .paid else { return false }
                guard let date = cost.expectedAt else { return false }
                return date >= now && date <= end
            }
            .sorted { ($0.expectedAt ?? .distantFuture) < ($1.expectedAt ?? .distantFuture) }

        let commitmentTotal = windowCommitments.reduce(MSHMoney.zero(currency: currency)) { $0 + $1.amount }
        let unlinkedHealthTotal = windowHealthCosts
            .filter { !commitmentHealthIDs.contains($0.id) }
            .reduce(MSHMoney.zero(currency: currency)) { $0 + $1.amount }
        let healthTotal = windowHealthCosts.reduce(MSHMoney.zero(currency: currency)) { $0 + $1.amount }
        let totalKnown = commitmentTotal + unlinkedHealthTotal
        let remaining = monthlyNetIncome - totalKnown
        let status = affordabilityStatus(
            available: remaining,
            referenceIncome: monthlyNetIncome,
            thresholds: thresholds
        )

        return MSHFinancialHorizon(
            generatedAt: now,
            through: end,
            monthlyNetIncome: monthlyNetIncome,
            knownCommitments: totalKnown,
            knownHealthCosts: healthTotal,
            availableAfterKnownCommitments: remaining,
            affordability: status,
            commitments: windowCommitments,
            healthCosts: windowHealthCosts,
            requiresAttention: status == .tight || status == .shortfall
        )
    }

    static func affordability(
        of cost: MSHHealthCost,
        availableBeforeCost: MSHMoney,
        referenceIncome: MSHMoney,
        thresholds: MSHAffordabilityThresholds = .init()
    ) -> MSHHealthCostAffordability {
        precondition(cost.amount.currency == availableBeforeCost.currency, "Health cost and available funds must use the same currency")
        precondition(referenceIncome.currency == availableBeforeCost.currency, "Reference income and available funds must use the same currency")
        let after = availableBeforeCost - cost.amount
        return MSHHealthCostAffordability(
            cost: cost,
            availableBeforeCost: availableBeforeCost,
            availableAfterCost: after,
            status: affordabilityStatus(available: after, referenceIncome: referenceIncome, thresholds: thresholds)
        )
    }

    static func spendingChanges(
        current: [MSHFinancialCategory: Decimal],
        baseline: [MSHFinancialCategory: Decimal],
        currency: String = "USD",
        minimumAbsoluteChange: Decimal = 25,
        minimumRelativeChange: Double = 0.20
    ) -> [MSHSpendingChange] {
        let categories = Set(current.keys).union(baseline.keys)
        return categories.compactMap { category -> MSHSpendingChange? in
            let currentValue = current[category] ?? 0
            let baselineValue = baseline[category] ?? 0
            let delta = currentValue - baselineValue
            let absoluteDelta = abs(NSDecimalNumber(decimal: delta).doubleValue)
            let baselineDouble = abs(NSDecimalNumber(decimal: baselineValue).doubleValue)
            let relative = baselineDouble > 0 ? absoluteDelta / baselineDouble : nil
            let absoluteThreshold = abs(NSDecimalNumber(decimal: minimumAbsoluteChange).doubleValue)
            let passesAbsolute = absoluteDelta >= absoluteThreshold
            let passesRelative = relative.map { $0 >= max(0, minimumRelativeChange) } ?? (absoluteDelta > 0)
            guard passesAbsolute && passesRelative else { return nil }
            return MSHSpendingChange(
                category: category,
                baseline: money(from: baselineValue, currency: currency),
                current: money(from: currentValue, currency: currency),
                difference: money(from: delta, currency: currency),
                relativeChange: relative
            )
        }
        .sorted { abs($0.difference.cents) > abs($1.difference.cents) }
    }

    static func affordabilityStatus(
        available: MSHMoney,
        referenceIncome: MSHMoney,
        thresholds: MSHAffordabilityThresholds = .init()
    ) -> MSHAffordabilityStatus {
        precondition(available.currency == referenceIncome.currency, "Affordability values must use the same currency")
        guard referenceIncome.cents > 0 else { return .unknown }
        if available.cents < 0 { return .shortfall }
        let reserve = Int64((Double(referenceIncome.cents) * thresholds.reserveFraction).rounded())
        if available.cents < reserve { return .tight }
        return .room
    }

    private static func commitmentKind(for category: MSHFinancialCategory) -> MSHFinancialCommitmentKind {
        switch category {
        case .housing: return .housing
        case .household: return .food
        case .transportation: return .transportation
        case .healthcare: return .healthcare
        case .debt: return .debt
        case .subscriptions: return .subscription
        case .family: return .family
        case .pets: return .petCare
        case .savings, .investments: return .savings
        default: return .other
        }
    }

    private static func defaultPriority(for category: MSHFinancialCategory) -> MSHFinancialCommitmentPriority {
        switch category {
        case .housing, .household, .transportation, .healthcare, .debt, .family, .pets:
            return .essential
        case .savings, .investments:
            return .planned
        default:
            return .flexible
        }
    }
}
