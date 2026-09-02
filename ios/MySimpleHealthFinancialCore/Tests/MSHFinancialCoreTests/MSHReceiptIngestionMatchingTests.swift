import XCTest
@testable import MSHFinancialCore

final class MSHReceiptIngestionMatchingTests: XCTestCase {
    func testIngestionPreservesExactCentsAndSourceProvenance() throws {
        let purchasedAt = date(2026, 9, 1)
        let ingestedAt = date(2026, 9, 2)
        let source = MSHReceiptIngestionSource(
            kind: .email,
            sourceReference: "message-123",
            capturedAt: purchasedAt
        )
        let request = MSHReceiptIngestionRequest(
            receiptID: "receipt-costco",
            merchantName: "Costco Wholesale",
            purchasedAt: purchasedAt,
            lineItems: [
                MSHReceiptIngestionLineItem(
                    id: "nasacort",
                    rawName: "NASACORT 120SPRY",
                    unitPriceCents: 2499
                ),
                MSHReceiptIngestionLineItem(
                    id: "olipop",
                    rawName: "OLIPOP",
                    quantity: 2,
                    unitPriceCents: 949,
                    lineDiscountCents: 100
                )
            ],
            adjustments: [
                MSHReceiptIngestionAdjustment(id: "tax", kind: .tax, label: "Tax", amountCents: 150)
            ],
            statedTotalCents: 4447
        )

        let result = try MSHFinancialCore.ingestReceipt(request, source: source, now: ingestedAt)

        XCTAssertEqual(result.source.kind, .email)
        XCTAssertEqual(result.source.sourceReference, "message-123")
        XCTAssertEqual(result.receipt.provenance, .emailReceipt)
        XCTAssertEqual(result.receipt.lineItems.map(\.provenance), [.emailReceipt, .emailReceipt])
        XCTAssertEqual(result.receipt.lineItems[0].unitPrice.cents, 2499)
        XCTAssertEqual(result.receipt.calculatedTotal.cents, 4447)
        XCTAssertEqual(result.receipt.statedTotal.cents, 4447)
        XCTAssertEqual(result.ingestedAt, ingestedAt)
        XCTAssertTrue(result.warnings.isEmpty)
    }

    func testIngestionReportsAnExactCentTotalMismatch() throws {
        let request = MSHReceiptIngestionRequest(
            receiptID: "receipt-partial",
            merchantName: "Kroger",
            purchasedAt: date(2026, 9, 1),
            lineItems: [
                MSHReceiptIngestionLineItem(id: "known", rawName: "Known items", unitPriceCents: 20000)
            ],
            statedTotalCents: 21437
        )

        let result = try MSHFinancialCore.ingestReceipt(
            request,
            source: MSHReceiptIngestionSource(kind: .cameraScan)
        )

        XCTAssertEqual(result.warnings.count, 1)
        XCTAssertEqual(result.warnings.first?.code, .totalMismatch)
        XCTAssertEqual(result.warnings.first?.differenceCents, 1437)
    }

    func testIngestionRejectsInvalidLineItemBeforeConstructingReceipt() {
        let request = MSHReceiptIngestionRequest(
            receiptID: "receipt-invalid",
            merchantName: "Costco",
            lineItems: [
                MSHReceiptIngestionLineItem(id: "bad", rawName: "Bad quantity", quantity: 0, unitPriceCents: 100)
            ],
            statedTotalCents: 100
        )

        XCTAssertThrowsError(try MSHFinancialCore.ingestReceipt(
            request,
            source: MSHReceiptIngestionSource(kind: .fileUpload)
        )) { error in
            XCTAssertEqual(error as? MSHReceiptIngestionError, .invalidQuantity(itemID: "bad"))
        }
    }

