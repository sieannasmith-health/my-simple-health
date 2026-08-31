import XCTest
@testable import MySimpleHealth

final class MSHNativeShellTests: XCTestCase {
    func testPrimaryNavigationHasExpectedSectionsInOrder() {
        XCTAssertEqual(
            MSHAppSection.allCases,
            [.myHealth, .calendar, .movement, .track, .tools]
        )
        XCTAssertEqual(
            MSHAppSection.allCases.map(\.title),
            ["My Health", "Calendar", "Movement", "Track", "Tools"]
        )
    }

    func testEverySectionHasDistinctNativeNavigationMetadata() {
        let sections = MSHAppSection.allCases

        XCTAssertEqual(Set(sections.map(\.title)).count, sections.count)
        XCTAssertEqual(Set(sections.map(\.systemImage)).count, sections.count)
        XCTAssertTrue(sections.allSatisfy { !$0.introduction.isEmpty })
    }

    func testFirstBridgeStagePreservesFiveTabsAndImplementsOnlyRealDestinations() {
        XCTAssertTrue(MSHAppSection.myHealth.isImplemented)
        XCTAssertTrue(MSHAppSection.calendar.isImplemented)
        XCTAssertTrue(MSHAppSection.movement.isImplemented)
        XCTAssertTrue(MSHAppSection.tools.isImplemented)
        XCTAssertFalse(MSHAppSection.track.isImplemented)
    }

    func testCalendarAndMovementRoutesUseWorkingExistingFeatures() {
        XCTAssertEqual(MSHFeatureDestination.calendar.path, "calendar.html")
        XCTAssertNil(MSHFeatureDestination.calendar.query)
        XCTAssertEqual(MSHFeatureDestination.movementPlan.path, "calendar.html")
        XCTAssertEqual(MSHFeatureDestination.movementPlan.query, "view=movement")
        XCTAssertEqual(MSHFeatureDestination.movementLibrary.path, "movement-library.html")
    }

    func testToolsMapToCanonicalExistingRoutes() {
        let routes: [MSHFeatureDestination: String] = [
            .landscape: "health-landscape.html",
            .selfInsight: "assessments.html",
            .horizon: "my-vision.html",
            .path: "my-project.html",
            .practice: "my-practice.html",
            .discovery: "my-learning.html",
            .journey: "my-progress.html",
            .food: "my-food.html",
            .financialHealth: "financial-health.html"
        ]

        XCTAssertEqual(routes.count, 9)
        for (destination, expectedPath) in routes {
            XCTAssertEqual(destination.path, expectedPath)
        }
    }

    func testEveryNativeFeatureDestinationHasAUniqueRouteIdentity() {
        let identities = MSHFeatureDestination.allCases.map {
            [$0.path, $0.query].compactMap { $0 }.joined(separator: "?")
        }
        XCTAssertEqual(Set(identities).count, identities.count)
    }
}
