import Foundation

public enum MSHFinancialCategory: String, Codable, CaseIterable, Sendable {
    case income = "Income"
    case housing = "Housing"
    case household = "Food & household"
    case transportation = "Transportation"
    case healthcare = "Insurance & healthcare"
    case family = "Family & children"
    case pets = "Pets"
    case personal = "Personal & lifestyle"
    case debt = "Debt"
    case savings = "Emergency savings"
    case investments = "Investments"
    case subscriptions = "Subscriptions"
    case transfer = "Transfer"
    case other = "Other"
}

public enum MSHTransactionDirection: String, Codable, Sendable {
    case credit
    case debit
}

public enum MSHTransactionStatus: String, Codable, Sendable {
    case pending
    case posted
}

public struct MSHFinancialAccount: Codable, Equatable, Sendable {
    public let schemaVersion: Int
    public let id: String
    public let source: String
    public let externalID: String?
    public let name: String
    public let type: String
    public let balance: Decimal
    public let currency: String
    public let isLiability: Bool

    public init(
        schemaVersion: Int = 1,
        id: String,
        source: String,
        externalID: String? = nil,
        name: String,
        type: String,
        balance: Decimal,
        currency: String = "USD",
        isLiability: Bool
    ) {
        self.schemaVersion = schemaVersion
        self.id = id
        self.source = source
        self.externalID = externalID
        self.name = name
        self.type = type
        self.balance = balance
        self.currency = currency
        self.isLiability = isLiability
    }
}

public struct MSHFinancialTransaction: Codable, Equatable, Sendable {
    public let schemaVersion: Int
    public let id: String
    public let source: String
    public let externalID: String?
    public let accountID: String?
    public var merchantName: String
    public var merchantKey: String
    public let rawDescription: String
    public let amount: Decimal
    public let direction: MSHTransactionDirection
    public let currency: String
    public let occurredAt: Date?
    public let postedAt: Date?
    public let status: MSHTransactionStatus
    public var category: MSHFinancialCategory?
    public var categorySource: String?
    public var recurring: Bool
    public var excludeFromSpending: Bool
    public var matchedRuleIDs: [String]

    public init(
        schemaVersion: Int = 1,
        id: String,
        source: String,
        externalID: String? = nil,
        accountID: String? = nil,
        merchantName: String,
        merchantKey: String,
        rawDescription: String,
        amount: Decimal,
        direction: MSHTransactionDirection,
        currency: String = "USD",
        occurredAt: Date? = nil,
        postedAt: Date? = nil,
        status: MSHTransactionStatus = .posted,
        category: MSHFinancialCategory? = nil,
        categorySource: String? = nil,
        recurring: Bool = false,
        excludeFromSpending: Bool = false,
        matchedRuleIDs: [String] = []
    ) {
        self.schemaVersion = schemaVersion
        self.id = id
        self.source = source
        self.externalID = externalID
        self.accountID = accountID
        self.merchantName = merchantName
        self.merchantKey = merchantKey
        self.rawDescription = rawDescription
        self.amount = amount
        self.direction = direction
        self.currency = currency
        self.occurredAt = occurredAt
        self.postedAt = postedAt
        self.status = status
        self.category = category
        self.categorySource = categorySource
        self.recurring = recurring
        self.excludeFromSpending = excludeFromSpending
        self.matchedRuleIDs = matchedRuleIDs
    }
}

public struct MSHFinancialRule: Codable, Equatable, Sendable {
    public let id: String
    public let priority: Int
    public let enabled: Bool
    public let merchantContains: String?
    public let direction: MSHTransactionDirection?
    public let accountID: String?
    public let minAmount: Decimal?
    public let maxAmount: Decimal?
    public let category: MSHFinancialCategory?
    public let renameMerchant: String?
    public let recurring: Bool?
    public let excludeFromSpending: Bool?
    public let shouldStop: Bool

    public init(
        id: String,
        priority: Int = 0,
        enabled: Bool = true,
        merchantContains: String? = nil,
        direction: MSHTransactionDirection? = nil,
        accountID: String? = nil,
        minAmount: Decimal? = nil,
        maxAmount: Decimal? = nil,
        category: MSHFinancialCategory? = nil,
        renameMerchant: String? = nil,
        recurring: Bool? = nil,
        excludeFromSpending: Bool? = nil,
        shouldStop: Bool = true
    ) {
        self.id = id
        self.priority = priority
        self.enabled = enabled
        self.merchantContains = merchantContains
        self.direction = direction
        self.accountID = accountID
        self.minAmount = minAmount
        self.maxAmount = maxAmount
        self.category = category
        self.renameMerchant = renameMerchant
        self.recurring = recurring
        self.excludeFromSpending = excludeFromSpending
        self.shouldStop = shouldStop
    }
}

