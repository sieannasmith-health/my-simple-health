import Foundation

public struct MSHMoney: Codable, Equatable, Hashable, Sendable, Comparable {
    public let cents: Int64
    public let currency: String

    public init(cents: Int64, currency: String = "USD") {
        self.cents = cents
        self.currency = currency.uppercased()
    }

    public static func < (lhs: MSHMoney, rhs: MSHMoney) -> Bool {
        precondition(lhs.currency == rhs.currency, "Cannot compare different currencies")
        return lhs.cents < rhs.cents
    }

    public static func + (lhs: MSHMoney, rhs: MSHMoney) -> MSHMoney {
        precondition(lhs.currency == rhs.currency, "Cannot add different currencies")
        return MSHMoney(cents: lhs.cents + rhs.cents, currency: lhs.currency)
    }

    public static func - (lhs: MSHMoney, rhs: MSHMoney) -> MSHMoney {
        precondition(lhs.currency == rhs.currency, "Cannot subtract different currencies")
        return MSHMoney(cents: lhs.cents - rhs.cents, currency: lhs.currency)
    }

    public static func zero(currency: String = "USD") -> MSHMoney {
        MSHMoney(cents: 0, currency: currency)
    }

    public var decimalAmount: Decimal {
        Decimal(cents) / 100
    }
}

public enum MSHFinancialProvenance: String, Codable, Sendable {
    case bankFeed = "bank-feed"
    case retailerReceipt = "retailer-receipt"
    case uploadedReceipt = "uploaded-receipt"
    case emailReceipt = "email-receipt"
    case manual = "manual"
    case inferred = "inferred"
    case userCorrected = "user-corrected"
}

public struct MSHProductIdentity: Codable, Equatable, Hashable, Sendable {
    public let id: String
    public let canonicalName: String
    public let brand: String?
    public let size: String?
    public let gtin: String?
    public let category: String?
    public let subcategory: String?
    public let purpose: String?
    public let aliases: [String]

    public init(
        id: String,
        canonicalName: String,
        brand: String? = nil,
        size: String? = nil,
        gtin: String? = nil,
        category: String? = nil,
        subcategory: String? = nil,
        purpose: String? = nil,
        aliases: [String] = []
    ) {
        self.id = id
        self.canonicalName = canonicalName
        self.brand = brand
        self.size = size
        self.gtin = gtin
        self.category = category
        self.subcategory = subcategory
        self.purpose = purpose
        self.aliases = aliases
    }
}

public struct MSHReceiptLineItem: Codable, Equatable, Sendable {
    public let id: String
    public let rawName: String
    public let product: MSHProductIdentity?
    public let quantity: Int
    public let unitPrice: MSHMoney
    public let lineDiscount: MSHMoney
    public let provenance: MSHFinancialProvenance

    public init(
        id: String,
        rawName: String,
        product: MSHProductIdentity? = nil,
        quantity: Int = 1,
        unitPrice: MSHMoney,
        lineDiscount: MSHMoney? = nil,
        provenance: MSHFinancialProvenance
    ) {
        precondition(quantity > 0, "Receipt quantity must be positive")
        self.id = id
        self.rawName = rawName
        self.product = product
        self.quantity = quantity
        self.unitPrice = unitPrice
        self.lineDiscount = lineDiscount ?? .zero(currency: unitPrice.currency)
        self.provenance = provenance
    }

    public var extendedPrice: MSHMoney {
        MSHMoney(cents: unitPrice.cents * Int64(quantity), currency: unitPrice.currency)
    }

    public var netAmount: MSHMoney {
        extendedPrice - lineDiscount
    }
}

public enum MSHReceiptAdjustmentKind: String, Codable, Sendable {
    case tax
    case fee
    case tip
    case discount
    case coupon
    case credit
}

public struct MSHReceiptAdjustment: Codable, Equatable, Sendable {
    public let id: String
    public let kind: MSHReceiptAdjustmentKind
    public let label: String
    public let amount: MSHMoney
    public let provenance: MSHFinancialProvenance

    public init(
        id: String,
        kind: MSHReceiptAdjustmentKind,
        label: String,
        amount: MSHMoney,
        provenance: MSHFinancialProvenance
    ) {
        self.id = id
        self.kind = kind
        self.label = label
        self.amount = amount
        self.provenance = provenance
    }

    public var signedCents: Int64 {
        switch kind {
        case .tax, .fee, .tip:
            return abs(amount.cents)
        case .discount, .coupon, .credit:
            return -abs(amount.cents)
        }
    }
}

public struct MSHReceipt: Codable, Equatable, Sendable {
    public let schemaVersion: Int
    public let id: String
    public let transactionID: String?
    public let merchantName: String
    public let purchasedAt: Date?
    public let currency: String
    public let lineItems: [MSHReceiptLineItem]
    public let adjustments: [MSHReceiptAdjustment]
    public let statedTotal: MSHMoney
    public let provenance: MSHFinancialProvenance

