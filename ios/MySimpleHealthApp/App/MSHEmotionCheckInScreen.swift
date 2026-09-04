import SwiftUI

struct MSHEmotionCheckInScreen: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var valence: Double = 0

    var body: some View {
        ZStack {
            MSHEmotionPalette.background.ignoresSafeArea()
            ambientBackground

            ScrollView(showsIndicators: false) {
                VStack(spacing: 24) {
                    header
                    prompt

                    MSHGlassEmotionOrb(
                        valence: valence,
                        reduceMotion: reduceMotion
                    )
                    .frame(width: 270, height: 270)
                    .accessibilityHidden(true)

                    emotionDescription

                    MSHValenceSlider(value: $valence)
                        .padding(.horizontal, 4)

                    reflectionCard

                    Button {
                        dismiss()
                    } label: {
                        HStack {
                            Spacer()
                            Text("Next")
                                .font(.headline.weight(.semibold))
                            Spacer()
                            Image(systemName: "arrow.right")
                                .font(.headline)
                        }
                        .foregroundStyle(MSHEmotionPalette.primaryText)
                        .padding(.horizontal, 22)
                        .frame(height: 58)
                        .background(.ultraThinMaterial, in: Capsule())
                        .overlay {
                            Capsule()
                                .stroke(MSHEmotionPalette.glassBorder, lineWidth: 0.8)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("emotion-check-in-next")
                }
                .padding(.horizontal, 22)
                .padding(.top, 14)
                .padding(.bottom, 36)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .accessibilityIdentifier("emotion-check-in-screen")
    }

    private var ambientBackground: some View {
        ZStack {
            Circle()
                .fill(MSHEmotionPalette.coolGlow.opacity(0.20))
                .frame(width: 360, height: 360)
                .blur(radius: 80)
                .offset(x: -150, y: -240)

            Circle()
                .fill(MSHEmotionPalette.warmGlow.opacity(0.17))
                .frame(width: 310, height: 310)
                .blur(radius: 90)
                .offset(x: 160, y: 40)

            Circle()
                .fill(MSHEmotionPalette.sageGlow.opacity(0.16))
                .frame(width: 330, height: 330)
                .blur(radius: 95)
                .offset(x: -120, y: 390)
        }
        .allowsHitTesting(false)
    }

    private var header: some View {
        HStack {
            Button {
                dismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 18, weight: .semibold))
                    .frame(width: 46, height: 46)
                    .background(.ultraThinMaterial, in: Circle())
                    .overlay { Circle().stroke(MSHEmotionPalette.glassBorder, lineWidth: 0.7) }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")

            Spacer()

            Text("CHECK IN")
                .font(.caption.weight(.semibold))
                .tracking(4.2)
                .foregroundStyle(MSHEmotionPalette.secondaryText)

            Spacer()

            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 18, weight: .semibold))
                    .frame(width: 46, height: 46)
                    .background(.ultraThinMaterial, in: Circle())
                    .overlay { Circle().stroke(MSHEmotionPalette.glassBorder, lineWidth: 0.7) }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
        }
        .foregroundStyle(MSHEmotionPalette.primaryText)
    }

    private var prompt: some View {
        VStack(spacing: 8) {
            Text("How are you feeling right now?")
                .font(.system(size: 34, weight: .medium, design: .serif))
                .multilineTextAlignment(.center)
                .foregroundStyle(MSHEmotionPalette.primaryText)

            Text("There’s no right or wrong answer. Just a moment to notice.")
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(MSHEmotionPalette.secondaryText)
                .padding(.horizontal, 18)
        }
    }

    private var emotionDescription: some View {
        let state = MSHEmotionState(valence: valence)
        return VStack(spacing: 6) {
            Text(state.label.uppercased())
                .font(.caption.weight(.semibold))
                .tracking(3.0)
                .foregroundStyle(MSHEmotionPalette.secondaryText)

            Text(state.description)
                .font(.system(.body, design: .serif))
                .foregroundStyle(MSHEmotionPalette.primaryText)
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.18), value: state.label)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Current feeling: \(state.label). \(state.description)")
    }

    private var reflectionCard: some View {
        HStack(spacing: 14) {
            Image(systemName: "leaf")
                .font(.system(size: 20, weight: .light))
                .foregroundStyle(MSHEmotionPalette.warmGlow)
                .frame(width: 42, height: 42)
                .background(.thinMaterial, in: Circle())

            VStack(alignment: .leading, spacing: 4) {
                Text("It’s okay to feel however you feel.")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(MSHEmotionPalette.primaryText)
                Text("Notice what is here without needing to change it.")
                    .font(.caption)
                    .foregroundStyle(MSHEmotionPalette.secondaryText)
            }

            Spacer(minLength: 0)
        }
        .padding(18)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(MSHEmotionPalette.glassBorder, lineWidth: 0.7)
        }
    }
}

struct MSHEmotionState: Equatable {
    let valence: Double

    init(valence: Double) {
        self.valence = min(max(valence, -1), 1)
    }

