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
            generator.impactOccurred(intensity: 0.78)
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
                        // Clear optical body: less flat gray, more light passing through.
                        .overlay {
                            shape.fill(Color.white.opacity(0.045 + (0.055 * glowStrength)))
                        }
                        // Local category tint lives inside the glass instead of only on the border.
                        .overlay {
                            shape.fill(tint.opacity(0.070 + (0.045 * glowStrength)))
                        }
                        // Internal refraction blooms. These are intentionally asymmetric so the
                        // surface feels like thick coated glass catching light rather than a flat fill.
                        .overlay {
                            shape.fill(
                                RadialGradient(
                                    colors: [
                                        Color(red: 0.46, green: 0.82, blue: 1.0)
                                            .opacity(0.18 + (0.12 * glowStrength)),
                                        Color.white.opacity(0.05),
                                        Color.clear
                                    ],
                                    center: .topLeading,
                                    startRadius: 4,
                                    endRadius: 170
                                )
                            )
                        }
                        .overlay {
                            shape.fill(
                                RadialGradient(
                                    colors: [
                                        Color(red: 0.86, green: 0.50, blue: 1.0)
                                            .opacity(0.16 + (0.14 * glowStrength)),
                                        tint.opacity(0.08 + (0.06 * glowStrength)),
                                        Color.clear
                                    ],
                                    center: .bottomTrailing,
                                    startRadius: 2,
                                    endRadius: 185
                                )
                            )
                        }
                        .overlay {
                            shape.fill(
                                LinearGradient(
                                    colors: [
                                        Color.white.opacity(0.15 + (0.08 * glowStrength)),
                                        Color.clear,
                                        Color(red: 1.0, green: 0.82, blue: 0.67)
                                            .opacity(0.07 + (0.05 * glowStrength))
                                    ],
                                    startPoint: .top,
                                    endPoint: .bottomTrailing
                                )
                            )
                        }
                }
            }
            // Pearl/specular rim: bright enough to describe a physically thick glass edge.
            .overlay {
                shape.strokeBorder(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(1.0 * edgeStrength),
                            Color.white.opacity(0.52 * edgeStrength),
                            Color.white.opacity(0.24 * edgeStrength),
                            Color.white.opacity(0.94 * edgeStrength)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1.10
                )
            }
            // MSH optical coating: selective cyan, violet, warm pearl, and local tint.
            .overlay {
                shape.strokeBorder(
                    AngularGradient(
                        colors: [
                            Color.clear,
                            Color(red: 0.36, green: 0.82, blue: 1.0).opacity(0.94 * edgeStrength),
                            Color.clear,
                            tint.opacity(0.60 * edgeStrength),
                            Color.white.opacity(0.20 * edgeStrength),
                            Color.clear,
                            Color(red: 0.78, green: 0.40, blue: 1.0).opacity(0.92 * edgeStrength),
                            Color(red: 1.0, green: 0.77, blue: 0.58).opacity(0.46 * edgeStrength),
                            Color.clear
                        ],
                        center: .center,
                        startAngle: .degrees(-28),
                        endAngle: .degrees(332)
                    ),
                    lineWidth: 1.85
                )
                .blur(radius: 0.12)
            }
            // Outer halo: visible enough to feel futuristic, still localized rather than rainbow.
            .overlay {
                shape.strokeBorder(
                    AngularGradient(
                        colors: [
                            Color.clear,
                            Color(red: 0.38, green: 0.76, blue: 1.0).opacity(0.34 * edgeStrength),
                            Color.clear,
                            Color(red: 0.88, green: 0.50, blue: 1.0).opacity(0.32 * edgeStrength),
                            Color.clear,
                            tint.opacity(0.18 * edgeStrength),
                            Color.clear
                        ],
                        center: .center
                    ),
                    lineWidth: 3.4
                )
                .blur(radius: 1.55)
            }
            // Fine top highlight reinforces a real specular cap.
            .overlay(alignment: .top) {
                shape
                    .strokeBorder(Color.white.opacity(0.92 * edgeStrength), lineWidth: 0.78)
                    .blur(radius: 0.08)
            }
            .shadow(
                color: tint.opacity(0.11 + (0.10 * glowStrength)),
                radius: 10 + (9 * glowStrength),
                y: 1
            )
            .shadow(
                color: Color(red: 0.44, green: 0.76, blue: 1.0)
                    .opacity(0.15 + (0.16 * glowStrength)),
                radius: 12 + (10 * glowStrength),
                y: 1
            )
            .shadow(
                color: Color(red: 0.82, green: 0.45, blue: 1.0)
                    .opacity(0.12 + (0.15 * glowStrength)),
                radius: 14 + (10 * glowStrength),
                y: 2
            )
            .shadow(
                color: Color.black.opacity(0.065 * shadowStrength),
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
                edgeStrength: configuration.isPressed ? 2.05 : 1.28,
                shadowStrength: configuration.isPressed ? 1.50 : 1.0,
                glowStrength: configuration.isPressed ? 1.55 : 0.42
            )
            .overlay {
                if configuration.isPressed {
                    shape.fill(
                        RadialGradient(
                            colors: [
                                Color.white.opacity(0.40),
                                tint.opacity(0.22),
                                Color(red: 0.48, green: 0.82, blue: 1.0).opacity(0.22),
                                Color(red: 0.84, green: 0.48, blue: 1.0).opacity(0.18),
                                Color.clear
                            ],
                            center: .topLeading,
                            startRadius: 2,
                            endRadius: 180
                        )
                    )
                    .allowsHitTesting(false)
                }
            }
            .scaleEffect(configuration.isPressed && !reduceMotion ? 1.045 : 1)
            .brightness(configuration.isPressed ? 0.085 : 0)
            .animation(
                reduceMotion ? nil : .spring(response: 0.18, dampingFraction: 0.72),
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
