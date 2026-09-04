import XCTest
@testable import MySimpleHealth

final class MSHPlaidListenerHandleTests: XCTestCase {
    func testControllerCanBeCreatedAndStoppedWithExplicitLifecycleCleanup() async {
        await MainActor.run {
            let controller = MSHPlaidConnectionController()
            controller.stop()
        }
    }
}
