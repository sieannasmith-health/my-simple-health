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

/// Versioned account-backed envelope shared by Core domain records.
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

/// Stable identities for the single current Landscape state and explicit selected Focus.
/// A retry overwrites the same logical record rather than creating duplicate snapshots.
enum MSHCoreRecordIdentity {
    static let landscape = "landscape.current"
    static let selectedFocus = "focus.selected"
}

/// Canonical Health Landscape identifiers from MSH Product Data Standard V1.
enum MSHLandscapeInstrument {
    static let instrumentID = "health_landscape"
    static let instrumentVersion = "HL-1"
    static let experienceVersion = "HEALTH-LANDSCAPE-V1"
}

/// Account-backed Landscape payload for partial resume and completed-result continuity.
/// Member responses remain authored values; synthesis belongs in a separate derived record.
struct MSHLandscapeAccountState: Codable, Equatable, Sendable {
    let administrationID: String
    let instrumentID: String
    let instrumentVersion: String
    let experienceVersion: String
    let responses: [String: String]
    let completedItemIDs: [String]
    let dimensionContexts: [String: String]
    let isComplete: Bool

    init(
        administrationID: String,
        responses: [String: String] = [:],
        completedItemIDs: [String] = [],
        dimensionContexts: [String: String] = [:],
        isComplete: Bool = false,
        instrumentID: String = MSHLandscapeInstrument.instrumentID,
        instrumentVersion: String = MSHLandscapeInstrument.instrumentVersion,
        experienceVersion: String = MSHLandscapeInstrument.experienceVersion
    ) {
        self.administrationID = administrationID
        self.instrumentID = instrumentID
        self.instrumentVersion = instrumentVersion
        self.experienceVersion = experienceVersion
        self.responses = responses
        self.completedItemIDs = completedItemIDs
        self.dimensionContexts = dimensionContexts
        self.isComplete = isComplete
    }
}

/// Only an explicit member choice may inhabit this authoritative record.
/// Recommended/model-generated Focus values must stay outside this type until selected.
struct MSHMemberSelectedFocus: Codable, Equatable, Sendable {
    let focusID: String
    let selectedAt: Date

    init?(focusID: String, selectedAt: Date) {
        let value = focusID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return nil }
        self.focusID = value
        self.selectedAt = selectedAt
    }
}

/// Typed Core record keeps domain payload attached to its authority/provenance envelope.
struct MSHCoreTypedRecord<Payload: Codable & Equatable & Sendable>: Codable, Equatable, Sendable {
    let envelope: MSHCoreRecordEnvelope
    let payload: Payload
}

enum MSHLandscapeFocusRecordFactory {
    static func landscape(
        ownerID: MSHMemberID,
        state: MSHLandscapeAccountState,
        createdAt: Date,
        updatedAt: Date,
        sourceRecordIDs: [String] = []
    ) -> MSHCoreTypedRecord<MSHLandscapeAccountState> {
        MSHCoreTypedRecord(
            envelope: MSHCoreRecordEnvelope(
                recordID: MSHCoreRecordIdentity.landscape,
                ownerID: ownerID,
                domain: .landscape,
                recordType: "assessment.health_landscape.state",
                provenance: .userStated,
                authority: .member,
                sourceRecordIDs: sourceRecordIDs,
                createdAt: createdAt,
                updatedAt: updatedAt
            ),
            payload: state
        )
    }

    static func selectedFocus(
        ownerID: MSHMemberID,
        selection: MSHMemberSelectedFocus,
        createdAt: Date,
        updatedAt: Date,
        sourceRecordIDs: [String] = []
    ) -> MSHCoreTypedRecord<MSHMemberSelectedFocus> {
        MSHCoreTypedRecord(
            envelope: MSHCoreRecordEnvelope(
                recordID: MSHCoreRecordIdentity.selectedFocus,
                ownerID: ownerID,
                domain: .focus,
                recordType: "focus.member_selected",
                provenance: .userStated,
                authority: .member,
                sourceRecordIDs: sourceRecordIDs,
                createdAt: createdAt,
                updatedAt: updatedAt
            ),
            payload: selection
        )
    }
}

/// Canonical Firestore namespace for synchronized Core records.
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
