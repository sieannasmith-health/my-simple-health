import XCTest
@testable import MySimpleHealth

final class MSHSharingTests: XCTestCase {
    func testSharingStartsWithExplicitScopedCategories() {
        XCTAssertEqual(MSHSharingCategory.calendar.defaultScope["mode"], "selected_items")
        XCTAssertEqual(MSHSharingCategory.workouts.defaultScope["mode"], "selected_items")
        XCTAssertEqual(MSHSharingCategory.finances.defaultScope["mode"], "selected_household_items")
        XCTAssertEqual(MSHSharingCategory.health.defaultScope["mode"], "approved_metric_summaries")
    }

    func testHealthSharingIsViewOnlyInPhaseOne() {
        XCTAssertFalse(MSHSharingCategory.health.allowsCollaboration)
        XCTAssertTrue(MSHSharingCategory.calendar.allowsCollaboration)
        XCTAssertTrue(MSHSharingCategory.workouts.allowsCollaboration)
        XCTAssertTrue(MSHSharingCategory.finances.allowsCollaboration)
    }

    func testRelationshipResolvesOtherAccountInBothDirections() {
        let inviter = UUID()
        let invitee = UUID()
        let relationship = MSHSharingRelationship(
            id: UUID(),
            inviterID: inviter,
            inviterEmail: "one@example.com",
            inviteeEmail: "two@example.com",
            inviteeID: invitee,
            status: "accepted",
            createdAt: "2026-09-01T00:00:00Z",
            acceptedAt: "2026-09-01T00:01:00Z",
            revokedAt: nil
        )

        XCTAssertEqual(relationship.otherUserID(for: inviter), invitee)
        XCTAssertEqual(relationship.otherUserID(for: invitee), inviter)
        XCTAssertEqual(relationship.otherEmail(for: inviter), "two@example.com")
        XCTAssertEqual(relationship.otherEmail(for: invitee), "one@example.com")
        XCTAssertTrue(relationship.isAccepted)
    }

    func testPendingRelationshipCannotBeTreatedAsAccepted() {
        let inviter = UUID()
        let relationship = MSHSharingRelationship(
            id: UUID(),
            inviterID: inviter,
            inviterEmail: "one@example.com",
            inviteeEmail: "two@example.com",
            inviteeID: nil,
            status: "pending",
            createdAt: "2026-09-01T00:00:00Z",
            acceptedAt: nil,
            revokedAt: nil
        )

        XCTAssertFalse(relationship.isAccepted)
        XCTAssertNil(relationship.otherUserID(for: inviter))
    }
}
