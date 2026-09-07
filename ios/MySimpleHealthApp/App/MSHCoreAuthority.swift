import Foundation
import FirebaseFirestore

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
        self.recordID = recordID; self.ownerID = ownerID; self.domain = domain
        self.recordType = recordType; self.schemaVersion = schemaVersion
        self.provenance = provenance; self.authority = authority
        self.lifecycleStatus = lifecycleStatus; self.sourceRecordIDs = sourceRecordIDs
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.deletedAt = deletedAt
    }
}

enum MSHCoreMemberNamespace {
    static func memberPath(_ memberID: MSHMemberID) -> String { "users/\(memberID.rawValue)" }
    static func recordsPath(_ memberID: MSHMemberID) -> String { "\(memberPath(memberID))/coreRecords" }
    static func recordPath(_ recordID: String, memberID: MSHMemberID) -> String {
        "\(recordsPath(memberID))/\(recordID)"
    }
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

enum MSHCoreRepositoryError: Error, Equatable {
    case unauthorized
    case ownerMismatch
}

/// Firestore implementation of the B.1 record boundary. Every operation is bound to
/// the authenticated UID supplied at construction; callers cannot select another owner.
actor MSHFirestoreCoreRecordRepository: MSHCoreRecordRepository {
    private let database: Firestore
    private let authenticatedMemberID: MSHMemberID

    init(database: Firestore = .firestore(), authenticatedMemberID: MSHMemberID) {
        self.database = database
        self.authenticatedMemberID = authenticatedMemberID
    }

    private func verify(_ memberID: MSHMemberID) throws {
        guard memberID == authenticatedMemberID else { throw MSHCoreRepositoryError.unauthorized }
    }

    func records(for memberID: MSHMemberID, domain: MSHCoreDomain? = nil) async throws -> [MSHCoreRecordEnvelope] {
        try verify(memberID)
        var query: Query = database.collection(MSHCoreMemberNamespace.recordsPath(memberID))
        if let domain { query = query.whereField("domain", isEqualTo: domain.rawValue) }
        let snapshot = try await query.getDocuments()
        return try snapshot.documents.map { try $0.data(as: MSHCoreRecordEnvelope.self) }
    }

    func create(_ record: MSHCoreRecordEnvelope, for memberID: MSHMemberID) async throws {
        try verify(memberID)
        guard record.ownerID == memberID else { throw MSHCoreRepositoryError.ownerMismatch }
        try await database.document(MSHCoreMemberNamespace.recordPath(record.recordID, memberID: memberID))
            .setData(from: record, merge: false)
    }

    func updateLifecycle(recordID: String, for memberID: MSHMemberID,
                         to lifecycleStatus: MSHCoreLifecycleStatus,
                         updatedAt: Date, deletedAt: Date?) async throws {
        try verify(memberID)
        var values: [String: Any] = [
            "lifecycleStatus": lifecycleStatus.rawValue,
            "updatedAt": Timestamp(date: updatedAt)
        ]
        values["deletedAt"] = deletedAt.map { Timestamp(date: $0) } ?? NSNull()
        try await database.document(MSHCoreMemberNamespace.recordPath(recordID, memberID: memberID))
            .updateData(values)
    }
}

struct MSHOnboardingContinuityRecord: Codable, Equatable, Sendable {
    static let recordID = "onboarding-continuity-v1"
    static let recordType = "onboarding_continuity"

    let envelope: MSHCoreRecordEnvelope
    let completed: Bool
    let completedAt: Date?

    init(ownerID: MSHMemberID, completed: Bool, completedAt: Date?, now: Date = Date()) {
        self.envelope = MSHCoreRecordEnvelope(
            recordID: Self.recordID, ownerID: ownerID, domain: .onboarding,
            recordType: Self.recordType, provenance: .userConfirmed, authority: .member,
            createdAt: now, updatedAt: now)
        self.completed = completed
        self.completedAt = completedAt
    }
}

/// Narrow onboarding service. The record contains completion only; OS permission choices
/// remain local and are never promoted to Core authority.
struct MSHOnboardingContinuityService: Sendable {
    let repository: MSHCoreRecordRepository

    func restore(for memberID: MSHMemberID) async throws -> MSHOnboardingContinuityRecord? {
        let records = try await repository.records(for: memberID, domain: .onboarding)
        guard let envelope = records.first(where: { $0.recordID == MSHOnboardingContinuityRecord.recordID }) else {
            return nil
        }
        return MSHOnboardingContinuityRecord(envelope: envelope)
    }

    func migrateIfNeeded(ownerID: MSHMemberID, localCompleted: Bool, now: Date = Date()) async throws {
        guard localCompleted else { return }
        if try await restore(for: ownerID) != nil { return }
        try await repository.create(
            MSHOnboardingContinuityRecord(ownerID: ownerID, completed: true, completedAt: now, now: now).envelope,
            for: ownerID)
    }
}

private extension MSHOnboardingContinuityRecord {
    init(envelope: MSHCoreRecordEnvelope) {
        self.envelope = envelope
        self.completed = true
        self.completedAt = envelope.updatedAt
    }
}