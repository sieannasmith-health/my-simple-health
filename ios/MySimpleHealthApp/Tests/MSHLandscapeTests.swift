import XCTest
@testable import MySimpleHealth

@MainActor
final class MSHLandscapeTests: XCTestCase {
    func testNativeCatalogPreservesLandscapeInstrument() {
        XCTAssertEqual(MSHLandscapeCatalog.instrumentVersion, "WL-PROTOTYPE-1")
        XCTAssertEqual(MSHLandscapeCatalog.experienceVersion, "DIMENSIONS-OF-HEALTH-V2")
        XCTAssertEqual(MSHLandscapeCatalog.domains.count, 9)
        XCTAssertEqual(MSHLandscapeCatalog.items.count, 27)
        XCTAssertEqual(MSHLandscapeCatalog.items.first?.id, "PHY-01")
        XCTAssertEqual(MSHLandscapeCatalog.items.last?.id, "WHO-02")
    }

    func testAnswerPersistsStableItemIdentityAndProvenanceFields() {
        let defaults = UserDefaults(suiteName: "MSHLandscapeTests.answer")!
        defaults.removePersistentDomain(forName: "MSHLandscapeTests.answer")
        let store = MSHLandscapeStore(defaults: defaults)
        let model = MSHLandscapeViewModel(store: store)

        model.start(domain: "physical")
        let option = MSHLandscapeCatalog.fit5[3]
        model.answer(option)

        let saved = store.load()
        XCTAssertEqual(saved?.responses.count, 1)
        XCTAssertEqual(saved?.responses.first?.itemID, "PHY-01")
        XCTAssertEqual(saved?.responses.first?.value, "mostly")
        XCTAssertEqual(saved?.responses.first?.signal, "fit")
        XCTAssertEqual(saved?.instrumentVersion, "WL-PROTOTYPE-1")
        XCTAssertEqual(saved?.experienceVersion, "DIMENSIONS-OF-HEALTH-V2")
    }

    func testBurdenResponseIsSummarizedAsWorthNoticing() {
        let defaults = UserDefaults(suiteName: "MSHLandscapeTests.summary")!
        defaults.removePersistentDomain(forName: "MSHLandscapeTests.summary")
        let model = MSHLandscapeViewModel(store: MSHLandscapeStore(defaults: defaults))

        model.start(domain: "physical")
        model.answer(MSHLandscapeCatalog.fit5[4])
        model.continueForward()
        model.answer(MSHLandscapeCatalog.frequencyPositive5[4])
        model.continueForward()
        model.answer(MSHLandscapeCatalog.fit5[4])
        model.continueForward()
        model.answer(MSHLandscapeCatalog.frequencyBurden5[4])

        XCTAssertEqual(model.domainState("physical"), "Worth noticing")
    }

    func testMissingResponseStaysOpenWithoutInventingAValue() {
        let defaults = UserDefaults(suiteName: "MSHLandscapeTests.missing")!
        defaults.removePersistentDomain(forName: "MSHLandscapeTests.missing")
        let store = MSHLandscapeStore(defaults: defaults)
        let model = MSHLandscapeViewModel(store: store)

        model.start(domain: "emotional")
        model.skip(reason: .notSure)

        let response = store.load()?.responses.first(where: { $0.itemID == "EMO-01" })
        XCTAssertNil(response?.value)
        XCTAssertEqual(response?.label, "Not sure")
        XCTAssertEqual(response?.missingReason, "NOT_SURE")
    }

    func testPartialLandscapeCanResumeAtAnUnexploredItem() {
        let defaults = UserDefaults(suiteName: "MSHLandscapeTests.resume")!
        defaults.removePersistentDomain(forName: "MSHLandscapeTests.resume")
        let store = MSHLandscapeStore(defaults: defaults)
        let first = MSHLandscapeViewModel(store: store)

        first.start(domain: "financial")
        first.answer(MSHLandscapeCatalog.fit5[2])
        first.continueForward()

        let restored = MSHLandscapeViewModel(store: store)
        XCTAssertTrue(restored.hasProgress)
        restored.resume()
        XCTAssertNotEqual(restored.currentItem?.id, "FIN-01")
    }
}
