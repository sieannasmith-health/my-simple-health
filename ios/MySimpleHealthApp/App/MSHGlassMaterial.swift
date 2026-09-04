import SwiftUI
import UIKit

/// Shared material language for MSH controls.
///
/// On iOS 26 and later we intentionally defer to Apple's Liquid Glass button styles
/// so MSH feels native to the system. Older supported iOS versions receive a restrained
/// material fallback that preserves the same MSH hierarchy without imitating system chrome.
enum MSHGlassHaptic {
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

struct MSHGlassControl<Label: View>: View {
    enum Emphasis {
        case regular
        case prominent
    }

    private let emphasis: Emphasis
    private let haptic: MSHGlassHaptic
    private let action: () -> Void
    private let label: () -> Label

    init(
        emphasis: Emphasis = .regular,
        haptic: MSHGlassHaptic = .softImpact,
        action: @escaping () -> Void,
        @ViewBuilder label: @escaping () -> Label
    ) {
        self.emphasis = emphasis
        self.haptic = haptic
        self.action = action
        self.label = label
    }

    var body: some View {
        Group {
            if #available(iOS 26.0, *) {
                nativeLiquidGlassButton
            } else {
                legacyMaterialButton
            }
        }
    }

    @available(iOS 26.0, *)
    @ViewBuilder
    private var nativeLiquidGlassButton: some View {
        switch emphasis {
        case .regular:
            baseButton
                .buttonStyle(.glass)
        case .prominent:
            baseButton
                .buttonStyle(.glassProminent)
        }
    }

    private var legacyMaterialButton: some View {
        baseButton
            .buttonStyle(MSHLegacyGlassButtonStyle(emphasis: emphasis))
    }

    private var baseButton: some View {
        Button {
            haptic.play()
            action()
        } label: {
            label()
        }
        .accessibilityAddTraits(.isButton)
    }
}

private struct MSHLegacyGlassButtonStyle: ButtonStyle {
    let emphasis: MSHGlassControl<EmptyView>.Emphasis

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
            .background {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay {
                        RoundedRectangle(cornerRadius: 22, style: .continuous)
                            .fill(
                                emphasis == .prominent
                                    ? MSHColor.warmWhite.opacity(0.12)
                                    : Color.white.opacity(0.035)
                            )
                    }
            }
            .overlay {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .strokeBorder(
                        AngularGradient(
                            colors: [
                                Color.white.opacity(configuration.isPressed ? 0.72 : 0.38),
                                Color(red: 0.72, green: 0.78, blue: 1.00).opacity(configuration.isPressed ? 0.30 : 0.10),
                                Color(red: 0.88, green: 0.72, blue: 1.00).opacity(configuration.isPressed ? 0.26 : 0.08),
                                Color.white.opacity(configuration.isPressed ? 0.68 : 0.34)
                            ],
                            center: .center
                        ),
                        lineWidth: configuration.isPressed ? 1.15 : 0.7
                    )
            }
            .shadow(
                color: Color.white.opacity(configuration.isPressed ? 0.12 : 0.04),
                radius: configuration.isPressed ? 10 : 4,
                y: configuration.isPressed ? 2 : 1
            )
            .scaleEffect(configuration.isPressed ? 1.025 : 1.0)
            .brightness(configuration.isPressed ? 0.035 : 0)
            .animation(
                .spring(response: 0.22, dampingFraction: 0.82),
                value: configuration.isPressed
            )
    }
}

extension MSHGlassControl where Label == HStack<TupleView<(Image, Text)>> {
    init(
        _ title: String,
        systemImage: String,
        emphasis: Emphasis = .regular,
        haptic: MSHGlassHaptic = .softImpact,
        action: @escaping () -> Void
    ) {
        self.init(emphasis: emphasis, haptic: haptic, action: action) {
            HStack(spacing: 8) {
                Image(systemName: systemImage)
                Text(title)
                    .font(.system(.body, design: .default, weight: .semibold))
            }
        }
    }
}

#Preview("MSH Glass") {
    ZStack {
        LinearGradient(
            colors: [MSHColor.charcoal, MSHColor.forest.opacity(0.82)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()

        VStack(spacing: 18) {
            MSHGlassControl("Ask Simple", systemImage: "sparkles") {}
            MSHGlassControl(
                "Continue",
                systemImage: "arrow.right",
                emphasis: .prominent
            ) {}
        }
        .foregroundStyle(.white)
    }
}
