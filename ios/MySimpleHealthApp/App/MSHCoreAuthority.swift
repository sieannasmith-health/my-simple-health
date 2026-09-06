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

/// Versioned account-backed envelope. B.1 defines the contract only; no Core domain is migrated yet.
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

    init(
        recordID: String,
        ownerID: MSHMemberID,
        domain: MSHCoreDomain,
        recordType: String,
        provenance: MSHCoreProvenance,
        authority: MSHCoreAuthority,
        lifecycleStatus: MSHCoreLifecycleStatus = .active,
        sourceRecordIDs: [String] = [],
        createdAt: Date,
        updatedAt: Date,
        deletedAt: Date? = nil,
        schemaVersion: String = Self.schemaVersion
    ) {
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

/// Canonical Firestore namespace for synchronized Core records.
/// Member journey domains will migrate here in later gated slices.
enum MSHCoreMemberNamespace {
    static func memberPath(_ memberID: MSHMemberID) -> String {
        "users/\(memberID.rawValue)"
    }

    static func recordsPath(_ memberID: MSHMemberID) -> String {
        "\(memberPath(memberID))/coreRecords"
    }

    static func recordPath(_ recordID: String, memberID: MSHMemberID) -> String {
        "\(recordsPath(memberID))/\(recordID)"
    }
}

/// Read boundary for account-backed Core records. Implementations must scope every operation to memberID.
protocol MSHCoreRecordReading: Sendable {
    func records(for memberID: MSHMemberID, domain: MSHCoreDomain?) async throws -> [MSHCoreRecordEnvelope]
}

/// Write boundary for account-backed Core records. Stable record IDs are supplied by the domain layer.
protocol MSHCoreRecordWriting: Sendable {
    func create(_ record: MSHCoreRecordEnvelope, for memberID: MSHMemberID) async throws
    func updateLifecycle(
        recordID: String,
        for memberID: MSHMemberID,
        to lifecycleStatus: MSHCoreLifecycleStatus,
        updatedAt: Date,
        deletedAt: Date?
    ) async throws
}

typealias MSHCoreRecordRepository = MSHCoreRecordReading & MSHCoreRecordWriting

/// Domain operations sit above persistence so SwiftUI and WebKit surfaces do not become authorities.
protocol MSHCoreDomainService: Sendable {
    associatedtype Snapshot: Sendable
    func currentSnapshot(for memberID: MSHMemberID) async throws -> Snapshot
}
