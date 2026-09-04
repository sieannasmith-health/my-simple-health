import FirebaseAuth
import FirebaseFirestore
import SwiftUI

struct MSHFinancialAccountSummary: Identifiable {
    let id: String
    let name: String
    let type: String
    let subtype: String?
    let currentBalance: Double?
    let availableBalance: Double?
    let currencyCode: String
}

struct MSHFinancialTransactionSummary: Identifiable {
    let id: String
    let merchant: String
    let amount: Double
    let date: Date?
    let pending: Bool
}

@MainActor
final class MSHFinancialHealthController: ObservableObject {
    @Published private(set) var accounts: [MSHFinancialAccountSummary] = []
    @Published private(set) var transactions: [MSHFinancialTransactionSummary] = []
    @Published private(set) var connectionCount = 0
    @Published var errorMessage: String?

    private let db = Firestore.firestore()
    private var listeners: [ListenerRegistration] = []

    var totalCurrentBalance: Double? {
        let values = accounts.compactMap(\.currentBalance)
        return values.isEmpty ? nil : values.reduce(0, +)
    }

    func start() {
        guard listeners.isEmpty, let uid = Auth.auth().currentUser?.uid else { return }
        let user = db.collection("users").document(uid)

        listeners.append(user.collection("plaidConnections").addSnapshotListener { [weak self] snapshot, error in
            Task { @MainActor in
                if let error { self?.errorMessage = error.localizedDescription; return }
                self?.connectionCount = snapshot?.documents.count ?? 0
            }
        })

        listeners.append(user.collection("plaidAccounts").addSnapshotListener { [weak self] snapshot, error in
            Task { @MainActor in
                if let error { self?.errorMessage = error.localizedDescription; return }
                self?.accounts = snapshot?.documents.map { document in
                    let data = document.data()
                    return MSHFinancialAccountSummary(
                        id: document.documentID,
                        name: data["name"] as? String ?? data["officialName"] as? String ?? "Account",
                        type: data["type"] as? String ?? "account",
                        subtype: data["subtype"] as? String,
                        currentBalance: data["currentBalance"] as? Double ?? data["balanceCurrent"] as? Double,
                        availableBalance: data["availableBalance"] as? Double ?? data["balanceAvailable"] as? Double,
                        currencyCode: data["isoCurrencyCode"] as? String ?? "USD"
                    )
                }.sorted { $0.name < $1.name } ?? []
            }
        })

        listeners.append(user.collection("plaidTransactions").order(by: "date", descending: true).limit(to: 20).addSnapshotListener { [weak self] snapshot, error in
            Task { @MainActor in
                if let error { self?.errorMessage = error.localizedDescription; return }
                self?.transactions = snapshot?.documents.map { document in
                    let data = document.data()
                    let timestampDate = (data["date"] as? Timestamp)?.dateValue()
                    let stringDate = (data["date"] as? String).flatMap { ISO8601DateFormatter().date(from: $0) }
                    return MSHFinancialTransactionSummary(
                        id: document.documentID,
                        merchant: data["merchantName"] as? String ?? data["name"] as? String ?? "Transaction",
                        amount: data["amount"] as? Double ?? 0,
                        date: timestampDate ?? stringDate,
                        pending: data["pending"] as? Bool ?? false
                    )
                } ?? []
            }
        })
    }

    func stop() {
        listeners.forEach { $0.remove() }
        listeners.removeAll()
    }
}

