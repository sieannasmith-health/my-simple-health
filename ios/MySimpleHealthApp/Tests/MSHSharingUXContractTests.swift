import XCTest

final class MSHSharingUXContractTests: XCTestCase {
    func testNativeSharingSourceContainsConfirmationAndSharedWithControls() throws {
        let testFile = URL(fileURLWithPath: #filePath)
        let projectRoot = testFile.deletingLastPathComponent().deletingLastPathComponent()
        let sourceURL = projectRoot.appendingPathComponent("App/MSHSharing.swift")
        let source = try String(contentsOf: sourceURL, encoding: .utf8)

        XCTAssertTrue(source.contains("Invite confirmed for"))
        XCTAssertTrue(source.contains("Shared with"))
        XCTAssertTrue(source.contains("Pending invitation"))
        XCTAssertTrue(source.contains("Sharing paused"))
        XCTAssertTrue(source.contains("setRelationshipSharing"))
        XCTAssertTrue(source.contains("pausedByMaster"))
    }
}
