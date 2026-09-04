import SwiftUI

// MARK: - Savings domain

struct MSHSavingsOffer: Identifiable, Codable, Equatable {
    enum Category: String, Codable, CaseIterable, Identifiable {
        case foodNutrition
        case personalCare
        case everydayHealth
        case movement
        case sleep
        case family

        var id: String { rawValue }

        var title: String {
            switch self {
            case .foodNutrition: "Food & Nutrition"
            case .personalCare: "Personal Care"
            case .everydayHealth: "Everyday Health"
            case .movement: "Movement"
            case .sleep: "Sleep"
            case .family: "Family"
            }
        }

        var systemImage: String {
            switch self {
            case .foodNutrition: "leaf"
            case .personalCare: "hands.sparkles"
            case .everydayHealth: "cross.case"
            case .movement: "figure.walk.motion"
            case .sleep: "moon.stars"
            case .family: "house.and.flag"
            }
        }
    }

    enum Benefit: Codable, Equatable {
        case dollarsOff(amount: Decimal)
        case percentOff(percent: Int)
        case cashBack(amount: Decimal)

        var headline: String {
            switch self {
            case .dollarsOff(let amount): "\(amount.currencyText) OFF"
            case .percentOff(let percent): "\(percent)% OFF"
            case .cashBack(let amount): "\(amount.currencyText) BACK"
            }
        }

        var maximumValue: Decimal? {
            switch self {
            case .dollarsOff(let amount), .cashBack(let amount): amount
            case .percentOff: nil
            }
        }
    }

    let id: UUID
    let title: String
    let brand: String?
    let category: Category
    let benefit: Benefit
    let details: String
    let expiresAt: Date?
    let redemptionLabel: String?
    let isPreview: Bool
}

private extension Decimal {
    var currencyText: String {
        let number = NSDecimalNumber(decimal: self)
        return number.formatted(.currency(code: Locale.current.currency?.identifier ?? "USD"))
    }
}

enum MSHSavingsDecision: String, Codable, Equatable {
    case saved
    case skipped
    case later
}

struct MSHSavingsPreferenceProfile: Codable, Equatable {
    var preferredCategories: Set<MSHSavingsOffer.Category> = []
    var dislikedCategories: Set<MSHSavingsOffer.Category> = []

    mutating func learn(from offer: MSHSavingsOffer, decision: MSHSavingsDecision) {
        switch decision {
        case .saved:
            preferredCategories.insert(offer.category)
            dislikedCategories.remove(offer.category)
        case .skipped:
            // A single skip is a weak signal. Do not turn it into a permanent dislike.
            break
        case .later:
            // "Maybe later" intentionally carries no preference signal.
            break
        }
    }
}

@MainActor
final class MSHSavingsStore: ObservableObject {
    @Published private(set) var offers: [MSHSavingsOffer]
    @Published private(set) var decisions: [UUID: MSHSavingsDecision]
    @Published private(set) var preferences: MSHSavingsPreferenceProfile
    @Published private(set) var redeemedSavings: Decimal

    private let defaults: UserDefaults
    private let decisionsKey = "msh.savings.decisions.v1"
    private let preferencesKey = "msh.savings.preferences.v1"
    private let redeemedSavingsKey = "msh.savings.redeemedValue.v1"

    init(
        offers: [MSHSavingsOffer] = MSHSavingsOffer.previewOffers,
        defaults: UserDefaults = .standard
    ) {
        self.offers = offers
        self.defaults = defaults

        if let data = defaults.data(forKey: decisionsKey),
           let stored = try? JSONDecoder().decode([UUID: MSHSavingsDecision].self, from: data) {
            decisions = stored
        } else {
            decisions = [:]
        }

        if let data = defaults.data(forKey: preferencesKey),
           let stored = try? JSONDecoder().decode(MSHSavingsPreferenceProfile.self, from: data) {
            preferences = stored
        } else {
            preferences = MSHSavingsPreferenceProfile()
        }

        if let saved = defaults.string(forKey: redeemedSavingsKey),
           let decimal = Decimal(string: saved) {
            redeemedSavings = decimal
        } else {
            redeemedSavings = 0
        }
    }

    var currentOffer: MSHSavingsOffer? {
        rankedAvailableOffers.first
    }

