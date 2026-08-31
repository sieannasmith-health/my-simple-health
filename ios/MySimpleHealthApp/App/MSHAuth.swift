import Foundation
import Supabase
import SwiftUI

@MainActor
final class MSHAuthStore: ObservableObject {
    static let shared = MSHAuthStore()

    @Published private(set) var session: Session?
    @Published private(set) var isResolvingSession = true
    @Published var errorMessage: String?

    let client: SupabaseClient
    private var authTask: Task<Void, Never>?

    private init() {
        client = SupabaseClient(
            supabaseURL: URL(string: "https://dcweyvlimvkljlqkzhbs.supabase.co")!,
            supabaseKey: "sb_publishable_eDu5tCF5ngIB1kPVVud-8w_grUSJhNa"
        )

        authTask = Task { [weak self] in
            guard let self else { return }
            for await state in client.auth.authStateChanges {
                switch state.event {
                case .initialSession, .signedIn, .signedOut, .tokenRefreshed, .userUpdated:
                    session = state.session
                    isResolvingSession = false
                default:
                    break
                }
            }
        }
    }

    deinit {
        authTask?.cancel()
    }

    var isAuthenticated: Bool { session != nil }
    var userEmail: String? { session?.user.email }
    var userID: UUID? { session?.user.id }

    func signIn(email: String, password: String) async {
        await perform {
            _ = try await client.auth.signIn(email: email, password: password)
        }
    }

    func createAccount(email: String, password: String) async {
        await perform {
            _ = try await client.auth.signUp(email: email, password: password)
        }
    }

    func signInWithGoogle() async {
        await perform {
            _ = try await client.auth.signInWithOAuth(provider: .google)
        }
    }

    func signOut() async {
        await perform {
            try await client.auth.signOut()
        }
    }

    private func perform(_ operation: () async throws -> Void) async {
        errorMessage = nil
        do {
            try await operation()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct MSHAuthGateView: View {
    @ObservedObject var store: MSHAuthStore
    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var isWorking = false

    private enum Mode {
        case signIn
        case createAccount

        var title: String {
            switch self {
            case .signIn: "Welcome back"
            case .createAccount: "Create your account"
            }
        }

        var actionTitle: String {
            switch self {
            case .signIn: "Log in"
            case .createAccount: "Create account"
            }
        }
    }

    var body: some View {
        ZStack {
            MSHOnboardingPalette.cream.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 24) {
                    Spacer(minLength: 52)

                    VStack(spacing: 10) {
                        Text("My Simple Health")
                            .font(.system(size: 18, weight: .semibold, design: .serif))
                            .foregroundStyle(MSHOnboardingPalette.forest)

                        Text(mode.title)
                            .font(.system(size: 34, weight: .medium, design: .serif))
                            .multilineTextAlignment(.center)
                            .foregroundStyle(MSHOnboardingPalette.charcoal)

                        Text("Your health information stays connected to your account and your choices.")
                            .font(.body)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(MSHOnboardingPalette.charcoal.opacity(0.72))
                    }

                    VStack(spacing: 14) {
                        TextField("Email", text: $email)
                            .textContentType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .padding(.horizontal, 16)
                            .frame(minHeight: 54)
                            .background(MSHOnboardingPalette.warmWhite)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                        SecureField("Password", text: $password)
                            .textContentType(mode == .signIn ? .password : .newPassword)
                            .padding(.horizontal, 16)
                            .frame(minHeight: 54)
                            .background(MSHOnboardingPalette.warmWhite)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                        Button {
                            submit()
                        } label: {
                            HStack {
                                if isWorking { ProgressView().tint(.white) }
                                Text(mode.actionTitle)
                            }
                            .font(.body.weight(.semibold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, minHeight: 54)
                            .background(MSHOnboardingPalette.forest)
                            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        }
                        .disabled(isWorking || email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || password.count < 6)

                        Button {
                            Task {
                                isWorking = true
                                await store.signInWithGoogle()
                                isWorking = false
                            }
                        } label: {
                            Text("Continue with Google")
                                .font(.body.weight(.semibold))
                                .foregroundStyle(MSHOnboardingPalette.forest)
                                .frame(maxWidth: .infinity, minHeight: 54)
                                .background(MSHOnboardingPalette.warmWhite.opacity(0.9))
                                .overlay {
                                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                                        .stroke(MSHOnboardingPalette.forest.opacity(0.18), lineWidth: 1)
                                }
                                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        }
                        .disabled(isWorking)

                        if let error = store.errorMessage {
                            Text(error)
                                .font(.footnote)
                                .foregroundStyle(.red)
                                .multilineTextAlignment(.center)
                        }
                    }

                    Button(mode == .signIn ? "New to MSH? Create an account" : "Already have an account? Log in") {
                        store.errorMessage = nil
                        mode = mode == .signIn ? .createAccount : .signIn
                    }
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(MSHOnboardingPalette.forest)
                    .frame(minHeight: 44)

                    HStack(spacing: 24) {
                        Link("Privacy", destination: URL(string: "https://mysimplehealth.org/privacy.html")!)
                        Link("Terms", destination: URL(string: "https://mysimplehealth.org/terms.html")!)
                    }
                    .font(.footnote)
                    .foregroundStyle(MSHOnboardingPalette.charcoal.opacity(0.66))

                    Spacer(minLength: 28)
                }
                .padding(.horizontal, 24)
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
            }
        }
        .tint(MSHOnboardingPalette.forest)
    }

    private func submit() {
        guard !isWorking else { return }
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        isWorking = true
        Task {
            switch mode {
            case .signIn:
                await store.signIn(email: cleanEmail, password: password)
            case .createAccount:
                await store.createAccount(email: cleanEmail, password: password)
            }
            isWorking = false
        }
    }
}