    public init(
        schemaVersion: Int = 1,
        id: String,
        transactionID: String? = nil,
        merchantName: String,
        purchasedAt: Date? = nil,
        currency: String = "USD",
        lineItems: [MSHReceiptLineItem],
        adjustments: [MSHReceiptAdjustment] = [],
        statedTotal: MSHMoney,
        provenance: MSHFinancialProvenance
    ) {
        let normalizedCurrency = currency.uppercased()
        precondition(statedTotal.currency == normalizedCurrency, "Receipt total currency must match receipt currency")
        precondition(lineItems.allSatisfy { $0.unitPrice.currency == normalizedCurrency && $0.lineDiscount.currency == normalizedCurrency }, "Line item currency must match receipt currency")
        precondition(adjustments.allSatisfy { $0.amount.currency == normalizedCurrency }, "Adjustment currency must match receipt currency")
        self.schemaVersion = schemaVersion
        self.id = id
        self.transactionID = transactionID
        self.merchantName = merchantName
        self.purchasedAt = purchasedAt
        self.currency = normalizedCurrency
        self.lineItems = lineItems
        self.adjustments = adjustments
        self.statedTotal = statedTotal
        self.provenance = provenance
    }

    public var calculatedTotal: MSHMoney {
        let itemCents = lineItems.reduce(Int64.zero) { $0 + $1.netAmount.cents }
        let adjustmentCents = adjustments.reduce(Int64.zero) { $0 + $1.signedCents }
        return MSHMoney(cents: itemCents + adjustmentCents, currency: currency)
    }
}

public enum MSHReconciliationStatus: String, Codable, Sendable {
    case fullyReconciled = "fully-reconciled"
    case partial = "partial"
    case missingReceipt = "missing-receipt"
    case mismatch = "mismatch"
    case pending = "pending"
    case refund = "refund"
    case transfer = "transfer"
}

public struct MSHFinancialReconciliation: Codable, Equatable, Sendable {
    public let schemaVersion: Int
    public let transactionID: String
    public let receiptID: String?
    public let transactionAmount: MSHMoney
    public let explainedAmount: MSHMoney
    public let difference: MSHMoney
    public let status: MSHReconciliationStatus
    public let reconciledAt: Date

    public init(
        schemaVersion: Int = 1,
        transactionID: String,
        receiptID: String?,
        transactionAmount: MSHMoney,
        explainedAmount: MSHMoney,
        difference: MSHMoney,
        status: MSHReconciliationStatus,
        reconciledAt: Date = Date()
    ) {
        self.schemaVersion = schemaVersion
        self.transactionID = transactionID
        self.receiptID = receiptID
        self.transactionAmount = transactionAmount
        self.explainedAmount = explainedAmount
        self.difference = difference
        self.status = status
        self.reconciledAt = reconciledAt
    }
}

public extension MSHFinancialCore {
    static func money(from decimal: Decimal, currency: String = "USD") -> MSHMoney {
        var source = decimal
        var rounded = Decimal()
        NSDecimalRound(&rounded, &source, 2, .plain)
        let centsDecimal = rounded * 100
        let cents = NSDecimalNumber(decimal: centsDecimal).int64Value
        return MSHMoney(cents: cents, currency: currency)
    }

    static func reconcile(
        transaction: MSHFinancialTransaction,
        receipt: MSHReceipt?,
        toleranceCents: Int64 = 0,
        now: Date = Date()
    ) -> MSHFinancialReconciliation {
        let transactionMoney = money(from: transaction.amount, currency: transaction.currency)

        if transaction.status == .pending {
            return MSHFinancialReconciliation(
                transactionID: transaction.id,
                receiptID: receipt?.id,
                transactionAmount: transactionMoney,
                explainedAmount: receipt?.calculatedTotal ?? .zero(currency: transaction.currency),
                difference: transactionMoney - (receipt?.calculatedTotal ?? .zero(currency: transaction.currency)),
                status: .pending,
                reconciledAt: now
            )
        }

        if transaction.category == .transfer {
            return MSHFinancialReconciliation(
                transactionID: transaction.id,
                receiptID: receipt?.id,
                transactionAmount: transactionMoney,
                explainedAmount: transactionMoney,
                difference: .zero(currency: transaction.currency),
                status: .transfer,
                reconciledAt: now
            )
        }

        if transaction.direction == .credit {
            return MSHFinancialReconciliation(
                transactionID: transaction.id,
                receiptID: receipt?.id,
                transactionAmount: transactionMoney,
                explainedAmount: receipt?.calculatedTotal ?? transactionMoney,
                difference: receipt == nil ? .zero(currency: transaction.currency) : transactionMoney - receipt!.calculatedTotal,
                status: .refund,
                reconciledAt: now
            )
        }

        guard let receipt else {
            return MSHFinancialReconciliation(
                transactionID: transaction.id,
                receiptID: nil,
                transactionAmount: transactionMoney,
                explainedAmount: .zero(currency: transaction.currency),
                difference: transactionMoney,
                status: .missingReceipt,
                reconciledAt: now
            )
        }

        precondition(receipt.currency == transaction.currency.uppercased(), "Receipt and transaction currencies must match")
        let explained = receipt.calculatedTotal
        let difference = transactionMoney - explained
        let absoluteDifference = abs(difference.cents)

        let status: MSHReconciliationStatus
        if absoluteDifference <= max(0, toleranceCents) {
            status = .fullyReconciled
        } else if explained.cents > 0 && explained.cents < transactionMoney.cents {
            status = .partial
        } else {
            status = .mismatch
        }

        return MSHFinancialReconciliation(
            transactionID: transaction.id,
            receiptID: receipt.id,
            transactionAmount: transactionMoney,
            explainedAmount: explained,
            difference: difference,
            status: status,
            reconciledAt: now
        )
    }
}
