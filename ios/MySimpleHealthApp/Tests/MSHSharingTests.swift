import XCTest
@testable import MySimpleHealth

final class MSHSharingTests: XCTestCase {
    func testSharingStartsWithExplicitScopedCategories() {
        XCTAssertEqual(MSHSharingCategory.calendar.defaultScope["mode"], "selected_items")
        XCTAssertEqual(MSHSharingCategory.workouts.defaultScope["mode"], "selected_items")
        XCTAssertEqual(MSHSharingCategory.finances.defaultScope["mode"], "selected_household_items")
        XCTAssertEqual(MSHSharingCategory.health.defaultScope["mode"], "approved_metric_summaries")
    }

    func testRelationshipResolvesOtherAccountInBothDirections() {
        let inviter = "inviter-id"
        let invitee = "invitee-id"
        let relationship = MSHSharingRelationship(
            id: "relationship-id",
            inviterID: inviter,
            inviterEmail: "one@example.com",
            inviteeEmail: "two@example.com",
            inviteeID: invitee,
            status: "accepted",
            createdAt: Date(timeIntervalSince1970: 1),
            acceptedAt: Date(timeIntervalSince1970: 2),
            revokedAt: nil
        )

        XCTAssertEqual(relationship.otherUserID(for: inviter), invitee)
        XCTAssertEqual(relationship.otherUserID(for: invitee), inviter)
        XCTAssertEqual(relationship.otherEmail(for: inviter), "two@example.com")
        XCTAssertEqual(relationship.otherEmail(for: invitee), "one@example.com")
        XCTAssertTrue(relationship.isAccepted)
        XCTAssertFalse(relationship.isPending)
        XCTAssertFalse(relationship.isRevoked)
    }

    func testPendingRelationshipHasExplicitPendingState() {
        let relationship = MSHSharingRelationship(
            id: "relationship-id",
            inviterID: "inviter-id",
            inviterEmail: "one@example.com",
            inviteeEmail: "two@example.com",
            inviteeID: nil,
            status: "pending",
            createdAt: Date(timeIntervalSince1970: 1),
            acceptedAt: nil,
            revokedAt: nil
        )

        XCTAssertFalse(relationship.isAccepted)
        XCTAssertTrue(relationship.isPending)
        XCTAssertFalse(relationship.isRevoked)
        XCTAssertNil(relationship.otherUserID(for: "inviter-id"))
    }

    func testRevokedRelationshipIsNotActiveOrPending() {
        let relationship = MSHSharingRelationship(
            id: "relationship-id",
            inviterID: "inviter-id",
            inviterEmail: "one@example.com",
            inviteeEmail: "two@example.com",
            inviteeID: "invitee-id",
            status: "revoked",
            createdAt: Date(timeIntervalSince1970: 1),
            acceptedAt: Date(timeIntervalSince1970: 2),
            revokedAt: Date(timeIntervalSince1970: 3)
        )

        XCTAssertFalse(relationship.isAccepted)
        XCTAssertFalse(relationship.isPending)
        XCTAssertTrue(relationship.isRevoked)
    }

    func testDuplicatePendingRelationshipsCollapseToNewest() {
        let older = MSHSharingRelationship(
            id: "older",
            inviterID: "inviter-id",
            inviterEmail: "one@example.com",
            inviteeEmail: "Two@Example.com",
            inviteeID: nil,
            status: "pending",
            createdAt: Date(timeIntervalSince1970: 1),
            acceptedAt: nil,
            revokedAt: nil
        )
        let newer = MSHSharingRelationship(
            id: "newer",
            inviterID: "inviter-id",
            inviterEmail: "one@example.com",
            inviteeEmail: "two@example.com",
            inviteeID: nil,
            status: "pending",
            createdAt: Date(timeIntervalSince1970: 2),
            acceptedAt: nil,
            revokedAt: nil
        )

        let collapsed = MSHSharingRelationshipPolicy.collapse([older, newer])
        let active = collapsed.filter { !$0.isRevoked }

        XCTAssertEqual(active.count, 1)
        XCTAssertEqual(active.first?.id, "newer")
        XCTAssertEqual(
            MSHSharingRelationshipPolicy.duplicateActiveIDs(in: [older, newer], keeping: collapsed),
            ["older"]
        )
    }

    func testAcceptedRelationshipWinsOverNewerPendingDuplicate() {
        let accepted = MSHSharingRelationship(
            id: "accepted",
            inviterID: "inviter-id",
            inviterEmail: "one@example.com",
            inviteeEmail: "two@example.com",
            inviteeID: "invitee-id",
            status: "accepted",
            createdAt: Date(timeIntervalSince1970: 1),
            acceptedAt: Date(timeIntervalSince1970: 2),
            revokedAt: nil
        )
        let pending = MSHSharingRelationship(
            id: "pending",
            inviterID: "inviter-id",
            inviterEmail: "one@example.com",
            inviteeEmail: "two@example.com",
            inviteeID: nil,
            status: "pending",
            createdAt: Date(timeIntervalSince1970: 3),
            acceptedAt: nil,
            revokedAt: nil
        )

        let collapsed = MSHSharingRelationshipPolicy.collapse([accepted, pending])
        let active = collapsed.filter { !$0.isRevoked }

        XCTAssertEqual(active.count, 1)
        XCTAssertEqual(active.first?.id, "accepted")
    }

    func testRelationshipDocumentIDIsStableAcrossEmailCase() {
        let first = MSHSharingRelationshipPolicy.documentID(
            inviterID: "inviter-id",
            inviteeEmail: "Two@Example.com"
        )
        let second = MSHSharingRelationshipPolicy.documentID(
            inviterID: "inviter-id",
            inviteeEmail: "two@example.com"
        )

        XCTAssertEqual(first, second)
        XCTAssertTrue(first.hasPrefix("relationship_"))
    }
}