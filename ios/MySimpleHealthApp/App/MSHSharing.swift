import FirebaseAuth
@preconcurrency import FirebaseFirestore
import Foundation
import SwiftUI

enum MSHSharingCategory: String, CaseIterable, Codable, Identifiable {
    case calendar
    case workouts
    case finances
    case health
    case cycle

    var id: Self { self }

    var title: String {
        switch self {
        case .calendar: "Calendar"
        case .workouts: "Workouts"
        case .finances: "Finances"
        case .health: "Health & Metrics"
        case .cycle: "Cycle"
        }
    }

    var subtitle: String {
        switch self {
        case .calendar: "Share only the events or calendar layers you choose."
        case .workouts: "Share selected workout videos, collections, and planned workouts."
        case .finances: "Share selected household financial information, not your whole financial workspace."
        case .health: "Share approved summaries and trends. Raw Apple Health records stay on this device."
        case .cycle: "Share approved cycle summaries and timing with this person. Cycle sharing is view-only."
        }
    }

    var defaultScope: [String: String] {
        switch self {
        case .calendar, .workouts: ["mode": "selected_items"]
        case .finances: ["mode": "selected_household_items"]
        case .health: ["mode": "approved_metric_summaries"]
        case .cycle: ["mode": "approved_cycle_summary"]
        }
    }
}

enum MSHSharingPermission: String, CaseIterable, Codable, Identifiable {
    case view
    case collaborate
    var id: Self { self }
}

struct MSHSharingRelationship: Identifiable, Equatable, Sendable {
    let id: String
    let inviterID: String
    let inviterEmail: String
    let inviteeEmail: String
    let inviteeID: String?
    let status: String
    let createdAt: Date?
    let acceptedAt: Date?
    let revokedAt: Date?

    func otherUserID(for currentUserID: String) -> String? {
        if inviterID == currentUserID { return inviteeID }
        if inviteeID == currentUserID { return inviterID }
        return nil
    }

    func otherEmail(for currentUserID: String) -> String {
        inviterID == currentUserID ? inviteeEmail : inviterEmail
    }

    var isAccepted: Bool { status == "accepted" && inviteeID != nil }
    var isPending: Bool { status == "pending" }
    var isRevoked: Bool { status == "revoked" }
}

struct MSHSharingGrant: Identifiable, Equatable, Sendable {
    let id: String
    let relationshipID: String
    let ownerID: String
    let recipientID: String
    let category: MSHSharingCategory
    let scope: [String: String]
    let permission: MSHSharingPermission
    let isActive: Bool
    let pausedByMaster: Bool
    let createdAt: Date?
    let updatedAt: Date?
    let revokedAt: Date?
}

@MainActor
final class MSHSharingStore: ObservableObject {
    @Published private(set) var relationships: [MSHSharingRelationship] = []
    @Published private(set) var grants: [MSHSharingGrant] = []
    @Published private(set) var isLoading = false
    @Published private(set) var isSendingInvite = false
    @Published var errorMessage: String?
    @Published var noticeMessage: String?

    private let db = Firestore.firestore()

    var currentUserID: String? { Auth.auth().currentUser?.uid }
    var currentEmail: String? { Auth.auth().currentUser?.email?.lowercased() }

    func load() async {
        guard let uid = currentUserID else {
            relationships = []
            grants = []
            return
        }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let sentSnapshot = try await db.collection("sharingRelationships")
                .whereField("inviterID", isEqualTo: uid)
                .getDocuments()

            let receivedSnapshot: QuerySnapshot?
            if let email = currentEmail {
                receivedSnapshot = try await db.collection("sharingRelationships")
                    .whereField("inviteeEmail", isEqualTo: email)
                    .getDocuments()
            } else {
                receivedSnapshot = nil
            }

            let ownerGrantSnapshot = try await db.collection("sharingGrants")
                .whereField("ownerID", isEqualTo: uid)
                .getDocuments()

            let recipientGrantSnapshot = try await db.collection("sharingGrants")
                .whereField("recipientID", isEqualTo: uid)
                .getDocuments()

            relationships = dedupe(
                sentSnapshot.documents.compactMap(Self.relationship) +
                (receivedSnapshot?.documents.compactMap(Self.relationship) ?? [])
            ).sorted { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) }

