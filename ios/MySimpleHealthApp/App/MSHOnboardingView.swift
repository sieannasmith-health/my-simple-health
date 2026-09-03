import SwiftUI

private enum MSHOnboardingStep: Int, CaseIterable {
    case atmosphere
    case fragmentation
    case coherence
    case discovery
    case intent
    case focus
    case saveSpace
}

struct MSHRootExperience: View {
    @StateObject private var onboardingStore = MSHOnboardingStore()

    var body: some View {
        Group {
            if onboardingStore.shouldPresentOnboarding {
                MSHOnboardingFlow(store: onboardingStore)
            } else {
                MSHAuthenticatedRootExperience()
            }
        }
        .environmentObject(onboardingStore)
    }
}

private struct MSHOnboardingFlow: View {
    @ObservedObject var store: MSHOnboardingStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var step = MSHOnboardingStep.atmosphere
    @State private var discoverySource: String?
    @State private var intent: String?
    @State private var selectedFocus: Set<String> = []

    private let discoveryOptions = [
        "A friend or family member",
        "Social media",
        "Search",
        "School or work",
        "Healthcare",
        "Something else"
    ]

    private let intentOptions = [
        "I want a clearer picture of my health",
        "I want help staying organized",
        "I want to understand something",
        "I want to look ahead",
        "I want to work toward something",
        "I’m just exploring"
    ]

    private let focusOptions = [
        "Health", "Sleep", "Movement", "Food", "Mind", "Healthcare",
        "Medications", "Money", "Relationships", "Environment", "Routines", "Life context"
    ]

    var body: some View {
        ZStack {
            MSHOnboardingPalette.cream.ignoresSafeArea()

            Group {
                switch step {
                case .atmosphere:
                    MSHOnboardingOpeningStoryboard.Atmosphere {
                        advance(to: .fragmentation)
                    }
                case .fragmentation:
                    MSHOnboardingOpeningStoryboard.Fragmentation {
                        advance(to: .coherence)
                    }
                case .coherence:
                    MSHOnboardingOpeningStoryboard.Coherence {
                        advance(to: .discovery)
                    }
                case .discovery:
                    discovery
                case .intent:
                    intentScreen
                case .focus:
                    focus
                case .saveSpace:
                    saveSpace
                }
            }
            .id(step)
            .transition(.opacity)
        }
        .tint(MSHOnboardingPalette.sage)
        .onAppear { store.markStarted() }
    }

    private var discovery: some View {
        MSHEditorialQuestionPage(
            eyebrow: "A LITTLE CONTEXT",
            title: "How did you hear about My Simple Health?",
            message: "This helps us understand how people find MSH. It won’t change the guidance you receive."
        ) {
            MSHChoiceList(
                options: discoveryOptions,
                selected: { discoverySource == $0 },
                allowsMultiple: false
            ) { option in
                discoverySource = option
            }

            MSHPrimaryButton(title: "Continue", enabled: discoverySource != nil) {
                advance(to: .intent)
            }
        }
    }

    private var intentScreen: some View {
        MSHEditorialQuestionPage(
            eyebrow: "WHAT BROUGHT YOU HERE",
            title: "What would feel useful right now?",
            message: "You don’t need to have a goal. This only helps MSH understand where to begin."
        ) {
            MSHChoiceList(
                options: intentOptions,
                selected: { intent == $0 },
                allowsMultiple: false
            ) { option in
                intent = option
            }

            MSHPrimaryButton(title: "Continue", enabled: intent != nil) {
                advance(to: .focus)
            }
        }
    }

    private var focus: some View {
        MSHEditorialQuestionPage(
            eyebrow: "WHAT MATTERS RIGHT NOW",
            title: "Which parts of life would you like MSH to understand?",
            message: "Choose as many as you want. You can change this later, and choosing something does not turn it into a goal."
        ) {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(focusOptions, id: \.self) { option in
                    Button {
                        if selectedFocus.contains(option) {
                            selectedFocus.remove(option)
                        } else {
                            selectedFocus.insert(option)
                        }
                    } label: {
                        HStack(spacing: 8) {
                            Text(option)
                                .font(.subheadline.weight(.semibold))
                            Spacer(minLength: 4)
                            if selectedFocus.contains(option) {
                                Image(systemName: "checkmark")
                                    .font(.caption.weight(.bold))
                            }
                        }
                        .foregroundStyle(MSHOnboardingPalette.charcoal)
                        .padding(.horizontal, 14)
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(
                            selectedFocus.contains(option)
                                ? MSHOnboardingPalette.sage.opacity(0.20)
                                : MSHOnboardingPalette.warmWhite.opacity(0.84)
                        )
                        .overlay {
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(
                                    selectedFocus.contains(option)
                                        ? MSHOnboardingPalette.sage.opacity(0.70)
                                        : MSHOnboardingPalette.stone,
                                    lineWidth: 1
                                )
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    .buttonStyle(MSHQuietButtonStyle())
                }
            }

            Button("Nothing specific right now") {
                selectedFocus.removeAll()
                advance(to: .saveSpace)
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(MSHOnboardingPalette.charcoal.opacity(0.72))
            .frame(maxWidth: .infinity, minHeight: 44)

            MSHPrimaryButton(title: "Continue", enabled: !selectedFocus.isEmpty) {
                advance(to: .saveSpace)
            }
        }
    }

    private var saveSpace: some View {
        MSHEditorialQuestionPage(
            eyebrow: "YOUR SPACE",
            title: "Save what you’ve started.",
            message: "Create or sign in to your account so your picture, preferences, and progress can stay connected to you."
        ) {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "checkmark.circle")
                        .foregroundStyle(MSHOnboardingPalette.sage)
                    Text("Your opening choices are ready to become the beginning of your MSH picture.")
                        .font(.subheadline)
                        .foregroundStyle(MSHOnboardingPalette.charcoal.opacity(0.72))
                        .fixedSize(horizontal: false, vertical: true)
                }

                MSHPrimaryButton(title: "Save my space") {
                    store.complete()
                }
            }
        }
    }

    private func advance(to nextStep: MSHOnboardingStep) {
        withAnimation(reduceMotion ? .easeOut(duration: 0.12) : .easeInOut(duration: 0.42)) {
            step = nextStep
        }
    }
}

