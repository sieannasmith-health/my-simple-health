import Foundation
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
        case .calendar: "Share only the events or calendar layers you choose."
        case .workouts: "Share selected workout videos, collections, and planned workouts."
        case .finances: "Share selected household financial information, not your whole financial workspace."
        case .health: "Share approved summaries and trends. Your local Apple Health record store stays private."
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

/// Native account sharing previously talked directly to Supabase and depended on a
/// Supabase UUID identity. Authentication now belongs to Firebase, whose user IDs are
/// strings. Keep the product doorway and sharing contracts intact while the transport
/// moves behind the Google backend rather than mixing two identity systems in the app.
struct MSHPeopleSharingScreen: View {
    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: MSHSpacing.large) {
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

                    VStack(alignment: .leading, spacing: MSHSpacing.small) {
                        Label("Sharing is being reconnected", systemImage: "arrow.triangle.2.circlepath")
                            .font(MSHTypography.cardTitle)
                            .foregroundStyle(MSHColor.primaryText)

                        Text("Your account now uses Firebase. Partner sharing is temporarily unavailable while its data connection moves to the new Google-backed account system. Existing health data on this device is not affected.")
                            .font(.subheadline)
                            .foregroundStyle(MSHColor.secondaryText)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .mshSurface()
                }
                .padding(MSHSpacing.medium)
            }
        }
        .navigationTitle("People & Sharing")
        .navigationBarTitleDisplayMode(.inline)
    }
}
