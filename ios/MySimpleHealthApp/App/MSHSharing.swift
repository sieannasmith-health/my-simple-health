import Foundation
import Supabase
import SwiftUI

enum MSHSharingCategory: String, CaseIterable, Codable, Identifiable {
    case calendar
    case workouts
    case finances
    case health

    var id: Self { self }

    var title: String {
        switch self {
        case .calendar: "Calendar"
        case .workouts: "Workouts"
        case .finances: "Finances"
        case .health: "Health & Metrics"
        }
    }

    var subtitle: String {
        switch self {
        case .calendar:
            "Share only the events or calendar layers you choose."
        case .workouts:
            "Share selected workout videos, collections, and planned workouts."
        case .finances:
            "Share selected household financial information, not your whole financial workspace."
        case .health:
            "Share approved summaries and trends. Your local Apple Health record store stays private."
        }
    }

    var systemImage: String {
        switch self {
        case .calendar: "calendar"
        case .workouts: "figure.run"
        case .finances: "dollarsign.circle"
        case .health: "heart.text.square"
        }
    }

    var defaultScope: [String: String] {
        switch self {
        case .calendar: ["mode": "selected_items"]
        case .workouts: ["mode": "selected_items"]
        case .finances: ["mode": "selected_household_items"]
        case .health: ["mode": "approved_metric_summaries"]
        }
    }

    var allowsCollaboration: Bool {
        switch self {
        case .calendar, .workouts, .finances: true
        case .health: false
        }
    }
}

enum MSHSharingPermission: String, CaseIterable, Codable, Identifiable {
    case view
    case collaborate

    var id: Self { self }

    var title: String {
        switch self {
        case .view: "View only"
        case .collaborate: "Collaborate"
        }
    }
}

struct MSHSharingRelationship: Codable, Identifiable, Equatable {
    let id: UUID
    let inviterID: UUID
    let inviterEmail: String
    let inviteeEmail: String
    let inviteeID: UUID?
    let status: String
    let createdAt: String
    let acceptedAt: String?
    let revokedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case inviterID = "inviter_id"
        case inviterEmail = "inviter_email"
        case inviteeEmail = "invitee_email"
        case inviteeID = "invitee_id"
        case status
        case createdAt = "created_at"
        case acceptedAt = "accepted_at"
        case revokedAt = "revoked_at"
    }

    func otherUserID(for currentUserID: UUID) -> UUID? {
        if inviterID == currentUserID { return inviteeID }
        if inviteeID == currentUserID { return inviterID }
        return nil
    }

    func otherEmail(for currentUserID: UUID) -> String {
        inviterID == currentUserID ? inviteeEmail : inviterEmail
    }

    var isAccepted: Bool { status == "accepted" && inviteeID != nil }
}

struct MSHSharingGrant: Codable, Identifiable, Equatable {
    let id: UUID
    let relationshipID: UUID
    let ownerID: UUID
    let recipientID: UUID
    let category: MSHSharingCategory
    let scope: [String: String]
    let permission: MSHSharingPermission
    let isActive: Bool
    let createdAt: String
    let updatedAt: String
    let revokedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case relationshipID = "relationship_id"
        case ownerID = "owner_id"
        case recipientID = "recipient_id"
        case category
        case scope
        case permission
        case isActive = "is_active"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case revokedAt = "revoked_at"
    }
}

private struct MSHSharingInviteInsert: Encodable {
    let inviterID: UUID
    let inviterEmail: String
    let inviteeEmail: String

    enum CodingKeys: String, CodingKey {
        case inviterID = "inviter_id"
        case inviterEmail = "inviter_email"
        case inviteeEmail = "invitee_email"
    }
}

private struct MSHSharingGrantInsert: Encodable {
    let relationshipID: UUID
    let ownerID: UUID
    let recipientID: UUID
    let category: MSHSharingCategory
    let scope: [String: String]
    let permission: MSHSharingPermission
    let isActive: Bool

    enum CodingKeys: String, CodingKey {
        case relationshipID = "relationship_id"
        case ownerID = "owner_id"
        case recipientID = "recipient_id"
        case category
        case scope
        case permission
        case isActive = "is_active"
    }
}

