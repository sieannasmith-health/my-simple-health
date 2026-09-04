import Foundation
import XCTest
@testable import MySimpleHealth

final class MSHWHOEvidenceProviderTests: XCTestCase {
    func testBuildsIndicatorSearchURL() throws {
        let url = try MSHWHOEvidenceProvider.makeURL(
            path: "Indicator",
            queryItems: [
                URLQueryItem(
                    name: "$filter",
                    value: "contains(IndicatorName,'Household')"
                )
            ]
        )

        XCTAssertEqual(url.host, "ghoapi.azureedge.net")
        XCTAssertEqual(url.path, "/api/Indicator")

        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        XCTAssertEqual(
            components?.queryItems?.first(where: { $0.name == "$filter" })?.value,
            "contains(IndicatorName,'Household')"
        )
    }

    func testBuildsDimensionFilter() {
        XCTAssertEqual(
            MSHWHOEvidenceProvider.filter(dimension: "Dim1", equals: "MLE"),
            "Dim1 eq 'MLE'"
        )
    }

    func testEscapesODataStringValues() {
        XCTAssertEqual(
            MSHWHOEvidenceProvider.filter(dimension: "SpatialDim", equals: "O'Brien"),
            "SpatialDim eq 'O''Brien'"
        )
    }

    func testYearFilterUsesHalfOpenCalendarYear() {
        XCTAssertEqual(
            MSHWHOEvidenceProvider.yearFilter(2026),
            [
                "date(TimeDimensionBegin) ge 2026-01-01",
                "date(TimeDimensionBegin) lt 2027-01-01"
            ]
        )
    }

    func testRejectsPathTraversal() {
        XCTAssertThrowsError(
            try MSHWHOEvidenceProvider.makeURL(path: "../Indicator")
        ) { error in
            XCTAssertEqual(error as? MSHWHOError, .invalidPath)
        }
    }
}
