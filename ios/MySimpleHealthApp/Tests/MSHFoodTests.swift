import XCTest
@testable import MySimpleHealth

@MainActor
final class MSHFoodTests: XCTestCase {
    private var suiteName: String!
    private var defaults: UserDefaults!

    override func setUp() {
        super.setUp()
        suiteName = "MSHFoodTests.\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        defaults = nil
        suiteName = nil
        super.tearDown()
    }

    func testPurchasedGroceryMovesIntoInventoryAndKeepsProductCode() {
        let store = MSHFoodStore(defaults: defaults)
        let grocery = MSHGroceryItem(name: "Greek yogurt", quantity: 2, unit: "cup", productCode: "012345678905")

        store.addGrocery(grocery)
        store.purchase(grocery)

        XCTAssertTrue(store.groceries.isEmpty)
        XCTAssertEqual(store.inventory.count, 1)
        XCTAssertEqual(store.inventory[0].name, "Greek yogurt")
        XCTAssertEqual(store.inventory[0].quantity, 2)
        XCTAssertEqual(store.inventory[0].productCode, "012345678905")
        XCTAssertEqual(store.inventory[0].provenance, "grocery_purchase")
    }

    func testSameGroceryPurchaseIsIdempotent() {
        let store = MSHFoodStore(defaults: defaults)
        let grocery = MSHGroceryItem(name: "Oats", quantity: 1, unit: "bag")

        store.addGrocery(grocery)
        store.purchase(grocery)
        store.purchase(grocery)

        XCTAssertEqual(store.inventory.count, 1)
        XCTAssertEqual(store.inventory[0].quantity, 1)
    }

    func testProductCodeMatchesExistingInventoryEvenWhenNamesDiffer() {
        let store = MSHFoodStore(defaults: defaults)
        store.addFood(MSHFoodItem(name: "Organic rolled oats", quantity: 1, unit: "bag", productCode: "012345678905"))
        let grocery = MSHGroceryItem(name: "Oats", quantity: 2, unit: "bag", productCode: "012345678905")

        store.addGrocery(grocery)
        store.purchase(grocery)

        XCTAssertEqual(store.inventory.count, 1)
        XCTAssertEqual(store.inventory[0].quantity, 3)
        XCTAssertEqual(store.inventory[0].name, "Organic rolled oats")
    }

    func testDuplicateActiveRestockIsSuppressed() {
        let store = MSHFoodStore(defaults: defaults)
        let food = MSHFoodItem(name: "Milk", quantity: 1, unit: "carton", productCode: "012345678905")
        store.addFood(food)

        store.useUp(store.inventory[0], restock: true)
        store.addGrocery(MSHGroceryItem(name: "Milk", quantity: 1, unit: "carton", productCode: "012345678905"))

        XCTAssertEqual(store.inventory.count, 0)
        XCTAssertEqual(store.groceries.count, 1)
    }

    func testStorePersistsInventoryGroceriesAndProcessedPurchases() {
        let grocery = MSHGroceryItem(name: "Rice", quantity: 1, unit: "bag")
        do {
            let store = MSHFoodStore(defaults: defaults)
            store.addFood(MSHFoodItem(name: "Beans", quantity: 3, unit: "can"))
            store.addGrocery(grocery)
            store.purchase(grocery)
            store.addGrocery(MSHGroceryItem(name: "Apples", quantity: 4, unit: "item"))
        }

        let reloaded = MSHFoodStore(defaults: defaults)
        XCTAssertEqual(reloaded.inventory.count, 2)
        XCTAssertEqual(reloaded.groceries.count, 1)
        XCTAssertEqual(reloaded.groceries[0].name, "Apples")

        reloaded.purchase(grocery)
        let rice = reloaded.inventory.first { $0.name == "Rice" }
        XCTAssertEqual(rice?.quantity, 1)
    }

    func testUseSoonReturnsExpiringItemsOnly() {
        let store = MSHFoodStore(defaults: defaults)
        let soon = Calendar.current.date(byAdding: .day, value: 2, to: Date())!
        let later = Calendar.current.date(byAdding: .day, value: 20, to: Date())!
        store.addFood(MSHFoodItem(name: "Spinach", expiresAt: soon))
        store.addFood(MSHFoodItem(name: "Rice", expiresAt: later))

        XCTAssertEqual(store.useSoon.map(\.name), ["Spinach"])
    }
}
