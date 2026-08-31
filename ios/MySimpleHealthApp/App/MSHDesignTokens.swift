import SwiftUI
import UIKit

enum MSHColor {
    static let accentLight = UIColor(red: 0.10, green: 0.25, blue: 0.16, alpha: 1)
    static let accentDark = UIColor(red: 0.48, green: 0.72, blue: 0.50, alpha: 1)
    static let canvasLight = UIColor(red: 0.98, green: 0.96, blue: 0.91, alpha: 1)
    static let canvasDark = UIColor(red: 0.055, green: 0.07, blue: 0.06, alpha: 1)

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
        light: UIColor(red: 0.995, green: 0.99, blue: 0.97, alpha: 0.94),
        dark: UIColor(red: 0.105, green: 0.13, blue: 0.11, alpha: 0.96)
    )

    static let primaryText = adaptive(
        light: UIColor(red: 0.14, green: 0.15, blue: 0.14, alpha: 1),
        dark: UIColor(red: 0.94, green: 0.94, blue: 0.90, alpha: 1)
    )

    static let secondaryText = adaptive(
        light: UIColor(red: 0.34, green: 0.38, blue: 0.34, alpha: 1),
        dark: UIColor(red: 0.68, green: 0.72, blue: 0.67, alpha: 1)
    )

    static let border = adaptive(
        light: UIColor(red: 0.10, green: 0.25, blue: 0.16, alpha: 0.12),
        dark: UIColor(red: 0.56, green: 0.66, blue: 0.55, alpha: 0.22)
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
    static let small: CGFloat = 12
    static let medium: CGFloat = 18
    static let large: CGFloat = 26
}

enum MSHTypography {
    static let destinationTitle = Font.system(.largeTitle, design: .rounded, weight: .semibold)
    static let cardTitle = Font.system(.headline, design: .rounded, weight: .semibold)
    static let body = Font.system(.body, design: .rounded)
}

struct MSHSurfaceModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(MSHSpacing.large)
            .background(MSHColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: MSHRadius.large, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: MSHRadius.large, style: .continuous)
                    .stroke(MSHColor.border, lineWidth: 1)
            }
    }
}

extension View {
    func mshSurface() -> some View {
        modifier(MSHSurfaceModifier())
    }
}
