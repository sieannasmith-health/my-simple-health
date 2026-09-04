import XCTest
@testable import MySimpleHealth

final class MSHCycleAudienceTests: XCTestCase {
    func testCycleOnlyShowsForWomanPreference() {
        XCTAssertTrue(MSHCycleAudiencePreference.woman.showsCycle)
        XCTAssertFalse(MSHCycleAudiencePreference.unspecified.showsCycle)
        XCTAssertFalse(MSHCycleAudiencePreference.notForMe.showsCycle)
    }

    func testCycleAudienceUsesStablePreferenceKey() {
        XCTAssertEqual(MSHCycleAudiencePreference.storageKey, "msh.profile.cycleAudience")
    }
}
