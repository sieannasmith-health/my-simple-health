import SwiftUI

/// Production SwiftUI implementation of onboarding storyboard moments 1–3:
/// atmosphere → fragmentation → coherence.
///
/// The fragments are real SwiftUI views rather than a prerecorded animation so
/// later onboarding work can personalize emphasis without replacing the motion system.
struct MSHOnboardingOpeningStoryboard {
    struct Atmosphere: View {
        let onContinue: () -> Void

        @Environment(\.accessibilityReduceMotion) private var reduceMotion
        @State private var reveal = false
        @State private var showContinue = false

        var body: some View {
            ZStack {
                MSHOpeningEnvironment(desaturated: true, warmth: 0.08)

                LinearGradient(
                    colors: [
                        Color.black.opacity(0.20),
                        Color.black.opacity(0.06),
                        Color.black.opacity(0.28)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                VStack(spacing: 14) {
                    Spacer()

                    Text("MY SIMPLE HEALTH")
                        .font(.system(size: 14, weight: .semibold))
                        .tracking(3.2)
                        .foregroundStyle(.white.opacity(0.82))

                    Text("Your health. Your space.")
                        .font(.system(size: 38, weight: .regular, design: .serif))
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 34)

                    Spacer()

                    if showContinue {
                        MSHOpeningContinueButton(title: "Continue", action: onContinue)
                            .transition(.opacity.combined(with: .move(edge: .bottom)))
                            .padding(.bottom, 34)
                    }
                }
                .opacity(reveal ? 1 : 0)
                .scaleEffect(reveal ? 1 : 0.985)
                .padding(.horizontal, 22)
            }
            .onAppear {
                if reduceMotion {
                    reveal = true
                    showContinue = true
                    return
                }

                withAnimation(.easeOut(duration: 0.85)) {
                    reveal = true
                }
                Task { @MainActor in
                    try? await Task.sleep(for: .milliseconds(1250))
                    withAnimation(.easeOut(duration: 0.45)) {
                        showContinue = true
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("onboarding-opening-atmosphere")
        }
    }

    struct Fragmentation: View {
        let onContinue: () -> Void

        @Environment(\.accessibilityReduceMotion) private var reduceMotion
        @State private var revealFragments = false
        @State private var revealStatement = false
        @State private var showContinue = false

        private let fragments: [MSHOnboardingFragment] = [
            .init("6h 42m sleep", symbol: "moon.stars", tint: .powder, x: 0.25, y: 0.18, delay: 0.00, rotation: -2.0),
            .init("Appointment Thursday", symbol: "calendar", tint: .stone, x: 0.70, y: 0.23, delay: 0.12, rotation: 1.5),
            .init("$186 groceries", symbol: "basket", tint: .mushroom, x: 0.31, y: 0.39, delay: 0.22, rotation: 1.0),
            .init("Refill in 5 days", symbol: "pills", tint: .powder, x: 0.73, y: 0.43, delay: 0.32, rotation: -1.5),
            .init("3 workouts this week", symbol: "figure.walk", tint: .sage, x: 0.24, y: 0.60, delay: 0.42, rotation: -1.0),
            .init("Lab result", symbol: "doc.text.magnifyingglass", tint: .stone, x: 0.74, y: 0.64, delay: 0.52, rotation: 1.5),
            .init("Money", symbol: "dollarsign", tint: .mushroom, x: 0.40, y: 0.76, delay: 0.62, rotation: 1.0),
            .init("Food", symbol: "fork.knife", tint: .clay, x: 0.68, y: 0.78, delay: 0.70, rotation: -1.0)
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
                            .offset(y: revealFragments ? 0 : 18)
                            .opacity(revealFragments ? 1 : 0)
                            .scaleEffect(revealFragments ? 1 : 0.94)
                            .animation(
                                reduceMotion
                                    ? nil
                                    : .spring(response: 0.72, dampingFraction: 0.88)
                                        .delay(fragment.delay),
                                value: revealFragments
                            )
                    }

                    VStack(spacing: 16) {
                        Spacer()

                        if revealStatement {
                            Text("Your health doesn’t happen in pieces.")
                                .font(.system(size: 34, weight: .regular, design: .serif))
                                .foregroundStyle(MSHOpeningPalette.charcoal)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 34)
                                .transition(.opacity.combined(with: .move(edge: .bottom)))

                            Text("The information may arrive separately. Your life doesn’t.")
                                .font(.subheadline)
                                .foregroundStyle(MSHOpeningPalette.secondaryText)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 40)
                                .transition(.opacity)
                        }

                        if showContinue {
                            MSHOpeningContinueButton(title: "Continue", action: onContinue)
                                .padding(.top, 4)
                                .transition(.opacity)
                        }
                    }
                    .padding(.bottom, 30)
                }
            }
            .onAppear {
                revealFragments = true

                if reduceMotion {
                    revealStatement = true
                    showContinue = true
                    return
                }

                Task { @MainActor in
                    try? await Task.sleep(for: .milliseconds(980))
                    withAnimation(.easeOut(duration: 0.55)) {
                        revealStatement = true
                    }
                    try? await Task.sleep(for: .milliseconds(650))
                    withAnimation(.easeOut(duration: 0.35)) {
                        showContinue = true
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("onboarding-fragmentation")
        }
    }

    struct Coherence: View {
        let onContinue: () -> Void

        @Environment(\.accessibilityReduceMotion) private var reduceMotion
        @State private var connected = false
        @State private var revealCopy = false
        @State private var showContinue = false

        private let fragments: [MSHOnboardingFragment] = [
            .init("Sleep", symbol: "moon.stars", tint: .powder, x: 0.28, y: 0.31, delay: 0.00, rotation: 0),
            .init("Busy week", symbol: "calendar.badge.clock", tint: .stone, x: 0.50, y: 0.31, delay: 0.08, rotation: 0),
            .init("Calendar", symbol: "calendar", tint: .sage, x: 0.72, y: 0.31, delay: 0.16, rotation: 0),
            .init("Medication", symbol: "pills", tint: .powder, x: 0.28, y: 0.50, delay: 0.20, rotation: 0),
            .init("Refill", symbol: "clock", tint: .stone, x: 0.50, y: 0.50, delay: 0.28, rotation: 0),
            .init("Thursday", symbol: "sun.max", tint: .sage, x: 0.72, y: 0.50, delay: 0.36, rotation: 0),
            .init("Food", symbol: "fork.knife", tint: .clay, x: 0.28, y: 0.69, delay: 0.40, rotation: 0),
            .init("Household", symbol: "house", tint: .mushroom, x: 0.50, y: 0.69, delay: 0.48, rotation: 0),
            .init("This month", symbol: "calendar.circle", tint: .sage, x: 0.72, y: 0.69, delay: 0.56, rotation: 0)
        ]

        var body: some View {
            GeometryReader { proxy in
                ZStack {
                    MSHOpeningEnvironment(desaturated: !connected, warmth: connected ? 0.20 : 0.05)

                    LinearGradient(
                        colors: [
                            Color.white.opacity(connected ? 0.42 : 0.62),
                            MSHOpeningPalette.ivory.opacity(connected ? 0.66 : 0.82)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .ignoresSafeArea()

                    coherenceLines(in: proxy.size)
                        .opacity(connected ? 1 : 0)

                    ForEach(fragments) { fragment in
                        MSHOnboardingFragmentView(fragment: fragment, compact: true)
                            .position(
                                x: connected
                                    ? proxy.size.width * fragment.x
                                    : proxy.size.width * (0.5 + (fragment.x - 0.5) * 1.34),
                                y: connected
                                    ? proxy.size.height * fragment.y
                                    : proxy.size.height * (0.50 + (fragment.y - 0.50) * 1.18)
                            )
                            .opacity(connected ? 1 : 0.72)
                            .scaleEffect(connected ? 1 : 0.92)
                            .animation(
                                reduceMotion
                                    ? nil
                                    : .spring(response: 0.9, dampingFraction: 0.86)
                                        .delay(fragment.delay),
                                value: connected
                            )
                    }

                    VStack(spacing: 12) {
                        if revealCopy {
                            Text("Neither should the way you understand it.")
                                .font(.system(size: 34, weight: .regular, design: .serif))
                                .foregroundStyle(MSHOpeningPalette.charcoal)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 30)

                            Text("My Simple Health brings the pieces together.")
                                .font(.subheadline)
                                .foregroundStyle(MSHOpeningPalette.secondaryText)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 38)
                        }

                        Spacer()

                        if showContinue {
                            MSHOpeningContinueButton(title: "Continue", action: onContinue)
                                .transition(.opacity)
                        }
                    }
                    .padding(.top, 62)
                    .padding(.bottom, 30)
                    .padding(.horizontal, 22)
                }
            }
            .onAppear {
                if reduceMotion {
                    connected = true
                    revealCopy = true
                    showContinue = true
                    return
                }

                withAnimation(.easeInOut(duration: 0.9)) {
                    connected = true
                }

                Task { @MainActor in
                    try? await Task.sleep(for: .milliseconds(850))
                    withAnimation(.easeOut(duration: 0.5)) {
                        revealCopy = true
                    }
                    try? await Task.sleep(for: .milliseconds(700))
                    withAnimation(.easeOut(duration: 0.35)) {
                        showContinue = true
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("onboarding-coherence")
        }

        private func coherenceLines(in size: CGSize) -> some View {
            Canvas { context, _ in
                let rows: [[CGPoint]] = [
                    [CGPoint(x: size.width * 0.28, y: size.height * 0.31), CGPoint(x: size.width * 0.50, y: size.height * 0.31), CGPoint(x: size.width * 0.72, y: size.height * 0.31)],
                    [CGPoint(x: size.width * 0.28, y: size.height * 0.50), CGPoint(x: size.width * 0.50, y: size.height * 0.50), CGPoint(x: size.width * 0.72, y: size.height * 0.50)],
                    [CGPoint(x: size.width * 0.28, y: size.height * 0.69), CGPoint(x: size.width * 0.50, y: size.height * 0.69), CGPoint(x: size.width * 0.72, y: size.height * 0.69)]
                ]

                for row in rows {
                    var path = Path()
                    path.move(to: row[0])
                    path.addLine(to: row[1])
                    path.addLine(to: row[2])
                    context.stroke(path, with: .color(MSHOpeningPalette.sage.opacity(0.38)), lineWidth: 1)
                }
            }
            .allowsHitTesting(false)
        }
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
    var compact = false

    var body: some View {
        HStack(spacing: compact ? 6 : 8) {
            Image(systemName: fragment.symbol)
                .font(.system(size: compact ? 11 : 13, weight: .medium))
                .foregroundStyle(MSHOpeningPalette.charcoal.opacity(0.72))

            Text(fragment.title)
                .font(.system(size: compact ? 12 : 13, weight: .medium))
                .foregroundStyle(MSHOpeningPalette.charcoal)
                .lineLimit(1)
        }
        .padding(.horizontal, compact ? 10 : 12)
        .frame(height: compact ? 34 : 38)
        .background(.ultraThinMaterial, in: Capsule())
        .background(fragment.tint.color.opacity(0.14), in: Capsule())
        .overlay {
            Capsule()
                .stroke(fragment.tint.color.opacity(0.38), lineWidth: 0.8)
        }
        .shadow(color: MSHOpeningPalette.espresso.opacity(0.08), radius: 10, y: 5)
        .accessibilityLabel(fragment.title)
    }
}

private struct MSHOpeningEnvironment: View {
    let desaturated: Bool
    let warmth: Double

    var body: some View {
        Group {
            if UIImage(named: "MySpaceWarmHouse") != nil {
                Image("MySpaceWarmHouse")
                    .resizable()
                    .scaledToFill()
                    .saturation(desaturated ? 0.40 : 0.86)
                    .contrast(desaturated ? 0.92 : 1.0)
                    .overlay(MSHOpeningPalette.mushroom.opacity(warmth))
            } else {
                LinearGradient(
                    colors: [MSHOpeningPalette.ivory, MSHOpeningPalette.stone, MSHOpeningPalette.mushroom],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .saturation(desaturated ? 0.45 : 0.85)
            }
        }
        .ignoresSafeArea()
    }
}

private struct MSHOpeningContinueButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Text(title)
                Image(systemName: "arrow.right")
                    .font(.footnote.weight(.semibold))
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(MSHOpeningPalette.ivory)
            .padding(.horizontal, 22)
            .frame(height: 48)
            .background(MSHOpeningPalette.charcoal, in: Capsule())
            .overlay {
                Capsule().stroke(Color.white.opacity(0.12), lineWidth: 0.8)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}

private enum MSHOpeningPalette {
    static let ivory = Color(red: 248 / 255, green: 247 / 255, blue: 243 / 255)
    static let stone = Color(red: 224 / 255, green: 223 / 255, blue: 220 / 255)
    static let charcoal = Color(red: 31 / 255, green: 30 / 255, blue: 29 / 255)
    static let espresso = Color(red: 33 / 255, green: 30 / 255, blue: 30 / 255)
    static let sage = Color(red: 149 / 255, green: 153 / 255, blue: 129 / 255)
    static let powder = Color(red: 197 / 255, green: 207 / 255, blue: 218 / 255)
    static let clay = Color(red: 97 / 255, green: 66 / 255, blue: 47 / 255)
    static let mushroom = Color(red: 210 / 255, green: 192 / 255, blue: 175 / 255)
    static let secondaryText = Color(red: 105 / 255, green: 101 / 255, blue: 96 / 255)
}