    var label: String {
        switch valence {
        case ..<(-0.65): "Very unpleasant"
        case ..<(-0.18): "Unpleasant"
        case ...0.18: "Neutral"
        case ...0.65: "Pleasant"
        default: "Very pleasant"
        }
    }

    var description: String {
        switch valence {
        case ..<(-0.65): "Heavy. Intense. Here."
        case ..<(-0.18): "Not quite settled."
        case ...0.18: "Steady. Present. Okay."
        case ...0.65: "A little lighter."
        default: "Open. Bright. Good."
        }
    }

    var mouthCurve: Double { valence }
    var eyeTilt: Double { valence * 0.16 }
    var glowStrength: Double { 0.22 + abs(valence) * 0.16 }
    var verticalScale: Double { 1 + valence * 0.012 }
}

private struct MSHGlassEmotionOrb: View {
    let valence: Double
    let reduceMotion: Bool

    var body: some View {
        TimelineView(.animation(minimumInterval: reduceMotion ? 1 : 1.0 / 30.0)) { timeline in
            let seconds = timeline.date.timeIntervalSinceReferenceDate
            let phase = reduceMotion ? 0 : seconds
            let state = MSHEmotionState(valence: valence)
            let breath = reduceMotion ? 1 : 1 + sin(phase * 0.72) * 0.008
            let driftX = reduceMotion ? 0 : sin(phase * 0.31) * 5
            let driftY = reduceMotion ? 0 : cos(phase * 0.27) * 4

            ZStack {
                Circle()
                    .fill(MSHEmotionPalette.shadow.opacity(0.58))
                    .frame(width: 200, height: 34)
                    .blur(radius: 18)
                    .offset(y: 118)

                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                MSHEmotionPalette.tint(for: valence).opacity(0.50),
                                MSHEmotionPalette.tint(for: valence).opacity(0.13),
                                .clear
                            ],
                            center: .center,
                            startRadius: 12,
                            endRadius: 142
                        )
                    )
                    .blur(radius: 22)
                    .scaleEffect(1.08)

                Circle()
                    .fill(.ultraThinMaterial)
                    .overlay {
                        Circle()
                            .fill(
                                RadialGradient(
                                    colors: [
                                        MSHEmotionPalette.tint(for: valence).opacity(state.glowStrength),
                                        Color.white.opacity(0.055),
                                        Color.black.opacity(0.16)
                                    ],
                                    center: UnitPoint(x: 0.43, y: 0.45),
                                    startRadius: 8,
                                    endRadius: 135
                                )
                            )
                    }
                    .overlay {
                        Circle()
                            .stroke(
                                LinearGradient(
                                    colors: [
                                        Color.white.opacity(0.78),
                                        Color.white.opacity(0.12),
                                        MSHEmotionPalette.warmGlow.opacity(0.46),
                                        MSHEmotionPalette.coolGlow.opacity(0.50),
                                        Color.white.opacity(0.54)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 2.1
                            )
                    }
                    .overlay(alignment: .topLeading) {
                        Ellipse()
                            .fill(
                                LinearGradient(
                                    colors: [Color.white.opacity(0.70), Color.white.opacity(0.03)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 132, height: 64)
                            .blur(radius: 5)
                            .rotationEffect(.degrees(-22))
                            .offset(x: 34 + driftX, y: 20 + driftY)
                            .blendMode(.screen)
                    }
                    .overlay(alignment: .bottomTrailing) {
                        ArcHighlight()
                            .stroke(MSHEmotionPalette.warmGlow.opacity(0.28), style: StrokeStyle(lineWidth: 8, lineCap: .round))
                            .frame(width: 200, height: 200)
                            .blur(radius: 4)
                            .offset(x: -9, y: -7)
                    }
                    .shadow(color: MSHEmotionPalette.tint(for: valence).opacity(0.22), radius: 24, x: 0, y: 14)

                MSHEmotionFace(valence: valence)
                    .padding(54)
            }
            .scaleEffect(x: breath, y: breath * state.verticalScale)
            .animation(reduceMotion ? nil : .interactiveSpring(response: 0.34, dampingFraction: 0.82), value: valence)
        }
    }
}

private struct MSHEmotionFace: View {
    let valence: Double

