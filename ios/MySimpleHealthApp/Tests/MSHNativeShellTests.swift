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
}
