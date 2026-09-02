import Foundation

public enum MSHReceiptIngestionSourceKind: String, Codable, Sendable {
    case cameraScan = "camera-scan"
    case photoLibrary = "photo-library"
    case fileUpload = "file-upload"
    case email
    case retailerAccount = "retailer-account"
    case manual
}

public struct MSHReceiptIngestionSource: Codable, Equatable, Sendable {
    public let kind: MSHReceiptIngestionSourceKind
    public let sourceReference: String?
    public let capturedAt: Date?

    public init(
        kind: MSHReceiptIngestionSourceKind,
        sourceReference: String? = nil,
        capturedAt: Date? = nil
    ) {
        self.kind = kind
        self.sourceReference = sourceReference
        self.capturedAt = capturedAt
    }

    public var provenance: MSHFinancialProvenance {
        switch kind {
        case .cameraScan, .photoLibrary, .fileUpload:
            return .uploadedReceipt
        case .email:
            return .emailReceipt
        case .retailerAccount:
            return .retailerReceipt
        case .manual:
            return .manual
        }
    }
}

public struct MSHReceiptIngestionLineItem: Codable, Equatable, Sendable {
    public let id: String
    public let rawName: String
    public let quantity: Int
    public let unitPriceCents: Int64
    public let lineDiscountCents: Int64

    public init(
        id: String,
        rawName: String,
        quantity: Int = 1,
        unitPriceCents: Int64,
        lineDiscountCents: Int64 = 0
    ) {
        self.id = id
        self.rawName = rawName
        self.quantity = quantity
        self.unitPriceCents = unitPriceCents
        self.lineDiscountCents = lineDiscountCents
    }
}

public struct MSHReceiptIngestionAdjustment: Codable, Equatable, Sendable {
    public let id: String
    public let kind: MSHReceiptAdjustmentKind
    public let label: String
    public let amountCents: Int64

    public init(id: String, kind: MSHReceiptAdjustmentKind, label: String, amountCents: Int64) {
        self.id = id
        self.kind = kind
        self.label = label
        self.amountCents = amountCents
    }
}

public struct MSHReceiptIngestionRequest: Codable, Equatable, Sendable {
    public let receiptID: String
    public let transactionID: String?
    public let merchantName: String
    public let purchasedAt: Date?
    public let currency: String
    public let lineItems: [MSHReceiptIngestionLineItem]
    public let adjustments: [MSHReceiptIngestionAdjustment]
    public let statedTotalCents: Int64

    public init(
        receiptID: String,
        transactionID: String? = nil,
        merchantName: String,
        purchasedAt: Date? = nil,
        currency: String = "USD",
        lineItems: [MSHReceiptIngestionLineItem],
        adjustments: [MSHReceiptIngestionAdjustment] = [],
        statedTotalCents: Int64
    ) {
        self.receiptID = receiptID
        self.transactionID = transactionID
        self.merchantName = merchantName
        self.purchasedAt = purchasedAt
        self.currency = currency.uppercased()
        self.lineItems = lineItems
        self.adjustments = adjustments
        self.statedTotalCents = statedTotalCents
    }
}

public enum MSHReceiptIngestionWarningCode: String, Codable, Sendable {
    case missingPurchaseDate = "missing-purchase-date"
    case noLineItems = "no-line-items"
    case totalMismatch = "total-mismatch"
}

public struct MSHReceiptIngestionWarning: Codable, Equatable, Sendable {
    public let code: MSHReceiptIngestionWarningCode
    public let message: String
    public let differenceCents: Int64?

    public init(code: MSHReceiptIngestionWarningCode, message: String, differenceCents: Int64? = nil) {
        self.code = code
        self.message = message
        self.differenceCents = differenceCents
    }
}

public struct MSHIngestedReceipt: Codable, Equatable, Sendable {
    public let receipt: MSHReceipt
    public let source: MSHReceiptIngestionSource
    public let ingestedAt: Date
    public let warnings: [MSHReceiptIngestionWarning]

    public init(
        receipt: MSHReceipt,
        source: MSHReceiptIngestionSource,
        ingestedAt: Date,
        warnings: [MSHReceiptIngestionWarning]
    ) {
        self.receipt = receipt
        self.source = source
        self.ingestedAt = ingestedAt
        self.warnings = warnings
    }
}

