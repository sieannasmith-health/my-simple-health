import Foundation

public enum MSHAffordabilityOptionKind: String, Codable, CaseIterable, Sendable {
    case insuranceCoveredAlternative = "insurance-covered-alternative"
    case genericEquivalent = "generic-equivalent"
    case differentPharmacy = "different-pharmacy"
    case mailOrder = "mail-order"
    case manufacturerAssistance = "manufacturer-assistance"
    case nonprofitAssistance = "nonprofit-assistance"
    case cashDiscount = "cash-discount"
    case paymentPlan = "payment-plan"
    case coverageReview = "coverage-review"
    case other
}

public enum MSHAffordabilityOptionAuthority: String, Codable, Sendable {
    case insurer
    case pharmacy
    case manufacturer
    case government
    case nonprofit
    case clinician
    case user
    case other
}

public enum MSHAffordabilityVerificationStatus: String, Codable, Sendable {
    case unverified
    case providerReported = "provider-reported"
    case userConfirmed = "user-confirmed"
    case expired
}

public enum MSHAffordabilityEligibilityStatus: String, Codable, Sendable {
    case unknown
    case potentiallyEligible = "potentially-eligible"
    case eligible
    case ineligible
}

public struct MSHAffordabilityOption: Codable, Equatable, Sendable {
    public let id: String
    public let healthCostID: String
    public let kind: MSHAffordabilityOptionKind
    public let title: String
    public let authority: MSHAffordabilityOptionAuthority
    public let estimatedCost: MSHMoney?
    public let estimatedSavings: MSHMoney?
    public let pharmacyName: String?
    public let requiresPrescriberDecision: Bool
    public let requiresInsuranceReview: Bool
    public let eligibility: MSHAffordabilityEligibilityStatus
    public let verification: MSHAffordabilityVerificationStatus
    public let sourceRecordID: String?
    public let validThrough: Date?
    public let notes: String?

    public init(
        id: String,
        healthCostID: String,
        kind: MSHAffordabilityOptionKind,
        title: String,
        authority: MSHAffordabilityOptionAuthority,
        estimatedCost: MSHMoney? = nil,
        estimatedSavings: MSHMoney? = nil,
        pharmacyName: String? = nil,
        requiresPrescriberDecision: Bool = false,
        requiresInsuranceReview: Bool = false,
        eligibility: MSHAffordabilityEligibilityStatus = .unknown,
        verification: MSHAffordabilityVerificationStatus = .unverified,
        sourceRecordID: String? = nil,
        validThrough: Date? = nil,
        notes: String? = nil
    ) {
        self.id = id
        self.healthCostID = healthCostID
        self.kind = kind
        self.title = title
        self.authority = authority
        self.estimatedCost = estimatedCost
        self.estimatedSavings = estimatedSavings
        self.pharmacyName = pharmacyName
        self.requiresPrescriberDecision = requiresPrescriberDecision
        self.requiresInsuranceReview = requiresInsuranceReview
        self.eligibility = eligibility
        self.verification = verification
        self.sourceRecordID = sourceRecordID
        self.validThrough = validThrough
        self.notes = notes
    }
}

public enum MSHAffordabilityActionOwner: String, Codable, Sendable {
    case person
    case prescriber
    case insurer
    case pharmacy
    case program
}

public struct MSHAffordabilityNextStep: Codable, Equatable, Sendable {
    public let optionID: String
    public let owner: MSHAffordabilityActionOwner
    public let label: String
    public let requiresConsent: Bool

    public init(optionID: String, owner: MSHAffordabilityActionOwner, label: String, requiresConsent: Bool = true) {
        self.optionID = optionID
        self.owner = owner
        self.label = label
        self.requiresConsent = requiresConsent
    }
}

public struct MSHHealthAffordabilityReview: Codable, Equatable, Sendable {
    public let generatedAt: Date
    public let cost: MSHHealthCost
    public let affordability: MSHHealthCostAffordability
    public let options: [MSHAffordabilityOption]
    public let nextSteps: [MSHAffordabilityNextStep]
    public let hasVerifiedLowerCostOption: Bool
    public let bestVerifiedEstimatedCost: MSHMoney?
    public let personRetainsDecision: Bool

    public init(
        generatedAt: Date,
        cost: MSHHealthCost,
        affordability: MSHHealthCostAffordability,
        options: [MSHAffordabilityOption],
        nextSteps: [MSHAffordabilityNextStep],
        hasVerifiedLowerCostOption: Bool,
        bestVerifiedEstimatedCost: MSHMoney?,
        personRetainsDecision: Bool = true
    ) {
        self.generatedAt = generatedAt
        self.cost = cost
        self.affordability = affordability
        self.options = options
        self.nextSteps = nextSteps
        self.hasVerifiedLowerCostOption = hasVerifiedLowerCostOption
        self.bestVerifiedEstimatedCost = bestVerifiedEstimatedCost
        self.personRetainsDecision = personRetainsDecision
    }
}

