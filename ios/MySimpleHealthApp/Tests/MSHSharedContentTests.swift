import XCTest
@testable import MySimpleHealth

final class MSHSharedContentTests: XCTestCase {
    func testResourceTypesMapToOnlyTheirSharingCategory() {
        XCTAssertEqual(MSHSharedResourceType.calendarEvent.requiredCategory, .calendar)
        XCTAssertEqual(MSHSharedResourceType.workoutVideo.requiredCategory, .workouts)
        XCTAssertEqual(MSHSharedResourceType.workoutCollection.requiredCategory, .workouts)
        XCTAssertEqual(MSHSharedResourceType.financialItem.requiredCategory, .finances)
        XCTAssertEqual(MSHSharedResourceType.healthMetricSummary.requiredCategory, .health)
    }

    func testHealthBoundaryHasNoRawHealthKitResourceType() {
        let rawValues = Set(MSHSharedResourceType.allCases.map(\.rawValue))
        XCTAssertEqual(rawValues.intersection(["healthkit_sample", "heart_rate_sample", "raw_health_record"]), [])
        XCTAssertTrue(rawValues.contains("health_metric_summary"))
    }
}
