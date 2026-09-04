import XCTest
@testable import MySimpleHealth

@MainActor
final class MSHSavingsTests: XCTestCase {
    private var defaults: UserDefaults!

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: "MSHSavingsTests-\(UUID().uuidString)")!
        defaults.removePersistentDomain(forName: defaultsSuiteName)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: defaultsSuiteName)
        defaults = nil
        super.tearDown()
    }

    private var defaultsSuiteName: String {
        defaults?.volatileDomainNames.first(where: { $0.hasPrefix("MSHSavingsTests-") }) ?? ""
    }

    func testSavingOfferTeachesCategoryPreference() {
        let food = offer(id: "11111111-1111-1111-1111-111111111111", title: "Food", category: .foodNutrition)
        let movement = offer(id: "22222222-2222-2222-2222-222222222222", title: "Movement", category: .movement)
        let store = MSHSavingsStore(offers: [movement, food], defaults: defaults)

        store.decide(.saved, for: food)
        store.restore(food)

        XCTAssertTrue(store.preferences.preferredCategories.contains(.foodNutrition))
        XCTAssertEqual(store.currentOffer?.id, food.id)
    }

    func testSkipDoesNotCreatePermanentDislike() {
        let food = offer(id: "33333333-3333-3333-3333-333333333333", title: "Food", category: .foodNutrition)
        let store = MSHSavingsStore(offers: [food], defaults: defaults)

        store.decide(.skipped, for: food)

        XCTAssertFalse(store.preferences.dislikedCategories.contains(.foodNutrition))
        XCTAssertNil(store.currentOffer)
    }

    func testLaterKeepsOfferAvailableWithoutTeachingPreference() {
        let sleep = offer(id: "44444444-4444-4444-4444-444444444444", title: "Sleep", category: .sleep)
        let store = MSHSavingsStore(offers: [sleep], defaults: defaults)

        store.decide(.later, for: sleep)

        XCTAssertEqual(store.currentOffer?.id, sleep.id)
        XCTAssertTrue(store.preferences.preferredCategories.isEmpty)
        XCTAssertTrue(store.preferences.dislikedCategories.isEmpty)
    }

    func testPotentialValueCountsSavedDollarBenefitsOnly() {
        let food = offer(
            id: "55555555-5555-5555-5555-555555555555",
            title: "Food",
            category: .foodNutrition,
            benefit: .dollarsOff(amount: 3)
        )
        let movement = offer(
            id: "66666666-6666-6666-6666-666666666666",
            title: "Movement",
            category: .movement,
            benefit: .percentOff(percent: 15)
        )
        let store = MSHSavingsStore(offers: [food, movement], defaults: defaults)

        store.decide(.saved, for: food)
        store.decide(.saved, for: movement)

        XCTAssertEqual(store.potentialSavedValue, Decimal(3))
    }

    func testRedeemedSavingsPersistAcrossStoreInstances() {
        let store = MSHSavingsStore(offers: [], defaults: defaults)
        store.recordRedeemedSavings(Decimal(string: "4.25")!)

        let restored = MSHSavingsStore(offers: [], defaults: defaults)

        XCTAssertEqual(restored.redeemedSavings, Decimal(string: "4.25")!)
    }

    private func offer(
        id: String,
        title: String,
        category: MSHSavingsOffer.Category,
        benefit: MSHSavingsOffer.Benefit = .dollarsOff(amount: 2)
    ) -> MSHSavingsOffer {
        MSHSavingsOffer(
            id: UUID(uuidString: id)!,
            title: title,
            brand: nil,
            category: category,
            benefit: benefit,
            details: "Test offer",
            expiresAt: nil,
            redemptionLabel: nil,
            isPreview: true
        )
    }
}
