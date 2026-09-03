import SwiftUI
import UIKit

/// MSH's native material foundation.
///
/// This deliberately uses shipping SwiftUI material APIs so the experience remains
/// compatible with the app's iOS 17 deployment target while still feeling at home on iPhone.
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

    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    func body(content: Content) -> some View {
        content
            .background {
                if reduceTransparency {
                    shape
                        .fill(Color.white.opacity(0.90))
                } else {
                    shape
                        .fill(.ultraThinMaterial)
                        .overlay {
                            shape.fill(tint.opacity(0.075))
                        }
                }
            }
            .overlay {
                shape.strokeBorder(
                    AngularGradient(
                        colors: [
                            Color.white.opacity(0.72 * edgeStrength),
                            Color(red: 0.76, green: 0.83, blue: 1.0).opacity(0.22 * edgeStrength),
                            Color(red: 0.92, green: 0.80, blue: 1.0).opacity(0.17 * edgeStrength),
                            tint.opacity(0.20 * edgeStrength),
                            Color.white.opacity(0.62 * edgeStrength)
                        ],
                        center: .center
                    ),
                    lineWidth: 0.8
                )
            }
            .overlay(alignment: .top) {
                shape
                    .strokeBorder(Color.white.opacity(0.32 * edgeStrength), lineWidth: 0.55)
                    .blur(radius: 0.2)
            }
            .shadow(
                color: Color.black.opacity(0.10 * shadowStrength),
                radius: 12,
                y: 5
            )
    }
}

extension View {
    func mshNativeGlass<S: InsettableShape>(
        in shape: S,
        tint: Color = .white,
        edgeStrength: Double = 1,
        shadowStrength: Double = 1
    ) -> some View {
        modifier(
            MSHNativeGlassSurface(
                shape: shape,
                tint: tint,
                edgeStrength: edgeStrength,
                shadowStrength: shadowStrength
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
                edgeStrength: configuration.isPressed ? 1.35 : 1.0,
                shadowStrength: configuration.isPressed ? 1.25 : 1.0
            )
            .scaleEffect(configuration.isPressed && !reduceMotion ? 1.025 : 1)
            .brightness(configuration.isPressed ? 0.025 : 0)
            .animation(
                reduceMotion ? nil : .spring(response: 0.22, dampingFraction: 0.82),
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
