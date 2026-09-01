import Foundation
import Supabase
import SwiftUI

@MainActor
final class MSHAuthStore: ObservableObject {
    static let shared = MSHAuthStore()
    static let authCallbackURL = URL(string: "mysimplehealth://auth-callback")!

    @Published private(set) var session: Session?
    @Published private(set) var isResolvingSession = true
    @Published var errorMessage: String?
    @Published var noticeMessage: String?

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
        noticeMessage = nil
        await perform {
            _ = try await client.auth.signIn(email: email, password: password)
        }
    }

    func createAccount(email: String, password: String) async {
        noticeMessage = nil
        await perform {
            _ = try await client.auth.signUp(
                email: email,
                password: password,
                redirectTo: Self.authCallbackURL
            )
        }
        if errorMessage == nil {
            noticeMessage = "Account created. If email confirmation is required, check your inbox and return to My Simple Health."
        }
    }

    func signInWithGoogle() async {
        noticeMessage = nil
        await perform {
            _ = try await client.auth.signInWithOAuth(
                provider: .google,
                redirectTo: Self.authCallbackURL
            )
        }
    }

    func handleAuthCallback(_ url: URL) async {
        guard url.scheme?.lowercased() == "mysimplehealth",
              url.host?.lowercased() == "auth-callback" else {
            return
        }

        errorMessage = nil
        do {
            _ = try await client.auth.session(from: url)
            noticeMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signOut() async {
        noticeMessage = nil
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

struct MSHAuthenticatedRootExperience: View {
#if !DEBUG
    @StateObject private var authStore = MSHAuthStore.shared
#endif

    var body: some View {
#if DEBUG
        // Development-only bypass so the native app remains testable when auth is unavailable.
        MSHRootExperience()
#else
        Group {
            if authStore.isResolvingSession {
                ZStack {
                    MSHColor.cream.ignoresSafeArea()
                    ProgressView()
                        .tint(MSHColor.forest)
                }
            } else if authStore.isAuthenticated {
                MSHRootExperience()
            } else {
                MSHAuthGateView(store: authStore)
            }
        }
        .environmentObject(authStore)
#endif
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
            MSHColor.cream.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 24) {
                    Spacer(minLength: 52)

                    VStack(spacing: 10) {
                        Text("My Simple Health")
                            .font(.system(size: 18, weight: .semibold, design: .serif))
                            .foregroundStyle(MSHColor.forest)

                        Text(mode.title)
                            .font(.system(size: 34, weight: .medium, design: .serif))
                            .multilineTextAlignment(.center)
                            .foregroundStyle(MSHColor.charcoal)

                        Text("Your health information stays connected to your account and your choices.")
                            .font(.body)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(MSHColor.charcoal.opacity(0.72))
                    }

                    VStack(spacing: 14) {
                        TextField("Email", text: $email)
                            .textContentType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .padding(.horizontal, 16)
                            .frame(minHeight: 54)
                            .background(MSHColor.warmWhite)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                        SecureField("Password", text: $password)
                            .textContentType(mode == .signIn ? .password : .newPassword)
                            .padding(.horizontal, 16)
                            .frame(minHeight: 54)
                            .background(MSHColor.warmWhite)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                        Button {
                            submit()
                        } label: {
                            HStack {
                                if isWorking { ProgressView().tint(MSHColor.warmWhite) }
                                Text(mode.actionTitle)
                            }
                            .font(.body.weight(.semibold))
                            .foregroundStyle(MSHColor.warmWhite)
                            .frame(maxWidth: .infinity, minHeight: 54)
                            .background(MSHColor.forest)
                            .overlay {
                                RoundedRectangle(cornerRadius: 18, style: .continuous)
                                    .stroke(MSHColor.charcoal.opacity(0.32), lineWidth: 0.75)
                            }
                            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        }
                        .buttonStyle(.plain)
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
                                .foregroundStyle(MSHColor.forest)
                                .frame(maxWidth: .infinity, minHeight: 54)
                                .background(MSHColor.warmWhite.opacity(0.9))
                                .overlay {
                                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                                        .stroke(MSHColor.forest.opacity(0.18), lineWidth: 1)
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

                        if let notice = store.noticeMessage {
                            Text(notice)
                                .font(.footnote)
                                .foregroundStyle(MSHColor.charcoal.opacity(0.72))
                                .multilineTextAlignment(.center)
                        }
                    }

                    Button(mode == .signIn ? "New to MSH? Create an account" : "Already have an account? Log in") {
                        store.errorMessage = nil
                        store.noticeMessage = nil
                        mode = mode == .signIn ? .createAccount : .signIn
                    }
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(MSHColor.forest)
                    .frame(minHeight: 44)

                    HStack(spacing: 24) {
                        Link("Privacy", destination: URL(string: "https://mysimplehealth.org/privacy.html")!)
                        Link("Terms", destination: URL(string: "https://mysimplehealth.org/terms.html")!)
                    }
                    .font(.footnote)
                    .foregroundStyle(MSHColor.charcoal.opacity(0.66))

                    Spacer(minLength: 28)
                }
                .padding(.horizontal, 24)
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
            }
        }
        .tint(MSHColor.forest)
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
