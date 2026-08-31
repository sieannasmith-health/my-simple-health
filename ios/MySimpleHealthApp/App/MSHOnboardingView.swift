import SwiftUI

private enum MSHOnboardingStep: Int, CaseIterable {
    case launch
    case welcome
    case appleHealth
    case notifications
    case startingPoint
    case completion
}

struct MSHRootExperience: View {
    @StateObject private var onboardingStore = MSHOnboardingStore()

    var body: some View {
        Group {
            if onboardingStore.shouldPresentOnboarding {
                MSHOnboardingFlow(store: onboardingStore)
            } else {
                MSHAppShell()
            }
        }
        .environmentObject(onboardingStore)
    }
}

private struct MSHOnboardingFlow: View {
    @ObservedObject var store: MSHOnboardingStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var step = MSHOnboardingStep.launch
    @State private var isWorking = false
    @State private var errorMessage: String?
    @State private var launchTask: Task<Void, Never>?

    var body: some View {
        ZStack {
            MSHOnboardingPalette.cream.ignoresSafeArea()

            Group {
                switch step {
                case .launch:
                    MSHLaunchExperience()
                case .welcome:
                    welcome
                case .appleHealth:
                    appleHealth
                case .notifications:
                    notifications
                case .startingPoint:
                    startingPoint
                case .completion:
                    completion
                }
            }
            .id(step)
            .transition(reduceMotion ? .opacity : .asymmetric(
                insertion: .opacity.combined(with: .move(edge: .trailing)),
                removal: .opacity
            ))
        }
        .tint(MSHOnboardingPalette.forest)
        .onAppear {
            store.markStarted()
            guard step == .launch else { return }
            launchTask = Task { @MainActor in
                try? await Task.sleep(for: reduceMotion ? .milliseconds(120) : .milliseconds(650))
                guard !Task.isCancelled else { return }
                advance(to: .welcome)
            }
        }
        .onDisappear { launchTask?.cancel() }
        .alert("We couldn't complete that request", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "Please try again.")
        }
    }

    private var welcome: some View {
        MSHOnboardingPage(
            eyebrow: "WELCOME",
            title: "Welcome to\nMy Simple Health",
            message: "Your health, together.\nIn the context of you."
        ) {
            VStack(spacing: 14) {
                MSHPrimaryButton(title: "Continue") { advance(to: .appleHealth) }

                Link("Already have an account? Log in", destination: URL(string: "https://mysimplehealth.org/login")!)
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(MSHOnboardingPalette.forest)
                    .frame(minHeight: 44)

                HStack(spacing: 24) {
                    Link("Privacy", destination: URL(string: "https://mysimplehealth.org/privacy.html")!)
                    Link("Terms", destination: URL(string: "https://mysimplehealth.org/terms.html")!)
                }
                .font(.footnote)
                .foregroundStyle(MSHOnboardingPalette.charcoal.opacity(0.72))
                .padding(.top, 6)
            }
        }
    }

    private var appleHealth: some View {
        MSHOnboardingPage(
            eyebrow: "APPLE HEALTH",
            title: "Bring your health with you",
            message: "Connect Apple Health to bring supported health information into My Health. You choose what to share, and you can change access later."
        ) {
            VStack(spacing: 12) {
                MSHPrimaryButton(title: "Connect Apple Health", isWorking: isWorking) {
                    requestAppleHealth()
                }
                MSHSecondaryButton(title: "Not now", disabled: isWorking) {
                    store.setAppleHealthChoice(.notNow)
                    advance(to: .notifications)
                }
            }
        }
    }

    private var notifications: some View {
        MSHOnboardingPage(
            eyebrow: "NOTIFICATIONS",
            title: "Keep track of what comes next",
            message: "Notifications can support planned workouts, medication actions, appointments, and other health activities. You stay in control of what is scheduled."
        ) {
            VStack(spacing: 12) {
                MSHPrimaryButton(title: "Allow notifications", isWorking: isWorking) {
                    requestNotifications()
                }
                MSHSecondaryButton(title: "Not now", disabled: isWorking) {
                    store.setNotificationChoice(.notNow)
                    advance(to: .startingPoint)
                }
            }
        }
    }

    private var startingPoint: some View {
        MSHOnboardingPage(
            eyebrow: "STARTING POINT",
            title: "Where would you like to start?",
            message: "This only helps shape your first view. You can explore every part of My Simple Health at any time."
        ) {
            VStack(spacing: 10) {
                ForEach(MSHOnboardingStartingPoint.allCases) { startingPoint in
                    Button {
                        store.setStartingPoint(startingPoint)
                        advance(to: .completion)
                    } label: {
                        HStack {
                            Text(startingPoint.title)
                            Spacer()
                            Image(systemName: "arrow.right")
                                .font(.footnote.weight(.semibold))
                        }
                        .font(.body.weight(.semibold))
                        .foregroundStyle(MSHOnboardingPalette.forest)
                        .padding(.horizontal, 18)
                        .frame(maxWidth: .infinity, minHeight: 54)
                        .background(MSHOnboardingPalette.warmWhite.opacity(0.82))
                        .overlay {
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .stroke(MSHOnboardingPalette.forest.opacity(0.16), lineWidth: 1)
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    }
                    .buttonStyle(MSHQuietButtonStyle())
                }
            }
        }
    }

    private var completion: some View {
        MSHOnboardingPage(
            eyebrow: "MY SIMPLE HEALTH",
            title: "Your health starts here.",
            message: "Your starting point is only a doorway. My Health remains the place where your broader picture comes together."
        ) {
            MSHPrimaryButton(title: "Go to My Health") { store.complete() }
        }
    }

    private func requestAppleHealth() {
        guard !isWorking else { return }
        isWorking = true
        Task { @MainActor in
            do {
                let result = try await MSHAppleHealthRuntime.connectForOnboarding()
                store.setAppleHealthChoice(result.outcome == .completed ? .requested : .declined)
                isWorking = false
                advance(to: .notifications)
            } catch {
                isWorking = false
                errorMessage = error.localizedDescription
            }
        }
    }

    private func requestNotifications() {
        guard !isWorking else { return }
        isWorking = true
        Task { @MainActor in
            do {
                let status = try await MSHNotificationService.shared.requestAuthorization()
                store.setNotificationChoice(status.canSchedule ? .allowed : .declined)
                isWorking = false
                advance(to: .startingPoint)
            } catch {
                isWorking = false
                errorMessage = error.localizedDescription
            }
        }
    }

    private func advance(to nextStep: MSHOnboardingStep) {
        errorMessage = nil
        withAnimation(reduceMotion ? .easeOut(duration: 0.12) : .easeInOut(duration: 0.32)) {
            step = nextStep
        }
    }
}

