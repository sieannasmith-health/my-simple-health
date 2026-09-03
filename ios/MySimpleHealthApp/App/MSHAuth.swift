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

    var isAuthenticated: Bool { user != nil }
    var userEmail: String? { user?.email }
    var userID: String? { user?.uid }

    func signIn(email: String, password: String) async {
        noticeMessage = nil
        await perform {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                Auth.auth().signIn(withEmail: email, password: password) { _, error in
                    if let error { continuation.resume(throwing: error) }
                    else { continuation.resume(returning: ()) }
                }
            }
        }
    }

    func createAccount(email: String, password: String) async {
        noticeMessage = nil
        await perform {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                Auth.auth().createUser(withEmail: email, password: password) { _, error in
                    if let error { continuation.resume(throwing: error) }
                    else { continuation.resume(returning: ()) }
                }
            }
        }
        if errorMessage == nil { noticeMessage = "Account created." }
    }

    func signInWithGoogle() async {
        noticeMessage = nil
        await perform {
            guard let clientID = FirebaseApp.app()?.options.clientID else { throw MSHAuthError.missingGoogleClientID }
            guard let presentingViewController = Self.presentingViewController() else { throw MSHAuthError.missingPresentingViewController }
            GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                GIDSignIn.sharedInstance.signIn(withPresenting: presentingViewController) { result, error in
                    if let error { continuation.resume(throwing: error); return }
                    guard let googleUser = result?.user, let idToken = googleUser.idToken?.tokenString else {
                        continuation.resume(throwing: MSHAuthError.missingGoogleIDToken); return
                    }
                    let credential = GoogleAuthProvider.credential(withIDToken: idToken, accessToken: googleUser.accessToken.tokenString)
                    Auth.auth().signIn(with: credential) { _, error in
                        if let error { continuation.resume(throwing: error) }
                        else { continuation.resume(returning: ()) }
                    }
                }
            }
        }
    }

    func handleOpenURL(_ url: URL) { _ = GIDSignIn.sharedInstance.handle(url) }

    func signOut() async {
        noticeMessage = nil
        await perform {
            GIDSignIn.sharedInstance.signOut()
            try Auth.auth().signOut()
        }
    }

    private func perform(_ operation: () async throws -> Void) async {
        errorMessage = nil
        do { try await operation() } catch { errorMessage = error.localizedDescription }
    }

    private static func presentingViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let keyWindow = scenes.flatMap(\.windows).first(where: \.isKeyWindow)
        var controller = keyWindow?.rootViewController
        while let presented = controller?.presentedViewController { controller = presented }
        if let navigation = controller as? UINavigationController { return navigation.visibleViewController ?? navigation }
        if let tab = controller as? UITabBarController { return tab.selectedViewController ?? tab }
        return controller
    }
}

private enum MSHAuthError: LocalizedError {
    case missingGoogleClientID, missingPresentingViewController, missingGoogleIDToken
    var errorDescription: String? {
        switch self {
        case .missingGoogleClientID: "Google Sign-In is not configured for this build."
        case .missingPresentingViewController: "My Simple Health could not open Google Sign-In. Please try again."
        case .missingGoogleIDToken: "Google did not return a valid sign-in token. Please try again."
        }
    }
}

struct MSHAuthenticatedRootExperience: View {
    @StateObject private var authStore = MSHAuthStore.shared
    @AppStorage("msh.settleInTourDecision") private var settleInTourDecision = ""
    @State private var showSettleInTour = false

    var body: some View {
        Group {
            if authStore.isResolvingSession {
                ZStack { MSHColor.cream.ignoresSafeArea(); ProgressView().tint(MSHColor.forest) }
            } else if authStore.isAuthenticated {
                MSHAppShell()
                    .safeAreaInset(edge: .top, spacing: 0) { MSHAccountSessionBar() }
                    .fullScreenCover(isPresented: $showSettleInTour) {
                        MSHSettleInTour {
                            settleInTourDecision = "completed"
                            showSettleInTour = false
                        } skip: {
                            settleInTourDecision = "selfGuided"
                            showSettleInTour = false
                        }
                    }
                    .onAppear {
                        if settleInTourDecision.isEmpty { showSettleInTour = true }
                    }
            } else {
                MSHAuthGateView(store: authStore)
            }
        }
        .environmentObject(authStore)
    }
}

private struct MSHSettleInTour: View {
    let finish: () -> Void
    let skip: () -> Void
    @State private var stage = 0
    @AppStorage("msh.displayName") private var displayName = ""
    @AppStorage("msh.appearance") private var appearanceRawValue = MSHAppearancePreference.system.rawValue
    @AppStorage("msh.mySpace") private var mySpaceRawValue = MSHMySpace.warmHouse.rawValue
    @AppStorage("msh.mySpaceLighting") private var lightingRawValue = MSHSpaceLighting.auto.rawValue

