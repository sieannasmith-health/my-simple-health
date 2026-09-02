import SwiftUI

struct MSHAccountSessionBar: View {
    @EnvironmentObject private var authStore: MSHAuthStore
    @State private var showSignOutConfirmation = false
    @State private var isSigningOut = false

    var body: some View {
        HStack(spacing: 10) {
            if let email = authStore.userEmail, !email.isEmpty {
                Text(email)
                    .font(.caption2)
                    .foregroundStyle(MSHColor.secondaryText)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .accessibilityLabel("Signed in as \(email)")
            }

            Spacer(minLength: 8)

            Button {
                showSignOutConfirmation = true
            } label: {
                Image(systemName: "rectangle.portrait.and.arrow.right")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(MSHColor.secondaryText)
                    .frame(width: 34, height: 34)
                    .background(MSHColor.controlFill)
                    .clipShape(Circle())
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .disabled(isSigningOut)
            .accessibilityLabel("Sign out")
        }
        .padding(.horizontal, 16)
        .frame(height: 40)
        .background(MSHColor.surface)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(MSHColor.border)
                .frame(height: 0.5)
        }
        .confirmationDialog(
            "Sign out of My Simple Health?",
            isPresented: $showSignOutConfirmation,
            titleVisibility: .visible
        ) {
            Button("Sign Out", role: .destructive) {
                Task {
                    isSigningOut = true
                    await authStore.signOut()
                    isSigningOut = false
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("You can sign back in at any time.")
        }
    }
}
