import SwiftUI

/// A lightweight destination surface that is available to SwiftUI immediately,
/// before heavier destination content is mounted. This prevents navigation pushes
/// from exposing the system's default white background while the next screen is
/// being constructed.
struct MSHImmediateDestination<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    @State private var mountContent = false

    var body: some View {
        ZStack {
            MSHColor.canvas
                .ignoresSafeArea()

            if mountContent {
                content()
            } else {
                MSHNavigationLoadingSurface(title: title)
            }
        }
        .task {
            await Task.yield()
            mountContent = true
        }
    }
}

struct MSHNavigationLoadingSurface: View {
    let title: String

    var body: some View {
        VStack(spacing: 14) {
            Spacer()

            ProgressView()
                .controlSize(.small)
                .tint(MSHColor.accent)

            Text(title)
                .font(.system(.headline, design: .serif))
                .foregroundStyle(MSHColor.primaryText)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(MSHColor.canvas)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Opening \(title)")
    }
}

private struct MSHNavigationSurfaceModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(MSHColor.canvas.ignoresSafeArea())
            .toolbarBackground(MSHColor.canvas, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
    }
}

extension View {
    func mshNavigationSurface() -> some View {
        modifier(MSHNavigationSurfaceModifier())
    }
}