private struct MSHLaunchExperience: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isVisible = false

    var body: some View {
        VStack(spacing: 18) {
            Circle()
                .fill(MSHOnboardingPalette.sage.opacity(0.2))
                .frame(width: 62, height: 62)
                .overlay {
                    Circle()
                        .stroke(MSHOnboardingPalette.forest.opacity(0.36), lineWidth: 1)
                        .padding(8)
                }
                .scaleEffect(isVisible ? 1 : 0.94)

            Text("My Simple Health")
                .font(.system(size: 32, weight: .medium, design: .serif))
                .foregroundStyle(MSHOnboardingPalette.forest)
        }
        .opacity(isVisible ? 1 : 0)
        .onAppear {
            if reduceMotion {
                isVisible = true
            } else {
                withAnimation(.easeOut(duration: 0.45)) { isVisible = true }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

private struct MSHOnboardingPage<Actions: View>: View {
    let eyebrow: String
    let title: String
    let message: String
    @ViewBuilder let actions: Actions

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Spacer(minLength: 68)

                Text(eyebrow)
                    .font(.caption.weight(.semibold))
                    .tracking(2.2)
                    .foregroundStyle(MSHOnboardingPalette.sage)
                    .padding(.bottom, 18)

                Text(title)
                    .font(.system(size: 42, weight: .medium, design: .serif))
                    .foregroundStyle(MSHOnboardingPalette.forest)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)

                Text(message)
                    .font(.title3)
                    .foregroundStyle(MSHOnboardingPalette.charcoal.opacity(0.84))
                    .lineSpacing(5)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 22)

                Spacer(minLength: 52)
                actions
                Spacer(minLength: 28)
            }
            .frame(maxWidth: 560, minHeight: UIScreen.main.bounds.height - 36, alignment: .leading)
            .padding(.horizontal, 28)
            .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
    }
}

private struct MSHPrimaryButton: View {
    let title: String
    var isWorking = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                if isWorking { ProgressView().tint(MSHOnboardingPalette.warmWhite) }
                Text(title)
                if !isWorking { Image(systemName: "arrow.right") }
            }
            .font(.headline)
            .foregroundStyle(MSHOnboardingPalette.warmWhite)
            .frame(maxWidth: .infinity, minHeight: 54)
            .background(MSHOnboardingPalette.forest)
            .clipShape(Capsule())
        }
        .buttonStyle(MSHQuietButtonStyle())
        .disabled(isWorking)
    }
}

private struct MSHSecondaryButton: View {
    let title: String
    var disabled = false
    let action: () -> Void

    var body: some View {
        Button(title, action: action)
            .font(.body.weight(.semibold))
            .foregroundStyle(MSHOnboardingPalette.forest)
            .frame(maxWidth: .infinity, minHeight: 50)
            .buttonStyle(MSHQuietButtonStyle())
            .disabled(disabled)
    }
}

private struct MSHQuietButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.82 : 1)
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.99 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.14), value: configuration.isPressed)
    }
}

private enum MSHOnboardingPalette {
    static let cream = Color(red: 245 / 255, green: 241 / 255, blue: 231 / 255)
    static let forest = Color(red: 23 / 255, green: 61 / 255, blue: 43 / 255)
    static let warmWhite = Color(red: 252 / 255, green: 251 / 255, blue: 247 / 255)
    static let charcoal = Color(red: 37 / 255, green: 40 / 255, blue: 34 / 255)
    static let sage = Color(red: 125 / 255, green: 148 / 255, blue: 96 / 255)
}
