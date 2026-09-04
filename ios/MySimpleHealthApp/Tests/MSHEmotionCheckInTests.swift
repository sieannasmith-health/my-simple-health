import XCTest
@testable import MySimpleHealth

final class MSHEmotionCheckInTests: XCTestCase {
    func testValenceIsClampedToSupportedRange() {
        XCTAssertEqual(MSHEmotionState(valence: -4).valence, -1)
        XCTAssertEqual(MSHEmotionState(valence: 4).valence, 1)
    }

    func testNeutralRangeHasNeutralCopyAndFlatMouth() {
        let state = MSHEmotionState(valence: 0)
        XCTAssertEqual(state.label, "Neutral")
        XCTAssertEqual(state.description, "Steady. Present. Okay.")
        XCTAssertEqual(state.mouthCurve, 0, accuracy: 0.0001)
    }

    func testLabelsMoveAcrossContinuousValenceRange() {
        XCTAssertEqual(MSHEmotionState(valence: -0.9).label, "Very unpleasant")
        XCTAssertEqual(MSHEmotionState(valence: -0.4).label, "Unpleasant")
        XCTAssertEqual(MSHEmotionState(valence: 0).label, "Neutral")
        XCTAssertEqual(MSHEmotionState(valence: 0.4).label, "Pleasant")
        XCTAssertEqual(MSHEmotionState(valence: 0.9).label, "Very pleasant")
    }

    func testExpressionParametersRemainContinuous() {
        let left = MSHEmotionState(valence: 0.24)
        let right = MSHEmotionState(valence: 0.25)

        XCTAssertLessThan(abs(right.mouthCurve - left.mouthCurve), 0.02)
        XCTAssertLessThan(abs(right.eyeTilt - left.eyeTilt), 0.02)
        XCTAssertLessThan(abs(right.verticalScale - left.verticalScale), 0.02)
    }
}
