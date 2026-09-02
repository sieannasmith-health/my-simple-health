import XCTest
@testable import MSHFinancialCore

final class MSHPennyReconciliationTests: XCTestCase {
    private func transaction(
        id: String = "tx-1",
        amount: Decimal,
        direction: MSHTransactionDirection = .debit,
        status: MSHTransactionStatus = .posted,
        category: MSHFinancialCategory? = .household
    ) -> MSHFinancialTransaction {
        MSHFinancialTransaction(
            id: id,
            source: "test",
            merchantName: "Costco",
            merchantKey: "costco",
            rawDescription: "COSTCO",
            amount: amount,
            direction: direction,
            currency: "USD",
            status: status,
            category: category,
            categorySource: "test"
        )
    }

    func testMoneyConvertsDecimalToIntegerCents() {
        XCTAssertEqual(MSHFinancialCore.money(from: Decimal(string: "12.49")!), MSHMoney(cents: 1249))
        XCTAssertEqual(MSHFinancialCore.money(from: Decimal(string: "286.42")!), MSHMoney(cents: 28642))
    }

    func testReceiptCalculatesExactTotalFromItemsAndAdjustments() {
        let receipt = MSHReceipt(
            id: "receipt-1",
            merchantName: "Costco",
            lineItems: [
                MSHReceiptLineItem(
                    id: "salmon",
                    rawName: "SALMON",
                    quantity: 1,
                    unitPrice: MSHMoney(cents: 3147),
                    provenance: .retailerReceipt
                ),
                MSHReceiptLineItem(
                    id: "olipop",
                    rawName: "OLIPOP",
                    quantity: 2,
                    unitPrice: MSHMoney(cents: 949),
                    lineDiscount: MSHMoney(cents: 100),
                    provenance: .retailerReceipt
                )
            ],
            adjustments: [
                MSHReceiptAdjustment(
                    id: "tax",
                    kind: .tax,
                    label: "Tax",
                    amount: MSHMoney(cents: 150),
                    provenance: .retailerReceipt
                ),
                MSHReceiptAdjustment(
                    id: "coupon",
                    kind: .coupon,
                    label: "Coupon",
                    amount: MSHMoney(cents: 50),
                    provenance: .retailerReceipt
                )
            ],
            statedTotal: MSHMoney(cents: 5045),
            provenance: .retailerReceipt
        )

        XCTAssertEqual(receipt.calculatedTotal.cents, 5045)
        XCTAssertEqual(receipt.statedTotal, receipt.calculatedTotal)
    }

    func testFullyReconciledTransactionHasZeroUnaccountedCents() {
        let receipt = MSHReceipt(
            id: "receipt-28642",
            transactionID: "tx-28642",
            merchantName: "Costco",
            lineItems: [
                MSHReceiptLineItem(
                    id: "items",
                    rawName: "Receipt items",
                    unitPrice: MSHMoney(cents: 27891),
                    provenance: .uploadedReceipt
                )
            ],
            adjustments: [
                MSHReceiptAdjustment(
                    id: "discount",
                    kind: .discount,
                    label: "Discounts",
                    amount: MSHMoney(cents: 750),
                    provenance: .uploadedReceipt
                ),
                MSHReceiptAdjustment(
                    id: "tax",
                    kind: .tax,
                    label: "Tax",
                    amount: MSHMoney(cents: 1501),
                    provenance: .uploadedReceipt
                )
            ],
            statedTotal: MSHMoney(cents: 28642),
            provenance: .uploadedReceipt
        )

        let result = MSHFinancialCore.reconcile(
            transaction: transaction(id: "tx-28642", amount: Decimal(string: "286.42")!),
            receipt: receipt
        )

        XCTAssertEqual(result.status, .fullyReconciled)
        XCTAssertEqual(result.explainedAmount.cents, 28642)
        XCTAssertEqual(result.difference.cents, 0)
    }

    func testPartialReceiptKeepsExactUnreconciledDifference() {
        let receipt = MSHReceipt(
            id: "partial",
            merchantName: "Kroger",
            lineItems: [
                MSHReceiptLineItem(
                    id: "known-items",
                    rawName: "Known items",
                    unitPrice: MSHMoney(cents: 20000),
                    provenance: .manual
                )
            ],
            statedTotal: MSHMoney(cents: 20000),
            provenance: .manual
        )

        let result = MSHFinancialCore.reconcile(
            transaction: transaction(amount: Decimal(string: "214.37")!),
            receipt: receipt
        )

        XCTAssertEqual(result.status, .partial)
        XCTAssertEqual(result.explainedAmount.cents, 20000)
        XCTAssertEqual(result.difference.cents, 1437)
    }

    func testMissingReceiptLeavesEntireTransactionUnexplained() {
        let result = MSHFinancialCore.reconcile(
            transaction: transaction(amount: Decimal(string: "58.19")!),
            receipt: nil
        )

        XCTAssertEqual(result.status, .missingReceipt)
        XCTAssertEqual(result.explainedAmount.cents, 0)
        XCTAssertEqual(result.difference.cents, 5819)
    }

    func testProductIdentityCanPreserveRetailerAliasAndPurpose() {
        let product = MSHProductIdentity(
            id: "product:nasacort-120",
            canonicalName: "Nasacort Allergy 24HR",
            brand: "Nasacort",
            size: "120 sprays",
            gtin: "0123456789012",
            category: "Health",
            subcategory: "OTC allergy medication",
            purpose: "Allergy care",
            aliases: ["NASACORT 120SPRY"]
        )

        let lineItem = MSHReceiptLineItem(
            id: "nasacort-line",
            rawName: "NASACORT 120SPRY",
            product: product,
            unitPrice: MSHMoney(cents: 1603),
            provenance: .retailerReceipt
        )

        XCTAssertEqual(lineItem.product?.canonicalName, "Nasacort Allergy 24HR")
        XCTAssertEqual(lineItem.product?.purpose, "Allergy care")
        XCTAssertEqual(lineItem.netAmount.cents, 1603)
    }
}
