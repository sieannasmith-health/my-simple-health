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
        let inviter = "inviter-id"
        let invitee = "invitee-id"
        let createdAt = Date(timeIntervalSince1970: 0)
        let acceptedAt = Date(timeIntervalSince1970: 60)
        let relationship = MSHSharingRelationship(
            id: "relationship-id",
            inviterID: inviter,
            inviterEmail: "one@example.com",
            inviteeEmail: "two@example.com",
            inviteeID: invitee,
            status: "accepted",
            createdAt: createdAt,
            acceptedAt: acceptedAt,
            revokedAt: nil
        )

        XCTAssertEqual(relationship.otherUserID(for: inviter), invitee)
        XCTAssertEqual(relationship.otherUserID(for: invitee), inviter)
        XCTAssertEqual(relationship.otherEmail(for: inviter), "two@example.com")
        XCTAssertEqual(relationship.otherEmail(for: invitee), "one@example.com")
        XCTAssertTrue(relationship.isAccepted)
    }

    func testPendingRelationshipCannotBeTreatedAsAccepted() {
        let inviter = "inviter-id"
        let relationship = MSHSharingRelationship(
            id: "relationship-id",
            inviterID: inviter,
            inviterEmail: "one@example.com",
            inviteeEmail: "two@example.com",
            inviteeID: nil,
            status: "pending",
            createdAt: Date(timeIntervalSince1970: 0),
            acceptedAt: nil,
            revokedAt: nil
        )

        XCTAssertFalse(relationship.isAccepted)
        XCTAssertNil(relationship.otherUserID(for: inviter))
    }
}