    var savedOffers: [MSHSavingsOffer] {
        offers.filter { decisions[$0.id] == .saved }
    }

    var availableCount: Int {
        offers.filter { decisions[$0.id] == nil || decisions[$0.id] == .later }.count
    }

    var potentialSavedValue: Decimal {
        savedOffers.compactMap(\.benefit.maximumValue).reduce(0, +)
    }

    var rankedAvailableOffers: [MSHSavingsOffer] {
        offers
            .filter { decisions[$0.id] == nil || decisions[$0.id] == .later }
            .sorted { lhs, rhs in
                let lhsScore = relevanceScore(for: lhs)
                let rhsScore = relevanceScore(for: rhs)
                if lhsScore == rhsScore { return lhs.title < rhs.title }
                return lhsScore > rhsScore
            }
    }

    func decide(_ decision: MSHSavingsDecision, for offer: MSHSavingsOffer) {
        decisions[offer.id] = decision
        preferences.learn(from: offer, decision: decision)
        persist()
    }

    func restore(_ offer: MSHSavingsOffer) {
        decisions.removeValue(forKey: offer.id)
        persist()
    }

    func recordRedeemedSavings(_ amount: Decimal) {
        guard amount > 0 else { return }
        redeemedSavings += amount
        persist()
    }

    private func relevanceScore(for offer: MSHSavingsOffer) -> Int {
        // Version 1 deliberately uses only explicit savings preferences and savings behavior.
        // Health conditions, diagnoses, labs, medications, symptoms, and Simple conversation
        // content are not commercial-targeting inputs here.
        preferences.preferredCategories.contains(offer.category) ? 10 : 0
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(decisions) {
            defaults.set(data, forKey: decisionsKey)
        }
        if let data = try? JSONEncoder().encode(preferences) {
            defaults.set(data, forKey: preferencesKey)
        }
        defaults.set(NSDecimalNumber(decimal: redeemedSavings).stringValue, forKey: redeemedSavingsKey)
    }
}

// MARK: - Native Savings experience