private struct MSHSharingGrantUpdate: Encodable {
    let scope: [String: String]
    let permission: MSHSharingPermission
    let isActive: Bool

    enum CodingKeys: String, CodingKey {
        case scope
        case permission
        case isActive = "is_active"
    }
}

private struct MSHInviteIDParameters: Encodable {
    let inviteID: UUID

    enum CodingKeys: String, CodingKey { case inviteID = "invite_id" }
}

private struct MSHRelationshipIDParameters: Encodable {
    let relationshipID: UUID

    enum CodingKeys: String, CodingKey { case relationshipID = "relationship_id" }
}

@MainActor
final class MSHSharingStore: ObservableObject {
    @Published private(set) var relationships: [MSHSharingRelationship] = []
    @Published private(set) var pendingInvites: [MSHSharingRelationship] = []
    @Published private(set) var grants: [MSHSharingGrant] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let authStore: MSHAuthStore

    init(authStore: MSHAuthStore = .shared) {
        self.authStore = authStore
    }

    var currentUserID: UUID? { authStore.userID }
    var currentUserEmail: String? { authStore.userEmail }
    var canUseAccountSharing: Bool { currentUserID != nil && currentUserEmail != nil }

    var acceptedRelationships: [MSHSharingRelationship] {
        relationships.filter(\.isAccepted)
    }

    var outgoingPendingRelationships: [MSHSharingRelationship] {
        guard let userID = currentUserID else { return [] }
        return relationships.filter { $0.inviterID == userID && $0.status == "pending" }
    }

    func grant(for relationship: MSHSharingRelationship, category: MSHSharingCategory) -> MSHSharingGrant? {
        guard let userID = currentUserID else { return nil }
        return grants.first {
            $0.relationshipID == relationship.id &&
            $0.ownerID == userID &&
            $0.category == category
        }
    }

    func incomingGrants(for relationship: MSHSharingRelationship) -> [MSHSharingGrant] {
        guard let userID = currentUserID else { return [] }
        return grants.filter {
            $0.relationshipID == relationship.id &&
            $0.recipientID == userID &&
            $0.isActive
        }
    }

