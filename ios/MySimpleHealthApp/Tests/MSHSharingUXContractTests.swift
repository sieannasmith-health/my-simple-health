import XCTest
@testable import MySimpleHealth

final class MSHSharingUXContractTests: XCTestCase {
    func testSharingUXUsesExplicitRelationshipStatesAndScopedCategories() {
        let pending = MSHSharingRelationship(
            id: "pending-id",
            inviterID: "owner-id",
            inviterEmail: "owner@example.com",
            inviteeEmail: "family@example.com",
            inviteeID: nil,
            status: "pending",
            createdAt: Date(timeIntervalSince1970: 1),
            acceptedAt: nil,
            revokedAt: nil
        )

        let accepted = MSHSharingRelationship(
            id: "accepted-id",
            inviterID: "owner-id",
            inviterEmail: "owner@example.com",
            inviteeEmail: "family@example.com",
            inviteeID: "family-id",
            status: "accepted",
            createdAt: Date(timeIntervalSince1970: 1),
            acceptedAt: Date(timeIntervalSince1970: 2),
            revokedAt: nil
        )

        XCTAssertTrue(pending.isPending)
        XCTAssertFalse(pending.isAccepted)
        XCTAssertTrue(accepted.isAccepted)
        XCTAssertFalse(accepted.isPending)

        XCTAssertEqual(MSHSharingCategory.calendar.defaultScope["mode"], "selected_items")
        XCTAssertEqual(MSHSharingCategory.health.defaultScope["mode"], "approved_metric_summaries")
        XCTAssertEqual(MSHSharingCategory.finances.defaultScope["mode"], "selected_household_items")
    }
}
