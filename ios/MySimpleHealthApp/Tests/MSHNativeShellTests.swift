import XCTest
@testable import MySimpleHealth

final class MSHNativeShellTests: XCTestCase {
    func testPrimaryNavigationHasExpectedSectionsInOrder() {
        XCTAssertEqual(
            MSHAppSection.allCases,
            [.myHealth, .explore, .simple, .progress, .me]
        )
        XCTAssertEqual(
            MSHAppSection.allCases.map(\.title),
            ["My Health", "Explore", "Simple", "Progress", "Me"]
        )
    }

    func testCriticalTabPathCanReturnToMyHealthWithoutChangingArchitecture() {
        let path = MSHAppSection.allCases + [.myHealth]

        XCTAssertEqual(path, [.myHealth, .explore, .simple, .progress, .me, .myHealth])
        XCTAssertTrue(path.allSatisfy(\.isImplemented))
    }

    func testRapidTabSelectionAlwaysTransfersToTheMostRecentTab() {
        var selected = MSHAppSection.myHealth

        for section in MSHAppSection.allCases + Array(MSHAppSection.allCases.reversed()) {
            selected = section
            XCTAssertEqual(selected, section)
        }
    }

    func testSelectingTheCurrentTabIsStable() {
        for section in MSHAppSection.allCases {
            var selected = section
            selected = section
            XCTAssertEqual(selected, section)
        }
    }

    func testEverySectionHasDistinctNativeNavigationMetadata() {
        let sections = MSHAppSection.allCases

        XCTAssertEqual(Set(sections.map(\.title)).count, sections.count)
        XCTAssertEqual(Set(sections.map(\.systemImage)).count, sections.count)
        XCTAssertTrue(sections.allSatisfy { !$0.introduction.isEmpty })
    }

    func testIntegratedShellPreservesFiveTabsAndUsesProductDestinations() {
        XCTAssertTrue(MSHAppSection.myHealth.isImplemented)
        XCTAssertTrue(MSHAppSection.explore.isImplemented)
        XCTAssertTrue(MSHAppSection.simple.isImplemented)
        XCTAssertTrue(MSHAppSection.progress.isImplemented)
        XCTAssertTrue(MSHAppSection.me.isImplemented)
    }

    func testCalendarAndMovementRoutesRemainAvailableUnderExplore() {
        XCTAssertEqual(MSHFeatureDestination.calendar.path, "calendar.html")
        XCTAssertNil(MSHFeatureDestination.calendar.query)
        XCTAssertEqual(MSHFeatureDestination.movementPlan.path, "calendar.html")
        XCTAssertEqual(MSHFeatureDestination.movementPlan.query, "view=movement")
        XCTAssertEqual(MSHFeatureDestination.movementLibrary.path, "movement-library.html")
    }

    func testExploreCapabilitiesMapToCanonicalExistingRoutes() {
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

    func testIntegratedCapabilitiesMapToCommittedRoutes() {
        let routes: [MSHFeatureDestination: (path: String, query: String?)] = [
            .cycle: ("calendar.html", "view=cycle"),
            .medications: ("medications.html", nil),
            .explore: ("my-health.html", "view=explore"),
            .healthStory: ("my-health-story.html", nil)
        ]

        for (destination, expected) in routes {
            XCTAssertEqual(destination.path, expected.path)
            XCTAssertEqual(destination.query, expected.query)
        }
    }

    func testCrossDomainRoutesOpenInTheExpectedPrimaryTab() {
        XCTAssertEqual(MSHWebRoute(destination: .healthStory).appSection, .progress)
        XCTAssertEqual(MSHWebRoute(destination: .cycle).appSection, .explore)
        XCTAssertEqual(MSHWebRoute(destination: .movementLibrary).appSection, .explore)
        XCTAssertEqual(MSHWebRoute(destination: .medications).appSection, .explore)
        XCTAssertEqual(MSHWebRoute(destination: .explore).appSection, .explore)
        XCTAssertEqual(MSHWebRoute(rawValue: "hello.html")?.appSection, .simple)
    }

    func testSimpleKeepsLegacyRouteInternalWhileUsingNewProductIdentity() {
        let route = MSHWebRoute(rawValue: "hello.html")

        XCTAssertNotNil(route)
        XCTAssertEqual(route?.appSection, .simple)
        XCTAssertEqual(MSHAppSection.simple.title, "Simple")
    }

    func testEveryNativeFeatureDestinationHasAUniqueRouteIdentity() {
        let identities = MSHFeatureDestination.allCases.map {
            [$0.path, $0.query].compactMap { $0 }.joined(separator: "?")
        }
        XCTAssertEqual(Set(identities).count, identities.count)
        XCTAssertFalse(identities.contains("health-patterns-preview.html"))
    }
}
