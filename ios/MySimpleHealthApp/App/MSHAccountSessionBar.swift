import SwiftUI

struct MSHAccountSessionBar: View {
    @EnvironmentObject private var authStore: MSHAuthStore
    @State private var showAccountHub = false
    @State private var showSignOutConfirmation = false
    @State private var isSigningOut = false

    var body: some View {
        Color.clear
            .frame(height: 0)
            .overlay(alignment: .topTrailing) {
                Button {
                    showAccountHub = true
                } label: {
                    Image(systemName: "person.crop.circle")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(.white)
                        .frame(width: 38, height: 38)
                        .background(.ultraThinMaterial)
                        .overlay {
                            Circle()
                                .stroke(Color.white.opacity(0.22), lineWidth: 0.8)
                        }
                        .clipShape(Circle())
                        .shadow(color: .black.opacity(0.12), radius: 10, y: 4)
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(isSigningOut)
                .accessibilityLabel("Account and sharing")
                .padding(.trailing, 16)
                .padding(.top, 8)
            }
            .zIndex(20)
            .sheet(isPresented: $showAccountHub) {
                accountHub
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
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

    private var accountHub: some View {
        NavigationStack {
            ZStack {
                MSHColor.canvas.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("ACCOUNT")
                                .font(.caption2.weight(.semibold))
                                .tracking(1.8)
                                .foregroundStyle(MSHColor.accent)

                            Text("Your MSH account")
                                .font(.system(size: 29, weight: .medium, design: .serif))
                                .foregroundStyle(MSHColor.primaryText)

                            if let email = authStore.userEmail, !email.isEmpty {
                                Text(email)
                                    .font(.subheadline)
                                    .foregroundStyle(MSHColor.secondaryText)
                                    .textSelection(.enabled)
                            }
                        }

                        VStack(spacing: 0) {
                            NavigationLink {
                                MSHPeopleSharingScreen()
                            } label: {
                                hubRow(
                                    title: "People & Sharing",
                                    subtitle: "Invite someone and control Calendar, Workouts, Finances, and Health sharing.",
                                    systemImage: "person.2"
                                )
                            }
                            .buttonStyle(.plain)

                            divider

                            NavigationLink {
                                MSHProfileSettingsScreen()
                            } label: {
                                hubRow(
                                    title: "Profile & Settings",
                                    subtitle: "Name, appearance, preferences, and account settings.",
                                    systemImage: "slider.horizontal.3"
                                )
                            }
                            .buttonStyle(.plain)

                            divider

                            Link(destination: URL(string: "https://mysimplehealth.org/privacy.html")!) {
                                hubRow(
                                    title: "Privacy",
                                    subtitle: "Review how My Simple Health handles information and permissions.",
                                    systemImage: "lock.shield"
                                )
                            }
                            .buttonStyle(.plain)

                            divider

                            Link(destination: URL(string: "https://mysimplehealth.org/support.html")!) {
                                hubRow(
                                    title: "Help & Support",
                                    subtitle: "Get help with your account and MSH features.",
                                    systemImage: "questionmark.circle"
                                )
                            }
                            .buttonStyle(.plain)
                        }

                        Button(role: .destructive) {
                            showAccountHub = false
                            showSignOutConfirmation = true
                        } label: {
                            Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                                .font(.body.weight(.semibold))
                                .frame(maxWidth: .infinity, minHeight: 46)
                        }
                        .buttonStyle(.bordered)
                        .disabled(isSigningOut)
                    }
                    .padding(22)
                }
            }
            .navigationTitle("Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(MSHColor.canvas, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { showAccountHub = false }
                }
            }
        }
    }

    private func hubRow(title: String, subtitle: String, systemImage: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: systemImage)
                .font(.system(size: 17, weight: .medium))
                .foregroundStyle(MSHColor.accent)
                .frame(width: 34, height: 34)
                .background(MSHColor.controlFill)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(.headline, design: .serif))
                    .foregroundStyle(MSHColor.primaryText)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(MSHColor.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 8)

            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(MSHColor.secondaryText.opacity(0.7))
                .padding(.top, 8)
        }
        .padding(.vertical, 15)
        .contentShape(Rectangle())
    }

    private var divider: some View {
        Rectangle()
            .fill(MSHColor.border)
            .frame(height: 0.5)
            .padding(.leading, 48)
    }
}
