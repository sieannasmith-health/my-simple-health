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
            generator.impactOccurred(intensity: 0.76)
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
                            shape.fill(Color.white.opacity(0.07 + (0.11 * glowStrength)))
                        }
                        .overlay {
                            shape.fill(tint.opacity(0.050 + (0.030 * glowStrength)))
                        }
                        .overlay {
                            shape.fill(
                                LinearGradient(
                                    colors: [
                                        tint.opacity(0.14 + (0.06 * glowStrength)),
                                        Color.white.opacity(0.055 + (0.08 * glowStrength)),
                                        Color(red: 0.72, green: 0.82, blue: 1.0).opacity(0.08 + (0.10 * glowStrength)),
                                        Color(red: 0.92, green: 0.75, blue: 1.0).opacity(0.07 + (0.11 * glowStrength)),
                                        Color.white.opacity(0.03)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                        }
                }
            }
            // Crisp pearl rim keeps the object reading as glass rather than a colored pill.
            .overlay {
                shape.strokeBorder(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(1.0 * edgeStrength),
                            Color.white.opacity(0.36 * edgeStrength),
                            Color.white.opacity(0.92 * edgeStrength)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1.00
                )
            }
            // MSH optical coating: selective cyan, violet, pearl, and local category tint.
            .overlay {
                shape.strokeBorder(
                    AngularGradient(
                        colors: [
                            Color.clear,
                            Color(red: 0.45, green: 0.78, blue: 1.0).opacity(0.82 * edgeStrength),
                            Color.clear,
                            tint.opacity(0.52 * edgeStrength),
                            Color.white.opacity(0.18 * edgeStrength),
                            Color.clear,
                            Color(red: 0.80, green: 0.48, blue: 1.0).opacity(0.80 * edgeStrength),
                            Color(red: 1.0, green: 0.82, blue: 0.67).opacity(0.38 * edgeStrength),
                            Color.clear
                        ],
                        center: .center,
                        startAngle: .degrees(-32),
                        endAngle: .degrees(328)
                    ),
                    lineWidth: 1.65
                )
                .blur(radius: 0.18)
            }
            // A broader, softer fringe makes the coating visible without becoming a rainbow border.
            .overlay {
                shape.strokeBorder(
                    AngularGradient(
                        colors: [
                            Color.clear,
                            Color(red: 0.50, green: 0.76, blue: 1.0).opacity(0.22 * edgeStrength),
                            Color.clear,
                            Color(red: 0.86, green: 0.60, blue: 1.0).opacity(0.21 * edgeStrength),
                            Color.clear
                        ],
                        center: .center
                    ),
                    lineWidth: 2.8
                )
                .blur(radius: 1.25)
            }
            .overlay(alignment: .top) {
                shape
                    .strokeBorder(Color.white.opacity(0.84 * edgeStrength), lineWidth: 0.72)
                    .blur(radius: 0.10)
            }
            .shadow(
                color: tint.opacity(0.09 + (0.08 * glowStrength)),
                radius: 9 + (7 * glowStrength),
                y: 1
            )
            .shadow(
                color: Color(red: 0.55, green: 0.73, blue: 1.0).opacity(0.12 + (0.13 * glowStrength)),
                radius: 10 + (8 * glowStrength),
                y: 1
            )
            .shadow(
                color: Color(red: 0.82, green: 0.55, blue: 1.0).opacity(0.09 + (0.12 * glowStrength)),
                radius: 12 + (8 * glowStrength),
                y: 2
            )
            .shadow(
                color: Color.black.opacity(0.07 * shadowStrength),
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
                edgeStrength: configuration.isPressed ? 1.95 : 1.22,
                shadowStrength: configuration.isPressed ? 1.46 : 1.0,
                glowStrength: configuration.isPressed ? 1.35 : 0.34
            )
            .overlay {
                if configuration.isPressed {
                    shape.fill(
                        RadialGradient(
                            colors: [
                                Color.white.opacity(0.34),
                                tint.opacity(0.16),
                                Color(red: 0.58, green: 0.78, blue: 1.0).opacity(0.17),
                                Color(red: 0.86, green: 0.62, blue: 1.0).opacity(0.13),
                                Color.clear
                            ],
                            center: .topLeading,
                            startRadius: 2,
                            endRadius: 170
                        )
                    )
                    .allowsHitTesting(false)
                }
            }
            .scaleEffect(configuration.isPressed && !reduceMotion ? 1.042 : 1)
            .brightness(configuration.isPressed ? 0.075 : 0)
            .animation(
                reduceMotion ? nil : .spring(response: 0.18, dampingFraction: 0.74),
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
