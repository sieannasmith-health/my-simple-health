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
        let editorialGlass = shadowStrength <= 0.60 && glowStrength <= 0.22

        content
            .background {
                if reduceTransparency {
                    shape.fill(Color.white.opacity(0.94))
                } else {
                    shape
                        .fill(.ultraThinMaterial)
                        .opacity(editorialGlass ? 0.42 : 1.0)
                        .overlay {
                            shape.fill(
                                Color.black.opacity(
                                    editorialGlass
                                        ? 0.030 + (0.018 * glowStrength)
                                        : 0.0
                                )
                            )
                        }
                        .overlay {
                            shape.fill(
                                Color.white.opacity(
                                    editorialGlass
                                        ? 0.12
                                        : 0.045 + (0.055 * glowStrength)
                                )
                            )
                        }
                        .overlay {
                            shape.fill(
                                tint.opacity(
                                    editorialGlass
                                        ? 0.008 + (0.010 * glowStrength)
                                        : 0.070 + (0.045 * glowStrength)
                                )
                            )
                        }
                        .overlay {
                            shape.fill(
                                RadialGradient(
                                    colors: [
                                        Color(red: 0.46, green: 0.82, blue: 1.0)
                                            .opacity(
                                                editorialGlass
                                                    ? 0.016 + (0.025 * glowStrength)
                                                    : 0.18 + (0.12 * glowStrength)
                                            ),
                                        Color.white.opacity(editorialGlass ? 0.018 : 0.05),
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
                                            .opacity(
                                                editorialGlass
                                                    ? 0.012 + (0.022 * glowStrength)
                                                    : 0.16 + (0.14 * glowStrength)
                                            ),
                                        tint.opacity(editorialGlass ? 0.008 : 0.08 + (0.06 * glowStrength)),
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
                                        Color.white.opacity(editorialGlass ? 0.13 : 0.15 + (0.08 * glowStrength)),
                                        Color.clear,
                                        Color(red: 1.0, green: 0.82, blue: 0.67)
                                            .opacity(editorialGlass ? 0.012 : 0.07 + (0.05 * glowStrength))
                                    ],
                                    startPoint: .top,
                                    endPoint: .bottomTrailing
                                )
                            )
                        }
                }
            }
            .overlay {
                shape.strokeBorder(
                    LinearGradient(
                        colors: [
                            Color.white.opacity((editorialGlass ? 0.76 : 1.0) * edgeStrength),
                            Color.white.opacity((editorialGlass ? 0.30 : 0.52) * edgeStrength),
                            Color.white.opacity((editorialGlass ? 0.12 : 0.24) * edgeStrength),
                            Color.white.opacity((editorialGlass ? 0.66 : 0.94) * edgeStrength)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: editorialGlass ? 0.86 : 1.10
                )
            }
            .overlay {
                shape.strokeBorder(
                    AngularGradient(
                        colors: [
                            Color.clear,
                            Color(red: 0.36, green: 0.82, blue: 1.0)
                                .opacity((editorialGlass ? 0.34 : 0.94) * edgeStrength),
                            Color.clear,
                            tint.opacity((editorialGlass ? 0.12 : 0.60) * edgeStrength),
                            Color.white.opacity((editorialGlass ? 0.10 : 0.20) * edgeStrength),
                            Color.clear,
                            Color(red: 0.78, green: 0.40, blue: 1.0)
                                .opacity((editorialGlass ? 0.30 : 0.92) * edgeStrength),
                            Color(red: 1.0, green: 0.77, blue: 0.58)
                                .opacity((editorialGlass ? 0.12 : 0.46) * edgeStrength),
                            Color.clear
                        ],
                        center: .center,
                        startAngle: .degrees(-28),
                        endAngle: .degrees(332)
                    ),
                    lineWidth: editorialGlass ? 1.18 : 1.85
                )
                .blur(radius: 0.10)
            }
            .overlay {
                shape.strokeBorder(
                    AngularGradient(
                        colors: [
                            Color.clear,
                            Color(red: 0.38, green: 0.76, blue: 1.0)
                                .opacity((editorialGlass ? 0.08 : 0.34) * edgeStrength),
                            Color.clear,
                            Color(red: 0.88, green: 0.50, blue: 1.0)
                                .opacity((editorialGlass ? 0.07 : 0.32) * edgeStrength),
                            Color.clear,
                            tint.opacity((editorialGlass ? 0.04 : 0.18) * edgeStrength),
                            Color.clear
                        ],
                        center: .center
                    ),
                    lineWidth: editorialGlass ? 1.9 : 3.40
                )
                .blur(radius: editorialGlass ? 0.88 : 1.55)
            }
            .overlay(alignment: .top) {
                shape
                    .strokeBorder(
                        Color.white.opacity((editorialGlass ? 0.56 : 0.92) * edgeStrength),
                        lineWidth: editorialGlass ? 0.54 : 0.78
                    )
                    .blur(radius: 0.08)
            }
            .shadow(
                color: tint.opacity((editorialGlass ? 0.012 : 0.11) + ((editorialGlass ? 0.020 : 0.10) * glowStrength)),
                radius: editorialGlass ? 5 : 10 + (9 * glowStrength),
                y: 1
            )
            .shadow(
                color: Color(red: 0.44, green: 0.76, blue: 1.0)
                    .opacity((editorialGlass ? 0.020 : 0.15) + ((editorialGlass ? 0.025 : 0.16) * glowStrength)),
                radius: editorialGlass ? 6 : 12 + (10 * glowStrength),
                y: 1
            )
            .shadow(
                color: Color(red: 0.82, green: 0.45, blue: 1.0)
                    .opacity((editorialGlass ? 0.015 : 0.12) + ((editorialGlass ? 0.022 : 0.15) * glowStrength)),
                radius: editorialGlass ? 6 : 14 + (10 * glowStrength),
                y: 2
            )
            .shadow(
                color: Color.black.opacity((editorialGlass ? 0.045 : 0.065) * shadowStrength),
                radius: editorialGlass ? 8 : 14,
                y: editorialGlass ? 4 : 6
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