public extension MSHFinancialCore {
    static func reviewAffordability(
        cost: MSHHealthCost,
        availableBeforeCost: MSHMoney,
        referenceIncome: MSHMoney,
        options: [MSHAffordabilityOption],
        now: Date = Date(),
        thresholds: MSHAffordabilityThresholds = .init()
    ) -> MSHHealthAffordabilityReview {
        let affordability = affordability(
            of: cost,
            availableBeforeCost: availableBeforeCost,
            referenceIncome: referenceIncome,
            thresholds: thresholds
        )

        let usable = options
            .filter { $0.healthCostID == cost.id }
            .filter { option in
                guard option.eligibility != .ineligible else { return false }
                guard option.verification != .expired else { return false }
                if let validThrough = option.validThrough, validThrough < now { return false }
                return true
            }
            .sorted(by: optionSort)

        let verifiedLowerCosts = usable.compactMap { option -> MSHMoney? in
            guard option.verification == .providerReported || option.verification == .userConfirmed else { return nil }
            guard let candidate = option.estimatedCost else { return nil }
            guard candidate.currency == cost.amount.currency, candidate < cost.amount else { return nil }
            return candidate
        }

        let best = verifiedLowerCosts.min()
        let steps = usable.map(nextStep(for:))

        return MSHHealthAffordabilityReview(
            generatedAt: now,
            cost: cost,
            affordability: affordability,
            options: usable,
            nextSteps: steps,
            hasVerifiedLowerCostOption: best != nil,
            bestVerifiedEstimatedCost: best,
            personRetainsDecision: true
        )
    }

    static func normalizedOption(
        _ option: MSHAffordabilityOption,
        against cost: MSHHealthCost
    ) -> MSHAffordabilityOption {
        guard let estimatedCost = option.estimatedCost, estimatedCost.currency == cost.amount.currency else {
            return option
        }
        let savings = estimatedCost < cost.amount ? cost.amount - estimatedCost : MSHMoney.zero(currency: cost.amount.currency)
        return MSHAffordabilityOption(
            id: option.id,
            healthCostID: option.healthCostID,
            kind: option.kind,
            title: option.title,
            authority: option.authority,
            estimatedCost: estimatedCost,
            estimatedSavings: savings,
            pharmacyName: option.pharmacyName,
            requiresPrescriberDecision: option.requiresPrescriberDecision,
            requiresInsuranceReview: option.requiresInsuranceReview,
            eligibility: option.eligibility,
            verification: option.verification,
            sourceRecordID: option.sourceRecordID,
            validThrough: option.validThrough,
            notes: option.notes
        )
    }

    private static func optionSort(_ lhs: MSHAffordabilityOption, _ rhs: MSHAffordabilityOption) -> Bool {
        let leftVerified = verificationRank(lhs.verification)
        let rightVerified = verificationRank(rhs.verification)
        if leftVerified != rightVerified { return leftVerified > rightVerified }

        switch (lhs.estimatedCost, rhs.estimatedCost) {
        case let (left?, right?) where left.currency == right.currency && left != right:
            return left < right
        case (_?, nil):
            return true
        case (nil, _?):
            return false
        default:
            return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
        }
    }

    private static func verificationRank(_ status: MSHAffordabilityVerificationStatus) -> Int {
        switch status {
        case .userConfirmed: return 3
        case .providerReported: return 2
        case .unverified: return 1
        case .expired: return 0
        }
    }

    private static func nextStep(for option: MSHAffordabilityOption) -> MSHAffordabilityNextStep {
        if option.requiresPrescriberDecision {
            return MSHAffordabilityNextStep(
                optionID: option.id,
                owner: .prescriber,
                label: "Discuss this option with the prescriber"
            )
        }
        if option.requiresInsuranceReview || option.kind == .coverageReview || option.kind == .insuranceCoveredAlternative {
            return MSHAffordabilityNextStep(
                optionID: option.id,
                owner: .insurer,
                label: "Review coverage and current out-of-pocket cost"
            )
        }
        switch option.kind {
        case .differentPharmacy, .cashDiscount, .mailOrder:
            return MSHAffordabilityNextStep(
                optionID: option.id,
                owner: .person,
                label: "Compare this price before choosing where to fill"
            )
        case .manufacturerAssistance, .nonprofitAssistance:
            return MSHAffordabilityNextStep(
                optionID: option.id,
                owner: .program,
                label: "Review eligibility and application requirements"
            )
        case .paymentPlan:
            return MSHAffordabilityNextStep(
                optionID: option.id,
                owner: .person,
                label: "Review payment terms before enrolling"
            )
        default:
            return MSHAffordabilityNextStep(
                optionID: option.id,
                owner: .person,
                label: "Review this option"
            )
        }
    }
}
