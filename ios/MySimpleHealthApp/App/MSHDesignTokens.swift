import SwiftUI
import UIKit

enum MSHColor {
    // Editorial base: neutral first, MSH green reserved for emphasis.
    static let accentLight = UIColor(red: 0.12, green: 0.29, blue: 0.19, alpha: 1)
    static let accentDark = UIColor(red: 0.52, green: 0.72, blue: 0.54, alpha: 1)
    static let canvasLight = UIColor(red: 0.965, green: 0.945, blue: 0.905, alpha: 1)
    static let canvasDark = UIColor(red: 0.045, green: 0.045, blue: 0.043, alpha: 1)

    static let forest = Color(red: 0.10, green: 0.25, blue: 0.16)
    static let sage = Color(red: 0.56, green: 0.66, blue: 0.55)
    static let cream = Color(red: 0.98, green: 0.96, blue: 0.91)
    static let warmWhite = Color(red: 0.995, green: 0.99, blue: 0.97)
    static let charcoal = Color(red: 0.14, green: 0.15, blue: 0.14)

    static let accent = adaptive(
        light: accentLight,
        dark: accentDark
    )

    static let canvas = adaptive(
        light: canvasLight,
        dark: canvasDark
    )

    static let surface = adaptive(
        light: UIColor(red: 1.0, green: 0.995, blue: 0.985, alpha: 1),
        dark: UIColor(red: 0.085, green: 0.085, blue: 0.08, alpha: 1)
    )

    static let controlFill = adaptive(
        light: UIColor(red: 0.985, green: 0.975, blue: 0.95, alpha: 1),
        dark: UIColor(red: 0.13, green: 0.13, blue: 0.125, alpha: 1)
    )

    static let primaryText = adaptive(
        light: UIColor(red: 0.09, green: 0.09, blue: 0.085, alpha: 1),
        dark: UIColor(red: 0.955, green: 0.95, blue: 0.925, alpha: 1)
    )

    static let secondaryText = adaptive(
        light: UIColor(red: 0.28, green: 0.28, blue: 0.265, alpha: 1),
        dark: UIColor(red: 0.72, green: 0.72, blue: 0.69, alpha: 1)
    )

    static let border = adaptive(
        light: UIColor(red: 0.13, green: 0.13, blue: 0.12, alpha: 0.18),
        dark: UIColor(red: 0.88, green: 0.87, blue: 0.82, alpha: 0.16)
    )

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
    static let destinationTitle = Font.system(.largeTitle, design: .serif, weight: .semibold)
    static let cardTitle = Font.system(.headline, design: .default, weight: .semibold)
    static let body = Font.system(.body, design: .default)
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
