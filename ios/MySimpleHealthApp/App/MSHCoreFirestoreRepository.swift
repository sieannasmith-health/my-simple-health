import FirebaseFirestore
import Foundation

/// Firestore-backed persistence for typed Core records.
/// Every operation is rooted in the caller-supplied Firebase UID namespace.
/// Domain/UI code supplies stable logical record IDs; this adapter never invents identity.
struct MSHCoreFirestoreRepository: Sendable {
    private let database: Firestore
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init(database: Firestore = Firestore.firestore()) {
        self.database = database
        self.encoder = JSONEncoder()
        self.decoder = JSONDecoder()
        self.encoder.dateEncodingStrategy = .iso8601
        self.decoder.dateDecodingStrategy = .iso8601
    }

    func save<Payload: Codable & Equatable & Sendable>(
        _ record: MSHCoreTypedRecord<Payload>,
        for memberID: MSHMemberID
    ) async throws {
        try Self.requireOwner(record.envelope.ownerID, matches: memberID)
        let data = try encoder.encode(record)
        let object = try Self.jsonObject(from: data)
        try await document(recordID: record.envelope.recordID, memberID: memberID).setData(object, merge: false)
    }

    func load<Payload: Codable & Equatable & Sendable>(
        recordID: String,
        for memberID: MSHMemberID,
        as payloadType: Payload.Type
    ) async throws -> MSHCoreTypedRecord<Payload>? {
        let snapshot = try await document(recordID: recordID, memberID: memberID).getDocument()
        guard snapshot.exists, let object = snapshot.data() else { return nil }
        let data = try JSONSerialization.data(withJSONObject: object)
        let record = try decoder.decode(MSHCoreTypedRecord<Payload>.self, from: data)
        try Self.requireOwner(record.envelope.ownerID, matches: memberID)
        guard record.envelope.recordID == recordID else { throw MSHCorePersistenceError.recordIdentityMismatch }
        return record
    }

    func saveLandscape(
        _ record: MSHCoreTypedRecord<MSHLandscapeAccountState>,
        for memberID: MSHMemberID
    ) async throws {
        guard record.envelope.domain == .landscape,
              record.envelope.recordID == MSHCoreRecordIdentity.landscape else {
            throw MSHCorePersistenceError.recordIdentityMismatch
        }
        try await save(record, for: memberID)
    }

    func loadLandscape(for memberID: MSHMemberID) async throws -> MSHCoreTypedRecord<MSHLandscapeAccountState>? {
        try await load(recordID: MSHCoreRecordIdentity.landscape, for: memberID, as: MSHLandscapeAccountState.self)
    }

    func saveSelectedFocus(
        _ record: MSHCoreTypedRecord<MSHMemberSelectedFocus>,
        for memberID: MSHMemberID
    ) async throws {
        guard record.envelope.domain == .focus,
              record.envelope.recordID == MSHCoreRecordIdentity.selectedFocus,
              record.envelope.authority == .member else {
            throw MSHCorePersistenceError.recordIdentityMismatch
        }
        try await save(record, for: memberID)
    }

    func loadSelectedFocus(for memberID: MSHMemberID) async throws -> MSHCoreTypedRecord<MSHMemberSelectedFocus>? {
        try await load(recordID: MSHCoreRecordIdentity.selectedFocus, for: memberID, as: MSHMemberSelectedFocus.self)
    }

    private func document(recordID: String, memberID: MSHMemberID) -> DocumentReference {
        database
            .collection("users")
            .document(memberID.rawValue)
            .collection("coreRecords")
            .document(recordID)
    }

    static func requireOwner(_ ownerID: MSHMemberID, matches memberID: MSHMemberID) throws {
        guard ownerID == memberID else { throw MSHCorePersistenceError.ownerMismatch }
    }

    static func jsonObject(from data: Data) throws -> [String: Any] {
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw MSHCorePersistenceError.invalidDocument
        }
        return object
    }
}

enum MSHCorePersistenceError: Error, Equatable {
    case ownerMismatch
    case recordIdentityMismatch
    case invalidDocument
}
