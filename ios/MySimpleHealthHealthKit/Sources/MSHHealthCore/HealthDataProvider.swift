import Foundation

public enum HealthProviderAvailability: String, Codable, Sendable {
    case available
    case unavailable
}

public enum HealthAuthorizationOutcome: String, Codable, Sendable {
    case completed
    case failed
}

public struct HealthAuthorizationResult: Codable, Equatable, Sendable {
    public let outcome: HealthAuthorizationOutcome
    public let requestedAreas: Set<HealthDataArea>
    public let message: String?

    public init(outcome: HealthAuthorizationOutcome, requestedAreas: Set<HealthDataArea>, message: String? = nil) {
        self.outcome = outcome
        self.requestedAreas = requestedAreas
        self.message = message
    }
}

public struct HealthSyncRequest: Sendable {
    public let areas: Set<HealthDataArea>
    public let checkpoints: [String: Data]
    public let lastSuccessfulSyncAt: Date?

    public init(areas: Set<HealthDataArea>, checkpoints: [String: Data], lastSuccessfulSyncAt: Date?) {
        self.areas = areas
        self.checkpoints = checkpoints
        self.lastSuccessfulSyncAt = lastSuccessfulSyncAt
    }
}

public struct HealthSyncBatch: Sendable {
    public let records: [HealthRecord]
    public let deletedSourceRecordIDs: Set<String>
    public let checkpoints: [String: Data]
    public let completedAt: Date
    public let partialFailures: [String]
    public let requiresContinuation: Bool

    public init(
        records: [HealthRecord],
        deletedSourceRecordIDs: Set<String> = [],
        checkpoints: [String: Data] = [:],
        completedAt: Date = Date(),
        partialFailures: [String] = [],
        requiresContinuation: Bool = false
    ) {
        self.records = records
        self.deletedSourceRecordIDs = deletedSourceRecordIDs
        self.checkpoints = checkpoints
        self.completedAt = completedAt
        self.partialFailures = partialFailures
        self.requiresContinuation = requiresContinuation
    }
}

public protocol HealthDataProvider: Sendable {
    var provider: HealthProvider { get }
    func availability() -> HealthProviderAvailability
    func requestAuthorization(for areas: Set<HealthDataArea>) async -> HealthAuthorizationResult
    func sync(_ request: HealthSyncRequest) async throws -> HealthSyncBatch
    func disconnect() async
}

public protocol HealthRecordRepository: Sendable {
    func apply(records: [HealthRecord], deletedSourceRecordIDs: Set<String>, provider: HealthProvider) async throws
    func records(provider: HealthProvider) async throws -> [HealthRecord]
    func removeRecords(provider: HealthProvider) async throws
}

public struct HealthSyncState: Codable, Equatable, Sendable {
    public let provider: HealthProvider
    public var selectedAreas: Set<HealthDataArea>
    public var checkpoints: [String: Data]
    public var lastSuccessfulSyncAt: Date?
    public var lastAttemptedSyncAt: Date?
    public var partialFailures: [String]

    public init(
        provider: HealthProvider,
        selectedAreas: Set<HealthDataArea> = [],
        checkpoints: [String: Data] = [:],
        lastSuccessfulSyncAt: Date? = nil,
        lastAttemptedSyncAt: Date? = nil,
        partialFailures: [String] = []
    ) {
        self.provider = provider
        self.selectedAreas = selectedAreas
        self.checkpoints = checkpoints
        self.lastSuccessfulSyncAt = lastSuccessfulSyncAt
        self.lastAttemptedSyncAt = lastAttemptedSyncAt
        self.partialFailures = partialFailures
    }
}

public protocol HealthSyncStateRepository: Sendable {
    func load(provider: HealthProvider) async throws -> HealthSyncState
    func save(_ state: HealthSyncState) async throws
    func clear(provider: HealthProvider) async throws
}
