import XCTest
@testable import MySimpleHealth

final class MSHCoreAuthorityTests: XCTestCase {
    func testFirebaseUIDBacksCanonicalMemberNamespace() throws {
        let member = try XCTUnwrap(MSHMemberID(rawValue: "firebase-user-123"))

        XCTAssertEqual(MSHCoreMemberNamespace.memberPath(member), "users/firebase-user-123")
        XCTAssertEqual(MSHCoreMemberNamespace.recordsPath(member), "users/firebase-user-123/coreRecords")
        XCTAssertEqual(
            MSHCoreMemberNamespace.recordPath("focus-1", memberID: member),
            "users/firebase-user-123/coreRecords/focus-1"
        )
    }

    func testMemberNamespacesAreIsolatedByUID() throws {
        let first = try XCTUnwrap(MSHMemberID(rawValue: "member-a"))
        let second = try XCTUnwrap(MSHMemberID(rawValue: "member-b"))

        XCTAssertNotEqual(MSHCoreMemberNamespace.recordsPath(first), MSHCoreMemberNamespace.recordsPath(second))
        XCTAssertFalse(MSHCoreMemberNamespace.recordPath("same-record", memberID: first).contains("member-b"))
    }

    func testBlankMemberIDIsRejected() {
        XCTAssertNil(MSHMemberID(rawValue: "   "))
    }

    func testAuthorityLayersRemainDistinct() throws {
        let member = try XCTUnwrap(MSHMemberID(rawValue: "member-a"))
        let now = Date(timeIntervalSince1970: 1_800_000_000)

        let inferred = MSHCoreRecordEnvelope(
            recordID: "vision-inference-1",
            ownerID: member,
            domain: .vision,
            recordType: "vision.synthesis",
            provenance: .modelInferred,
            authority: .modelInference,
            sourceRecordIDs: ["vision-entry-1"],
            createdAt: now,
            updatedAt: now
        )

        let confirmed = MSHCoreRecordEnvelope(
            recordID: "vision-confirmed-1",
            ownerID: member,
            domain: .vision,
            recordType: "vision.confirmed",
            provenance: .userConfirmed,
            authority: .member,
            sourceRecordIDs: [inferred.recordID],
            createdAt: now,
            updatedAt: now
        )

        XCTAssertNotEqual(inferred.recordID, confirmed.recordID)
        XCTAssertEqual(inferred.provenance, .modelInferred)
        XCTAssertEqual(confirmed.provenance, .userConfirmed)
        XCTAssertEqual(confirmed.sourceRecordIDs, [inferred.recordID])
    }
}
