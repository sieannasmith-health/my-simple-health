import SwiftUI
import UIKit

/// Production SwiftUI implementation of onboarding storyboard moments 1–3:
/// atmosphere → fragmentation → coherence.
struct MSHOnboardingOpeningStoryboard {
    struct Atmosphere: View {
        let onContinue: () -> Void

        @Environment(\.accessibilityReduceMotion) private var reduceMotion
        @State private var eyebrowVisible = false
        @State private var titleVisible = false
        @State private var showContinue = false

        var body: some View {
            GeometryReader { proxy in
                ZStack {
                    MSHOpeningThresholdEnvironment()

                    LinearGradient(
                        colors: [
                            Color.black.opacity(0.04),
                            Color.clear,
                            Color.black.opacity(0.10)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .ignoresSafeArea()

                    VStack(spacing: 0) {
                        Spacer(minLength: 110)

                        VStack(spacing: 26) {
                            Text("MY SIMPLE HEALTH")
                                .font(.system(size: 13, weight: .semibold))
                                .tracking(3.4)
                                .foregroundStyle(.white.opacity(0.92))
                                .padding(.horizontal, 22)
                                .frame(height: 42)
                                .mshNativeGlass(
                                    in: Capsule(),
                                    tint: MSHOpeningPalette.ivory,
                                    edgeStrength: 0.90,
                                    shadowStrength: 0.72,
                                    glowStrength: 0.26
                                )
                                .opacity(eyebrowVisible ? 1 : 0)
                                .offset(y: eyebrowVisible ? 0 : 7)

                            Text("Your health.\nYour space.")
                                .font(.system(size: 44, weight: .regular, design: .serif))
                                .multilineTextAlignment(.center)
                                .foregroundStyle(.white)
                                .padding(.horizontal, 18)
                                .fixedSize(horizontal: false, vertical: true)
                                .opacity(titleVisible ? 1 : 0)
                                .offset(y: titleVisible ? 0 : 9)
                        }
                        .padding(.horizontal, 18)
                        .padding(.vertical, 38)
                        .frame(maxWidth: 354)
                        .mshNativeGlass(
                            in: RoundedRectangle(cornerRadius: 34, style: .continuous),
                            tint: MSHOpeningPalette.ivory,
                            edgeStrength: 1.16,
                            shadowStrength: 1.12,
                            glowStrength: 0.38
                        )

                        Spacer()

                        MSHOpeningContinueButton(title: "Continue", action: onContinue)
                            .opacity(showContinue ? 1 : 0)
                            .offset(y: showContinue ? 0 : 10)
                            .allowsHitTesting(showContinue)
                            .padding(.bottom, 54)
                    }
                    .padding(.horizontal, 18)
                    .frame(width: proxy.size.width, height: proxy.size.height)
                }
                .frame(width: proxy.size.width, height: proxy.size.height)
            }
            .ignoresSafeArea()
            .onAppear { runSequence() }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("onboarding-opening-atmosphere")
        }

        private func runSequence() {
            if reduceMotion {
                eyebrowVisible = true
                titleVisible = true
                showContinue = true
                return
            }

            withAnimation(.easeOut(duration: 0.72)) {
                eyebrowVisible = true
            }

            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(180))
                withAnimation(.easeOut(duration: 0.92)) {
                    titleVisible = true
                }
                try? await Task.sleep(for: .milliseconds(760))
                withAnimation(.spring(response: 0.42, dampingFraction: 0.80)) {
                    showContinue = true
                }
            }
        }
    }

    struct Fragmentation: View {
        let onContinue: () -> Void

        @Environment(\.accessibilityReduceMotion) private var reduceMotion
        @State private var revealFragments = false
        @State private var statementVisible = false
        @State private var supportVisible = false
        @State private var showContinue = false