    func testMatcherRanksMerchantAmountAndDateWithExplicitReasons() {
        let receipt = makeReceipt(
            id: "receipt-28642",
            merchant: "Costco Wholesale",
            totalCents: 28642,
            purchasedAt: date(2026, 9, 1)
        )
        let transactions = [
            makeTransaction(id: "wrong-merchant", merchant: "Kroger", amount: "286.42", occurredAt: date(2026, 9, 1)),
            makeTransaction(id: "best", merchant: "COSTCO WHOLESALE #123", amount: "286.42", occurredAt: date(2026, 9, 1)),
            makeTransaction(id: "nearby", merchant: "Costco", amount: "286.41", occurredAt: date(2026, 9, 2))
        ]

        let candidates = MSHFinancialCore.receiptMatchCandidates(for: receipt, transactions: transactions)

        XCTAssertEqual(candidates.map(\.transactionID), ["best", "nearby", "wrong-merchant"])
        XCTAssertEqual(candidates[0].score, 100)
        XCTAssertEqual(candidates[0].confidence, .high)
        XCTAssertEqual(candidates[0].amountDifferenceCents, 0)
        XCTAssertEqual(candidates[0].dateDifferenceDays, 0)
        XCTAssertEqual(candidates[0].reasons.map(\.code), [.exactAmount, .exactMerchant, .sameDay])
        XCTAssertEqual(candidates[1].amountDifferenceCents, 1)
        XCTAssertEqual(candidates[1].reasons.map(\.code), [.nearbyAmount, .relatedMerchant, .nearbyDate])
        XCTAssertEqual(candidates[2].reasons.map(\.code), [.exactAmount, .differentMerchant, .sameDay])
    }

    func testMatcherFiltersIneligibleTransactions() {
        let receipt = makeReceipt(
            id: "receipt-filter",
            merchant: "Costco",
            totalCents: 1000,
            purchasedAt: date(2026, 9, 1)
        )
        let transactions = [
            makeTransaction(id: "eligible", merchant: "Costco", amount: "10.00", occurredAt: date(2026, 9, 1)),
            makeTransaction(id: "wrong-amount", merchant: "Costco", amount: "12.00", occurredAt: date(2026, 9, 1)),
            makeTransaction(id: "wrong-date", merchant: "Costco", amount: "10.00", occurredAt: date(2026, 9, 12)),
            makeTransaction(id: "credit", merchant: "Costco", amount: "10.00", occurredAt: date(2026, 9, 1), direction: .credit),
            makeTransaction(id: "pending", merchant: "Costco", amount: "10.00", occurredAt: date(2026, 9, 1), status: .pending),
            makeTransaction(id: "wrong-currency", merchant: "Costco", amount: "10.00", occurredAt: date(2026, 9, 1), currency: "CAD")
        ]

        let candidates = MSHFinancialCore.receiptMatchCandidates(for: receipt, transactions: transactions)

        XCTAssertEqual(candidates.map(\.transactionID), ["eligible"])
    }

    func testMatcherUsesStableTransactionIDForAnExactTie() {
        let receipt = makeReceipt(
            id: "receipt-tie",
            merchant: "Meijer",
            totalCents: 5819,
            purchasedAt: date(2026, 9, 1)
        )
        let transactions = [
            makeTransaction(id: "tx-b", merchant: "Meijer", amount: "58.19", occurredAt: date(2026, 9, 1)),
            makeTransaction(id: "tx-a", merchant: "Meijer", amount: "58.19", occurredAt: date(2026, 9, 1))
        ]

        let candidates = MSHFinancialCore.receiptMatchCandidates(for: receipt, transactions: transactions)

        XCTAssertEqual(candidates.map(\.transactionID), ["tx-a", "tx-b"])
    }

    private func makeReceipt(id: String, merchant: String, totalCents: Int64, purchasedAt: Date) -> MSHReceipt {
        MSHReceipt(
            id: id,
            merchantName: merchant,
            purchasedAt: purchasedAt,
            lineItems: [
                MSHReceiptLineItem(
                    id: "receipt-total",
                    rawName: "Receipt total",
                    unitPrice: MSHMoney(cents: totalCents),
                    provenance: .uploadedReceipt
                )
            ],
            statedTotal: MSHMoney(cents: totalCents),
            provenance: .uploadedReceipt
        )
    }

    private func makeTransaction(
        id: String,
        merchant: String,
        amount: String,
        occurredAt: Date,
        direction: MSHTransactionDirection = .debit,
        status: MSHTransactionStatus = .posted,
        currency: String = "USD"
    ) -> MSHFinancialTransaction {
        MSHFinancialTransaction(
            id: id,
            source: "test-bank",
            merchantName: merchant,
            merchantKey: MSHFinancialCore.normalizeMerchant(merchant),
            rawDescription: merchant,
            amount: Decimal(string: amount)!,
            direction: direction,
            currency: currency,
            occurredAt: occurredAt,
            status: status
        )
    }

    private func date(_ year: Int, _ month: Int, _ day: Int) -> Date {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar.date(from: DateComponents(year: year, month: month, day: day))!
    }
}