    func load() async {
        guard canUseAccountSharing else {
            relationships = []
            pendingInvites = []
            grants = []
            return
        }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            async let relationshipRequest: [MSHSharingRelationship] = authStore.client
                .from("msh_sharing_relationships")
                .select()
                .order("created_at", ascending: false)
                .execute()
                .value

            async let pendingRequest: [MSHSharingRelationship] = authStore.client
                .rpc("msh_pending_sharing_invites")
                .execute()
                .value

            async let grantRequest: [MSHSharingGrant] = authStore.client
                .from("msh_sharing_grants")
                .select()
                .order("updated_at", ascending: false)
                .execute()
                .value

            relationships = try await relationshipRequest
            pendingInvites = try await pendingRequest
            grants = try await grantRequest
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func invite(email: String) async -> Bool {
        guard let userID = currentUserID,
              let userEmail = currentUserEmail?.trimmingCharacters(in: .whitespacesAndNewlines),
              !userEmail.isEmpty else {
            errorMessage = "Sign in to invite someone to share with you."
            return false
        }

        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard cleanEmail.contains("@") else {
            errorMessage = "Enter a valid email address."
            return false
        }
        guard cleanEmail != userEmail.lowercased() else {
            errorMessage = "Use the other person's My Simple Health email."
            return false
        }

        errorMessage = nil
        do {
            let payload = MSHSharingInviteInsert(
                inviterID: userID,
                inviterEmail: userEmail.lowercased(),
                inviteeEmail: cleanEmail
            )
            try await authStore.client
                .from("msh_sharing_relationships")
                .insert(payload)
                .execute()
            await load()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func accept(_ invite: MSHSharingRelationship) async {
        errorMessage = nil
        do {
            try await authStore.client
                .rpc("msh_accept_sharing_invite", params: MSHInviteIDParameters(inviteID: invite.id))
                .execute()
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func revoke(_ relationship: MSHSharingRelationship) async {
        errorMessage = nil
        do {
            try await authStore.client
                .rpc("msh_revoke_sharing_relationship", params: MSHRelationshipIDParameters(relationshipID: relationship.id))
                .execute()
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func setSharing(
        category: MSHSharingCategory,
        with relationship: MSHSharingRelationship,
        enabled: Bool,
        permission requestedPermission: MSHSharingPermission? = nil
    ) async {
        guard let userID = currentUserID,
              let recipientID = relationship.otherUserID(for: userID),
              relationship.isAccepted else {
            errorMessage = "This sharing relationship is not active yet."
            return
        }

        let permission: MSHSharingPermission = category.allowsCollaboration
            ? (requestedPermission ?? grant(for: relationship, category: category)?.permission ?? .view)
            : .view

        errorMessage = nil
        do {
            if let existing = grant(for: relationship, category: category) {
                let payload = MSHSharingGrantUpdate(
                    scope: category.defaultScope,
                    permission: permission,
                    isActive: enabled
                )
                try await authStore.client
                    .from("msh_sharing_grants")
                    .update(payload)
                    .eq("id", value: existing.id)
                    .execute()
            } else if enabled {
                let payload = MSHSharingGrantInsert(
                    relationshipID: relationship.id,
                    ownerID: userID,
                    recipientID: recipientID,
                    category: category,
                    scope: category.defaultScope,
                    permission: permission,
                    isActive: true
                )
                try await authStore.client
                    .from("msh_sharing_grants")
                    .insert(payload)
                    .execute()
            }
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func setPermission(
        _ permission: MSHSharingPermission,
        category: MSHSharingCategory,
        relationship: MSHSharingRelationship
    ) async {
        guard category.allowsCollaboration,
              grant(for: relationship, category: category)?.isActive == true else { return }
        await setSharing(
            category: category,
            with: relationship,
            enabled: true,
            permission: permission
        )
    }
}

struct MSHPeopleSharingScreen: View {
    @StateObject private var store = MSHSharingStore()
    @State private var inviteEmail = ""
    @State private var isInviting = false

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: MSHSpacing.large) {
                    intro

                    if !store.canUseAccountSharing {
                        signedOutNote
                    } else {
                        inviteSection
                        pendingInvites
                        peopleSection
                        sharedWithMeSection
                    }

                    if let error = store.errorMessage {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.horizontal, MSHSpacing.small)
                    }
                }
                .padding(MSHSpacing.medium)
            }
            .refreshable { await store.load() }
        }
        .navigationTitle("People & Sharing")
        .navigationBarTitleDisplayMode(.inline)
        .task { await store.load() }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.medium) {
            Image(systemName: "person.2")
                .font(.system(size: 30, weight: .medium))
                .foregroundStyle(MSHColor.accent)

            Text("Share what you choose.")
                .font(MSHTypography.destinationTitle)
                .foregroundStyle(MSHColor.primaryText)

            Text("Each person keeps a separate My Simple Health account. Nothing is shared by default, and access can be changed or removed at any time.")
                .font(MSHTypography.body)
                .foregroundStyle(MSHColor.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .mshSurface()
    }

    private var signedOutNote: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.small) {
            Text("Account sharing needs a signed-in account")
                .font(MSHTypography.cardTitle)
                .foregroundStyle(MSHColor.primaryText)
            Text("The Debug app can bypass sign-in for development, but partner sharing is only available when an authenticated MSH account is active.")
                .font(.subheadline)
                .foregroundStyle(MSHColor.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
        .mshSurface()
    }

    private var inviteSection: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.medium) {
            Text("Invite someone")
                .font(MSHTypography.cardTitle)
                .foregroundStyle(MSHColor.primaryText)

            Text("They must accept before either of you can share anything.")
                .font(.subheadline)
                .foregroundStyle(MSHColor.secondaryText)

            TextField("Their MSH email", text: $inviteEmail)
                .textContentType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(.horizontal, MSHSpacing.medium)
                .frame(height: 48)
                .background(MSHColor.controlFill)
                .foregroundStyle(MSHColor.primaryText)
                .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous)
                        .stroke(MSHColor.border, lineWidth: 1)
                }

            Button {
                Task {
                    isInviting = true
                    if await store.invite(email: inviteEmail) { inviteEmail = "" }
                    isInviting = false
                }
            } label: {
                HStack {
                    if isInviting { ProgressView().tint(MSHColor.warmWhite) }
                    Text("Send invite")
                }
                .font(.body.weight(.semibold))
                .foregroundStyle(MSHColor.warmWhite)
                .frame(maxWidth: .infinity, minHeight: 48)
                .background(MSHColor.forest)
                .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(isInviting || inviteEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

            ForEach(store.outgoingPendingRelationships) { relationship in
                Label("Waiting for \(relationship.inviteeEmail)", systemImage: "clock")
                    .font(.footnote)
                    .foregroundStyle(MSHColor.secondaryText)
            }
        }
        .mshSurface()
    }

    @ViewBuilder
    private var pendingInvites: some View {
        if !store.pendingInvites.isEmpty {
            VStack(alignment: .leading, spacing: MSHSpacing.medium) {
                Text("Invitations for you")
                    .font(MSHTypography.cardTitle)
                    .foregroundStyle(MSHColor.primaryText)

                ForEach(store.pendingInvites) { invite in
                    VStack(alignment: .leading, spacing: MSHSpacing.small) {
                        Text(invite.inviterEmail)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(MSHColor.primaryText)
                        Text("Accepting connects your accounts for sharing, but still shares no categories until one of you explicitly turns them on.")
                            .font(.footnote)
                            .foregroundStyle(MSHColor.secondaryText)
                        Button("Accept invite") {
                            Task { await store.accept(invite) }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(MSHColor.forest)
                    }
                }
            }
            .mshSurface()
        }
    }

    @ViewBuilder
    private var peopleSection: some View {
        if store.acceptedRelationships.isEmpty {
            VStack(alignment: .leading, spacing: MSHSpacing.small) {
                Text("People I share with")
                    .font(MSHTypography.cardTitle)
                    .foregroundStyle(MSHColor.primaryText)
                Text("No accepted sharing relationships yet.")
                    .font(.subheadline)
                    .foregroundStyle(MSHColor.secondaryText)
            }
            .mshSurface()
        } else {
            VStack(alignment: .leading, spacing: MSHSpacing.medium) {
                Text("People I share with")
                    .font(MSHTypography.cardTitle)
                    .foregroundStyle(MSHColor.primaryText)

                ForEach(store.acceptedRelationships) { relationship in
                    NavigationLink {
                        MSHPersonSharingDetailScreen(store: store, relationship: relationship)
                    } label: {
                        HStack(spacing: MSHSpacing.medium) {
                            Image(systemName: "person.crop.circle")
                                .font(.title2)
                                .foregroundStyle(MSHColor.accent)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(partnerLabel(relationship))
                                    .font(.body.weight(.semibold))
                                    .foregroundStyle(MSHColor.primaryText)
                                Text(outgoingSummary(relationship))
                                    .font(.footnote)
                                    .foregroundStyle(MSHColor.secondaryText)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(MSHColor.secondaryText)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .mshSurface()
        }
    }

    @ViewBuilder
    private var sharedWithMeSection: some View {
        let incoming = store.acceptedRelationships.flatMap { relationship in
            store.incomingGrants(for: relationship).map { (relationship, $0) }
        }

        if !incoming.isEmpty {
            VStack(alignment: .leading, spacing: MSHSpacing.medium) {
                Text("Shared with me")
                    .font(MSHTypography.cardTitle)
                    .foregroundStyle(MSHColor.primaryText)

                ForEach(incoming, id: \.1.id) { relationship, grant in
                    HStack(spacing: MSHSpacing.small) {
                        Image(systemName: grant.category.systemImage)
                            .foregroundStyle(MSHColor.accent)
                            .frame(width: 28)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(grant.category.title)
                                .font(.body.weight(.semibold))
                                .foregroundStyle(MSHColor.primaryText)
                            Text("From \(partnerLabel(relationship)) · \(grant.permission.title)")
                                .font(.footnote)
                                .foregroundStyle(MSHColor.secondaryText)
                        }
                    }
                }
            }
            .mshSurface()
        }
    }

    private func partnerLabel(_ relationship: MSHSharingRelationship) -> String {
        guard let userID = store.currentUserID else { return "Connected account" }
        return relationship.otherEmail(for: userID)
    }

    private func outgoingSummary(_ relationship: MSHSharingRelationship) -> String {
        let active = MSHSharingCategory.allCases.filter {
            store.grant(for: relationship, category: $0)?.isActive == true
        }
        return active.isEmpty ? "Nothing shared yet" : active.map(\.title).joined(separator: " · ")
    }
}

private struct MSHPersonSharingDetailScreen: View {
    @ObservedObject var store: MSHSharingStore
    let relationship: MSHSharingRelationship
    @State private var showHealthConfirmation = false
    @State private var healthRequestedState = false
    @State private var showRevokeConfirmation = false

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: MSHSpacing.large) {
                    VStack(alignment: .leading, spacing: MSHSpacing.small) {
                        Text("Sharing with")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(MSHColor.secondaryText)
                        Text(partnerEmail)
                            .font(MSHTypography.destinationTitle)
                            .foregroundStyle(MSHColor.primaryText)
                        Text("Turn on only the areas you want this person to access. These choices do not have to match what they share with you.")
                            .font(MSHTypography.body)
                            .foregroundStyle(MSHColor.secondaryText)
                    }
                    .mshSurface()

                    ForEach(MSHSharingCategory.allCases) { category in
                        categoryCard(category)
                    }

                    Button(role: .destructive) {
                        showRevokeConfirmation = true
                    } label: {
                        Text("Remove sharing relationship")
                            .frame(maxWidth: .infinity, minHeight: 48)
                    }
                    .buttonStyle(.bordered)
                }
                .padding(MSHSpacing.medium)
            }
        }
        .navigationTitle("Sharing")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Share health summaries?", isPresented: $showHealthConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Share") {
                Task {
                    await store.setSharing(category: .health, with: relationship, enabled: healthRequestedState)
                }
            }
        } message: {
            Text("Only approved MSH health summaries and metric trends are eligible for sharing. Your full Apple Health history and local HealthKit database are not shared.")
        }
        .confirmationDialog("Remove this sharing relationship?", isPresented: $showRevokeConfirmation) {
            Button("Remove access", role: .destructive) {
                Task { await store.revoke(relationship) }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("All active sharing grants between these two accounts will be revoked.")
        }
    }

    private var partnerEmail: String {
        guard let userID = store.currentUserID else { return "Connected account" }
        return relationship.otherEmail(for: userID)
    }

    @ViewBuilder
    private func categoryCard(_ category: MSHSharingCategory) -> some View {
        let grant = store.grant(for: relationship, category: category)
        let enabled = grant?.isActive == true

        VStack(alignment: .leading, spacing: MSHSpacing.medium) {
            HStack(alignment: .top, spacing: MSHSpacing.medium) {
                Image(systemName: category.systemImage)
                    .font(.title3)
                    .foregroundStyle(MSHColor.accent)
                    .frame(width: 42, height: 42)
                    .background(MSHColor.controlFill)
                    .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))

                VStack(alignment: .leading, spacing: 4) {
                    Text(category.title)
                        .font(MSHTypography.cardTitle)
                        .foregroundStyle(MSHColor.primaryText)
                    Text(category.subtitle)
                        .font(.subheadline)
                        .foregroundStyle(MSHColor.secondaryText)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: MSHSpacing.small)

                Toggle("", isOn: Binding(
                    get: { enabled },
                    set: { newValue in
                        if category == .health && newValue {
                            healthRequestedState = true
                            showHealthConfirmation = true
                        } else {
                            Task {
                                await store.setSharing(category: category, with: relationship, enabled: newValue)
                            }
                        }
                    }
                ))
                .labelsHidden()
                .tint(MSHColor.accent)
            }

            if enabled && category.allowsCollaboration {
                Picker("Permission", selection: Binding(
                    get: { grant?.permission ?? .view },
                    set: { permission in
                        Task {
                            await store.setPermission(permission, category: category, relationship: relationship)
                        }
                    }
                )) {
                    ForEach(MSHSharingPermission.allCases) { permission in
                        Text(permission.title).tag(permission)
                    }
                }
                .pickerStyle(.segmented)
            }

            if category == .health {
                Label("Health sharing is summary-based and view-only in this phase.", systemImage: "lock.shield")
                    .font(.footnote)
                    .foregroundStyle(MSHColor.secondaryText)
            }
        }
        .mshSurface()
    }
}
