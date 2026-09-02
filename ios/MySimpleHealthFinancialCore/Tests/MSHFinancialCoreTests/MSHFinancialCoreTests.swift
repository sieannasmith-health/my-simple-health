import XCTest
@testable import MSHFinancialCore

final class MSHFinancialCoreTests: XCTestCase {
    private let calendar = Calendar(identifier: .gregorian)

    func testUserRuleOutranksInference() {
        let transaction = makeTransaction(id: "1", merchant: "Costco Wholesale", amount: 83, date: date(2026, 8, 20))
        let rule = MSHFinancialRule(
            id: "rule-personal",
            priority: 100,
            merchantContains: "Costco",
            category: .personal
        )

        let classified = MSHFinancialCore.classify(transaction, rules: [rule])

        XCTAssertEqual(classified.category, .personal)
        XCTAssertEqual(classified.categorySource, "user-rule")
        XCTAssertEqual(classified.matchedRuleIDs, ["rule-personal"])
    }

    func testDeduplicationPrefersPostedRecord() {
        let pending = makeTransaction(id: "same", merchant: "Utility", amount: 100, date: date(2026, 8, 1), status: .pending)
        let posted = makeTransaction(id: "same", merchant: "Utility", amount: 100, date: date(2026, 8, 1), status: .posted)

        let result = MSHFinancialCore.deduplicate([pending, posted])

        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result.first?.status, .posted)
    }

    func testDetectsMonthlyRecurringPattern() {
        let transactions = [
            makeTransaction(id: "n1", merchant: "Netflix", amount: 24.99, date: date(2026, 6, 4), accountID: "card"),
            makeTransaction(id: "n2", merchant: "Netflix", amount: 24.99, date: date(2026, 7, 4), accountID: "card"),
            makeTransaction(id: "n3", merchant: "Netflix", amount: 24.99, date: date(2026, 8, 4), accountID: "card")
        ]

        let recurring = MSHFinancialCore.detectRecurringPatterns(transactions)

        XCTAssertEqual(recurring.count, 1)
        XCTAssertEqual(recurring.first?.cadence, "monthly")
        XCTAssertEqual(recurring.first?.typicalAmount, Decimal(string: "24.99"))
        XCTAssertGreaterThan(recurring.first?.confidence ?? 0, 0.7)
    }

    func testDerivesCashFlowSpendingAndNetWorth() {
        let accounts = [
            MSHFinancialAccount(id: "checking", source: "manual", name: "Checking", type: "checking", balance: 4200, isLiability: false),
            MSHFinancialAccount(id: "card", source: "manual", name: "Card", type: "credit", balance: 1100, isLiability: true),
            MSHFinancialAccount(id: "investments", source: "manual", name: "Investments", type: "investment", balance: 18000, isLiability: false)
        ]
        let transactions = [
            makeTransaction(id: "pay", merchant: "Payroll", amount: 5000, date: date(2026, 8, 30), direction: .credit),
            makeTransaction(id: "grocery", merchant: "Kroger", amount: 200, date: date(2026, 8, 31)),
            makeTransaction(id: "n1", merchant: "Netflix", amount: 25, date: date(2026, 6, 4), accountID: "card"),
            makeTransaction(id: "n2", merchant: "Netflix", amount: 25, date: date(2026, 7, 4), accountID: "card"),
            makeTransaction(id: "n3", merchant: "Netflix", amount: 25, date: date(2026, 8, 4), accountID: "card")
        ]

        let model = MSHFinancialCore.deriveFinancialState(
            accounts: accounts,
            transactions: transactions,
            now: date(2026, 9, 2)
        )

        XCTAssertEqual(model.totals.income, 5000)
        XCTAssertEqual(model.totals.expenses, 275)
        XCTAssertEqual(model.totals.cashFlow, 4725)
        XCTAssertEqual(model.totals.netWorth, 21100)
        XCTAssertEqual(model.spendByCategory[.household], 200)
        XCTAssertEqual(model.recurringPatterns.count, 1)
    }

    func testPlanningStatePreservesUserPlannedProvenance() {
        let expenses = [
            MSHPlannedExpense(id: "rent", module: "housing", label: "Housing", amount: 3000, type: "recurring"),
            MSHPlannedExpense(id: "food", module: "household", label: "Groceries", amount: 1000, type: "variable")
        ]

        let plan = MSHFinancialCore.derivePlanningState(
            monthlyNetIncome: 10000,
            expenses: expenses,
            enabledModules: ["housing"]
        )

        XCTAssertEqual(plan.provenance, "user-planned")
        XCTAssertEqual(plan.monthlyExpenses, 3000)
        XCTAssertEqual(plan.availableToDirect, 7000)
        XCTAssertEqual(plan.expenses.first?.provenance, "user-planned")
    }

    private func makeTransaction(
        id: String,
        merchant: String,
        amount: Decimal,
        date: Date,
        accountID: String? = nil,
        direction: MSHTransactionDirection = .debit,
        status: MSHTransactionStatus = .posted
    ) -> MSHFinancialTransaction {
        MSHFinancialTransaction(
            id: id,
            source: "bank",
            accountID: accountID,
            merchantName: merchant,
            merchantKey: MSHFinancialCore.normalizeMerchant(merchant),
            rawDescription: merchant,
            amount: amount,
            direction: direction,
            occurredAt: date,
            postedAt: date,
            status: status
        )
    }

    private func date(_ year: Int, _ month: Int, _ day: Int) -> Date {
        calendar.date(from: DateComponents(timeZone: TimeZone(secondsFromGMT: 0), year: year, month: month, day: day))!
    }
}