private struct MSHEditorialQuestionPage<Actions: View>: View {
    let eyebrow: String
    let title: String
    let message: String
    @ViewBuilder let actions: Actions

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var eyebrowVisible = false
    @State private var titleVisible = false
    @State private var messageVisible = false
    @State private var actionsVisible = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Spacer(minLength: 72)

                Text(eyebrow)
                    .font(.caption.weight(.semibold))
                    .tracking(2.3)
                    .foregroundStyle(MSHOnboardingPalette.sage)
                    .opacity(eyebrowVisible ? 1 : 0)
                    .offset(y: eyebrowVisible ? 0 : 6)
                    .padding(.bottom, 18)

                Text(title)
                    .font(.system(size: 38, weight: .medium, design: .serif))
                    .foregroundStyle(MSHOnboardingPalette.charcoal)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                    .opacity(titleVisible ? 1 : 0)
                    .offset(y: titleVisible ? 0 : 8)

                Text(message)
                    .font(.body)
                    .foregroundStyle(MSHOnboardingPalette.charcoal.opacity(0.68))
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 18)
                    .opacity(messageVisible ? 1 : 0)
                    .offset(y: messageVisible ? 0 : 6)

                VStack(spacing: 18) {
                    actions
                }
                .padding(.top, 36)
                .opacity(actionsVisible ? 1 : 0)
                .offset(y: actionsVisible ? 0 : 8)

                Spacer(minLength: 36)
            }
            .frame(maxWidth: 560, minHeight: UIScreen.main.bounds.height - 28, alignment: .leading)
            .padding(.horizontal, 26)
            .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
        .onAppear { reveal() }
    }

    private func reveal() {
        if reduceMotion {
            eyebrowVisible = true
            titleVisible = true
            messageVisible = true
            actionsVisible = true
            return
        }

        withAnimation(.easeOut(duration: 0.62)) { eyebrowVisible = true }
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(130))
            withAnimation(.easeOut(duration: 0.82)) { titleVisible = true }
            try? await Task.sleep(for: .milliseconds(130))
            withAnimation(.easeOut(duration: 0.68)) { messageVisible = true }
            try? await Task.sleep(for: .milliseconds(180))
            withAnimation(.easeOut(duration: 0.62)) { actionsVisible = true }
        }
    }
}

private struct MSHChoiceList: View {
    let options: [String]
    let selected: (String) -> Bool
    let allowsMultiple: Bool
    let onSelect: (String) -> Void

    var body: some View {
        VStack(spacing: 9) {
            ForEach(options, id: \.self) { option in
                Button {
                    onSelect(option)
                } label: {
                    HStack(spacing: 12) {
                        Text(option)
                            .font(.body.weight(.medium))
                            .multilineTextAlignment(.leading)
                        Spacer()
                        if selected(option) {
                            Image(systemName: allowsMultiple ? "checkmark.square.fill" : "checkmark")
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(MSHOnboardingPalette.sage)
                        }
                    }
                    .foregroundStyle(MSHOnboardingPalette.charcoal)
                    .padding(.horizontal, 16)
                    .frame(maxWidth: .infinity, minHeight: 54)
                    .background(
                        selected(option)
                            ? MSHOnboardingPalette.sage.opacity(0.16)
                            : MSHOnboardingPalette.warmWhite.opacity(0.82)
                    )
                    .overlay {
                        RoundedRectangle(cornerRadius: 17, style: .continuous)
                            .stroke(
                                selected(option)
                                    ? MSHOnboardingPalette.sage.opacity(0.62)
                                    : MSHOnboardingPalette.stone,
                                lineWidth: 1
                            )
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
                }
                .buttonStyle(MSHQuietButtonStyle())
            }
        }
    }
}

private struct MSHPrimaryButton: View {
    let title: String
    var enabled = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Text(title)
                Image(systemName: "arrow.right")
            }
            .font(.headline)
            .foregroundStyle(MSHOnboardingPalette.warmWhite)
            .frame(maxWidth: .infinity, minHeight: 54)
            .background(MSHOnboardingPalette.charcoal.opacity(enabled ? 1 : 0.34))
            .clipShape(Capsule())
        }
        .buttonStyle(MSHQuietButtonStyle())
        .disabled(!enabled)
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
    static let cream = Color(red: 248 / 255, green: 247 / 255, blue: 243 / 255)
    static let warmWhite = Color(red: 252 / 255, green: 251 / 255, blue: 247 / 255)
    static let charcoal = Color(red: 31 / 255, green: 30 / 255, blue: 29 / 255)
    static let sage = Color(red: 149 / 255, green: 153 / 255, blue: 129 / 255)
    static let stone = Color(red: 224 / 255, green: 223 / 255, blue: 220 / 255)
}
