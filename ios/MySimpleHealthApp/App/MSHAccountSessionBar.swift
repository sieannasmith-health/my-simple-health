import SwiftUI

struct MSHAccountSessionBar: View {
    @EnvironmentObject private var authStore: MSHAuthStore
    @State private var showSignOutConfirmation = false
    @State private var isSigningOut = false

    var body: some View {
        HStack(spacing: 12) {
            if let email = authStore.userEmail, !email.isEmpty {
                Text(email)
                    .font(.caption)
                    .foregroundStyle(MSHColor.secondaryText)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .accessibilityLabel("Signed in as \(email)")
            }

            Spacer(minLength: 8)

            Menu {
                Button(role: .destructive) {
                    showSignOutConfirmation = true
                } label: {
                    Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                }
            } label: {
                Image(systemName: "person.crop.circle")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(MSHColor.primaryText)
                    .frame(width: 40, height: 40)
                    .contentShape(Rectangle())
            }
            .disabled(isSigningOut)
            .accessibilityLabel("Account menu")
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 44)
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
