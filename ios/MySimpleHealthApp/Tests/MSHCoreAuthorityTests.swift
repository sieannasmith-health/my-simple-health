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

    func testLandscapeUsesCanonicalInstrumentIdentityAndStableRecordID() throws {
        let member = try XCTUnwrap(MSHMemberID(rawValue: "member-a"))
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let state = MSHLandscapeAccountState(
            administrationID: "admin-1",
            responses: ["sleep": "4"],
            completedItemIDs: ["sleep"]
        )

        let record = MSHLandscapeFocusRecordFactory.landscape(
            ownerID: member,
            state: state,
            createdAt: now,
            updatedAt: now
        )

        XCTAssertEqual(record.envelope.recordID, MSHCoreRecordIdentity.landscape)
        XCTAssertEqual(record.envelope.domain, .landscape)
        XCTAssertEqual(record.envelope.authority, .member)
        XCTAssertEqual(record.envelope.provenance, .userStated)
        XCTAssertEqual(record.payload.instrumentID, "health_landscape")
        XCTAssertEqual(record.payload.instrumentVersion, "HL-1")
        XCTAssertEqual(record.payload.experienceVersion, "HEALTH-LANDSCAPE-V1")
        XCTAssertFalse(record.payload.isComplete)
    }

    func testLandscapePartialResumeUsesSameLogicalRecordAcrossRetry() throws {
        let member = try XCTUnwrap(MSHMemberID(rawValue: "member-a"))
        let firstTime = Date(timeIntervalSince1970: 1_800_000_000)
        let retryTime = firstTime.addingTimeInterval(30)

        let partial = MSHLandscapeAccountState(
            administrationID: "admin-1",
            responses: ["sleep": "4"],
            completedItemIDs: ["sleep"]
        )
        let resumed = MSHLandscapeAccountState(
            administrationID: "admin-1",
            responses: ["sleep": "4", "movement": "3"],
            completedItemIDs: ["sleep", "movement"]
        )

        let first = MSHLandscapeFocusRecordFactory.landscape(
            ownerID: member,
            state: partial,
            createdAt: firstTime,
            updatedAt: firstTime
        )
        let retry = MSHLandscapeFocusRecordFactory.landscape(
            ownerID: member,
            state: resumed,
            createdAt: firstTime,
            updatedAt: retryTime
        )

        XCTAssertEqual(first.envelope.recordID, retry.envelope.recordID)
        XCTAssertEqual(first.payload.administrationID, retry.payload.administrationID)
        XCTAssertEqual(retry.payload.completedItemIDs, ["sleep", "movement"])
    }

    func testExplicitMemberFocusSelectionIsAuthoritativeAndStable() throws {
        let member = try XCTUnwrap(MSHMemberID(rawValue: "member-a"))
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let selection = try XCTUnwrap(MSHMemberSelectedFocus(focusID: "sleep", selectedAt: now))

        let record = MSHLandscapeFocusRecordFactory.selectedFocus(
            ownerID: member,
            selection: selection,
            createdAt: now,
            updatedAt: now,
            sourceRecordIDs: [MSHCoreRecordIdentity.landscape]
        )

        XCTAssertEqual(record.envelope.recordID, MSHCoreRecordIdentity.selectedFocus)
        XCTAssertEqual(record.envelope.domain, .focus)
        XCTAssertEqual(record.envelope.recordType, "focus.member_selected")
        XCTAssertEqual(record.envelope.provenance, .userStated)
        XCTAssertEqual(record.envelope.authority, .member)
        XCTAssertEqual(record.envelope.sourceRecordIDs, [MSHCoreRecordIdentity.landscape])
        XCTAssertEqual(record.payload.focusID, "sleep")
    }

    func testBlankFocusCannotBecomeAuthoritativeSelection() {
        XCTAssertNil(MSHMemberSelectedFocus(focusID: "   ", selectedAt: Date()))
    }

    func testFocusRecordPathRemainsAccountScoped() throws {
        let first = try XCTUnwrap(MSHMemberID(rawValue: "member-a"))
        let second = try XCTUnwrap(MSHMemberID(rawValue: "member-b"))

        XCTAssertNotEqual(
            MSHCoreMemberNamespace.recordPath(MSHCoreRecordIdentity.selectedFocus, memberID: first),
            MSHCoreMemberNamespace.recordPath(MSHCoreRecordIdentity.selectedFocus, memberID: second)
        )
    }

    func testPersistenceBoundaryRejectsCrossAccountOwner() throws {
        let first = try XCTUnwrap(MSHMemberID(rawValue: "member-a"))
        let second = try XCTUnwrap(MSHMemberID(rawValue: "member-b"))

        XCTAssertThrowsError(try MSHCoreFirestoreRepository.requireOwner(first, matches: second)) { error in
            XCTAssertEqual(error as? MSHCorePersistenceError, .ownerMismatch)
        }
    }

    func testPersistenceBoundaryAcceptsMatchingOwner() throws {
        let member = try XCTUnwrap(MSHMemberID(rawValue: "member-a"))
        XCTAssertNoThrow(try MSHCoreFirestoreRepository.requireOwner(member, matches: member))
    }
}