            grants = dedupeGrants(
                ownerGrantSnapshot.documents.compactMap(Self.grant) +
                recipientGrantSnapshot.documents.compactMap(Self.grant)
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func invite(email rawEmail: String) async -> Bool {
        guard let user = Auth.auth().currentUser,
              let inviterEmail = user.email?.lowercased() else {
            errorMessage = "Sign in before inviting someone."
            return false
        }

        let inviteeEmail = rawEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard inviteeEmail.contains("@"), inviteeEmail != inviterEmail else {
            errorMessage = "Enter a different valid email address."
            return false
        }

        if relationships.contains(where: {
            $0.inviterID == user.uid &&
            $0.inviteeEmail.lowercased() == inviteeEmail &&
            !$0.isRevoked
        }) {
            errorMessage = "That person is already listed under Shared with."
            return false
        }

        errorMessage = nil
        noticeMessage = nil
        isSendingInvite = true
        defer { isSendingInvite = false }

        do {
            let document = db.collection("sharingRelationships").document()
            try await document.setData([
                "inviterID": user.uid,
                "inviterEmail": inviterEmail,
                "inviteeEmail": inviteeEmail,
                "inviteeID": NSNull(),
                "status": "pending",
                "createdAt": FieldValue.serverTimestamp(),
                "acceptedAt": NSNull(),
                "revokedAt": NSNull()
            ])

            let verification = try await document.getDocument()
            guard verification.exists,
                  verification.data()?["inviteeEmail"] as? String == inviteeEmail,
                  verification.data()?["status"] as? String == "pending" else {
                throw MSHSharingError.inviteNotConfirmed
            }

            await load()
            noticeMessage = "Invite confirmed for \(inviteeEmail). They are listed below under Shared with."
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func accept(_ relationship: MSHSharingRelationship) async {
        guard let user = Auth.auth().currentUser,
              user.email?.lowercased() == relationship.inviteeEmail.lowercased() else {
            errorMessage = "This invitation belongs to a different account."
            return
        }

        errorMessage = nil
        do {
            try await db.collection("sharingRelationships").document(relationship.id).updateData([
                "inviteeID": user.uid,
                "status": "accepted",
                "acceptedAt": FieldValue.serverTimestamp(),
                "revokedAt": NSNull()
            ])
            noticeMessage = "Sharing connection accepted."
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func revoke(_ relationship: MSHSharingRelationship) async {
        guard let uid = currentUserID,
              relationship.inviterID == uid || relationship.inviteeID == uid else { return }

        errorMessage = nil
        do {
            try await db.collection("sharingRelationships").document(relationship.id).updateData([
                "status": "revoked",
                "revokedAt": FieldValue.serverTimestamp()
            ])
            noticeMessage = relationship.isPending ? "Invitation canceled." : "Sharing connection removed."
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func setSharing(
        _ enabled: Bool,
        category: MSHSharingCategory,
        relationship: MSHSharingRelationship,
        permission: MSHSharingPermission = .view
    ) async {
        guard relationship.isAccepted,
              let uid = currentUserID,
              let recipientID = relationship.otherUserID(for: uid) else {
            errorMessage = "Accept the connection before sharing anything."
            return
        }

        let grantID = Self.grantID(
            relationshipID: relationship.id,
            ownerID: uid,
            recipientID: recipientID,
            category: category
        )
        let document = db.collection("sharingGrants").document(grantID)

        errorMessage = nil
        do {
            if enabled {
                let effectivePermission: MSHSharingPermission = (category == .health || category == .cycle) ? .view : permission
                try await document.setData([
                    "relationshipID": relationship.id,
                    "ownerID": uid,
                    "recipientID": recipientID,
                    "category": category.rawValue,
                    "scope": category.defaultScope,
                    "permission": effectivePermission.rawValue,
                    "isActive": true,
                    "pausedByMaster": false,
                    "createdAt": FieldValue.serverTimestamp(),
                    "updatedAt": FieldValue.serverTimestamp(),
                    "revokedAt": NSNull()
                ], merge: true)
            } else {
                try await document.setData([
                    "relationshipID": relationship.id,
                    "ownerID": uid,
                    "recipientID": recipientID,
                    "category": category.rawValue,
                    "scope": category.defaultScope,
                    "permission": MSHSharingPermission.view.rawValue,
                    "isActive": false,
                    "pausedByMaster": false,
                    "updatedAt": FieldValue.serverTimestamp(),
                    "revokedAt": FieldValue.serverTimestamp()
                ], merge: true)
            }
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func setRelationshipSharing(_ enabled: Bool, relationship: MSHSharingRelationship) async {
        guard relationship.isAccepted,
              let uid = currentUserID,
              let recipientID = relationship.otherUserID(for: uid) else {
            errorMessage = "This sharing connection is not active yet."
            return
        }

        let owned = grants.filter {
            $0.relationshipID == relationship.id &&
            $0.ownerID == uid &&
            $0.recipientID == recipientID
        }

        errorMessage = nil
        do {
            if enabled {
                let paused = owned.filter(\.pausedByMaster)
                guard !paused.isEmpty else {
                    noticeMessage = "Choose at least one area below to start sharing."
                    return
                }
                for grant in paused {
                    try await db.collection("sharingGrants").document(grant.id).updateData([
                        "isActive": true,
                        "pausedByMaster": false,
                        "updatedAt": FieldValue.serverTimestamp(),
                        "revokedAt": NSNull()
                    ])
                }
                noticeMessage = "Sharing resumed with \(relationship.otherEmail(for: uid))."
            } else {
                let active = owned.filter(\.isActive)
                guard !active.isEmpty else { return }
                for grant in active {
                    try await db.collection("sharingGrants").document(grant.id).updateData([
                        "isActive": false,
                        "pausedByMaster": true,
                        "updatedAt": FieldValue.serverTimestamp(),
                        "revokedAt": FieldValue.serverTimestamp()
                    ])
                }
                noticeMessage = "Sharing paused with \(relationship.otherEmail(for: uid))."
            }
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func isSharing(_ category: MSHSharingCategory, with relationship: MSHSharingRelationship) -> Bool {
        guard let uid = currentUserID,
              let recipientID = relationship.otherUserID(for: uid) else { return false }
        return grants.contains {
            $0.relationshipID == relationship.id &&
            $0.ownerID == uid &&
            $0.recipientID == recipientID &&
            $0.category == category &&
            $0.isActive
        }
    }

    func isRelationshipSharing(_ relationship: MSHSharingRelationship) -> Bool {
        guard let uid = currentUserID,
              let recipientID = relationship.otherUserID(for: uid) else { return false }
        return grants.contains {
            $0.relationshipID == relationship.id &&
            $0.ownerID == uid &&
            $0.recipientID == recipientID &&
            $0.isActive
        }
    }

    func canResumeRelationshipSharing(_ relationship: MSHSharingRelationship) -> Bool {
        guard let uid = currentUserID,
              let recipientID = relationship.otherUserID(for: uid) else { return false }
        return grants.contains {
            $0.relationshipID == relationship.id &&
            $0.ownerID == uid &&
            $0.recipientID == recipientID &&
            $0.pausedByMaster
        }
    }

    private static func relationship(_ document: QueryDocumentSnapshot) -> MSHSharingRelationship? {
        let data = document.data()
        guard let inviterID = data["inviterID"] as? String,
              let inviterEmail = data["inviterEmail"] as? String,
              let inviteeEmail = data["inviteeEmail"] as? String,
              let status = data["status"] as? String else { return nil }

        return MSHSharingRelationship(
            id: document.documentID,
            inviterID: inviterID,
            inviterEmail: inviterEmail,
            inviteeEmail: inviteeEmail,
            inviteeID: data["inviteeID"] as? String,
            status: status,
            createdAt: (data["createdAt"] as? Timestamp)?.dateValue(),
            acceptedAt: (data["acceptedAt"] as? Timestamp)?.dateValue(),
            revokedAt: (data["revokedAt"] as? Timestamp)?.dateValue()
        )
    }

    private static func grant(_ document: QueryDocumentSnapshot) -> MSHSharingGrant? {
        let data = document.data()
        guard let relationshipID = data["relationshipID"] as? String,
              let ownerID = data["ownerID"] as? String,
              let recipientID = data["recipientID"] as? String,
              let categoryRaw = data["category"] as? String,
              let category = MSHSharingCategory(rawValue: categoryRaw),
              let permissionRaw = data["permission"] as? String,
              let permission = MSHSharingPermission(rawValue: permissionRaw),
              let isActive = data["isActive"] as? Bool else { return nil }

        return MSHSharingGrant(
            id: document.documentID,
            relationshipID: relationshipID,
            ownerID: ownerID,
            recipientID: recipientID,
            category: category,
            scope: data["scope"] as? [String: String] ?? [:],
            permission: permission,
            isActive: isActive,
            pausedByMaster: data["pausedByMaster"] as? Bool ?? false,
            createdAt: (data["createdAt"] as? Timestamp)?.dateValue(),
            updatedAt: (data["updatedAt"] as? Timestamp)?.dateValue(),
            revokedAt: (data["revokedAt"] as? Timestamp)?.dateValue()
        )
    }

    private func dedupe(_ values: [MSHSharingRelationship]) -> [MSHSharingRelationship] {
        Array(Dictionary(uniqueKeysWithValues: values.map { ($0.id, $0) }).values)
    }

    private func dedupeGrants(_ values: [MSHSharingGrant]) -> [MSHSharingGrant] {
        Array(Dictionary(uniqueKeysWithValues: values.map { ($0.id, $0) }).values)
    }

    private static func grantID(
        relationshipID: String,
        ownerID: String,
        recipientID: String,
        category: MSHSharingCategory
    ) -> String {
        "\(relationshipID)_\(ownerID)_\(recipientID)_\(category.rawValue)"
    }
}

private enum MSHSharingError: LocalizedError {
    case inviteNotConfirmed

    var errorDescription: String? {
        switch self {
        case .inviteNotConfirmed:
            "The invitation could not be confirmed. Nothing was marked as sent. Please try again."
        }
    }
}

struct MSHPeopleSharingScreen: View {
    @StateObject private var store = MSHSharingStore()
    @State private var inviteEmail = ""

    private var pendingForMe: [MSHSharingRelationship] {
        guard let email = store.currentEmail else { return [] }
        return store.relationships.filter {
            $0.isPending &&
            $0.inviteeID == nil &&
            $0.inviteeEmail.lowercased() == email
        }
    }

    private var sharedWithRelationships: [MSHSharingRelationship] {
        guard let uid = store.currentUserID else { return [] }
        return store.relationships.filter {
            $0.inviterID == uid && !$0.isRevoked
        }
    }

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: MSHSpacing.large) {
                    header
                    inviteCard

                    if !pendingForMe.isEmpty {
                        sectionTitle("Invitations for you")
                        ForEach(pendingForMe) { relationship in
                            invitationCard(relationship)
                        }
                    }

                    sectionTitle("Shared with")
                    sharedWithSection

                    if let notice = store.noticeMessage {
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(MSHColor.accent)
                            Text(notice)
                                .font(.footnote)
                                .foregroundStyle(MSHColor.primaryText)
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(MSHColor.accent.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))
                    }

                    if let error = store.errorMessage {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .padding(.horizontal, MSHSpacing.small)
                    }

                    Text("Raw Apple Health samples never enter this sharing layer. Health and Cycle sharing are limited to summaries you explicitly approve.")
                        .font(.footnote)
                        .foregroundStyle(MSHColor.secondaryText)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, MSHSpacing.small)
                }
                .padding(MSHSpacing.medium)
            }
            .refreshable { await store.load() }
        }
        .navigationTitle("People & Sharing")
        .navigationBarTitleDisplayMode(.inline)
        .task { await store.load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.medium) {
            Image(systemName: "person.2")
                .font(.system(size: 30, weight: .medium))
                .foregroundStyle(MSHColor.accent)

            Text("People & Sharing")
                .font(MSHTypography.destinationTitle)
                .foregroundStyle(MSHColor.primaryText)

            Text("Share only what you choose, with the people you choose.")
                .font(MSHTypography.body)
                .foregroundStyle(MSHColor.secondaryText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .mshSurface()
    }

    private var inviteCard: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.medium) {
            Text("Invite someone")
                .font(MSHTypography.cardTitle)
                .foregroundStyle(MSHColor.primaryText)

            TextField("Email address", text: $inviteEmail)
                .textInputAutocapitalization(.never)
                .keyboardType(.emailAddress)
                .autocorrectionDisabled()
                .padding(.horizontal, 14)
                .frame(height: 48)
                .background(MSHColor.controlFill)
                .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))

            Button {
                Task {
                    if await store.invite(email: inviteEmail) {
                        inviteEmail = ""
                    }
                }
            } label: {
                HStack(spacing: 8) {
                    if store.isSendingInvite {
                        ProgressView().tint(.white)
                    }
                    Text(store.isSendingInvite ? "Confirming…" : "Send invite")
                        .font(.headline)
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 48)
                .background(MSHColor.accent)
                .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(inviteEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || store.isSendingInvite)
        }
        .mshSurface()
    }

    @ViewBuilder
    private var sharedWithSection: some View {
        if store.isLoading && store.relationships.isEmpty {
            ProgressView()
                .tint(MSHColor.accent)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 28)
        } else if sharedWithRelationships.isEmpty {
            emptyState
        } else {
            ForEach(sharedWithRelationships) { relationship in
                sharedWithCard(relationship)
            }
        }
    }

    private func invitationCard(_ relationship: MSHSharingRelationship) -> some View {
        HStack(spacing: MSHSpacing.medium) {
            VStack(alignment: .leading, spacing: 4) {
                Text(relationship.inviterEmail)
                    .font(MSHTypography.cardTitle)
                    .foregroundStyle(MSHColor.primaryText)
                Text("Wants to connect with you in My Simple Health")
                    .font(.subheadline)
                    .foregroundStyle(MSHColor.secondaryText)
            }
            Spacer()
            Button("Accept") {
                Task { await store.accept(relationship) }
            }
            .buttonStyle(.borderedProminent)
            .tint(MSHColor.accent)
        }
        .mshSurface()
    }

    private func sharedWithCard(_ relationship: MSHSharingRelationship) -> some View {
        VStack(alignment: .leading, spacing: MSHSpacing.medium) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(relationship.inviteeEmail)
                        .font(MSHTypography.cardTitle)
                        .foregroundStyle(MSHColor.primaryText)

                    Text(statusText(for: relationship))
                        .font(.caption)
                        .foregroundStyle(statusColor(for: relationship))
                }

                Spacer()

                if relationship.isAccepted {
                    Toggle("", isOn: Binding(
                        get: { store.isRelationshipSharing(relationship) },
                        set: { enabled in
                            Task {
                                await store.setRelationshipSharing(enabled, relationship: relationship)
                            }
                        }
                    ))
                    .labelsHidden()
                    .tint(MSHColor.accent)
                    .accessibilityLabel("Share with \(relationship.inviteeEmail)")
                    .accessibilityHint(store.canResumeRelationshipSharing(relationship) ? "Turn on to resume the areas you previously shared." : "Turn off to pause all currently shared areas.")
                } else if relationship.isPending {
                    Button("Cancel") {
                        Task { await store.revoke(relationship) }
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.red)
                    .buttonStyle(.plain)
                }
            }

            if relationship.isAccepted {
                Divider()

                Text("Choose what this person can access")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(MSHColor.secondaryText)

                ForEach(MSHSharingCategory.allCases) { category in
                    Toggle(isOn: Binding(
                        get: { store.isSharing(category, with: relationship) },
                        set: { enabled in
                            Task {
                                await store.setSharing(enabled, category: category, relationship: relationship)
                            }
                        }
                    )) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(category.title)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(MSHColor.primaryText)
                            Text(category.subtitle)
                                .font(.caption)
                                .foregroundStyle(MSHColor.secondaryText)
                        }
                    }
                    .tint(MSHColor.accent)
                }

                Menu {
                    Button("Remove connection", role: .destructive) {
                        Task { await store.revoke(relationship) }
                    }
                } label: {
                    Label("More sharing options", systemImage: "ellipsis.circle")
                        .font(.caption)
                        .foregroundStyle(MSHColor.secondaryText)
                }
            }
        }
        .mshSurface()
    }

    private func statusText(for relationship: MSHSharingRelationship) -> String {
        if relationship.isPending { return "Pending invitation" }
        if store.isRelationshipSharing(relationship) { return "Shared" }
        if store.canResumeRelationshipSharing(relationship) { return "Sharing paused" }
        return "Connected · choose what to share"
    }

    private func statusColor(for relationship: MSHSharingRelationship) -> Color {
        if store.isRelationshipSharing(relationship) { return MSHColor.accent }
        return MSHColor.secondaryText
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("No one added yet")
                .font(MSHTypography.cardTitle)
                .foregroundStyle(MSHColor.primaryText)
            Text("When an invite is confirmed, that person will appear here immediately with their sharing status.")
                .font(.subheadline)
                .foregroundStyle(MSHColor.secondaryText)
        }
        .mshSurface()
    }

    private func sectionTitle(_ title: String) -> some View {
        Text(title.uppercased())
            .font(.caption2.weight(.semibold))
            .tracking(1.6)
            .foregroundStyle(MSHColor.secondaryText)
    }
}
