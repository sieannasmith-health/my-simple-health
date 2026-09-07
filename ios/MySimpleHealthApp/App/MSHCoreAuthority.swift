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

/// Versioned account-backed envelope. Domain payloads deliberately remain outside this envelope.
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
         lifecycleStatus: MSHCoreLifecycleStatus = .active,
         sourceRecordIDs: [String] = [], createdAt: Date, updatedAt: Date,
         deletedAt: Date? = nil, schemaVersion: String = Self.schemaVersion) {
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
    func updateLifecycle(recordID: String, for memberID: MSHMemberID,
                         to lifecycleStatus: MSHCoreLifecycleStatus,
                         updatedAt: Date, deletedAt: Date?) async throws
}

typealias MSHCoreRecordRepository = MSHCoreRecordReading & MSHCoreRecordWriting

protocol MSHCoreDomainService: Sendable {
    associatedtype Snapshot: Sendable
    func currentSnapshot(for memberID: MSHMemberID) async throws -> Snapshot
}

/// The single semantic record used by B.2. Its ID is independent of timestamps,
/// device state, or local installation, so retries cannot create duplicates.
enum MSHOnboardingContinuity {
    static let recordID = "onboarding-continuity-v1"
    static let recordType = "onboarding.completion"

    static func completedRecord(for memberID: MSHMemberID, at date: Date) -> MSHCoreRecordEnvelope {
        MSHCoreRecordEnvelope(recordID: recordID, ownerID: memberID,
                              domain: .onboarding, recordType: recordType,
                              provenance: .userConfirmed, authority: .member,
                              createdAt: date, updatedAt: date)
    }
}

enum MSHOnboardingContinuityError: Error, Equatable {
    case unauthorized
    case conflictingRecord
}

/// Persistence-neutral repository implementation used by the domain and by tests.
/// A Firebase adapter can implement the same protocol using the exact namespace above.
/// Every operation validates both the requested UID and the envelope owner.
actor MSHInMemoryCoreRecordRepository: MSHCoreRecordRepository {
    private var recordsByPath: [String: MSHCoreRecordEnvelope] = [:]

    func records(for memberID: MSHMemberID, domain: MSHCoreDomain?) async throws -> [MSHCoreRecordEnvelope] {
        recordsByPath.values.filter { record in
            record.ownerID == memberID && (domain == nil || record.domain == domain)
        }
    }

    func create(_ record: MSHCoreRecordEnvelope, for memberID: MSHMemberID) async throws {
        guard record.ownerID == memberID else { throw MSHOnboardingContinuityError.unauthorized }
        let path = MSHCoreMemberNamespace.recordPath(record.recordID, memberID: memberID)
        if let existing = recordsByPath[path] {
            guard existing == record else { throw MSHOnboardingContinuityError.conflictingRecord }
            return
        }
        recordsByPath[path] = record
    }

    func updateLifecycle(recordID: String, for memberID: MSHMemberID,
                         to lifecycleStatus: MSHCoreLifecycleStatus,
                         updatedAt: Date, deletedAt: Date?) async throws {
        let path = MSHCoreMemberNamespace.recordPath(recordID, memberID: memberID)
        guard var record = recordsByPath[path], record.ownerID == memberID else {
            throw MSHOnboardingContinuityError.unauthorized
        }
        record = MSHCoreRecordEnvelope(recordID: record.recordID, ownerID: record.ownerID,
                                       domain: record.domain, recordType: record.recordType,
                                       provenance: record.provenance, authority: record.authority,
                                       lifecycleStatus: lifecycleStatus,
                                       sourceRecordIDs: record.sourceRecordIDs,
                                       createdAt: record.createdAt, updatedAt: updatedAt,
                                       deletedAt: deletedAt, schemaVersion: record.schemaVersion)
        recordsByPath[path] = record
    }
}

/// Migration is deliberately non-destructive: local completion is written first,
/// then account state is verified. A repository failure never clears local state.
struct MSHOnboardingContinuityService: Sendable {
    let repository: any MSHCoreRecordRepository

    init(repository: any MSHCoreRecordRepository) { self.repository = repository }

    func restoreOrMigrate(memberID: MSHMemberID, localCompleted: Bool, now: Date = Date()) async throws -> Bool {
        let existing = try await repository.records(for: memberID, domain: .onboarding)
        if existing.contains(where: { $0.recordID == MSHOnboardingContinuity.recordID && $0.lifecycleStatus == .active }) {
            return true
        }
        guard localCompleted else { return false }
        let record = MSHOnboardingContinuity.completedRecord(for: memberID, at: now)
        try await repository.create(record, for: memberID)
        let verified = try await repository.records(for: memberID, domain: .onboarding)
        return verified.contains { $0.recordID == record.recordID && $0.lifecycleStatus == .active }
    }
}