public enum MSHReceiptIngestionError: Error, Equatable, Sendable {
    case missingReceiptID
    case missingMerchantName
    case invalidCurrency
    case negativeStatedTotal
    case duplicateLineItemID(String)
    case invalidLineItemID
    case invalidQuantity(itemID: String)
    case negativeUnitPrice(itemID: String)
    case negativeLineDiscount(itemID: String)
    case lineItemTotalOverflow(itemID: String)
    case lineDiscountExceedsExtendedPrice(itemID: String)
    case duplicateAdjustmentID(String)
    case invalidAdjustmentID
    case negativeAdjustmentAmount(adjustmentID: String)
}

public extension MSHFinancialCore {
    static func ingestReceipt(
        _ request: MSHReceiptIngestionRequest,
        source: MSHReceiptIngestionSource,
        now: Date = Date()
    ) throws -> MSHIngestedReceipt {
        guard !request.receiptID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw MSHReceiptIngestionError.missingReceiptID
        }
        guard !request.merchantName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw MSHReceiptIngestionError.missingMerchantName
        }
        guard request.currency.range(of: #"^[A-Z]{3}$"#, options: .regularExpression) != nil else {
            throw MSHReceiptIngestionError.invalidCurrency
        }
        guard request.statedTotalCents >= 0 else {
            throw MSHReceiptIngestionError.negativeStatedTotal
        }

        var lineItemIDs = Set<String>()
        let lineItems = try request.lineItems.map { item -> MSHReceiptLineItem in
            guard !item.id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                throw MSHReceiptIngestionError.invalidLineItemID
            }
            guard lineItemIDs.insert(item.id).inserted else {
                throw MSHReceiptIngestionError.duplicateLineItemID(item.id)
            }
            guard item.quantity > 0 else {
                throw MSHReceiptIngestionError.invalidQuantity(itemID: item.id)
            }
            guard item.unitPriceCents >= 0 else {
                throw MSHReceiptIngestionError.negativeUnitPrice(itemID: item.id)
            }
            guard item.lineDiscountCents >= 0 else {
                throw MSHReceiptIngestionError.negativeLineDiscount(itemID: item.id)
            }
            let (extendedPriceCents, overflow) = item.unitPriceCents.multipliedReportingOverflow(by: Int64(item.quantity))
            guard !overflow else {
                throw MSHReceiptIngestionError.lineItemTotalOverflow(itemID: item.id)
            }
            guard item.lineDiscountCents <= extendedPriceCents else {
                throw MSHReceiptIngestionError.lineDiscountExceedsExtendedPrice(itemID: item.id)
            }

            return MSHReceiptLineItem(
                id: item.id,
                rawName: item.rawName,
                quantity: item.quantity,
                unitPrice: MSHMoney(cents: item.unitPriceCents, currency: request.currency),
                lineDiscount: MSHMoney(cents: item.lineDiscountCents, currency: request.currency),
                provenance: source.provenance
            )
        }

        var adjustmentIDs = Set<String>()
        let adjustments = try request.adjustments.map { adjustment -> MSHReceiptAdjustment in
            guard !adjustment.id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                throw MSHReceiptIngestionError.invalidAdjustmentID
            }
            guard adjustmentIDs.insert(adjustment.id).inserted else {
                throw MSHReceiptIngestionError.duplicateAdjustmentID(adjustment.id)
            }
            guard adjustment.amountCents >= 0 else {
                throw MSHReceiptIngestionError.negativeAdjustmentAmount(adjustmentID: adjustment.id)
            }

            return MSHReceiptAdjustment(
                id: adjustment.id,
                kind: adjustment.kind,
                label: adjustment.label,
                amount: MSHMoney(cents: adjustment.amountCents, currency: request.currency),
                provenance: source.provenance
            )
        }

        let receipt = MSHReceipt(
            id: request.receiptID,
            transactionID: request.transactionID,
            merchantName: request.merchantName,
            purchasedAt: request.purchasedAt,
            currency: request.currency,
            lineItems: lineItems,
            adjustments: adjustments,
            statedTotal: MSHMoney(cents: request.statedTotalCents, currency: request.currency),
            provenance: source.provenance
        )

        var warnings: [MSHReceiptIngestionWarning] = []
        if request.purchasedAt == nil {
            warnings.append(MSHReceiptIngestionWarning(
                code: .missingPurchaseDate,
                message: "Receipt purchase date was not available."
            ))
        }
        if request.lineItems.isEmpty {
            warnings.append(MSHReceiptIngestionWarning(
                code: .noLineItems,
                message: "Receipt contains no line items."
            ))
        }
        let totalDifferenceCents = receipt.statedTotal.cents - receipt.calculatedTotal.cents
        if totalDifferenceCents != 0 {
            warnings.append(MSHReceiptIngestionWarning(
                code: .totalMismatch,
                message: "Calculated receipt total differs from the stated total.",
                differenceCents: totalDifferenceCents
            ))
        }

        return MSHIngestedReceipt(receipt: receipt, source: source, ingestedAt: now, warnings: warnings)
    }
}

