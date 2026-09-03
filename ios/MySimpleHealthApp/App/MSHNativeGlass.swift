import SwiftUI
import UIKit

/// MSH's native material foundation.
///
/// Uses shipping SwiftUI material APIs so the experience remains compatible with
/// the app's iOS 17 deployment target while preserving MSH's optical glass language.
enum MSHNativeHaptic {
    case none
    case selection
    case softImpact
    case confirmation

    @MainActor
    func play() {
        switch self {
        case .none:
            break
        case .selection:
            UISelectionFeedbackGenerator().selectionChanged()
        case .softImpact:
            let generator = UIImpactFeedbackGenerator(style: .soft)
            generator.prepare()
            generator.impactOccurred(intensity: 0.72)
        case .confirmation:
            let generator = UINotificationFeedbackGenerator()
            generator.prepare()
            generator.notificationOccurred(.success)
        }
    }
}

struct MSHNativeGlassSurface<S: InsettableShape>: ViewModifier {
    let shape: S
    let tint: Color
    let edgeStrength: Double
    let shadowStrength: Double
    let glowStrength: Double

    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    func body(content: Content) -> some View {
        content
            .background {
                if reduceTransparency {
                    shape.fill(Color.white.opacity(0.94))
                } else {
                    shape
                        .fill(.ultraThinMaterial)
                        .overlay {
                            shape.fill(Color.white.opacity(0.10 + (0.10 * glowStrength)))
                        }
                        .overlay {
                            shape.fill(tint.opacity(0.018))
                        }
                        .overlay {
                            shape.fill(
                                LinearGradient(
                                    colors: [
                                        Color(red: 0.68, green: 0.80, blue: 1.0).opacity(0.10 * glowStrength),
                                        Color.white.opacity(0.06 * glowStrength),
                                        Color(red: 0.91, green: 0.72, blue: 1.0).opacity(0.10 * glowStrength)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                        }
                }
            }
            // Bright specular rim first.
            .overlay {
                shape.strokeBorder(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.98 * edgeStrength),
                            Color.white.opacity(0.42 * edgeStrength),
                            Color.white.opacity(0.82 * edgeStrength)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 0.95
                )
            }
            // Localized chromatic fringe: blue on one side, violet on the opposite side.
            .overlay {
                shape.strokeBorder(
                    AngularGradient(
                        colors: [
                            Color.clear,
                            Color(red: 0.56, green: 0.72, blue: 1.0).opacity(0.62 * edgeStrength),
                            Color.clear,
                            Color.white.opacity(0.14 * edgeStrength),
                            Color.clear,
                            Color(red: 0.82, green: 0.57, blue: 1.0).opacity(0.58 * edgeStrength),
                            Color.clear
                        ],
                        center: .center,
                        startAngle: .degrees(-35),
                        endAngle: .degrees(325)
                    ),
                    lineWidth: 1.35
                )
                .blur(radius: 0.22)
            }
            .overlay(alignment: .top) {
                shape
                    .strokeBorder(Color.white.opacity(0.72 * edgeStrength), lineWidth: 0.62)
                    .blur(radius: 0.12)
            }
            .shadow(
                color: Color(red: 0.58, green: 0.68, blue: 1.0).opacity(0.10 * glowStrength),
                radius: 10 + (5 * glowStrength),
                y: 1
            )
            .shadow(
                color: Color(red: 0.80, green: 0.58, blue: 1.0).opacity(0.075 * glowStrength),
                radius: 12 + (4 * glowStrength),
                y: 2
            )
            .shadow(
                color: Color.black.opacity(0.08 * shadowStrength),
                radius: 14,
                y: 6
            )
    }
}

extension View {
    func mshNativeGlass<S: InsettableShape>(
        in shape: S,
        tint: Color = .white,
        edgeStrength: Double = 1,
        shadowStrength: Double = 1,
        glowStrength: Double = 0
    ) -> some View {
        modifier(
            MSHNativeGlassSurface(
                shape: shape,
                tint: tint,
                edgeStrength: edgeStrength,
                shadowStrength: shadowStrength,
                glowStrength: glowStrength
            )
        )
    }
}

struct MSHNativeGlassButtonStyle<S: InsettableShape>: ButtonStyle {
    let shape: S
    let tint: Color
    let foreground: Color

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(foreground)
            .mshNativeGlass(
                in: shape,
                tint: tint,
                edgeStrength: configuration.isPressed ? 1.72 : 1.08,
                shadowStrength: configuration.isPressed ? 1.38 : 1.0,
                glowStrength: configuration.isPressed ? 1.0 : 0.16
            )
            .overlay {
                if configuration.isPressed {
                    shape.fill(
                        RadialGradient(
                            colors: [
                                Color.white.opacity(0.24),
                                Color(red: 0.67, green: 0.79, blue: 1.0).opacity(0.12),
                                Color(red: 0.88, green: 0.69, blue: 1.0).opacity(0.08),
                                Color.clear
                            ],
                            center: .topLeading,
                            startRadius: 2,
                            endRadius: 150
                        )
                    )
                    .allowsHitTesting(false)
                }
            }
            .scaleEffect(configuration.isPressed && !reduceMotion ? 1.035 : 1)
            .brightness(configuration.isPressed ? 0.055 : 0)
            .animation(
                reduceMotion ? nil : .spring(response: 0.20, dampingFraction: 0.78),
                value: configuration.isPressed
            )
    }
}

struct MSHNativeGlassButton<Label: View, S: InsettableShape>: View {
    let shape: S
    let tint: Color
    let foreground: Color
    let haptic: MSHNativeHaptic
    let action: () -> Void
    private let label: () -> Label

    init(
        shape: S,
        tint: Color = .white,
        foreground: Color = .primary,
        haptic: MSHNativeHaptic = .softImpact,
        action: @escaping () -> Void,
        @ViewBuilder label: @escaping () -> Label
    ) {
        self.shape = shape
        self.tint = tint
        self.foreground = foreground
        self.haptic = haptic
        self.action = action
        self.label = label
    }

    var body: some View {
        Button {
            haptic.play()
            action()
        } label: {
            label()
        }
        .buttonStyle(
            MSHNativeGlassButtonStyle(
                shape: shape,
                tint: tint,
                foreground: foreground
            )
        )
    }
}
