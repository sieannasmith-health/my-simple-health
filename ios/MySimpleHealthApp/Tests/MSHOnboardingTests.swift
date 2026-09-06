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
#if DEBUG
        UserDefaults.standard.removePersistentDomain(forName: MSHOnboardingStoreFactory.freshOnboardingTestSuiteName)
#endif
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
#if DEBUG
        UserDefaults.standard.removePersistentDomain(forName: MSHOnboardingStoreFactory.freshOnboardingTestSuiteName)
#endif
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
        first.complete()

        let relaunched = MSHOnboardingStore(defaults: defaults, existingUserDetector: { false })
        XCTAssertFalse(relaunched.shouldPresentOnboarding)
        XCTAssertTrue(relaunched.state.started)
        XCTAssertTrue(relaunched.state.completed)
        XCTAssertEqual(relaunched.state.appleHealthChoice, .notNow)
        XCTAssertEqual(relaunched.state.notificationChoice, .declined)
        XCTAssertNil(relaunched.state.startingPoint)
    }

    func testExistingNativeHealthUserIsMigratedPastOnboardingWithoutChangingChoices() {
        let store = MSHOnboardingStore(defaults: defaults, existingUserDetector: { true })

        XCTAssertFalse(store.shouldPresentOnboarding)
        XCTAssertTrue(store.state.completed)
        XCTAssertTrue(store.state.migratedExistingUser)
        XCTAssertEqual(store.state.appleHealthChoice, .notAsked)
        XCTAssertEqual(store.state.notificationChoice, .notAsked)
    }

    func testLegacyMigratedExistingUserRemainsPastOnboarding() throws {
        var legacyState = MSHOnboardingState(
            schemaVersion: 1,
            started: true,
            completed: true,
            migratedExistingUser: true
        )
        legacyState.startingPoint = .movement
        defaults.set(try JSONEncoder().encode(legacyState), forKey: MSHOnboardingStore.storageKey)

        let store = MSHOnboardingStore(defaults: defaults, existingUserDetector: { false })

        XCTAssertFalse(store.shouldPresentOnboarding)
        XCTAssertTrue(store.state.started)
        XCTAssertTrue(store.state.completed)
        XCTAssertTrue(store.state.migratedExistingUser)
        XCTAssertEqual(store.state.schemaVersion, MSHOnboardingState.currentSchemaVersion)
        XCTAssertEqual(store.state.startingPoint, .movement)
    }

#if DEBUG
    func testFreshOnboardingHarnessUsesIsolatedStateAndCanPersistAcrossTestRelaunch() {
        let productionState = MSHOnboardingState(started: true, completed: true)
        UserDefaults.standard.set(
            try? JSONEncoder().encode(productionState),
            forKey: MSHOnboardingStore.storageKey
        )

        let first = MSHOnboardingStoreFactory.make(arguments: [
            MSHOnboardingStoreFactory.freshOnboardingTestArgument,
            MSHOnboardingStoreFactory.resetFreshOnboardingTestArgument
        ])

        XCTAssertTrue(first.shouldPresentOnboarding)
        XCTAssertFalse(first.state.completed)
        first.setAppleHealthChoice(.notNow)
        first.setNotificationChoice(.notNow)
        first.complete()

        let relaunched = MSHOnboardingStoreFactory.make(arguments: [
            MSHOnboardingStoreFactory.freshOnboardingTestArgument
        ])
        XCTAssertFalse(relaunched.shouldPresentOnboarding)
        XCTAssertTrue(relaunched.state.completed)

        let productionData = UserDefaults.standard.data(forKey: MSHOnboardingStore.storageKey)
        let preservedProductionState = productionData.flatMap { try? JSONDecoder().decode(MSHOnboardingState.self, from: $0) }
        XCTAssertEqual(preservedProductionState, productionState)

        UserDefaults.standard.removeObject(forKey: MSHOnboardingStore.storageKey)
    }
#endif
}