    var body: some View {
        Canvas { context, size in
            let center = CGPoint(x: size.width / 2, y: size.height / 2)
            let ink = Color.black.opacity(0.70)
            let eyeWidth = size.width * 0.17
            let eyeY = center.y - size.height * 0.10
            let tilt = valence * size.height * 0.018

            for direction in [-1.0, 1.0] {
                let eyeX = center.x + direction * size.width * 0.22
                var eye = Path()
                eye.move(to: CGPoint(x: eyeX - eyeWidth / 2, y: eyeY - direction * tilt))
                eye.addQuadCurve(
                    to: CGPoint(x: eyeX + eyeWidth / 2, y: eyeY + direction * tilt),
                    control: CGPoint(x: eyeX, y: eyeY - max(valence, 0) * size.height * 0.025)
                )
                context.stroke(eye, with: .color(ink), style: StrokeStyle(lineWidth: 5.2, lineCap: .round))
            }

            let mouthWidth = size.width * (0.25 + abs(valence) * 0.055)
            let mouthY = center.y + size.height * 0.16
            var mouth = Path()
            mouth.move(to: CGPoint(x: center.x - mouthWidth / 2, y: mouthY))
            mouth.addQuadCurve(
                to: CGPoint(x: center.x + mouthWidth / 2, y: mouthY),
                control: CGPoint(x: center.x, y: mouthY + CGFloat(valence) * size.height * 0.19)
            )
            context.stroke(mouth, with: .color(ink), style: StrokeStyle(lineWidth: 5.4, lineCap: .round))
        }
        .drawingGroup()
    }
}

private struct MSHValenceSlider: View {
    @Binding var value: Double
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(spacing: 10) {
            GeometryReader { proxy in
                let width = proxy.size.width
                let progress = CGFloat((value + 1) / 2)

                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: [
                                    MSHEmotionPalette.coolGlow,
                                    MSHEmotionPalette.sageGlow,
                                    MSHEmotionPalette.warmGlow
                                ],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .opacity(0.70)
                        .frame(height: 17)
                        .overlay { Capsule().stroke(Color.white.opacity(0.54), lineWidth: 0.8) }

                    Circle()
                        .fill(.regularMaterial)
                        .overlay { Circle().stroke(Color.white.opacity(0.72), lineWidth: 1) }
                        .shadow(color: Color.black.opacity(0.26), radius: 7, y: 4)
                        .frame(width: 38, height: 38)
                        .offset(x: max(0, min(width - 38, progress * (width - 38))))
                }
                .frame(height: 44)
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { gesture in
                            let normalized = min(max(gesture.location.x / width, 0), 1)
                            let updated = Double(normalized * 2 - 1)
                            if reduceMotion {
                                value = updated
                            } else {
                                withAnimation(.interactiveSpring(response: 0.22, dampingFraction: 0.86)) {
                                    value = updated
                                }
                            }
                        }
                )
            }
            .frame(height: 44)

            HStack {
                Text("VERY\nUNPLEASANT")
                    .multilineTextAlignment(.leading)
                Spacer()
                Text("NEUTRAL")
                Spacer()
                Text("VERY\nPLEASANT")
                    .multilineTextAlignment(.trailing)
            }
            .font(.system(size: 10, weight: .medium))
            .tracking(1.3)
            .foregroundStyle(MSHEmotionPalette.secondaryText)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Feeling pleasantness")
        .accessibilityValue(MSHEmotionState(valence: value).label)
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: value = min(1, value + 0.1)
            case .decrement: value = max(-1, value - 0.1)
            @unknown default: break
            }
        }
        .accessibilityIdentifier("emotion-valence-slider")
    }
}

private struct ArcHighlight: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.addArc(
            center: CGPoint(x: rect.midX, y: rect.midY),
            radius: min(rect.width, rect.height) * 0.44,
            startAngle: .degrees(18),
            endAngle: .degrees(104),
            clockwise: false
        )
        return path
    }
}

private enum MSHEmotionPalette {
    static let background = Color(red: 0.045, green: 0.070, blue: 0.068)
    static let primaryText = Color(red: 0.94, green: 0.93, blue: 0.89)
    static let secondaryText = Color(red: 0.72, green: 0.74, blue: 0.70)
    static let coolGlow = Color(red: 0.32, green: 0.67, blue: 0.72)
    static let sageGlow = Color(red: 0.48, green: 0.66, blue: 0.49)
    static let warmGlow = Color(red: 0.85, green: 0.68, blue: 0.38)
    static let shadow = Color.black
    static let glassBorder = Color.white.opacity(0.22)

    static func tint(for valence: Double) -> Color {
        let clamped = min(max(valence, -1), 1)
        if clamped < 0 {
            return Color.interpolate(from: coolGlow, to: sageGlow, fraction: clamped + 1)
        }
        return Color.interpolate(from: sageGlow, to: warmGlow, fraction: clamped)
    }
}

private extension Color {
    static func interpolate(from: Color, to: Color, fraction: Double) -> Color {
        let fraction = min(max(fraction, 0), 1)
        let fromColor = UIColor(from)
        let toColor = UIColor(to)

        var fr: CGFloat = 0
        var fg: CGFloat = 0
        var fb: CGFloat = 0
        var fa: CGFloat = 0
        var tr: CGFloat = 0
        var tg: CGFloat = 0
        var tb: CGFloat = 0
        var ta: CGFloat = 0

        guard fromColor.getRed(&fr, green: &fg, blue: &fb, alpha: &fa),
              toColor.getRed(&tr, green: &tg, blue: &tb, alpha: &ta) else {
            return from
        }

        let f = CGFloat(fraction)
        return Color(
            red: fr + (tr - fr) * f,
            green: fg + (tg - fg) * f,
            blue: fb + (tb - fb) * f,
            opacity: fa + (ta - fa) * f
        )
    }
}
