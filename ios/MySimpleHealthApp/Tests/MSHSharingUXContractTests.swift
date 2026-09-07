import XCTest
@testable import MySimpleHealth

final class MSHSharingUXContractTests: XCTestCase {
    func testNativeSharingContractExposesExpectedControls() {
        XCTAssertEqual(MSHSharingCategory.calendar.title, "Calendar")
        XCTAssertEqual(MSHSharingCategory.workouts.title, "Workouts")
        XCTAssertEqual(MSHSharingCategory.finances.title, "Finances")
        XCTAssertEqual(MSHSharingCategory.health.title, "Health & Metrics")

        XCTAssertEqual(MSHSharingCategory.calendar.defaultScope["mode"], "selected_items")
        XCTAssertEqual(MSHSharingCategory.workouts.defaultScope["mode"], "selected_items")
        XCTAssertEqual(MSHSharingCategory.finances.defaultScope["mode"], "selected_household_items")
        XCTAssertEqual(MSHSharingCategory.health.defaultScope["mode"], "approved_metric_summaries")
    }
}
