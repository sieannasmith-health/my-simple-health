import SwiftUI
import MSHFinancialCore

struct MSHGroceryComparisonScreen: View {
    @State private var retailer = MSHGroceryComparisonModel.retailers[0]
    @State private var convenienceTolerance = "6.00"
    @State private var inStore = MSHGroceryQuoteDraft(
        channel: .inStore,
        itemTotal: "82.00",
        fees: "0",
        tip: "0",
        travel: "3.50",
        minutes: "55",
        effort: .high
    )
    @State private var pickup = MSHGroceryQuoteDraft(
        channel: .pickup,
        itemTotal: "84.00",
        fees: "0",
        tip: "0",
        travel: "3.50",
        minutes: "25",
        effort: .moderate
    )
    @State private var delivery = MSHGroceryQuoteDraft(
        channel: .instacart,
        itemTotal: "86.00",
        fees: "7.99",
        tip: "8.00",
        travel: "0",
        minutes: "0",
        effort: .low
    )

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                header
                sourceNotice
                retailerPicker
                preferenceCard
                quoteSection
                resultCard
                integrityNote
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 40)
        }
        .background(MSHColor.canvas)
        .navigationTitle("Grocery Comparison")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(MSHColor.canvas, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .accessibilityIdentifier("native-grocery-comparison")
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("GROCERY COMPARISON")
                .font(.caption2.weight(.semibold))
                .tracking(2.2)
                .foregroundStyle(MSHColor.accent)

            Text("What’s the best way to get your groceries today?")
                .font(.system(size: 31, weight: .medium, design: .serif))
                .foregroundStyle(MSHColor.primaryText)
                .fixedSize(horizontal: false, vertical: true)

            Text("Compare money, time, and effort without pretending they are the same thing.")
                .font(.system(size: 16, design: .serif))
                .foregroundStyle(MSHColor.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var sourceNotice: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "slider.horizontal.3")
                .foregroundStyle(MSHColor.accent)
                .frame(width: 26)

            VStack(alignment: .leading, spacing: 4) {
                Text("Preview with your estimates")
                    .font(.headline)
                    .foregroundStyle(MSHColor.primaryText)
                Text("Live retailer pricing is not connected yet. The values below are editable examples so you can test the comparison engine on your iPhone now.")
                    .font(.subheadline)
                    .foregroundStyle(MSHColor.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(16)
        .background(MSHColor.controlFill)
        .clipShape(RoundedRectangle(cornerRadius: MSHRadius.large, style: .continuous))
        .accessibilityIdentifier("grocery-comparison-source-notice")
    }

    private var retailerPicker: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("RETAILER")
                .mshFieldLabel()

            Picker("Retailer", selection: $retailer) {
                ForEach(MSHGroceryComparisonModel.retailers, id: \.self) { name in
                    Text(name).tag(name)
                }
            }
            .pickerStyle(.menu)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 14)
            .frame(minHeight: 48)
            .background(MSHColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous)
                    .stroke(MSHColor.border, lineWidth: 0.75)
            }
            .accessibilityIdentifier("grocery-retailer-picker")
        }
    }

    private var preferenceCard: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("YOUR TRADEOFF")
                .mshFieldLabel()
            Text("How much more would you be comfortable spending if another option saves meaningful time or effort?")
                .font(.subheadline)
                .foregroundStyle(MSHColor.secondaryText)

            HStack(spacing: 8) {
                Text("$")
                    .foregroundStyle(MSHColor.secondaryText)
                TextField("0.00", text: $convenienceTolerance)
                    .keyboardType(.decimalPad)
                    .font(.title3.monospacedDigit())
                    .accessibilityIdentifier("grocery-convenience-tolerance")
            }
            .padding(.horizontal, 14)
            .frame(height: 48)
            .background(MSHColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous)
                    .stroke(MSHColor.border, lineWidth: 0.75)
            }
        }
        .mshSurface()
    }

    private var quoteSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("WAYS TO GET IT")
                .mshFieldLabel()

            MSHGroceryQuoteEditor(title: "Go inside", subtitle: "In-store", draft: $inStore)
            MSHGroceryQuoteEditor(title: "Pick it up", subtitle: "Pickup", draft: $pickup)
            MSHGroceryQuoteEditor(title: "Bring it to me", subtitle: "Delivery estimate", draft: $delivery)
        }
    }

    @ViewBuilder
    private var resultCard: some View {
        let result = MSHGroceryComparisonModel.compare(
            retailer: retailer,
            drafts: [inStore, pickup, delivery],
            convenienceTolerance: convenienceTolerance
        )

        VStack(alignment: .leading, spacing: 14) {
            Text("SIMPLE’S READ")
                .font(.caption2.weight(.semibold))
                .tracking(1.8)
                .foregroundStyle(MSHColor.accent)

            if let best = result.bestOverallValue {
                Text(MSHGroceryComparisonModel.headline(for: best, result: result))
                    .font(.system(.title2, design: .serif, weight: .semibold))
                    .foregroundStyle(MSHColor.primaryText)

                Text(MSHGroceryComparisonModel.explanation(for: best, result: result))
                    .font(.system(.body, design: .serif))
                    .foregroundStyle(MSHColor.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)

                Divider().overlay(MSHColor.border)

                ForEach(result.quotes, id: \.id) { quote in
                    HStack(alignment: .firstTextBaseline) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(MSHGroceryComparisonModel.channelTitle(quote.channel))
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(MSHColor.primaryText)
                            Text(MSHGroceryComparisonModel.burdenText(quote))
                                .font(.caption)
                                .foregroundStyle(MSHColor.secondaryText)
                        }
                        Spacer(minLength: 10)
                        Text(MSHGroceryComparisonModel.money(quote.costs.total))
                            .font(.headline.monospacedDigit())
                            .foregroundStyle(MSHColor.primaryText)
                    }
                    .padding(.vertical, 4)
                }
            } else {
                Text("Add usable estimates to compare your options.")
                    .font(.system(.title3, design: .serif, weight: .semibold))
                    .foregroundStyle(MSHColor.primaryText)
            }
        }
        .mshSurface()
        .accessibilityIdentifier("grocery-comparison-result")
    }

    private var integrityNote: some View {
        Text("These are your editable estimates, not live store quotes. MSH keeps item cost, fees, travel cost, time, and effort distinct. The comparison suggests a tradeoff; you keep the decision.")
            .font(.footnote)
            .foregroundStyle(MSHColor.secondaryText)
            .fixedSize(horizontal: false, vertical: true)
    }
}