        private let fragments: [MSHOnboardingFragment] = [
            .init("6h 42m sleep", symbol: "moon.stars", tint: .powder, x: 0.23, y: 0.16, delay: 0.00, rotation: -2.0),
            .init("Appointment Thursday", symbol: "calendar", tint: .stone, x: 0.69, y: 0.21, delay: 0.12, rotation: 1.5),
            .init("$186 groceries", symbol: "basket", tint: .mushroom, x: 0.30, y: 0.36, delay: 0.22, rotation: 1.0),
            .init("Refill in 5 days", symbol: "pills", tint: .powder, x: 0.72, y: 0.41, delay: 0.32, rotation: -1.5),
            .init("3 workouts this week", symbol: "figure.walk", tint: .sage, x: 0.24, y: 0.55, delay: 0.42, rotation: -1.0),
            .init("Lab result", symbol: "doc.text.magnifyingglass", tint: .stone, x: 0.73, y: 0.59, delay: 0.52, rotation: 1.5),
            .init("Money", symbol: "dollarsign", tint: .mushroom, x: 0.40, y: 0.68, delay: 0.62, rotation: 1.0),
            .init("Food", symbol: "fork.knife", tint: .clay, x: 0.68, y: 0.71, delay: 0.70, rotation: -1.0)
        ]

