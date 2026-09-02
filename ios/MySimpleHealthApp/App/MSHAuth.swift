import FirebaseAuth
import FirebaseCore
import Foundation
import GoogleSignIn
import SwiftUI
import UIKit

@MainActor
final class MSHAuthStore: ObservableObject {
    static let shared = MSHAuthStore()

    @Published private(set) var user: User?
    @Published private(set) var isResolvingSession = true
    @Published var errorMessage: String?
    @Published var noticeMessage: String?

    private var authStateHandle: AuthStateDidChangeListenerHandle?

    private init() {
        user = Auth.auth().currentUser
        isResolvingSession = false

        authStateHandle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor in
                self?.user = user
                self?.isResolvingSession = false
            }
        }
    }

    deinit {
        if let authStateHandle {
            Auth.auth().removeStateDidChangeListener(authStateHandle)
        }
    }

    var isAuthenticated: Bool { user != nil }
    var userEmail: String? { user?.email }
    var userID: String? { user?.uid }

    func signIn(email: String, password: String) async {
        noticeMessage = nil
        await perform {
            try await withCheckedThrowingContinuation { continuation in
                Auth.auth().signIn(withEmail: email, password: password) { _, error in
                    if let error {
                        continuation.resume(throwing: error)
                    } else {
                        continuation.resume(returning: ())
                    }
                }
            }
        }
    }

    func createAccount(email: String, password: String) async {
        noticeMessage = nil
        await perform {
            try await withCheckedThrowingContinuation { continuation in
                Auth.auth().createUser(withEmail: email, password: password) { _, error in
                    if let error {
                        continuation.resume(throwing: error)
                    } else {
                        continuation.resume(returning: ())
                    }
                }
            }
        }
        if errorMessage == nil {
            noticeMessage = "Account created."
        }
    }

    func signInWithGoogle() async {
        noticeMessage = nil
        await perform {
            guard let clientID = FirebaseApp.app()?.options.clientID else {
                throw MSHAuthError.missingGoogleClientID
            }
            guard let presentingViewController = Self.presentingViewController() else {
                throw MSHAuthError.missingPresentingViewController
            }

            GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)

            try await withCheckedThrowingContinuation { continuation in
                GIDSignIn.sharedInstance.signIn(withPresenting: presentingViewController) { result, error in
                    if let error {
                        continuation.resume(throwing: error)
                        return
                    }

                    guard let googleUser = result?.user,
                          let idToken = googleUser.idToken?.tokenString else {
                        continuation.resume(throwing: MSHAuthError.missingGoogleIDToken)
                        return
                    }

                    let credential = GoogleAuthProvider.credential(
                        withIDToken: idToken,
                        accessToken: googleUser.accessToken.tokenString
                    )

                    Auth.auth().signIn(with: credential) { _, error in
                        if let error {
                            continuation.resume(throwing: error)
                        } else {
                            continuation.resume(returning: ())
                        }
                    }
                }
            }
        }
    }

    func handleOpenURL(_ url: URL) {
        _ = GIDSignIn.sharedInstance.handle(url)
    }

    func signOut() async {
        noticeMessage = nil
        await perform {
            GIDSignIn.sharedInstance.signOut()
            try Auth.auth().signOut()
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

    private static func presentingViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let keyWindow = scenes.flatMap(\.windows).first(where: \.isKeyWindow)
        var controller = keyWindow?.rootViewController

        while let presented = controller?.presentedViewController {
            controller = presented
        }

        if let navigation = controller as? UINavigationController {
            return navigation.visibleViewController ?? navigation
        }
        if let tab = controller as? UITabBarController {
            return tab.selectedViewController ?? tab
        }
        return controller
    }
}

private enum MSHAuthError: LocalizedError {
    case missingGoogleClientID
    case missingPresentingViewController
    case missingGoogleIDToken

    var errorDescription: String? {
        switch self {
        case .missingGoogleClientID:
            "Google Sign-In is not configured for this build."
        case .missingPresentingViewController:
            "My Simple Health could not open Google Sign-In. Please try again."
        case .missingGoogleIDToken:
            "Google did not return a valid sign-in token. Please try again."
        }
    }
}

struct MSHAuthenticatedRootExperience: View {
    @StateObject private var authStore = MSHAuthStore.shared

    var body: some View {
        Group {
            if authStore.isResolvingSession {
                ZStack {
                    MSHColor.cream.ignoresSafeArea()
                    ProgressView()
                        .tint(MSHColor.forest)
                }
            } else if authStore.isAuthenticated {
                MSHAppShell()
            } else {
                MSHAuthGateView(store: authStore)
            }
        }
        .environmentObject(authStore)
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