    var body: some View {
        NavigationStack {
            ZStack {
                MSHColor.canvas.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 26) {
                        Text(stage == 0 ? "MAKE YOURSELF AT HOME" : "YOUR SPACE")
                            .font(.caption.weight(.semibold)).tracking(2.2).foregroundStyle(MSHColor.accent)
                        Text(stage == 0 ? "Before we begin, make this space feel like yours." : "Settle in for a moment.")
                            .font(.system(size: 38, weight: .medium, design: .serif))
                            .foregroundStyle(MSHColor.primaryText)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(stage == 0 ? "I can show you where your profile, appearance, connections, sharing, and privacy controls live." : "Choose a background and lighting that make My Simple Health comfortable to return to. You can change these anytime in Me.")
                            .font(.body).foregroundStyle(MSHColor.secondaryText).lineSpacing(4)

                        if stage == 0 {
                            VStack(alignment: .leading, spacing: 14) {
                                Label("Me", systemImage: "person.crop.circle")
                                    .font(.title3.weight(.semibold))
                                Text("Start here when you want to change your profile or how MSH feels.")
                                    .font(.subheadline).foregroundStyle(MSHColor.secondaryText)
                            }
                            .padding(20)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))

                            Button("Show me around") { withAnimation(.easeInOut(duration: 0.45)) { stage = 1 } }
                                .buttonStyle(MSHSettlePrimaryButtonStyle())
                            Button("I'll figure it out myself", action: skip)
                                .font(.body.weight(.semibold)).foregroundStyle(MSHColor.secondaryText)
                                .frame(maxWidth: .infinity, minHeight: 48)
                        } else {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("What should we call you?").font(.headline)
                                TextField("Name or nickname", text: $displayName)
                                    .padding(.horizontal, 16).frame(height: 50)
                                    .background(MSHColor.controlFill, in: RoundedRectangle(cornerRadius: 16))
                            }

                            Text("Choose your space").font(.headline)
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                                ForEach(MSHMySpace.allCases) { space in
                                    Button {
                                        mySpaceRawValue = space.rawValue
                                    } label: {
                                        ZStack(alignment: .bottomLeading) {
                                            MSHSpacePreview(space: space)
                                            Text(space.title)
                                                .font(.caption.weight(.semibold)).foregroundStyle(.white)
                                                .padding(10)
                                        }
                                        .frame(height: 112)
                                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                                        .overlay {
                                            RoundedRectangle(cornerRadius: 18).stroke(mySpaceRawValue == space.rawValue ? MSHColor.accent : Color.clear, lineWidth: 3)
                                        }
                                    }.buttonStyle(.plain)
                                }
                            }

                            Text("Choose your light").font(.headline)
                            Picker("Space lighting", selection: $lightingRawValue) {
                                ForEach(MSHSpaceLighting.allCases) { lighting in Text(lighting.title).tag(lighting.rawValue) }
                            }.pickerStyle(.segmented)

                            Text("App appearance").font(.headline)
                            Picker("Appearance", selection: $appearanceRawValue) {
                                ForEach(MSHAppearancePreference.allCases) { preference in Text(preference.title).tag(preference.rawValue) }
                            }.pickerStyle(.segmented)

                            Button("Keep this space", action: finish).buttonStyle(MSHSettlePrimaryButtonStyle())
                            Text("You can change this anytime in Me.")
                                .font(.footnote).foregroundStyle(MSHColor.secondaryText).frame(maxWidth: .infinity, alignment: .center)
                        }
                    }
                    .padding(.horizontal, 22).padding(.top, 34).padding(.bottom, 40)
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { skip() } label: { Image(systemName: "xmark") }
                        .accessibilityLabel("Exit tour")
                }
            }
        }
    }
}

private struct MSHSpacePreview: View {
    let space: MSHMySpace
    var body: some View {
        ZStack {
            if let assetName = space.assetName, UIImage(named: assetName) != nil {
                Image(assetName).resizable().scaledToFill()
            } else {
                MSHColor.charcoal
            }
            LinearGradient(colors: [.clear, .black.opacity(0.5)], startPoint: .top, endPoint: .bottom)
        }
    }
}

private struct MSHSettlePrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline).foregroundStyle(MSHColor.warmWhite)
            .frame(maxWidth: .infinity, minHeight: 54)
            .background(MSHColor.charcoal, in: Capsule())
            .opacity(configuration.isPressed ? 0.82 : 1)
    }
}

struct MSHAuthGateView: View {
    @ObservedObject var store: MSHAuthStore
    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var isWorking = false