struct MSHGroceryQuoteDraft: Equatable {
    var channel: MSHAcquisitionChannel
    var itemTotal: String
    var fees: String
    var tip: String
    var travel: String
    var minutes: String
    var effort: MSHEffortLevel
}

private struct MSHGroceryQuoteEditor: View {
    let title: String
    let subtitle: String
    @Binding var draft: MSHGroceryQuoteDraft

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(.headline, design: .serif))
                        .foregroundStyle(MSHColor.primaryText)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(MSHColor.secondaryText)
                }
                Spacer()
                Image(systemName: icon)
                    .foregroundStyle(MSHColor.accent)
            }

            HStack(spacing: 10) {
                amountField("Items", text: $draft.itemTotal)
                amountField("Fees", text: $draft.fees)
            }
            HStack(spacing: 10) {
                amountField("Tip", text: $draft.tip)
                amountField("Travel", text: $draft.travel)
            }

            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("TOTAL MINUTES")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(MSHColor.secondaryText)
                    TextField("0", text: $draft.minutes)
                        .keyboardType(.numberPad)
                        .textFieldStyle(.roundedBorder)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("EFFORT")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(MSHColor.secondaryText)
                    Picker("Effort", selection: $draft.effort) {
                        Text("Low").tag(MSHEffortLevel.low)
                        Text("Moderate").tag(MSHEffortLevel.moderate)
                        Text("High").tag(MSHEffortLevel.high)
                    }
                    .pickerStyle(.menu)
                }
            }
        }
        .mshSurface()
    }

    private func amountField(_ label: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(MSHColor.secondaryText)
            HStack(spacing: 3) {
                Text("$").foregroundStyle(MSHColor.secondaryText)
                TextField("0.00", text: text)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .monospacedDigit()
            }
            .padding(.horizontal, 10)
            .frame(height: 40)
            .background(MSHColor.controlFill)
            .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))
        }
        .frame(maxWidth: .infinity)
    }

    private var icon: String {
        switch draft.channel {
        case .inStore: "cart"
        case .pickup: "bag"
        default: "car.side"
        }
    }
}

enum MSHGroceryComparisonModel {
    static let retailers = [
        "Costco",
        "Sam’s Club",
        "Target",
        "Kroger",
        "BJ’s Wholesale Club",
        "Aldi",
        "Whole Foods Market",
        "Fresh Thyme Market",
        "The Fresh Market",
        "Niemann Harvest Market"
    ]