public enum MSHReceiptMatchConfidence: String, Codable, Sendable {
    case low
    case medium
    case high
}

public enum MSHReceiptMatchReasonCode: String, Codable, Sendable {
    case exactAmount = "exact-amount"
    case nearbyAmount = "nearby-amount"
    case exactMerchant = "exact-merchant"
    case relatedMerchant = "related-merchant"
    case differentMerchant = "different-merchant"
    case sameDay = "same-day"
    case nearbyDate = "nearby-date"
    case missingDate = "missing-date"
}

public struct MSHReceiptMatchReason: Codable, Equatable, Sendable {
    public let code: MSHReceiptMatchReasonCode
    public let scoreContribution: Int
    public let detail: String

    public init(code: MSHReceiptMatchReasonCode, scoreContribution: Int, detail: String) {
        self.code = code
        self.scoreContribution = scoreContribution
        self.detail = detail
    }
}

public struct MSHReceiptMatchConfiguration: Codable, Equatable, Sendable {
    public let maximumAmountDifferenceCents: Int64
    public let maximumDateDifferenceDays: Int
    public let minimumScore: Int

    public init(
        maximumAmountDifferenceCents: Int64 = 100,
        maximumDateDifferenceDays: Int = 7,
        minimumScore: Int = 50
    ) {
        self.maximumAmountDifferenceCents = max(0, maximumAmountDifferenceCents)
        self.maximumDateDifferenceDays = max(0, maximumDateDifferenceDays)
        self.minimumScore = min(100, max(0, minimumScore))
    }
}

public struct MSHReceiptMatchCandidate: Codable, Equatable, Sendable {
    public let receiptID: String
    public let transactionID: String
    public let confidence: MSHReceiptMatchConfidence
    public let score: Int
    public let amountDifferenceCents: Int64
    public let dateDifferenceDays: Int?
    public let reasons: [MSHReceiptMatchReason]

    public init(
        receiptID: String,
        transactionID: String,
        confidence: MSHReceiptMatchConfidence,
        score: Int,
        amountDifferenceCents: Int64,
        dateDifferenceDays: Int?,
        reasons: [MSHReceiptMatchReason]
    ) {
        self.receiptID = receiptID
        self.transactionID = transactionID
        self.confidence = confidence
        self.score = score
        self.amountDifferenceCents = amountDifferenceCents
        self.dateDifferenceDays = dateDifferenceDays
        self.reasons = reasons
    }
}

public extension MSHFinancialCore {
    static func receiptMatchCandidates(
        for receipt: MSHReceipt,
        transactions: [MSHFinancialTransaction],
        configuration: MSHReceiptMatchConfiguration = MSHReceiptMatchConfiguration()
    ) -> [MSHReceiptMatchCandidate] {
        let candidates = transactions.compactMap { transaction in
            receiptMatchCandidate(for: receipt, transaction: transaction, configuration: configuration)
        }

        return candidates.sorted {
            if $0.score != $1.score { return $0.score > $1.score }
            if $0.amountDifferenceCents != $1.amountDifferenceCents {
                return $0.amountDifferenceCents < $1.amountDifferenceCents
            }
            if $0.dateDifferenceDays != $1.dateDifferenceDays {
                return ($0.dateDifferenceDays ?? Int.max) < ($1.dateDifferenceDays ?? Int.max)
            }
            return $0.transactionID < $1.transactionID
        }
    }

