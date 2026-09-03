import SwiftUI
import UIKit

enum MSHColor {
    // MARK: - Editorial architectural palette
    // Neutral surfaces carry the interface. Color is intentionally restrained so
    // My Space photography and the person's information remain visually primary.
    static let ivory = Color(red: 0.973, green: 0.969, blue: 0.953)       // #F8F7F3
    static let stone = Color(red: 0.878, green: 0.875, blue: 0.863)       // #E0DFDC
    static let charcoal = Color(red: 0.122, green: 0.118, blue: 0.114)    // #1F1E1D
    static let espresso = Color(red: 0.129, green: 0.118, blue: 0.118)    // #211E1E
    static let sage = Color(red: 0.584, green: 0.600, blue: 0.506)        // #959981
    static let powder = Color(red: 0.773, green: 0.812, blue: 0.855)      // #C5CFDA
    static let clay = Color(red: 0.380, green: 0.259, blue: 0.184)        // #61422F
    static let mushroom = Color(red: 0.824, green: 0.753, blue: 0.686)    // #D2C0AF

    // Legacy names remain available while screens migrate to the editorial system.
    // Forest is no longer the default UI accent.
    static let forest = Color(red: 0.10, green: 0.25, blue: 0.16)
    static let cream = ivory
    static let warmWhite = Color(red: 0.992, green: 0.989, blue: 0.980)

    private static let accentLight = UIColor(red: 0.584, green: 0.600, blue: 0.506, alpha: 1)
    private static let accentDark = UIColor(red: 0.690, green: 0.704, blue: 0.620, alpha: 1)
    private static let canvasLight = UIColor(red: 0.973, green: 0.969, blue: 0.953, alpha: 1)
    private static let canvasDark = UIColor(red: 0.082, green: 0.075, blue: 0.075, alpha: 1)

    static let accent = adaptive(light: accentLight, dark: accentDark)

    static let canvas = adaptive(
        light: canvasLight,
        dark: canvasDark
    )

    static let surface = adaptive(
        light: UIColor(red: 0.995, green: 0.993, blue: 0.985, alpha: 1),
        dark: UIColor(red: 0.129, green: 0.118, blue: 0.118, alpha: 1)
    )

    static let secondarySurface = adaptive(
        light: UIColor(red: 0.878, green: 0.875, blue: 0.863, alpha: 1),
        dark: UIColor(red: 0.175, green: 0.164, blue: 0.160, alpha: 1)
    )

    static let controlFill = adaptive(
        light: UIColor(red: 0.930, green: 0.922, blue: 0.902, alpha: 1),
        dark: UIColor(red: 0.185, green: 0.174, blue: 0.168, alpha: 1)
    )

    static let primaryText = adaptive(
        light: UIColor(red: 0.122, green: 0.118, blue: 0.114, alpha: 1),
        dark: UIColor(red: 0.965, green: 0.957, blue: 0.933, alpha: 1)
    )

    static let secondaryText = adaptive(
        light: UIColor(red: 0.412, green: 0.396, blue: 0.376, alpha: 1),
        dark: UIColor(red: 0.745, green: 0.725, blue: 0.690, alpha: 1)
    )

    static let border = adaptive(
        light: UIColor(red: 0.122, green: 0.118, blue: 0.114, alpha: 0.14),
        dark: UIColor(red: 0.965, green: 0.957, blue: 0.933, alpha: 0.14)
    )

    // Supporting editorial accents. These are decorative/organizational colors,
    // not replacements for semantic error, warning, success, or health-state colors.
    static let supportingSage = sage
    static let supportingPowder = powder
    static let supportingClay = clay
    static let supportingMushroom = mushroom

    private static func adaptive(light: UIColor, dark: UIColor) -> Color {
        Color(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark ? dark : light
        })
    }
}

enum MSHSpacing {
    static let xSmall: CGFloat = 6
    static let small: CGFloat = 10
    static let medium: CGFloat = 16
    static let large: CGFloat = 24
    static let xLarge: CGFloat = 32
}

enum MSHRadius {
    static let small: CGFloat = 10
    static let medium: CGFloat = 14
    static let large: CGFloat = 18
}

enum MSHTypography {
    // Editorial hierarchy: serif carries identity; sans-serif carries utility.
    static let destinationTitle = Font.system(.largeTitle, design: .serif, weight: .medium)
    static let editorialTitle = Font.system(size: 38, weight: .regular, design: .serif)
    static let sectionTitle = Font.system(.title2, design: .serif, weight: .regular)
    static let cardTitle = Font.system(.headline, design: .default, weight: .medium)
    static let body = Font.system(.body, design: .default)
    static let utility = Font.system(.caption, design: .default, weight: .medium)
}

struct MSHSurfaceModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(MSHSpacing.large)
            .background(MSHColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: MSHRadius.large, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: MSHRadius.large, style: .continuous)
                    .stroke(MSHColor.border, lineWidth: 0.75)
            }
    }
}

extension View {
    func mshSurface() -> some View {
        modifier(MSHSurfaceModifier())
    }
}

extension MSHNativeHaptic {
    @MainActor
    func fire() {
        play()
    }
}