struct MSHSavingsScreen: View {
    @StateObject private var store: MSHSavingsStore
    @State private var dragOffset: CGSize = .zero
    @State private var showSavedOffers = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(store: MSHSavingsStore? = nil) {
        _store = StateObject(wrappedValue: store ?? MSHSavingsStore())
    }

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    header
                    valueSummary
                    offerDeck
                    privacyNote
                }
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 40)
            }
        }
        .navigationTitle("MSH Savings")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(MSHColor.canvas, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .sheet(isPresented: $showSavedOffers) {
            NavigationStack {
                MSHSavedOffersScreen(store: store)
            }
        }
        .accessibilityIdentifier("msh-savings-screen")
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("MSH SAVINGS")
                .font(.caption2.weight(.semibold))
                .tracking(2.2)
                .foregroundStyle(MSHColor.accent)
            Text("More value from your membership.")
                .font(.system(size: 30, weight: .medium, design: .serif))
                .foregroundStyle(MSHColor.primaryText)
            Text("Browse health and wellness savings that fit what you choose. Save what is useful, skip what is not.")
                .font(.system(size: 16, design: .serif))
                .foregroundStyle(MSHColor.secondaryText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var valueSummary: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Saved through MSH")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(MSHColor.secondaryText)
                    Text(store.redeemedSavings.currencyText)
                        .font(.system(size: 30, weight: .medium, design: .serif))
                        .foregroundStyle(MSHColor.primaryText)
                }
                Spacer()
                Button("Saved offers") { showSavedOffers = true }
                    .buttonStyle(.plain)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(MSHColor.accent)
            }

            HStack(spacing: 18) {
                valueStat(title: "Available", value: "\(store.availableCount)")
                valueStat(title: "Saved", value: "\(store.savedOffers.count)")
                valueStat(title: "Potential value", value: store.potentialSavedValue.currencyText)
            }
        }
        .mshSurface()
    }

    private func valueStat(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value)
                .font(.headline)
                .foregroundStyle(MSHColor.primaryText)
            Text(title)
                .font(.caption2)
                .foregroundStyle(MSHColor.secondaryText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var offerDeck: some View {
        if let offer = store.currentOffer {
            VStack(spacing: 16) {
                MSHSavingsOfferCard(offer: offer)
                    .offset(x: dragOffset.width, y: dragOffset.height * 0.12)
                    .rotationEffect(.degrees(Double(dragOffset.width / 28)))
                    .gesture(
                        DragGesture(minimumDistance: 16)
                            .onChanged { value in dragOffset = value.translation }
                            .onEnded { value in finishDrag(value, offer: offer) }
                    )

                HStack(spacing: 12) {
                    savingsAction(title: "Not for me", systemImage: "xmark", decision: .skipped, offer: offer)
                    savingsAction(title: "Later", systemImage: "clock", decision: .later, offer: offer)
                    savingsAction(title: "Save", systemImage: "bookmark", decision: .saved, offer: offer, prominent: true)
                }
            }
            .accessibilityElement(children: .contain)
        } else {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: "checkmark.circle")
                    .font(.title2)
                    .foregroundStyle(MSHColor.accent)
                Text("You're caught up.")
                    .font(.system(.title3, design: .serif, weight: .semibold))
                    .foregroundStyle(MSHColor.primaryText)
                Text("There are no more offers to review right now. MSH Savings can stay quiet until there is something new.")
                    .foregroundStyle(MSHColor.secondaryText)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .mshSurface()
        }
    }

    private func savingsAction(
        title: String,
        systemImage: String,
        decision: MSHSavingsDecision,
        offer: MSHSavingsOffer,
        prominent: Bool = false
    ) -> some View {
        Button {
            decide(decision, offer: offer)
        } label: {
            Label(title, systemImage: systemImage)
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity)
                .frame(height: 46)
                .foregroundStyle(prominent ? Color.white : MSHColor.primaryText)
                .background(prominent ? MSHColor.forest : MSHColor.controlFill)
                .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("savings-\(decision.rawValue)")
    }

    private var privacyNote: some View {
        VStack(alignment: .leading, spacing: 7) {
            Label("Your savings preferences are separate from your health guidance.", systemImage: "lock.shield")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(MSHColor.primaryText)
            Text("This first version learns only from what you save, skip, and explicitly choose in Savings. Health conditions and clinical information are not used to target offers.")
                .font(.caption)
                .foregroundStyle(MSHColor.secondaryText)
        }
        .padding(.horizontal, 2)
    }

    private func finishDrag(_ value: DragGesture.Value, offer: MSHSavingsOffer) {
        let threshold: CGFloat = 105
        if value.translation.width > threshold {
            decide(.saved, offer: offer)
        } else if value.translation.width < -threshold {
            decide(.skipped, offer: offer)
        } else {
            resetDrag()
        }
    }

    private func decide(_ decision: MSHSavingsDecision, offer: MSHSavingsOffer) {
        let targetX: CGFloat = decision == .saved ? 560 : decision == .skipped ? -560 : 0
        if reduceMotion || decision == .later {
            store.decide(decision, for: offer)
            dragOffset = .zero
            return
        }

        withAnimation(.easeIn(duration: 0.18)) {
            dragOffset.width = targetX
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            store.decide(decision, for: offer)
            dragOffset = .zero
        }
    }

    private func resetDrag() {
        withAnimation(reduceMotion ? nil : .spring(response: 0.28, dampingFraction: 0.82)) {
            dragOffset = .zero
        }
    }
}

private struct MSHSavingsOfferCard: View {
    let offer: MSHSavingsOffer

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Label(offer.category.title, systemImage: offer.category.systemImage)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(MSHColor.secondaryText)
                Spacer()
                if offer.isPreview {
                    Text("PREVIEW")
                        .font(.caption2.weight(.bold))
                        .tracking(1.2)
                        .foregroundStyle(MSHColor.secondaryText)
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(offer.benefit.headline)
                    .font(.system(size: 36, weight: .medium, design: .serif))
                    .foregroundStyle(MSHColor.forest)
                Text(offer.title)
                    .font(.system(.title2, design: .serif, weight: .semibold))
                    .foregroundStyle(MSHColor.primaryText)
                if let brand = offer.brand {
                    Text(brand)
                        .font(.subheadline)
                        .foregroundStyle(MSHColor.secondaryText)
                }
            }

