import FirebaseAuth
import FirebaseFirestore
import FirebaseFunctions
import LinkKit
import SwiftUI

struct MSHPlaidConnectionSummary: Identifiable, Equatable {
    let id: String
    let status: String
    let lastSuccessfulSyncAt: Date?
}

@MainActor
final class MSHPlaidConnectionController: ObservableObject {
    @Published private(set) var connections: [MSHPlaidConnectionSummary] = []
    @Published private(set) var isWorking = false
    @Published private(set) var isLinkReady = false
    @Published var isPresentingLink = false
    @Published var errorMessage: String?

    private(set) var linkSession: PlaidLinkSession?

    private let functions = Functions.functions(region: "us-central1")
    private let db = Firestore.firestore()
    nonisolated(unsafe) private var listener: ListenerRegistration?

    deinit {
        listener?.remove()
    }

    func start() {
        guard listener == nil, let uid = Auth.auth().currentUser?.uid else { return }
        listener = db.collection("users")
            .document(uid)
            .collection("plaidConnections")
            .addSnapshotListener { [weak self] snapshot, error in
                Task { @MainActor in
                    guard let self else { return }
                    if let error {
                        self.errorMessage = error.localizedDescription
                        return
                    }

                    self.connections = snapshot?.documents.compactMap { document in
                        let data = document.data()
                        return MSHPlaidConnectionSummary(
                            id: document.documentID,
                            status: data["status"] as? String ?? "connected",
                            lastSuccessfulSyncAt: (data["lastSuccessfulSyncAt"] as? Timestamp)?.dateValue()
                        )
                    }
                    .sorted { $0.id < $1.id } ?? []
                }
            }
    }

    func stop() {
        listener?.remove()
        listener = nil
    }

    func beginConnection() {
        guard !isWorking else { return }
        errorMessage = nil
        isWorking = true
        isLinkReady = false

        Task {
            defer { isWorking = false }
            do {
                guard Auth.auth().currentUser != nil else {
                    throw MSHPlaidConnectionError.notSignedIn
                }

                let result = try await functions
                    .httpsCallable("createPlaidLinkToken")
                    .call()
                guard let payload = result.data as? [String: Any],
                      let linkToken = payload["linkToken"] as? String,
                      !linkToken.isEmpty else {
                    throw MSHPlaidConnectionError.invalidLinkToken
                }

                createLinkSession(linkToken: linkToken)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func sync(_ connection: MSHPlaidConnectionSummary) {
        guard !isWorking else { return }
        errorMessage = nil
        isWorking = true

        Task {
            defer { isWorking = false }
            do {
                _ = try await functions
                    .httpsCallable("syncPlaidItem")
                    .call(["itemId": connection.id])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func disconnect(_ connection: MSHPlaidConnectionSummary) {
        guard !isWorking else { return }
        errorMessage = nil
        isWorking = true

        Task {
            defer { isWorking = false }
            do {
                _ = try await functions
                    .httpsCallable("disconnectPlaidItem")
                    .call(["itemId": connection.id])
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func createLinkSession(linkToken: String) {
        let configuration = LinkTokenConfiguration(
            token: linkToken,
            onSuccess: { [weak self] success in
                Task { @MainActor in
                    self?.isPresentingLink = false
                    self?.isLinkReady = false
                    self?.linkSession = nil
                    await self?.exchange(publicToken: success.publicToken)
                }
            },
            onExit: { [weak self] exit in
                Task { @MainActor in
                    self?.isPresentingLink = false
                    self?.isLinkReady = false
                    self?.linkSession = nil
                    if let error = exit.error {
                        self?.errorMessage = error.displayMessage ?? error.errorMessage
                    }
                }
            },
            onEvent: { _ in },
            onLoad: { [weak self] in
                Task { @MainActor in
                    self?.isLinkReady = true
                }
            }
        )

        do {
            linkSession = try Plaid.createPlaidLinkSession(configuration: configuration)
            isLinkReady = true
            isPresentingLink = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func exchange(publicToken: String) async {
        isWorking = true
        defer { isWorking = false }

        do {
            _ = try await functions
                .httpsCallable("exchangePlaidPublicToken")
                .call(["publicToken": publicToken])
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct MSHPlaidConnectionScreen: View {
    @StateObject private var controller = MSHPlaidConnectionController()

    var body: some View {
        List {
            Section {
                Text("Connect accounts you choose. Each financial connection belongs to your MSH account unless you explicitly share selected information later.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }

            Section("Connected institutions") {
                if controller.connections.isEmpty {
                    Text("No financial accounts connected yet.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(controller.connections) { connection in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Image(systemName: connection.status == "connected" ? "checkmark.circle.fill" : "exclamationmark.circle")
                                Text(connection.status == "connected" ? "Connected" : "Needs attention")
                                Spacer()
                            }

                            if let lastSync = connection.lastSuccessfulSyncAt {
                                Text("Last updated \(lastSync.formatted(date: .abbreviated, time: .shortened))")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            HStack {
                                Button("Refresh") { controller.sync(connection) }
                                Spacer()
                                Button("Disconnect", role: .destructive) { controller.disconnect(connection) }
                            }
                            .font(.callout.weight(.semibold))
                        }
                        .padding(.vertical, 4)
                    }
                }
            }

            Section {
                Button {
                    controller.beginConnection()
                } label: {
                    HStack {
                        if controller.isWorking { ProgressView() }
                        Text("Connect financial account")
                    }
                    .frame(maxWidth: .infinity)
                }
                .disabled(controller.isWorking)
            }

            if let errorMessage = controller.errorMessage {
                Section {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }
        }
        .navigationTitle("Financial Connections")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { controller.start() }
        .onDisappear { controller.stop() }
        .sheet(isPresented: $controller.isPresentingLink) {
            if let linkSession = controller.linkSession {
                linkSession.sheet()
            } else {
                ProgressView()
            }
        }
        .accessibilityIdentifier("plaid-financial-connections")
    }
}

private enum MSHPlaidConnectionError: LocalizedError {
    case notSignedIn
    case invalidLinkToken

    var errorDescription: String? {
        switch self {
        case .notSignedIn:
            "Sign in to connect a financial account."
        case .invalidLinkToken:
            "My Simple Health could not start the secure financial connection."
        }
    }
}