        var body: some View {
            GeometryReader { proxy in
                ZStack {
                    MSHOpeningEnvironment(desaturated: true, warmth: 0.03)

                    Color.white.opacity(0.50)
                        .ignoresSafeArea()

                    ForEach(fragments) { fragment in
                        MSHOnboardingFragmentView(fragment: fragment)
                            .position(
                                x: proxy.size.width * fragment.x,
                                y: proxy.size.height * fragment.y
                            )
                            .rotationEffect(.degrees(reduceMotion ? 0 : fragment.rotation))
                            .offset(y: revealFragments ? 0 : 14)
                            .opacity(revealFragments ? 1 : 0)
                            .scaleEffect(revealFragments ? 1 : 0.96)
                            .animation(
                                reduceMotion ? nil : .easeOut(duration: 0.68).delay(fragment.delay),
                                value: revealFragments
                            )
                    }

                    VStack(spacing: 11) {
                        Spacer()

                        Text("Your health doesn’t happen in pieces.")
                            .font(.system(size: 31, weight: .regular, design: .serif))
                            .foregroundStyle(MSHOpeningPalette.charcoal)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 28)
                            .fixedSize(horizontal: false, vertical: true)
                            .opacity(statementVisible ? 1 : 0)
                            .offset(y: statementVisible ? 0 : 8)

                        Text("The information may arrive separately. Your life doesn’t.")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(MSHOpeningPalette.charcoal.opacity(0.72))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 36)
                            .fixedSize(horizontal: false, vertical: true)
                            .opacity(supportVisible ? 1 : 0)
                            .offset(y: supportVisible ? 0 : 6)

                        MSHOpeningContinueButton(title: "Continue", action: onContinue)
                            .padding(.top, 8)
                            .opacity(showContinue ? 1 : 0)
                            .offset(y: showContinue ? 0 : 8)
                            .allowsHitTesting(showContinue)
                    }
                    .padding(.bottom, 54)
                    .frame(width: proxy.size.width)
                }
                .frame(width: proxy.size.width, height: proxy.size.height)
            }
            .ignoresSafeArea()
            .onAppear { runSequence() }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("onboarding-fragmentation")
        }

        private func runSequence() {
            revealFragments = true

            if reduceMotion {
                statementVisible = true
                supportVisible = true
                showContinue = true
                return
            }

            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(980))
                withAnimation(.easeOut(duration: 0.88)) {
                    statementVisible = true
                }
                try? await Task.sleep(for: .milliseconds(220))
                withAnimation(.easeOut(duration: 0.72)) {
                    supportVisible = true
                }
                try? await Task.sleep(for: .milliseconds(620))
                withAnimation(.easeOut(duration: 0.58)) {
                    showContinue = true
                }
            }
        }
    }

    struct Coherence: View {
        let onContinue: () -> Void

        @Environment(\.accessibilityReduceMotion) private var reduceMotion
        @State private var fragmentsVisible = true
        @State private var insightsVisible = false
        @State private var titleVisible = false
        @State private var supportVisible = false
        @State private var showContinue = false

        private let sourceFragments: [MSHOnboardingFragment] = [
            .init("Appointment Thursday", symbol: "calendar", tint: .stone, x: 0.30, y: 0.40, delay: 0.00, rotation: -1.0),
            .init("Refill in 5 days", symbol: "pills", tint: .powder, x: 0.71, y: 0.45, delay: 0.08, rotation: 1.0),
            .init("6h 42m sleep", symbol: "moon.stars", tint: .powder, x: 0.28, y: 0.59, delay: 0.16, rotation: 0),
            .init("3 workouts this week", symbol: "figure.walk", tint: .sage, x: 0.70, y: 0.63, delay: 0.24, rotation: 0)
        ]

        private let insights: [MSHCoherenceInsight] = [
            .init(
                eyebrow: "CONNECTED",
                title: "Your appointment and refill belong in the same picture.",
                detail: "Simple can connect timing that arrived from different places.",
                tint: .powder
            ),
            .init(
                eyebrow: "CONTEXT",
                title: "Sleep means more when the rest of the week is visible too.",
                detail: "One number does not have to carry the whole story.",
                tint: .sage
            ),
            .init(
                eyebrow: "DISCERNMENT",
                title: "And sometimes nothing requires action.",
                detail: "Understanding can be useful without becoming another task.",
                tint: .mushroom
            )
        ]

        var body: some View {
            GeometryReader { proxy in
                ZStack {
                    MSHOpeningEnvironment(desaturated: !insightsVisible, warmth: insightsVisible ? 0.18 : 0.04)

                    LinearGradient(
                        colors: [
                            Color.white.opacity(insightsVisible ? 0.46 : 0.60),
                            MSHOpeningPalette.ivory.opacity(insightsVisible ? 0.72 : 0.84)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .ignoresSafeArea()

                    ForEach(sourceFragments) { fragment in
                        MSHOnboardingFragmentView(fragment: fragment)
                            .position(
                                x: proxy.size.width * fragment.x,
                                y: proxy.size.height * fragment.y
                            )
                            .rotationEffect(.degrees(fragment.rotation))
                            .opacity(fragmentsVisible ? 0.80 : 0)
                            .scaleEffect(fragmentsVisible ? 1 : 0.96)
                            .animation(reduceMotion ? nil : .easeOut(duration: 0.55), value: fragmentsVisible)
                    }

                    VStack(spacing: 0) {
                        Text("Neither should the way you understand it.")
                            .font(.system(size: 31, weight: .regular, design: .serif))
                            .foregroundStyle(MSHOpeningPalette.charcoal)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 28)
                            .fixedSize(horizontal: false, vertical: true)
                            .opacity(titleVisible ? 1 : 0)
                            .offset(y: titleVisible ? 0 : 8)

                        Text("My Simple Health turns separate signals into useful context.")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(MSHOpeningPalette.charcoal.opacity(0.68))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 34)
                            .padding(.top, 8)
                            .fixedSize(horizontal: false, vertical: true)
                            .opacity(supportVisible ? 1 : 0)
                            .offset(y: supportVisible ? 0 : 6)

                        VStack(spacing: 10) {
                            ForEach(Array(insights.enumerated()), id: \.offset) { index, insight in
                                MSHCoherenceInsightCard(insight: insight)
                                    .opacity(insightsVisible ? 1 : 0)
                                    .offset(y: insightsVisible ? 0 : 12)
                                    .animation(
                                        reduceMotion ? nil : .easeOut(duration: 0.72).delay(Double(index) * 0.12),
                                        value: insightsVisible
                                    )
                            }
                        }
                        .padding(.horizontal, 22)
                        .padding(.top, 28)

                        Spacer()

                        MSHOpeningContinueButton(title: "Continue", action: onContinue)
                            .opacity(showContinue ? 1 : 0)
                            .offset(y: showContinue ? 0 : 8)
                            .allowsHitTesting(showContinue)
                            .padding(.bottom, 54)
                    }
                    .padding(.top, 74)
                    .frame(width: proxy.size.width)
                }
                .frame(width: proxy.size.width, height: proxy.size.height)
            }
            .ignoresSafeArea()
            .onAppear { runSequence() }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("onboarding-coherence")
        }

        private func runSequence() {
            if reduceMotion {
                fragmentsVisible = false
                titleVisible = true
                supportVisible = true
                insightsVisible = true
                showContinue = true
                return
            }

            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(350))
                withAnimation(.easeOut(duration: 0.55)) {
                    fragmentsVisible = false
                }

                try? await Task.sleep(for: .milliseconds(180))
                withAnimation(.easeOut(duration: 0.86)) {
                    titleVisible = true
                }

                try? await Task.sleep(for: .milliseconds(160))
                withAnimation(.easeOut(duration: 0.72)) {
                    supportVisible = true
                }

                try? await Task.sleep(for: .milliseconds(220))
                insightsVisible = true

                try? await Task.sleep(for: .milliseconds(1150))
                withAnimation(.easeOut(duration: 0.58)) {
                    showContinue = true
                }
            }
        }
    }
}

