import SwiftUI
import UIKit

struct MSHAccountSessionBar: View {
    @EnvironmentObject private var authStore: MSHAuthStore
    @State private var showSignOutConfirmation = false
    @State private var isSigningOut = false
    @State private var presentedSection: AccountSection?

    private enum AccountSection: String, Identifiable {
        case account
        case peopleSharing
        case appearance
        case privacy
        case help

        var id: String { rawValue }
    }

    private var inviteURL: URL {
        var components = URLComponents(string: "https://mysimplehealth.org/")!
        var items = [URLQueryItem(name: "invite", value: "msh")]
        if let userID = authStore.userID, !userID.isEmpty {
            items.append(URLQueryItem(name: "ref", value: userID))
        }
        components.queryItems = items
        return components.url!
    }

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
                Button {
                    presentedSection = .account
                } label: {
                    Label("Account", systemImage: "person.crop.circle")
                }

                Button {
                    presentedSection = .peopleSharing
                } label: {
                    Label("People & Sharing", systemImage: "person.2")
                }

                ShareLink(
                    item: inviteURL,
                    subject: Text("Join me on My Simple Health"),
                    message: Text("I’d like to connect with you on My Simple Health. This invite does not share any health information until we both choose what to share.")
                ) {
                    Label("Invite Someone", systemImage: "square.and.arrow.up")
                }

                Divider()

                Button {
                    presentedSection = .appearance
                } label: {
                    Label("Appearance", systemImage: "circle.lefthalf.filled")
                }

                Button {
                    presentedSection = .privacy
                } label: {
                    Label("Privacy & Permissions", systemImage: "lock.shield")
                }

                Button {
                    presentedSection = .help
                } label: {
                    Label("Help", systemImage: "questionmark.circle")
                }

                Divider()

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
            .accessibilityLabel("Account and sharing menu")
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 44)
        .background(MSHColor.surface)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(MSHColor.border)
                .frame(height: 0.5)
        }
        .sheet(item: $presentedSection) { section in
            accountSheet(section)
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

    @ViewBuilder
    private func accountSheet(_ section: AccountSection) -> some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    switch section {
                    case .account:
                        accountContent
                    case .peopleSharing:
                        peopleSharingContent
                    case .appearance:
                        appearanceContent
                    case .privacy:
                        privacyContent
                    case .help:
                        helpContent
                    }
                }
                .padding(24)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(MSHColor.surface)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { presentedSection = nil }
                }
            }
        }
    }

    private var accountContent: some View {
        VStack(alignment: .leading, spacing: 18) {
            sheetTitle("Account", systemImage: "person.crop.circle")
            if let email = authStore.userEmail, !email.isEmpty {
                infoRow("Signed in as", value: email)
            }
            Text("Your account keeps your MSH experience connected across the app. Sharing remains separate and permission-based.")
                .font(.body)
                .foregroundStyle(MSHColor.secondaryText)
        }
    }

    private var peopleSharingContent: some View {
        VStack(alignment: .leading, spacing: 18) {
            sheetTitle("People & Sharing", systemImage: "person.2")
            Text("Invite someone you trust, then choose separately what each person can access. An invitation alone never grants access to health, Calendar, Movement, or Financial Health information.")
                .font(.body)
                .foregroundStyle(MSHColor.secondaryText)

            ShareLink(
                item: inviteURL,
                subject: Text("Join me on My Simple Health"),
                message: Text("I’d like to connect with you on My Simple Health. This invite does not share any health information until we both choose what to share.")
            ) {
                Label("Share Invite Link", systemImage: "square.and.arrow.up")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(MSHColor.warmWhite)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(MSHColor.forest)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }

            VStack(alignment: .leading, spacing: 8) {
                Label("Invitation only", systemImage: "link")
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(MSHColor.primaryText)
                Text("The link helps the other person reach MSH and identifies who invited them. Data access still requires explicit sharing choices.")
                    .font(.footnote)
                    .foregroundStyle(MSHColor.secondaryText)
            }
            .padding(16)
            .background(MSHColor.sage.opacity(0.10))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
    }

    private var appearanceContent: some View {
        VStack(alignment: .leading, spacing: 18) {
            sheetTitle("Appearance", systemImage: "circle.lefthalf.filled")
            Text("MSH currently follows your iPhone appearance for the native shell. Light surfaces use dark text and dark surfaces use light text.")
                .font(.body)
                .foregroundStyle(MSHColor.secondaryText)
            Button {
                guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
                UIApplication.shared.open(url)
            } label: {
                Label("Open iPhone Settings", systemImage: "gearshape")
                    .font(.body.weight(.semibold))
            }
        }
    }

    private var privacyContent: some View {
        VStack(alignment: .leading, spacing: 18) {
            sheetTitle("Privacy & Permissions", systemImage: "lock.shield")
            Text("Sharing is category-specific and should remain revocable. An invite link never bypasses those permissions.")
                .font(.body)
                .foregroundStyle(MSHColor.secondaryText)
            Link(destination: URL(string: "https://mysimplehealth.org/privacy.html")!) {
                Label("Read Privacy Policy", systemImage: "arrow.up.right.square")
                    .font(.body.weight(.semibold))
            }
            Button {
                guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
                UIApplication.shared.open(url)
            } label: {
                Label("Manage iPhone Permissions", systemImage: "slider.horizontal.3")
                    .font(.body.weight(.semibold))
            }
        }
    }

    private var helpContent: some View {
        VStack(alignment: .leading, spacing: 18) {
            sheetTitle("Help", systemImage: "questionmark.circle")
            Text("Get help with your account, app access, and MSH features.")
                .font(.body)
                .foregroundStyle(MSHColor.secondaryText)
            Link(destination: URL(string: "https://mysimplehealth.org/support.html")!) {
                Label("Help & Support", systemImage: "arrow.up.right.square")
                    .font(.body.weight(.semibold))
            }
        }
    }

    private func sheetTitle(_ title: String, systemImage: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 22, weight: .medium))
                .foregroundStyle(MSHColor.forest)
                .frame(width: 42, height: 42)
                .background(MSHColor.sage.opacity(0.12))
                .clipShape(Circle())
            Text(title)
                .font(.system(size: 30, weight: .medium, design: .serif))
                .foregroundStyle(MSHColor.primaryText)
        }
    }

    private func infoRow(_ label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(MSHColor.secondaryText)
            Text(value)
                .font(.body.weight(.semibold))
                .foregroundStyle(MSHColor.primaryText)
                .textSelection(.enabled)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(MSHColor.sage.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