public struct MSHRecurringPattern: Codable, Equatable, Sendable {
    public let id: String
    public let merchantName: String
    public let accountID: String?
    public let category: MSHFinancialCategory
    public let cadence: String
    public let typicalAmount: Decimal
    public let lastObservedAt: Date
    public let nextExpectedAt: Date
    public let occurrenceCount: Int
    public let confidence: Double
}

public struct MSHFinancialTotals: Codable, Equatable, Sendable {
    public let income: Decimal
    public let expenses: Decimal
    public let cashFlow: Decimal
    public let recurringMonthly: Decimal
    public let assets: Decimal
    public let liabilities: Decimal
    public let netWorth: Decimal
}

public struct MSHDerivedFinancialState: Codable, Equatable, Sendable {
    public let schemaVersion: Int
    public let generatedAt: Date
    public let accounts: [MSHFinancialAccount]
    public let transactions: [MSHFinancialTransaction]
    public let recurringPatterns: [MSHRecurringPattern]
    public let upcomingRecurring: [MSHRecurringPattern]
    public let totals: MSHFinancialTotals
    public let spendByCategory: [MSHFinancialCategory: Decimal]
}

public struct MSHPlannedExpense: Codable, Equatable, Sendable {
    public let id: String
    public let module: String
    public let label: String
    public let amount: Decimal
    public let type: String
    public let provenance: String

    public init(id: String, module: String, label: String, amount: Decimal, type: String, provenance: String = "user-planned") {
        self.id = id
        self.module = module
        self.label = label
        self.amount = amount
        self.type = type
        self.provenance = provenance
    }
}

public struct MSHFinancialPlanningState: Codable, Equatable, Sendable {
    public let schemaVersion: Int
    public let provenance: String
    public let monthlyNetIncome: Decimal
    public let monthlyExpenses: Decimal
    public let availableToDirect: Decimal
    public let annualizedExpenses: Decimal
    public let expenses: [MSHPlannedExpense]
}

public enum MSHFinancialCore {
    public static let version = 1