struct MSHFinancialHealthScreen: View {
    @StateObject private var controller = MSHFinancialHealthController()

    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    header
                    financialPicture
                    accounts
                    recentActivity
                    capabilities
                    simpleAndAdvocate
                }
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 40)
            }
        }
        .navigationTitle("Financial Health")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(MSHColor.canvas, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .onAppear { controller.start() }
        .onDisappear { controller.stop() }
        .accessibilityIdentifier("financial-health-native")
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("FINANCIAL HEALTH")
                .font(.caption2.weight(.semibold))
                .tracking(2.2)
                .foregroundStyle(MSHFinancialPalette.gold)
            Text("Your money is part of your health story.")
                .font(.system(size: 31, weight: .medium, design: .serif))
                .foregroundStyle(MSHColor.primaryText)
            Text("Understand what you have, what is moving, what is ahead, and what options may help without reducing financial wellbeing to a budget score.")
                .font(.system(size: 16, design: .serif))
                .foregroundStyle(MSHColor.secondaryText)
        }
    }

    private var financialPicture: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionLabel("YOUR FINANCIAL PICTURE")
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(controller.totalCurrentBalance.map(currency) ?? "Connect to begin")
                        .font(.system(size: 30, weight: .medium, design: .serif))
                        .foregroundStyle(MSHColor.primaryText)
                    Text(controller.accounts.isEmpty ? "Your accounts can appear here when you choose to connect them." : "Across \(controller.accounts.count) connected account\(controller.accounts.count == 1 ? "" : "s")")
                        .font(.caption)
                        .foregroundStyle(MSHColor.secondaryText)
                }
                Spacer()
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.title2)
                    .foregroundStyle(MSHFinancialPalette.sage)
            }
            .padding(20)
            .background(MSHColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay { RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(MSHColor.border, lineWidth: 0.5) }

            NavigationLink { MSHPlaidConnectionScreen() } label: {
                Label(controller.connectionCount == 0 ? "Connect financial accounts" : "Manage financial connections", systemImage: "building.columns")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(MSHColor.accent)
            }
            .buttonStyle(.plain)
        }
    }

    @ViewBuilder private var accounts: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionLabel("ACCOUNTS")
            if controller.accounts.isEmpty {
                emptyCard("Checking, savings, credit, loans, and investments you choose to connect will live here.", icon: "wallet.bifold")
            } else {
                ForEach(controller.accounts) { account in
                    HStack(spacing: 14) {
                        Image(systemName: account.type.lowercased().contains("credit") ? "creditcard" : "building.columns")
                            .foregroundStyle(MSHFinancialPalette.sage)
                            .frame(width: 38, height: 38)
                            .background(MSHFinancialPalette.sage.opacity(0.12))
                            .clipShape(Circle())
                        VStack(alignment: .leading, spacing: 3) {
                            Text(account.name).font(.system(.headline, design: .serif))
                            Text([account.type.capitalized, account.subtype?.capitalized].compactMap { $0 }.joined(separator: " · "))
                                .font(.caption).foregroundStyle(MSHColor.secondaryText)
                        }
                        Spacer()
                        if let balance = account.currentBalance {
                            Text(currency(balance)).font(.subheadline.weight(.semibold))
                        }
                    }
                    .padding(.vertical, 8)
                }
            }
        }
    }

    @ViewBuilder private var recentActivity: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionLabel("RECENT ACTIVITY")
            if controller.transactions.isEmpty {
                emptyCard("Transactions will organize here with merchant, amount, timing, category, and later their relationship to goals, projects, healthcare, food, and opportunities.", icon: "list.bullet.rectangle")
            } else {
                ForEach(controller.transactions.prefix(8)) { transaction in
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(transaction.merchant).font(.system(.headline, design: .serif))
                            Text(transaction.pending ? "Pending" : (transaction.date?.formatted(date: .abbreviated, time: .omitted) ?? "Recent"))
                                .font(.caption).foregroundStyle(MSHColor.secondaryText)
                        }
                        Spacer()
                        Text(currency(transaction.amount)).font(.subheadline.weight(.semibold))
                    }
                    .padding(.vertical, 7)
                }
            }
        }
    }

    private var capabilities: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionLabel("UNDERSTAND & PLAN")
            LazyVGrid(columns: columns, spacing: 12) {
                capability("Spending", "Where money is going", "chart.pie")
                capability("Recurring", "Bills & subscriptions", "repeat")
                capability("Savings", "Margin & goals", "banknote")
                capability("Credit & Debt", "Obligations & factors", "creditcard")
                capability("Financial Wellbeing", "Security, strain & freedom", "heart.text.square")
                capability("Documents", "Receipts & records", "doc.text")
            }
        }
    }

    private var simpleAndAdvocate: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionLabel("SIMPLE")
            VStack(alignment: .leading, spacing: 9) {
                Text("Understand first. Decide second.")
                    .font(.system(.title3, design: .serif, weight: .semibold))
                Text("Simple will connect your financial information with the context you choose to share, teach financial concepts, help organize decisions, and surface questions worth investigating.")
                    .font(.subheadline).foregroundStyle(MSHColor.secondaryText)
                Divider()
                Label("Know Your Options", systemImage: "sparkles")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(MSHFinancialPalette.gold)
                Text("Advocate is designed to investigate potential savings, benefits, assistance, negotiation, coverage, rights, appeals, and tax relevance. Opportunities stay potential until they are verified.")
                    .font(.caption).foregroundStyle(MSHColor.secondaryText)
            }
            .padding(20)
            .background(LinearGradient(colors: [MSHFinancialPalette.warmIvory, MSHColor.surface], startPoint: .topLeading, endPoint: .bottomTrailing))
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay { RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(MSHColor.border, lineWidth: 0.5) }
        }
    }

    private func capability(_ title: String, _ subtitle: String, _ icon: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon).foregroundStyle(MSHFinancialPalette.sage)
            Text(title).font(.system(.headline, design: .serif))
            Text(subtitle).font(.caption).foregroundStyle(MSHColor.secondaryText)
        }
        .frame(maxWidth: .infinity, minHeight: 100, alignment: .topLeading)
        .padding(14)
        .background(MSHColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: 19, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: 19, style: .continuous).stroke(MSHColor.border.opacity(0.8), lineWidth: 0.5) }
    }

    private func emptyCard(_ text: String, icon: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon).foregroundStyle(MSHFinancialPalette.sage)
            Text(text).font(.subheadline).foregroundStyle(MSHColor.secondaryText).fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(MSHColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text).font(.caption2.weight(.semibold)).tracking(1.6).foregroundStyle(MSHFinancialPalette.gold)
    }

    private func currency(_ amount: Double) -> String {
        amount.formatted(.currency(code: "USD"))
    }
}

private enum MSHFinancialPalette {
    static let sage = Color(red: 149 / 255, green: 153 / 255, blue: 129 / 255)
    static let gold = Color(red: 174 / 255, green: 144 / 255, blue: 86 / 255)
    static let warmIvory = Color(red: 248 / 255, green: 247 / 255, blue: 243 / 255)
}