private struct MSHCoherenceInsight {
    let eyebrow: String
    let title: String
    let detail: String
    let tint: MSHOnboardingFragment.Tint
}

private struct MSHCoherenceInsightCard: View {
    let insight: MSHCoherenceInsight

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(insight.tint.color.opacity(0.82))
                .frame(width: 3)

            VStack(alignment: .leading, spacing: 5) {
                Text(insight.eyebrow)
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1.5)
                    .foregroundStyle(MSHOpeningPalette.secondaryText)

                Text(insight.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(MSHOpeningPalette.charcoal)
                    .fixedSize(horizontal: false, vertical: true)

                Text(insight.detail)
                    .font(.system(size: 12.5))
                    .foregroundStyle(MSHOpeningPalette.charcoal.opacity(0.64))
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 0)
        }
        .padding(14)
        .mshNativeGlass(
            in: RoundedRectangle(cornerRadius: 18, style: .continuous),
            tint: insight.tint.color,
            edgeStrength: 0.88,
            shadowStrength: 0.55
        )
    }
}

private struct MSHOnboardingFragment: Identifiable {
    enum Tint {
        case sage, powder, clay, mushroom, stone

        var color: Color {
            switch self {
            case .sage: MSHOpeningPalette.sage
            case .powder: MSHOpeningPalette.powder
            case .clay: MSHOpeningPalette.clay
            case .mushroom: MSHOpeningPalette.mushroom
            case .stone: MSHOpeningPalette.stone
            }
        }
    }

    let id = UUID()
    let title: String
    let symbol: String
    let tint: Tint
    let x: CGFloat
    let y: CGFloat
    let delay: Double
    let rotation: Double

    init(_ title: String, symbol: String, tint: Tint, x: CGFloat, y: CGFloat, delay: Double, rotation: Double) {
        self.title = title
        self.symbol = symbol
        self.tint = tint
        self.x = x
        self.y = y
        self.delay = delay
        self.rotation = rotation
    }
}

private struct MSHOnboardingFragmentView: View {
    let fragment: MSHOnboardingFragment

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: fragment.symbol)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(MSHOpeningPalette.charcoal.opacity(0.72))

            Text(fragment.title)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(MSHOpeningPalette.charcoal)
                .lineLimit(1)
        }
        .padding(.horizontal, 12)
        .frame(height: 38)
        .mshNativeGlass(
            in: Capsule(),
            tint: fragment.tint.color,
            edgeStrength: 0.94,
            shadowStrength: 0.72
        )
        .accessibilityLabel(fragment.title)
    }
}