    static func compare(
        retailer: String,
        drafts: [MSHGroceryQuoteDraft],
        convenienceTolerance: String
    ) -> MSHAcquisitionComparisonResult {
        let quotes = drafts.enumerated().compactMap { index, draft in
            quote(retailer: retailer, index: index, draft: draft)
        }
        let tolerance = moneyValue(convenienceTolerance).map { MSHMoney(cents: $0) }
        return MSHFinancialCore.compareAcquisitionOptions(
            quotes,
            preferences: MSHAcquisitionComparisonPreferences(
                maximumExtraSpendForConvenience: tolerance
            )
        )
    }

    static func quote(retailer: String, index: Int, draft: MSHGroceryQuoteDraft) -> MSHAcquisitionQuote? {
        guard let itemCents = moneyValue(draft.itemTotal), itemCents > 0 else { return nil }
        let feeCents = moneyValue(draft.fees) ?? 0
        let tipCents = moneyValue(draft.tip) ?? 0
        let travelCents = moneyValue(draft.travel) ?? 0
        let totalMinutes = Int(draft.minutes) ?? 0

        return MSHAcquisitionQuote(
            id: "manual|\(retailer)|\(draft.channel.rawValue)|\(index)",
            retailerName: retailer,
            channel: draft.channel,
            providerName: "Manual preview",
            basketID: "lp-preview",
            costs: MSHAcquisitionCostBreakdown(
                items: MSHMoney(cents: itemCents),
                fees: MSHMoney(cents: max(0, feeCents)),
                tip: MSHMoney(cents: max(0, tipCents)),
                travel: MSHMoney(cents: max(0, travelCents))
            ),
            roundTripMinutes: max(0, totalMinutes),
            shoppingMinutes: 0,
            effort: draft.effort,
            verification: .estimated,
            observedAt: Date(),
            provenance: .manual
        )
    }

    static func headline(for quote: MSHAcquisitionQuote, result: MSHAcquisitionComparisonResult) -> String {
        switch result.reason {
        case .bestValueWithinConvenienceTolerance:
            return "\(channelTitle(quote.channel)) looks like the best tradeoff."
        case .lowestMonetaryCost:
            return "\(channelTitle(quote.channel)) is the lowest-cost option."
        case .onlyEligibleOption:
            return "\(channelTitle(quote.channel)) is the only option in this comparison."
        case .insufficientVerifiedData:
            return "There isn’t enough information to compare yet."
        }
    }

    static func explanation(for quote: MSHAcquisitionQuote, result: MSHAcquisitionComparisonResult) -> String {
        guard let cheapest = result.lowestCost else {
            return "Change the estimates above and MSH will compare them again."
        }
        if quote.id == cheapest.id {
            return "Based on the estimates you entered, this has the lowest monetary acquisition cost. Time and effort remain visible separately."
        }
        let extra = quote.costs.total.cents - cheapest.costs.total.cents
        return "This costs about \(money(MSHMoney(cents: extra))) more than the lowest-cost option, but falls within the convenience amount you chose and reduces time or effort."
    }

    static func channelTitle(_ channel: MSHAcquisitionChannel) -> String {
        switch channel {
        case .inStore: "In store"
        case .pickup: "Pickup"
        case .retailerDelivery: "Retailer delivery"
        case .instacart: "Delivery"
        case .doordash: "DoorDash"
        case .uberEats: "Uber Eats"
        case .otherMarketplace: "Marketplace delivery"
        }
    }

    static func burdenText(_ quote: MSHAcquisitionQuote) -> String {
        let minutes = quote.totalMinutes.map { "\($0) min" } ?? "time unknown"
        return "\(minutes) · \(quote.effort.rawValue.capitalized) effort"
    }

    static func money(_ value: MSHMoney) -> String {
        let amount = Double(value.cents) / 100
        return amount.formatted(.currency(code: value.currency))
    }

    private static func moneyValue(_ text: String) -> Int64? {
        let cleaned = text
            .replacingOccurrences(of: "$", with: "")
            .replacingOccurrences(of: ",", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty, let decimal = Decimal(string: cleaned) else { return nil }
        let cents = decimal * 100
        return NSDecimalNumber(decimal: cents).rounding(
            accordingToBehavior: NSDecimalNumberHandler(
                roundingMode: .plain,
                scale: 0,
                raiseOnExactness: false,
                raiseOnOverflow: false,
                raiseOnUnderflow: false,
                raiseOnDivideByZero: false
            )
        ).int64Value
    }
}
