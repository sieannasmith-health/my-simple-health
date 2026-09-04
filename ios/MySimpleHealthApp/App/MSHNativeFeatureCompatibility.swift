import SwiftUI

/// Compatibility bridge for restored My Health cards while the current shell
/// continues to own destination routing.
struct MSHNativeFeatureScreen: View {
    let destination: MSHFeatureDestination

    @ViewBuilder
    var body: some View {
        switch destination {
        case .landscape:
            MSHLandscapeScreen()
        default:
            MSHWebFeatureScreen(destination: destination)
        }
    }
}