/// A neutral architectural threshold for first launch. It deliberately does not use
/// any of the rooms a person can later choose as My Space.
private struct MSHOpeningThresholdEnvironment: View {
    var body: some View {
        GeometryReader { proxy in
            ZStack {
                LinearGradient(
                    colors: [
                        Color(red: 0.91, green: 0.87, blue: 0.80),
                        Color(red: 0.78, green: 0.70, blue: 0.61),
                        Color(red: 0.47, green: 0.39, blue: 0.32)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )

                // Warm plaster wall with a distinct architectural alcove.
                RoundedRectangle(cornerRadius: 58, style: .continuous)
                    .fill(Color(red: 0.83, green: 0.76, blue: 0.66).opacity(0.92))
                    .frame(width: proxy.size.width * 0.72, height: proxy.size.height * 0.72)
                    .offset(x: proxy.size.width * 0.08, y: -proxy.size.height * 0.02)
                    .overlay {
                        RoundedRectangle(cornerRadius: 58, style: .continuous)
                            .stroke(Color.white.opacity(0.16), lineWidth: 1)
                    }
                    .shadow(color: .black.opacity(0.12), radius: 28, x: 0, y: 18)

                // Stone floor plane gives the threshold a real architectural horizon.
                LinearGradient(
                    colors: [
                        Color.clear,
                        Color(red: 0.54, green: 0.45, blue: 0.37).opacity(0.22),
                        Color(red: 0.31, green: 0.25, blue: 0.21).opacity(0.48)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: proxy.size.height * 0.40)
                .frame(maxHeight: .infinity, alignment: .bottom)

                // Dark wood reveals on both sides keep the scene architectural without
                // resembling any selectable My Space room.
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(red: 0.22, green: 0.16, blue: 0.12),
                                Color(red: 0.34, green: 0.25, blue: 0.19)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(width: proxy.size.width * 0.10)
                    .frame(maxHeight: .infinity)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(red: 0.29, green: 0.21, blue: 0.16),
                                Color(red: 0.18, green: 0.13, blue: 0.10)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(width: proxy.size.width * 0.08)
                    .frame(maxHeight: .infinity)
                    .frame(maxWidth: .infinity, alignment: .trailing)

                // Directional daylight reads like a real opening rather than a soft blob.
                LinearGradient(
                    colors: [
                        Color.white.opacity(0.34),
                        Color.white.opacity(0.08),
                        Color.clear
                    ],
                    startPoint: .topTrailing,
                    endPoint: .bottomLeading
                )
                .blendMode(.screen)

                // Thin horizontal seams imply large-format stone/plaster panels.
                VStack(spacing: proxy.size.height * 0.12) {
                    ForEach(0..<6, id: \.self) { _ in
                        Rectangle()
                            .fill(Color.white.opacity(0.035))
                            .frame(height: 0.7)
                    }
                }
                .padding(.horizontal, proxy.size.width * 0.12)
                .offset(y: proxy.size.height * 0.04)

                LinearGradient(
                    colors: [
                        Color.white.opacity(0.08),
                        Color.clear,
                        Color.black.opacity(0.18)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .ignoresSafeArea()
    }
}

private struct MSHOpeningEnvironment: View {
    let desaturated: Bool
    let warmth: Double

    var body: some View {
        GeometryReader { proxy in
            Group {
                if UIImage(named: "MySpaceWarmHouse") != nil {
                    Image("MySpaceWarmHouse")
                        .resizable()
                        .scaledToFill()
                        .frame(width: proxy.size.width, height: proxy.size.height)
                        .clipped()
                        .saturation(desaturated ? 0.40 : 0.86)
                        .contrast(desaturated ? 0.92 : 1.0)
                        .overlay(MSHOpeningPalette.mushroom.opacity(warmth))
                } else {
                    LinearGradient(
                        colors: [MSHOpeningPalette.ivory, MSHOpeningPalette.stone, MSHOpeningPalette.mushroom],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .saturation(desaturated ? 0.45 : 0.85)
                }
            }
        }
        .ignoresSafeArea()
    }
}

private struct MSHOpeningContinueButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        MSHNativeGlassButton(
            shape: Capsule(),
            tint: MSHOpeningPalette.ivory,
            foreground: MSHOpeningPalette.charcoal,
            haptic: .softImpact,
            action: action
        ) {
            HStack(spacing: 10) {
                Text(title)
                Image(systemName: "arrow.right")
                    .font(.subheadline.weight(.semibold))
            }
            .font(.headline.weight(.semibold))
            .padding(.horizontal, 30)
            .frame(height: 58)
        }
        .accessibilityLabel(title)
    }
}
