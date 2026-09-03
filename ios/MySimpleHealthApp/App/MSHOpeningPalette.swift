import SwiftUI

/// Editorial palette used by the opening onboarding storyboard.
/// Kept separate from the broader onboarding palette so the photographic
/// opening can use a few extra contextual tones without coupling the files.
enum MSHOpeningPalette {
    static let ivory = Color(red: 248 / 255, green: 247 / 255, blue: 243 / 255)
    static let warmWhite = Color(red: 252 / 255, green: 251 / 255, blue: 247 / 255)
    static let charcoal = Color(red: 31 / 255, green: 30 / 255, blue: 29 / 255)
    static let espresso = Color(red: 33 / 255, green: 30 / 255, blue: 30 / 255)
    static let sage = Color(red: 149 / 255, green: 153 / 255, blue: 129 / 255)
    static let stone = Color(red: 224 / 255, green: 223 / 255, blue: 220 / 255)
    static let powder = Color(red: 197 / 255, green: 207 / 255, blue: 218 / 255)
    static let clay = Color(red: 97 / 255, green: 66 / 255, blue: 47 / 255)
    static let mushroom = Color(red: 210 / 255, green: 192 / 255, blue: 175 / 255)
    static let secondaryText = charcoal.opacity(0.56)
}
