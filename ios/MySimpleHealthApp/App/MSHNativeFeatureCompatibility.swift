import SwiftUI

/// Compatibility bridge for restored My Health cards while the current shell
/// continues to own destination routing.
struct MSHNativeFeatureScreen: View {
    let destination: MSHFeatureDestination

    var body: some View {
        MSHWebFeatureScreen(destination: destination)
    }
}