    private static func receiptMatchCandidate(
        for receipt: MSHReceipt,
        transaction: MSHFinancialTransaction,
        configuration: MSHReceiptMatchConfiguration
    ) -> MSHReceiptMatchCandidate? {
        guard transaction.direction == .debit,
              transaction.status == .posted,
              transaction.currency.uppercased() == receipt.currency else {
            return nil
        }

        let transactionAmount = money(from: transaction.amount, currency: transaction.currency)
        guard transactionAmount.cents >= 0, receipt.statedTotal.cents >= 0 else {
            return nil
        }
        let amountDifferenceCents = abs(transactionAmount.cents - receipt.statedTotal.cents)
        guard amountDifferenceCents <= configuration.maximumAmountDifferenceCents else {
            return nil
        }

        let dateDifferenceDays = receiptDateDifferenceDays(receipt: receipt, transaction: transaction)
        if let dateDifferenceDays, dateDifferenceDays > configuration.maximumDateDifferenceDays {
            return nil
        }

        var reasons: [MSHReceiptMatchReason] = []
        if amountDifferenceCents == 0 {
            reasons.append(MSHReceiptMatchReason(
                code: .exactAmount,
                scoreContribution: 55,
                detail: "Receipt and transaction totals match exactly in cents."
            ))
        } else {
            reasons.append(MSHReceiptMatchReason(
                code: .nearbyAmount,
                scoreContribution: 35,
                detail: "Receipt and transaction totals differ by \(amountDifferenceCents) cents."
            ))
        }

        reasons.append(receiptMerchantReason(receipt: receipt, transaction: transaction))
        reasons.append(receiptDateReason(dateDifferenceDays))

        let score = min(100, reasons.reduce(0) { $0 + $1.scoreContribution })
        guard score >= configuration.minimumScore else { return nil }

        let confidence: MSHReceiptMatchConfidence
        if score >= 85 {
            confidence = .high
        } else if score >= 65 {
            confidence = .medium
        } else {
            confidence = .low
        }

        return MSHReceiptMatchCandidate(
            receiptID: receipt.id,
            transactionID: transaction.id,
            confidence: confidence,
            score: score,
            amountDifferenceCents: amountDifferenceCents,
            dateDifferenceDays: dateDifferenceDays,
            reasons: reasons
        )
    }

    private static func receiptMerchantReason(
        receipt: MSHReceipt,
        transaction: MSHFinancialTransaction
    ) -> MSHReceiptMatchReason {
        let receiptMerchant = normalizeMerchant(receipt.merchantName)
        let transactionMerchant = transaction.merchantKey.isEmpty
            ? normalizeMerchant(transaction.merchantName)
            : normalizeMerchant(transaction.merchantKey)

        if !receiptMerchant.isEmpty && receiptMerchant == transactionMerchant {
            return MSHReceiptMatchReason(
                code: .exactMerchant,
                scoreContribution: 25,
                detail: "Normalized merchant names match."
            )
        }

        let receiptTokens = Set(receiptMerchant.split(separator: " ").map(String.init))
        let transactionTokens = Set(transactionMerchant.split(separator: " ").map(String.init))
        let sharedTokenCount = receiptTokens.intersection(transactionTokens).count
        let largestTokenCount = max(receiptTokens.count, transactionTokens.count)
        let tokenOverlap = largestTokenCount == 0 ? 0 : Double(sharedTokenCount) / Double(largestTokenCount)
        let containsMerchant = !receiptMerchant.isEmpty
            && !transactionMerchant.isEmpty
            && (receiptMerchant.contains(transactionMerchant) || transactionMerchant.contains(receiptMerchant))

        if containsMerchant || tokenOverlap >= 0.5 {
            return MSHReceiptMatchReason(
                code: .relatedMerchant,
                scoreContribution: 18,
                detail: "Merchant names share a normalized name or meaningful tokens."
            )
        }

        return MSHReceiptMatchReason(
            code: .differentMerchant,
            scoreContribution: -20,
            detail: "Merchant names do not appear related."
        )
    }

    private static func receiptDateDifferenceDays(
        receipt: MSHReceipt,
        transaction: MSHFinancialTransaction
    ) -> Int? {
        guard let receiptDate = receipt.purchasedAt,
              let transactionDate = transaction.occurredAt ?? transaction.postedAt else {
            return nil
        }

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let receiptDay = calendar.startOfDay(for: receiptDate)
        let transactionDay = calendar.startOfDay(for: transactionDate)
        return abs(calendar.dateComponents([.day], from: receiptDay, to: transactionDay).day ?? 0)
    }

    private static func receiptDateReason(_ dateDifferenceDays: Int?) -> MSHReceiptMatchReason {
        guard let dateDifferenceDays else {
            return MSHReceiptMatchReason(
                code: .missingDate,
                scoreContribution: 0,
                detail: "A receipt or transaction date is unavailable."
            )
        }
        if dateDifferenceDays == 0 {
            return MSHReceiptMatchReason(
                code: .sameDay,
                scoreContribution: 20,
                detail: "Receipt and transaction occurred on the same calendar day."
            )
        }

        let contribution: Int
        switch dateDifferenceDays {
        case 1:
            contribution = 16
        case 2...3:
            contribution = 10
        default:
            contribution = 5
        }
        return MSHReceiptMatchReason(
            code: .nearbyDate,
            scoreContribution: contribution,
            detail: "Receipt and transaction dates are \(dateDifferenceDays) days apart."
        )
    }
}
