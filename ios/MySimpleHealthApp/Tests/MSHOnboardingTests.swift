import XCTest
@testable import MySimpleHealth

@MainActor
final class MSHOnboardingTests: XCTestCase {
    private var defaults: UserDefaults!
    private var suiteName: String!

    override func setUp() {
        super.setUp()
        suiteName = "MSHOnboardingTests.\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        defaults = nil
        suiteName = nil
        super.tearDown()
    }

    func testFreshInstallStartsWithoutRequestingOrCompletingAnything() {
        let store = MSHOnboardingStore(defaults: defaults, existingUserDetector: { false })

        XCTAssertTrue(store.shouldPresentOnboarding)
        XCTAssertFalse(store.state.started)
        XCTAssertFalse(store.state.completed)
        XCTAssertEqual(store.state.appleHealthChoice, .notAsked)
        XCTAssertEqual(store.state.notificationChoice, .notAsked)
        XCTAssertNil(store.state.startingPoint)
    }

    func testChoicesAndCompletionPersistAcrossRelaunch() {
        let first = MSHOnboardingStore(defaults: defaults, existingUserDetector: { false })
        first.markStarted()
        first.setAppleHealthChoice(.notNow)
        first.setNotificationChoice(.declined)
        first.setStartingPoint(.movement)
        first.complete()

        let relaunched = MSHOnboardingStore(defaults: defaults, existingUserDetector: { false })
        XCTAssertFalse(relaunched.shouldPresentOnboarding)
        XCTAssertTrue(relaunched.state.started)
        XCTAssertTrue(relaunched.state.completed)
        XCTAssertEqual(relaunched.state.appleHealthChoice, .notNow)
        XCTAssertEqual(relaunched.state.notificationChoice, .declined)
        XCTAssertEqual(relaunched.state.startingPoint, .movement)
    }

    func testExistingNativeHealthUserIsMigratedPastOnboardingWithoutChangingChoices() {
        let store = MSHOnboardingStore(defaults: defaults, existingUserDetector: { true })

        XCTAssertFalse(store.shouldPresentOnboarding)
        XCTAssertTrue(store.state.completed)
        XCTAssertTrue(store.state.migratedExistingUser)
        XCTAssertEqual(store.state.appleHealthChoice, .notAsked)
        XCTAssertEqual(store.state.notificationChoice, .notAsked)
    }

    func testEveryStartingPointIsNonemptyAndPersistable() {
        XCTAssertEqual(MSHOnboardingStartingPoint.allCases.count, 5)
        XCTAssertTrue(MSHOnboardingStartingPoint.allCases.allSatisfy { !$0.title.isEmpty })

        let store = MSHOnboardingStore(defaults: defaults, existingUserDetector: { false })
        for startingPoint in MSHOnboardingStartingPoint.allCases {
            store.setStartingPoint(startingPoint)
            XCTAssertEqual(store.state.startingPoint, startingPoint)
        }
    }
}