            Text(offer.details)
                .font(.body)
                .foregroundStyle(MSHColor.secondaryText)

            HStack {
                if let redemptionLabel = offer.redemptionLabel {
                    Label(redemptionLabel, systemImage: "cart")
                }
                Spacer()
                if let expiresAt = offer.expiresAt {
                    Text("Ends \(expiresAt.formatted(date: .abbreviated, time: .omitted))")
                }
            }
            .font(.caption)
            .foregroundStyle(MSHColor.secondaryText)
        }
        .padding(24)
        .frame(maxWidth: .infinity, minHeight: 320, alignment: .topLeading)
        .background(MSHColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(MSHColor.border, lineWidth: 0.8)
        }
        .shadow(color: Color.black.opacity(0.06), radius: 18, y: 8)
        .accessibilityIdentifier("savings-offer-card")
    }
}

private struct MSHSavedOffersScreen: View {
    @ObservedObject var store: MSHSavingsStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()
            if store.savedOffers.isEmpty {
                ContentUnavailableView(
                    "No saved offers",
                    systemImage: "bookmark",
                    description: Text("Offers you want to keep will appear here.")
                )
            } else {
                List {
                    ForEach(store.savedOffers) { offer in
                        VStack(alignment: .leading, spacing: 5) {
                            Text(offer.benefit.headline)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(MSHColor.accent)
                            Text(offer.title)
                                .font(.system(.headline, design: .serif))
                            Text(offer.category.title)
                                .font(.caption)
                                .foregroundStyle(MSHColor.secondaryText)
                        }
                        .listRowBackground(MSHColor.surface)
                        .swipeActions {
                            Button("Remove", role: .destructive) { store.restore(offer) }
                        }
                    }
                }
                .scrollContentBackground(.hidden)
            }
        }
        .navigationTitle("Saved Offers")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Done") { dismiss() }
            }
        }
    }
}

// MARK: - Preview data only

extension MSHSavingsOffer {
    static let previewOffers: [MSHSavingsOffer] = {
        let calendar = Calendar.current
        let now = Date()

        return [
            MSHSavingsOffer(
                id: UUID(uuidString: "8D315F21-4D77-42CE-A7F6-05B83B90DB91")!,
                title: "Plain Greek yogurt",
                brand: "Sample partner",
                category: .foodNutrition,
                benefit: .dollarsOff(amount: 2),
                details: "A sample MSH Savings offer used to build and test the member experience.",
                expiresAt: calendar.date(byAdding: .day, value: 14, to: now),
                redemptionLabel: "Eligible retailers",
                isPreview: true
            ),
            MSHSavingsOffer(
                id: UUID(uuidString: "E234BA66-6E67-4FE4-A580-7058519A605B")!,
                title: "Fragrance-free personal care",
                brand: "Sample partner",
                category: .personalCare,
                benefit: .dollarsOff(amount: 3),
                details: "Preview savings for an eligible personal-care purchase. No real coupon is issued in this build.",
                expiresAt: calendar.date(byAdding: .day, value: 21, to: now),
                redemptionLabel: "Eligible retailers",
                isPreview: true
            ),
            MSHSavingsOffer(
                id: UUID(uuidString: "47F30D86-374A-4CA5-AFE1-EBE4A170C2D1")!,
                title: "Home movement equipment",
                brand: "Sample partner",
                category: .movement,
                benefit: .percentOff(percent: 15),
                details: "A sample member offer for equipment someone has already chosen to shop for.",
                expiresAt: calendar.date(byAdding: .day, value: 30, to: now),
                redemptionLabel: "Online",
                isPreview: true
            ),
            MSHSavingsOffer(
                id: UUID(uuidString: "3A5C4B89-B7DD-44BB-9D08-EB6F7B7CE809")!,
                title: "Oral care essentials",
                brand: "Sample partner",
                category: .everydayHealth,
                benefit: .cashBack(amount: 4),
                details: "Preview cash-back style value for an eligible everyday-health purchase.",
                expiresAt: calendar.date(byAdding: .day, value: 18, to: now),
                redemptionLabel: "Eligible retailers",
                isPreview: true
            )
        ]
    }()
}