    private enum Mode { case signIn, createAccount
        var title: String { self == .signIn ? "Welcome back" : "Create your account" }
        var actionTitle: String { self == .signIn ? "Log in" : "Create account" }
    }

    var body: some View {
        ZStack {
            MSHColor.cream.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 24) {
                    Spacer(minLength: 52)
                    VStack(spacing: 10) {
                        Text("My Simple Health").font(.system(size: 18, weight: .semibold, design: .serif)).foregroundStyle(MSHColor.forest)
                        Text(mode.title).font(.system(size: 34, weight: .medium, design: .serif)).multilineTextAlignment(.center).foregroundStyle(MSHColor.charcoal)
                        Text("Your health information stays connected to your account and your choices.").font(.body).multilineTextAlignment(.center).foregroundStyle(MSHColor.charcoal.opacity(0.72))
                    }
                    VStack(spacing: 14) {
                        TextField("", text: $email, prompt: Text("Email").foregroundStyle(MSHColor.charcoal.opacity(0.48)))
                            .textContentType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled().foregroundStyle(MSHColor.charcoal).tint(MSHColor.forest)
                            .padding(.horizontal, 16).frame(minHeight: 54).background(MSHColor.sage.opacity(0.11))
                            .overlay { RoundedRectangle(cornerRadius: 16).stroke(MSHColor.forest.opacity(0.16), lineWidth: 1) }.clipShape(RoundedRectangle(cornerRadius: 16))
                        SecureField("", text: $password, prompt: Text("Password").foregroundStyle(MSHColor.charcoal.opacity(0.48)))
                            .textContentType(mode == .signIn ? .password : .newPassword).foregroundStyle(MSHColor.charcoal).tint(MSHColor.forest)
                            .padding(.horizontal, 16).frame(minHeight: 54).background(MSHColor.sage.opacity(0.11))
                            .overlay { RoundedRectangle(cornerRadius: 16).stroke(MSHColor.forest.opacity(0.16), lineWidth: 1) }.clipShape(RoundedRectangle(cornerRadius: 16))
                        Button { submit() } label: {
                            HStack { if isWorking { ProgressView().tint(MSHColor.warmWhite) }; Text(mode.actionTitle) }
                                .font(.body.weight(.semibold)).foregroundStyle(MSHColor.warmWhite).frame(maxWidth: .infinity, minHeight: 54)
                                .background(MSHColor.forest).clipShape(RoundedRectangle(cornerRadius: 18))
                        }.buttonStyle(.plain).disabled(isWorking || email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || password.count < 6)
                        Button {
                            Task { isWorking = true; await store.signInWithGoogle(); isWorking = false }
                        } label: {
                            Text("Continue with Google").font(.body.weight(.semibold)).foregroundStyle(MSHColor.forest).frame(maxWidth: .infinity, minHeight: 54)
                                .background(MSHColor.sage.opacity(0.08)).overlay { RoundedRectangle(cornerRadius: 18).stroke(MSHColor.forest.opacity(0.24), lineWidth: 1) }.clipShape(RoundedRectangle(cornerRadius: 18))
                        }.disabled(isWorking)
                        if let error = store.errorMessage { Text(error).font(.footnote).foregroundStyle(.red).multilineTextAlignment(.center) }
                        if let notice = store.noticeMessage { Text(notice).font(.footnote).foregroundStyle(MSHColor.charcoal.opacity(0.72)).multilineTextAlignment(.center) }
                    }
                    Button(mode == .signIn ? "New to MSH? Create an account" : "Already have an account? Log in") {
                        store.errorMessage = nil; store.noticeMessage = nil; mode = mode == .signIn ? .createAccount : .signIn
                    }.font(.callout.weight(.semibold)).foregroundStyle(MSHColor.forest).frame(minHeight: 44)
                    HStack(spacing: 24) {
                        Link("Privacy", destination: URL(string: "https://mysimplehealth.org/privacy.html")!)
                        Link("Terms", destination: URL(string: "https://mysimplehealth.org/terms.html")!)
                    }.font(.footnote).foregroundStyle(MSHColor.charcoal.opacity(0.66))
                    Spacer(minLength: 28)
                }.padding(.horizontal, 24).frame(maxWidth: 520).frame(maxWidth: .infinity)
            }
        }.tint(MSHColor.forest).preferredColorScheme(.light)
    }

    private func submit() {
        guard !isWorking else { return }
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        isWorking = true
        Task {
            switch mode { case .signIn: await store.signIn(email: cleanEmail, password: password); case .createAccount: await store.createAccount(email: cleanEmail, password: password) }
            isWorking = false
        }
    }
}
