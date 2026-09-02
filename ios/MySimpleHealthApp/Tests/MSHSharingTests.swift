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
        let inviter = "firebase-user-one"
        let invitee = "firebase-user-two"
        let relationship = MSHSharingRelationship(
            id: "relationship-one",
            inviterID: inviter,
            inviterEmail: "one@example.com",
            inviteeEmail: "two@example.com",
            inviteeID: invitee,
            status: "accepted",
            createdAt: Date(timeIntervalSince1970: 1_788_220_800),
            acceptedAt: Date(timeIntervalSince1970: 1_788_220_860),
            revokedAt: nil
        )

        XCTAssertEqual(relationship.otherUserID(for: inviter), invitee)
        XCTAssertEqual(relationship.otherUserID(for: invitee), inviter)
        XCTAssertEqual(relationship.otherEmail(for: inviter), "two@example.com")
        XCTAssertEqual(relationship.otherEmail(for: invitee), "one@example.com")
        XCTAssertTrue(relationship.isAccepted)
    }

    func testPendingRelationshipCannotBeTreatedAsAccepted() {
        let inviter = "firebase-user-one"
        let relationship = MSHSharingRelationship(
            id: "relationship-pending",
            inviterID: inviter,
            inviterEmail: "one@example.com",
            inviteeEmail: "two@example.com",
            inviteeID: nil,
            status: "pending",
            createdAt: Date(timeIntervalSince1970: 1_788_220_800),
            acceptedAt: nil,
            revokedAt: nil
        )

        XCTAssertFalse(relationship.isAccepted)
        XCTAssertNil(relationship.otherUserID(for: inviter))
    }
}
