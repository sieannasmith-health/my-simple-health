import Foundation

/// Canonical member identity for Core MSH v1. The raw value is always a Firebase Auth UID.
struct MSHMemberID: RawRepresentable, Codable, Hashable, Sendable {
    let rawValue: String

    init?(rawValue: String) {
        let value = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return nil }
        self.rawValue = value
    }
}

enum MSHCoreDomain: String, Codable, CaseIterable, Sendable {
    case onboarding
    case landscape
    case focus
    case vision
    case project
    case practice
    case reflection
    case learning
    case progress
    case returnPoint = "return_point"
}

enum MSHCoreProvenance: String, Codable, CaseIterable, Sendable {
    case userStated = "USER_STATED"
    case userConfirmed = "USER_CONFIRMED"
    case systemObserved = "SYSTEM_OBSERVED"
    case modelInferred = "MODEL_INFERRED"
}

enum MSHCoreAuthority: String, Codable, CaseIterable, Sendable {
    case member
    case externalSource = "external_source"
    case systemDerived = "system_derived"
    case modelInference = "model_inference"
}

enum MSHCoreLifecycleStatus: String, Codable, CaseIterable, Sendable {
    case active = "ACTIVE"
    case amended = "AMENDED"
    case superseded = "SUPERSEDED"
    case deleted = "DELETED"
}

struct MSHCoreRecordEnvelope: Codable, Equatable, Sendable {
    static let schemaVersion = "1.0.0"

    let recordID: String
    let ownerID: MSHMemberID
    let domain: MSHCoreDomain
    let recordType: String
    let schemaVersion: String
    let provenance: MSHCoreProvenance
    let authority: MSHCoreAuthority
    let lifecycleStatus: MSHCoreLifecycleStatus
    let sourceRecordIDs: [String]
    let createdAt: Date
    let updatedAt: Date
    let deletedAt: Date?

    init(recordID: String, ownerID: MSHMemberID, domain: MSHCoreDomain, recordType: String,
         provenance: MSHCoreProvenance, authority: MSHCoreAuthority,
         lifecycleStatus: MSHCoreLifecycleStatus = .active, sourceRecordIDs: [String] = [],
         createdAt: Date, updatedAt: Date, deletedAt: Date? = nil,
         schemaVersion: String = Self.schemaVersion) {
        self.recordID = recordID
        self.ownerID = ownerID
        self.domain = domain
        self.recordType = recordType
        self.schemaVersion = schemaVersion
        self.provenance = provenance
        self.authority = authority
        self.lifecycleStatus = lifecycleStatus
        self.sourceRecordIDs = sourceRecordIDs
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.deletedAt = deletedAt
    }
}

enum MSHCoreMemberNamespace {
    static func memberPath(_ memberID: MSHMemberID) -> String { "users/\(memberID.rawValue)" }
    static func recordsPath(_ memberID: MSHMemberID) -> String { "\(memberPath(memberID))/coreRecords" }
    static func recordPath(_ recordID: String, memberID: MSHMemberID) -> String { "\(recordsPath(memberID))/\(recordID)" }
}

protocol MSHCoreRecordReading: Sendable {
    func records(for memberID: MSHMemberID, domain: MSHCoreDomain?) async throws -> [MSHCoreRecordEnvelope]
}

protocol MSHCoreRecordWriting: Sendable {
    func create(_ record: MSHCoreRecordEnvelope, for memberID: MSHMemberID) async throws
    func updateLifecycle(recordID: String, for memberID: MSHMemberID, to lifecycleStatus: MSHCoreLifecycleStatus,
                         updatedAt: Date, deletedAt: Date?) async throws
}

typealias MSHCoreRecordRepository = MSHCoreRecordReading & MSHCoreRecordWriting

protocol MSHCoreDomainService: Sendable {
    associatedtype Snapshot: Sendable
    func currentSnapshot(for memberID: MSHMemberID) async throws -> Snapshot
}

/// Deterministic repository implementation used by the onboarding domain and by tests.
/// A production Firestore adapter can implement the same B.1 protocol without changing domain logic.
actor MSHInMemoryCoreRecordRepository: MSHCoreRecordRepository {
    enum Error: Swift.Error { case unauthorized, duplicate, notFound }
    private var recordsByPath: [String: MSHCoreRecordEnvelope] = [:]

    func records(for memberID: MSHMemberID, domain: MSHCoreDomain?) async throws -> [MSHCoreRecordEnvelope] {
        recordsByPath.values.filter { $0.ownerID == memberID && (domain == nil || $0.domain == domain) }
    }

    func create(_ record: MSHCoreRecordEnvelope, for memberID: MSHMemberID) async throws {
        guard record.ownerID == memberID else { throw Error.unauthorized }
        let path = MSHCoreMemberNamespace.recordPath(record.recordID, memberID: memberID)
        guard recordsByPath[path] == nil else { throw Error.duplicate }
        recordsByPath[path] = record
    }

    func updateLifecycle(recordID: String, for memberID: MSHMemberID, to lifecycleStatus: MSHCoreLifecycleStatus,
                         updatedAt: Date, deletedAt: Date?) async throws {
        let path = MSHCoreMemberNamespace.recordPath(recordID, memberID: memberID)
        guard var record = recordsByPath[path], record.ownerID == memberID else { throw Error.notFound }
        record = MSHCoreRecordEnvelope(recordID: record.recordID, ownerID: record.ownerID, domain: record.domain,
                                       recordType: record.recordType, provenance: record.provenance,
                                       authority: record.authority, lifecycleStatus: lifecycleStatus,
                                       sourceRecordIDs: record.sourceRecordIDs, createdAt: record.createdAt,
                                       updatedAt: updatedAt, deletedAt: deletedAt)
        recordsByPath[path] = record
    }
}