    public static func normalizeMerchant(_ value: String) -> String {
        value
            .lowercased()
            .replacingOccurrences(of: #"\b(pos|debit|credit|purchase|payment|online|pending)\b"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"[#*]\w+"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"\d{3,}"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"[^a-z0-9&+.' -]"#, with: " ", options: .regularExpression)
            .split(whereSeparator: { $0.isWhitespace })
            .joined(separator: " ")
    }

    public static func deduplicate(_ transactions: [MSHFinancialTransaction]) -> [MSHFinancialTransaction] {
        var byID: [String: MSHFinancialTransaction] = [:]
        for transaction in transactions {
            if let prior = byID[transaction.id] {
                if prior.status == .pending && transaction.status == .posted {
                    byID[transaction.id] = transaction
                }
            } else {
                byID[transaction.id] = transaction
            }
        }
        return byID.values.sorted { ($0.occurredAt ?? .distantPast) < ($1.occurredAt ?? .distantPast) }
    }

    public static func classify(_ transaction: MSHFinancialTransaction, rules: [MSHFinancialRule] = []) -> MSHFinancialTransaction {
        var result = transaction

        for rule in rules.sorted(by: { $0.priority > $1.priority }) where rule.enabled && matches(rule, transaction: result) {
            result.matchedRuleIDs.append(rule.id)
            if let rename = rule.renameMerchant {
                result.merchantName = rename
                result.merchantKey = normalizeMerchant(rename)
            }
            if let category = rule.category {
                result.category = category
                result.categorySource = "user-rule"
            }
            if let recurring = rule.recurring { result.recurring = recurring }
            if let excluded = rule.excludeFromSpending { result.excludeFromSpending = excluded }
            if rule.shouldStop { break }
        }

        guard result.category == nil else { return result }
        if result.direction == .credit {
            result.category = .income
            result.categorySource = "inferred"
            return result
        }

        let text = "\(result.merchantKey) \(result.rawDescription.lowercased())"
        let hints: [(MSHFinancialCategory, [String])] = [
            (.housing, ["mortgage", "rent", "hoa", "property tax"]),
            (.household, ["grocery", "kroger", "meijer", "costco", "sams club", "sam's club", "trader joe", "whole foods"]),
            (.transportation, ["shell", "exxon", "chevron", "uber", "lyft", "parking", "toll"]),
            (.healthcare, ["pharmacy", "cvs", "walgreens", "hospital", "medical", "dental", "vision", "insurance"]),
            (.pets, ["petco", "petsmart", "veterinary", "chewy"]),
            (.debt, ["student loan", "loan payment", "credit card payment"]),
            (.investments, ["fidelity", "vanguard", "schwab", "401k", "401(k)", "ira contribution"]),
            (.subscriptions, ["netflix", "spotify", "hulu", "disney+", "icloud", "apple.com/bill", "youtube premium"])
        ]

        if let match = hints.first(where: { entry in entry.1.contains(where: text.contains) }) {
            result.category = match.0
            result.categorySource = "inferred"
        } else {
            result.category = .other
            result.categorySource = "fallback"
        }
        return result
    }

    public static func detectRecurringPatterns(_ transactions: [MSHFinancialTransaction], rules: [MSHFinancialRule] = [], minimumOccurrences: Int = 3) -> [MSHRecurringPattern] {
        let classifiedTransactions: [MSHFinancialTransaction] = transactions.map { transaction in
            classify(transaction, rules: rules)
        }

        let eligibleTransactions: [MSHFinancialTransaction] = classifiedTransactions.filter { transaction in
            transaction.status == MSHTransactionStatus.posted &&
            transaction.direction == MSHTransactionDirection.debit &&
            transaction.occurredAt != nil
        }

        var grouped: [String: [MSHFinancialTransaction]] = [:]
        for transaction in eligibleTransactions {
            let accountKey = transaction.accountID ?? "any"
            let key = "\(accountKey)|\(transaction.merchantKey)"
            grouped[key, default: []].append(transaction)
        }

        var patterns: [MSHRecurringPattern] = []
        let requiredOccurrences = Swift.max(2, minimumOccurrences)

        for group in grouped.values {
            guard group.count >= requiredOccurrences else { continue }

            let sorted: [MSHFinancialTransaction] = group.sorted { lhs, rhs in
                let lhsDate: Date = lhs.occurredAt ?? Date.distantPast
                let rhsDate: Date = rhs.occurredAt ?? Date.distantPast
                return lhsDate < rhsDate
            }

            var dates: [Date] = []
            dates.reserveCapacity(sorted.count)
            for transaction in sorted {
                guard let date = transaction.occurredAt else {
                    dates.removeAll()
                    break
                }
                dates.append(date)
            }
            guard dates.count == sorted.count else { continue }

            var intervals: [Double] = []
            if dates.count > 1 {
                intervals.reserveCapacity(dates.count - 1)
                for index in 1..<dates.count {
                    let days = dates[index].timeIntervalSince(dates[index - 1]) / 86_400.0
                    intervals.append(days)
                }
            }

            let medianInterval: Double = median(intervals)
            guard let cadence = cadence(for: medianInterval) else { continue }

            let amounts: [Double] = sorted.map { transaction in
                NSDecimalNumber(decimal: transaction.amount).doubleValue
            }
            let typical: Double = median(amounts)
            guard typical > 0 else { continue }

            var typicalDecimal = Decimal(typical)
            var roundedTypical = Decimal()
            NSDecimalRound(&roundedTypical, &typicalDecimal, 2, .plain)

            let amountErrors: [Double] = amounts.map { amount in
                abs(amount - typical) / typical
            }
            let maxError: Double = amountErrors.max() ?? 0
            guard maxError <= 0.18 else { continue }
            guard let last = sorted.last, let lastDate = last.occurredAt else { continue }

            let next = lastDate.addingTimeInterval(cadence.days * 86_400.0)
            let confidence = Swift.max(0.0, Swift.min(1.0, 1.0 - cadence.error - Swift.min(maxError, 0.5)))

            patterns.append(MSHRecurringPattern(
                id: "recurring|\(last.accountID ?? "any")|\(last.merchantKey)|\(cadence.name)",
                merchantName: last.merchantName,
                accountID: last.accountID,
                category: last.category ?? MSHFinancialCategory.other,
                cadence: cadence.name,
                typicalAmount: roundedTypical,
                lastObservedAt: lastDate,
                nextExpectedAt: next,
                occurrenceCount: sorted.count,
                confidence: confidence
            ))
        }

        return patterns.sorted { lhs, rhs in
            lhs.nextExpectedAt < rhs.nextExpectedAt
        }
    }

    public static func deriveFinancialState(
        accounts: [MSHFinancialAccount],
        transactions: [MSHFinancialTransaction],
        rules: [MSHFinancialRule] = [],
        now: Date = Date()
    ) -> MSHDerivedFinancialState {
        let classified = deduplicate(transactions).map { classify($0, rules: rules) }
        let posted = classified.filter { $0.status == .posted }
        let spendable = posted.filter { !$0.excludeFromSpending && $0.category != .transfer }
        let income = spendable.filter { $0.direction == .credit }.reduce(Decimal.zero) { $0 + $1.amount }
        let expenses = spendable.filter { $0.direction == .debit }.reduce(Decimal.zero) { $0 + $1.amount }
        let patterns = detectRecurringPatterns(classified, rules: rules)
        let recurringMonthly = patterns.reduce(Decimal.zero) { $0 + monthlyEquivalent($1) }
        let assets = accounts.filter { !$0.isLiability }.reduce(Decimal.zero) { $0 + $1.balance }
        let liabilities = accounts.filter { account in account.isLiability }.reduce(Decimal.zero) { $0 + abs($1.balance) }
        let horizon = now.addingTimeInterval(45 * 86_400)
        let upcoming = patterns.filter { $0.nextExpectedAt >= now && $0.nextExpectedAt <= horizon }
        var spendByCategory: [MSHFinancialCategory: Decimal] = [:]
        for tx in spendable where tx.direction == .debit {
            spendByCategory[tx.category ?? .other, default: 0] += tx.amount
        }

        return MSHDerivedFinancialState(
            schemaVersion: version,
            generatedAt: now,
            accounts: accounts,
            transactions: classified,
            recurringPatterns: patterns,
            upcomingRecurring: upcoming,
            totals: MSHFinancialTotals(
                income: income,
                expenses: expenses,
                cashFlow: income - expenses,
                recurringMonthly: recurringMonthly,
                assets: assets,
                liabilities: liabilities,
                netWorth: assets - liabilities
            ),
            spendByCategory: spendByCategory
        )
    }

    public static func derivePlanningState(monthlyNetIncome: Decimal, expenses: [MSHPlannedExpense], enabledModules: Set<String> = []) -> MSHFinancialPlanningState {
        let active = expenses.filter { enabledModules.isEmpty || enabledModules.contains($0.module) }
        let monthlyExpenses = active.reduce(Decimal.zero) { $0 + max(0, $1.amount) }
        return MSHFinancialPlanningState(
            schemaVersion: version,
            provenance: "user-planned",
            monthlyNetIncome: max(0, monthlyNetIncome),
            monthlyExpenses: monthlyExpenses,
            availableToDirect: max(0, monthlyNetIncome) - monthlyExpenses,
            annualizedExpenses: monthlyExpenses * 12,
            expenses: active
        )
    }

    private static func matches(_ rule: MSHFinancialRule, transaction: MSHFinancialTransaction) -> Bool {
        if let merchant = rule.merchantContains, !transaction.merchantKey.contains(normalizeMerchant(merchant)) { return false }
        if let direction = rule.direction, transaction.direction != direction { return false }
        if let accountID = rule.accountID, transaction.accountID != accountID { return false }
        if let minAmount = rule.minAmount, transaction.amount < minAmount { return false }
        if let maxAmount = rule.maxAmount, transaction.amount > maxAmount { return false }
        return true
    }

    private static func cadence(for days: Double) -> (name: String, days: Double, error: Double)? {
        let candidates: [(String, Double)] = [("weekly", 7), ("biweekly", 14), ("monthly", 30.4375), ("quarterly", 91.3125), ("annual", 365.25)]
        let scored = candidates.map { candidate in (candidate.0, candidate.1, abs(days - candidate.1) / candidate.1) }
        guard let best = scored.min(by: { $0.2 < $1.2 }), best.2 <= 0.22 else { return nil }
        return best
    }

    private static func median(_ values: [Double]) -> Double {
        guard !values.isEmpty else { return 0 }
        let sorted = values.sorted()
        let middle = sorted.count / 2
        return sorted.count.isMultiple(of: 2) ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
    }

    private static func monthlyEquivalent(_ pattern: MSHRecurringPattern) -> Decimal {
        switch pattern.cadence {
        case "weekly": return pattern.typicalAmount * Decimal(52.0 / 12.0)
        case "biweekly": return pattern.typicalAmount * Decimal(26.0 / 12.0)
        case "monthly": return pattern.typicalAmount
        case "quarterly": return pattern.typicalAmount / 3
        case "annual": return pattern.typicalAmount / 12
        default: return 0
        }
    }
}
