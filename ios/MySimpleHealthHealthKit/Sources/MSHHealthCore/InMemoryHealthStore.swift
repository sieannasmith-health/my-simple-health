import Foundation

public actor InMemoryHealthRecordRepository: HealthRecordRepository {
    private var storage: [String: HealthRecord] = [:]

    public init() {}

    public func apply(records: [HealthRecord], deletedSourceRecordIDs: Set<String>, provider: HealthProvider) async throws {
        for record in records where record.source.provider == provider {
            storage[record.deduplicationKey] = record
        }
        let deletedKeys = storage.compactMap { key, value in
            value.source.provider == provider && deletedSourceRecordIDs.contains(value.source.sourceRecordID) ? key : nil
        }
        deletedKeys.forEach { storage.removeValue(forKey: $0) }
    }

    public func records(provider: HealthProvider) async throws -> [HealthRecord] {
        storage.values.filter { $0.source.provider == provider }.sorted { $0.eventStart < $1.eventStart }
    }

    public func removeRecords(provider: HealthProvider) async throws {
        storage = storage.filter { $0.value.source.provider != provider }
    }
}

public actor InMemoryHealthSyncStateRepository: HealthSyncStateRepository {
    private var storage: [HealthProvider: HealthSyncState] = [:]

    public init() {}

    public func load(provider: HealthProvider) async throws -> HealthSyncState {
        storage[provider] ?? HealthSyncState(provider: provider)
    }

    public func save(_ state: HealthSyncState) async throws {
        storage[state.provider] = state
    }

    public func clear(provider: HealthProvider) async throws {
        storage.removeValue(forKey: provider)
    }
}
