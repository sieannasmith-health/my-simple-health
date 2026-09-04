import SwiftUI

extension View {
    func mshFieldLabel() -> some View {
        self
            .font(.caption2.weight(.semibold))
            .tracking(1.5)
            .foregroundStyle(MSHColor.secondaryText)
    }
}
