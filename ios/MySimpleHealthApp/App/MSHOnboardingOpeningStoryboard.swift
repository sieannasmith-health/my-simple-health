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
                    MSHOpeningEnvironment(desaturated: true, warmth: 0.08)
                        .frame(width: proxy.size.width, height: proxy.size.height)
                        .clipped()

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
                            .opacity(eyebrowVisible ? 1 : 0)
                            .offset(y: eyebrowVisible ? 0 : 7)

                        Text("Your health. Your space.")
                            .font(.system(size: 38, weight: .regular, design: .serif))
                            .multilineTextAlignment(.center)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 26)
                            .fixedSize(horizontal: false, vertical: true)
                            .opacity(titleVisible ? 1 : 0)
                            .offset(y: titleVisible ? 0 : 9)

                        Spacer()

                        MSHOpeningContinueButton(title: "Continue", action: onContinue)
                            .opacity(showContinue ? 1 : 0)
                            .offset(y: showContinue ? 0 : 8)
                            .allowsHitTesting(showContinue)
                            .padding(.bottom, 34)
                    }
                    .padding(.horizontal, 22)
                }
                .frame(width: proxy.size.width, height: proxy.size.height)
                .clipped()
            }
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
                withAnimation(.easeOut(duration: 0.62)) {
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
            .init("6h 42m sleep", symbol: "moon.stars", tint: .powder, x: 0.23, y: 0.17, delay: 0.00, rotation: -2.0),
            .init("Appointment Thursday", symbol: "calendar", tint: .stone, x: 0.69, y: 0.22, delay: 0.12, rotation: 1.5),
            .init("$186 groceries", symbol: "basket", tint: .mushroom, x: 0.30, y: 0.38, delay: 0.22, rotation: 1.0),
            .init("Refill in 5 days", symbol: "pills", tint: .powder, x: 0.72, y: 0.43, delay: 0.32, rotation: -1.5),
            .init("3 workouts this week", symbol: "figure.walk", tint: .sage, x: 0.24, y: 0.59, delay: 0.42, rotation: -1.0),
            .init("Lab result", symbol: "doc.text.magnifyingglass", tint: .stone, x: 0.73, y: 0.63, delay: 0.52, rotation: 1.5),
            .init("Money", symbol: "dollarsign", tint: .mushroom, x: 0.40, y: 0.73, delay: 0.62, rotation: 1.0),
            .init("Food", symbol: "fork.knife", tint: .clay, x: 0.68, y: 0.76, delay: 0.70, rotation: -1.0)
        ]

        var body: some View {
            GeometryReader { proxy in
                ZStack {
                    MSHOpeningEnvironment(desaturated: true, warmth: 0.03)
                        .frame(width: proxy.size.width, height: proxy.size.height)
                        .clipped()

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

                    VStack(spacing: 12) {
                        Spacer()

                        Text("Your health doesn’t happen in pieces.")
                            .font(.system(size: 32, weight: .regular, design: .serif))
                            .foregroundStyle(MSHOpeningPalette.charcoal)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 28)
                            .fixedSize(horizontal: false, vertical: true)
                            .opacity(statementVisible ? 1 : 0)
                            .offset(y: statementVisible ? 0 : 8)

                        Text("The information may arrive separately. Your life doesn’t.")
                            .font(.subheadline)
                            .foregroundStyle(MSHOpeningPalette.secondaryText)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 36)
                            .fixedSize(horizontal: false, vertical: true)
                            .opacity(supportVisible ? 1 : 0)
                            .offset(y: supportVisible ? 0 : 6)

                        MSHOpeningContinueButton(title: "Continue", action: onContinue)
                            .padding(.top, 6)
                            .opacity(showContinue ? 1 : 0)
                            .offset(y: showContinue ? 0 : 8)
                            .allowsHitTesting(showContinue)
                    }
                    .padding(.bottom, 28)
                    .frame(width: proxy.size.width)
                }
                .frame(width: proxy.size.width, height: proxy.size.height)
                .clipped()
            }
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
        @State private var connected = false
        @State private var titleVisible = false
        @State private var supportVisible = false
        @State private var showContinue = false

        private let fragments: [MSHOnboardingFragment] = [
            .init("Sleep", symbol: "moon.stars", tint: .powder, x: 0.28, y: 0.33, delay: 0.00, rotation: 0),
            .init("Busy week", symbol: "calendar.badge.clock", tint: .stone, x: 0.50, y: 0.33, delay: 0.08, rotation: 0),
            .init("Calendar", symbol: "calendar", tint: .sage, x: 0.72, y: 0.33, delay: 0.16, rotation: 0),
            .init("Medication", symbol: "pills", tint: .powder, x: 0.28, y: 0.51, delay: 0.20, rotation: 0),
            .init("Refill", symbol: "clock", tint: .stone, x: 0.50, y: 0.51, delay: 0.28, rotation: 0),
            .init("Thursday", symbol: "sun.max", tint: .sage, x: 0.72, y: 0.51, delay: 0.36, rotation: 0),
            .init("Food", symbol: "fork.knife", tint: .clay, x: 0.28, y: 0.69, delay: 0.40, rotation: 0),
            .init("Household", symbol: "house", tint: .mushroom, x: 0.50, y: 0.69, delay: 0.48, rotation: 0),
            .init("This month", symbol: "calendar.circle", tint: .sage, x: 0.72, y: 0.69, delay: 0.56, rotation: 0)
        ]

        var body: some View {
            GeometryReader { proxy in
                ZStack {
                    MSHOpeningEnvironment(desaturated: !connected, warmth: connected ? 0.20 : 0.05)
                        .frame(width: proxy.size.width, height: proxy.size.height)
                        .clipped()

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
                                    : proxy.size.width * (0.5 + (fragment.x - 0.5) * 1.30),
                                y: connected
                                    ? proxy.size.height * fragment.y
                                    : proxy.size.height * (0.50 + (fragment.y - 0.50) * 1.14)
                            )
                            .opacity(connected ? 1 : 0.70)
                            .scaleEffect(connected ? 1 : 0.94)
                            .animation(
                                reduceMotion ? nil : .easeInOut(duration: 0.92).delay(fragment.delay),
                                value: connected
                            )
                    }

                    VStack(spacing: 10) {
                        Text("Neither should the way you understand it.")
                            .font(.system(size: 31, weight: .regular, design: .serif))
                            .foregroundStyle(MSHOpeningPalette.charcoal)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 26)
                            .fixedSize(horizontal: false, vertical: true)
                            .opacity(titleVisible ? 1 : 0)
                            .offset(y: titleVisible ? 0 : 8)

                        Text("My Simple Health brings the pieces together.")
                            .font(.subheadline)
                            .foregroundStyle(MSHOpeningPalette.secondaryText)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 34)
                            .fixedSize(horizontal: false, vertical: true)
                            .opacity(supportVisible ? 1 : 0)
                            .offset(y: supportVisible ? 0 : 6)

                        Spacer()

                        MSHOpeningContinueButton(title: "Continue", action: onContinue)
                            .opacity(showContinue ? 1 : 0)
                            .offset(y: showContinue ? 0 : 8)
                            .allowsHitTesting(showContinue)
                    }
                    .padding(.top, 60)
                    .padding(.bottom, 28)
                    .frame(width: proxy.size.width)
                }
                .frame(width: proxy.size.width, height: proxy.size.height)
                .clipped()
            }
            .onAppear { runSequence() }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("onboarding-coherence")
        }

        private func runSequence() {
            if reduceMotion {
                connected = true
                titleVisible = true
                supportVisible = true
                showContinue = true
                return
            }

            withAnimation(.easeInOut(duration: 0.95)) {
                connected = true
            }

            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(760))
                withAnimation(.easeOut(duration: 0.88)) {
                    titleVisible = true
                }
                try? await Task.sleep(for: .milliseconds(220))
                withAnimation(.easeOut(duration: 0.72)) {
                    supportVisible = true
                }
                try? await Task.sleep(for: .milliseconds(650))
                withAnimation(.easeOut(duration: 0.58)) {
                    showContinue = true
                }
            }
        }

        private func coherenceLines(in size: CGSize) -> some View {
            Canvas { context, _ in
                let rows: [[CGPoint]] = [
                    [CGPoint(x: size.width * 0.28, y: size.height * 0.33), CGPoint(x: size.width * 0.50, y: size.height * 0.33), CGPoint(x: size.width * 0.72, y: size.height * 0.33)],
                    [CGPoint(x: size.width * 0.28, y: size.height * 0.51), CGPoint(x: size.width * 0.50, y: size.height * 0.51), CGPoint(x: size.width * 0.72, y: size.height * 0.51)],
                    [CGPoint(x: size.width * 0.28, y: size.height * 0.69), CGPoint(x: size.width * 0.50, y: size.height * 0.69), CGPoint(x: size.width * 0.72, y: size.height * 0.69)]
                ]

                for row in rows {
                    var path = Path()
                    path.move(to: row[0])
                    path.addLine(to: row[1])
                    path.addLine(to: row[2])
                    context.stroke(path, with: .color(MSHOpeningPalette.sage.opacity(0.34)), lineWidth: 1)
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
                .stroke(fragment.tint.color.opacity(0.34), lineWidth: 0.8)
        }
        .shadow(color: MSHOpeningPalette.espresso.opacity(0.07), radius: 9, y: 4)
        .accessibilityLabel(fragment.title)
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
