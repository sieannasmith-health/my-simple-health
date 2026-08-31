import Foundation
import MSHHealthCore

actor FileHealthStore: HealthRecordRepository, HealthSyncStateRepository {
    private struct StateContents: Codable {
        var states: [String: HealthSyncState] = [:]
    }

    private struct LegacyContents: Codable {
        var records: [String: HealthRecord] = [:]
        var states: [String: HealthSyncState] = [:]
    }

    private let fileManager: FileManager
    private let legacyFileURL: URL
    private let recordJSONFileURL: URL
    private let recordDatabaseURL: URL
    private let stateFileURL: URL
    private var recordStore: SQLiteHealthRecordStore?
    private var stateContents: StateContents

    init(fileManager: FileManager = .default, directoryURL: URL? = nil) {
        self.fileManager = fileManager
        let directory = directoryURL ?? fileManager
            .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("MySimpleHealth/ConnectedHealth", isDirectory: true)
        try? fileManager.createDirectory(
            at: directory,
            withIntermediateDirectories: true,
            attributes: [.protectionKey: FileProtectionType.complete]
        )

        legacyFileURL = directory.appendingPathComponent("health-records.json")
        recordJSONFileURL = directory.appendingPathComponent("health-records-v2.json")
        recordDatabaseURL = directory.appendingPathComponent("health-records-v3.sqlite")
        stateFileURL = directory.appendingPathComponent("health-state.json")
        recordStore = nil

        if let stateData = try? Data(contentsOf: stateFileURL),
           let decoded = try? JSONDecoder.health.decode(StateContents.self, from: stateData) {
            stateContents = decoded
            MSHDebugLifecycle.log(
                "health_state_load_complete",
                "stateBytesRead=\(stateData.count) bulkRecordDecoding=false stateCount=\(decoded.states.count)"
            )
        } else if fileManager.fileExists(atPath: legacyFileURL.path) {
            stateContents = Self.migrateLegacyState(
                from: legacyFileURL,
                to: stateFileURL,
                fileManager: fileManager
            )
        } else {
            stateContents = StateContents()
            MSHDebugLifecycle.log(
                "health_state_load_complete",
                "stateBytesRead=0 bulkRecordDecoding=false stateCount=0"
            )
        }
    }

    func apply(records: [HealthRecord], deletedSourceRecordIDs: Set<String>, provider: HealthProvider) throws {
        try openRecordStore().apply(
            records: records,
            deletedSourceRecordIDs: deletedSourceRecordIDs,
            provider: provider
        )
    }

    func records(provider: HealthProvider) throws -> [HealthRecord] {
        try openRecordStore().records(provider: provider)
    }

    func records(
        provider: HealthProvider,
        areas: Set<HealthDataArea>,
        movementCutoff: Date,
        dateRange: DateInterval? = nil,
        calendarProjectionOnly: Bool = false
    ) throws -> [HealthRecord] {
        try openRecordStore().records(
            provider: provider,
            areas: areas,
            movementCutoff: movementCutoff,
            dateRange: dateRange,
            calendarProjectionOnly: calendarProjectionOnly
        )
    }

    func removeRecords(provider: HealthProvider) throws {
        try openRecordStore().removeRecords(provider: provider)
    }

    func load(provider: HealthProvider) throws -> HealthSyncState {
        stateContents.states[provider.rawValue] ?? HealthSyncState(provider: provider)
    }

    func save(_ state: HealthSyncState) throws {
        stateContents.states[state.provider.rawValue] = state
        try persistState(reason: "save")
    }

    func clear(provider: HealthProvider) throws {
        stateContents.states.removeValue(forKey: provider.rawValue)
        try persistState(reason: "clear")
    }

    func diagnosticFileSize() -> UInt64 {
        if let recordStore { return recordStore.diskSize() }
        if fileManager.fileExists(atPath: recordDatabaseURL.path) {
            return Self.databaseSize(at: recordDatabaseURL, fileManager: fileManager)
        }
        return Self.fileSize(at: activeLegacyRecordURL, fileManager: fileManager)
    }

    func diagnosticStateFileSize() -> UInt64 {
        Self.fileSize(at: stateFileURL, fileManager: fileManager)
    }

    func diagnosticBulkRecordsLoaded() -> Bool {
        false
    }

    func diagnosticLastPersistenceMetrics() -> HealthRecordPersistenceMetrics? {
        recordStore?.lastPersistenceMetrics
    }

    func diagnosticRecordCount() throws -> Int {
        try openRecordStore().recordCount()
    }

    private var activeLegacyRecordURL: URL {
        fileManager.fileExists(atPath: recordJSONFileURL.path) ? recordJSONFileURL : legacyFileURL
    }

    private func openRecordStore() throws -> SQLiteHealthRecordStore {
        if let recordStore { return recordStore }
        let opened = try SQLiteHealthRecordStore(
            databaseURL: recordDatabaseURL,
            migrationSources: [recordJSONFileURL, legacyFileURL],
            fileManager: fileManager
        )
        recordStore = opened
        return opened
    }

    private func persistState(reason: String) throws {
        let stateFileBytesBefore = Self.fileSize(at: stateFileURL, fileManager: fileManager)
        let recordFileBytes = diagnosticFileSize()
        MSHDebugLifecycle.log(
            "health_state_persist_started",
            "reason=\(reason) stateBytesRead=0 stateFileBytesBefore=\(stateFileBytesBefore) recordFileBytes=\(recordFileBytes) bulkRecordDecoding=false bulkRecordsLoaded=false"
        )
        let data = try JSONEncoder.health.encode(stateContents)
        MSHDebugLifecycle.log(
            "health_state_encode_complete",
            "reason=\(reason) stateBytesWritten=\(data.count) bulkRecordDecoding=false"
        )
        try data.write(to: stateFileURL, options: [.atomic, .completeFileProtection])
        MSHDebugLifecycle.log(
            "health_state_persist_complete",
            "reason=\(reason) stateBytesWritten=\(data.count) recordBytesWritten=0 bulkRecordDecoding=false bulkRecordsLoaded=false"
        )
    }

    private static func migrateLegacyState(
        from legacyURL: URL,
        to stateURL: URL,
        fileManager: FileManager
    ) -> StateContents {
        let legacyFileBytes = fileSize(at: legacyURL, fileManager: fileManager)
        MSHDebugLifecycle.log(
            "health_state_migration_started",
            "legacyFileBytes=\(legacyFileBytes) legacyRecordFilePreserved=true bulkRecordDecoding=false"
        )
        do {
            let mapped = try Data(contentsOf: legacyURL, options: [.mappedIfSafe])
            if let stateValue = topLevelValue(named: "states", in: mapped) {
                let states = try JSONDecoder.health.decode([String: HealthSyncState].self, from: stateValue)
                let migrated = StateContents(states: states)
                let encoded = try JSONEncoder.health.encode(migrated)
                try encoded.write(to: stateURL, options: [.atomic, .completeFileProtection])
                MSHDebugLifecycle.log(
                    "health_state_migration_complete",
                    "legacyBytesScanned=\(mapped.count) stateBytesRead=\(stateValue.count) stateBytesWritten=\(encoded.count) stateCount=\(states.count) legacyRecordFilePreserved=true bulkRecordDecoding=false"
                )
                return migrated
            }
            throw CocoaError(.coderReadCorrupt)
        } catch {
            MSHDebugLifecycle.log(
                "health_state_migration_stream_extract_failed",
                "swiftType=\(String(reflecting: type(of: error))) description=\(error.localizedDescription) bulkRecordDecoding=true"
            )
            do {
                let data = try Data(contentsOf: legacyURL)
                let legacy = try JSONDecoder.health.decode(LegacyContents.self, from: data)
                let migrated = StateContents(states: legacy.states)
                let encoded = try JSONEncoder.health.encode(migrated)
                try encoded.write(to: stateURL, options: [.atomic, .completeFileProtection])
                MSHDebugLifecycle.log(
                    "health_state_migration_fallback_complete",
                    "legacyBytesRead=\(data.count) stateBytesWritten=\(encoded.count) stateCount=\(legacy.states.count) legacyRecordFilePreserved=true bulkRecordDecoding=true"
                )
                return migrated
            } catch {
                MSHDebugLifecycle.log(
                    "health_state_migration_failed",
                    "swiftType=\(String(reflecting: type(of: error))) description=\(error.localizedDescription) legacyRecordFilePreserved=true"
                )
                return StateContents()
            }
        }
    }

    private static func topLevelValue(named target: String, in data: Data) -> Data? {
        data.withUnsafeBytes { rawBuffer in
            let bytes = rawBuffer.bindMemory(to: UInt8.self)
            var index = 0

            func skipWhitespace() {
                while index < bytes.count && [9, 10, 13, 32].contains(bytes[index]) { index += 1 }
            }

            func stringEnd(startingAt start: Int) -> Int? {
                guard start < bytes.count, bytes[start] == 34 else { return nil }
                var cursor = start + 1
                var escaped = false
                while cursor < bytes.count {
                    let byte = bytes[cursor]
                    if escaped { escaped = false }
                    else if byte == 92 { escaped = true }
                    else if byte == 34 { return cursor + 1 }
                    cursor += 1
                }
                return nil
            }

            func valueEnd(startingAt start: Int) -> Int? {
                guard start < bytes.count else { return nil }
                if bytes[start] == 34 { return stringEnd(startingAt: start) }
                if bytes[start] == 123 || bytes[start] == 91 {
                    var cursor = start
                    var depth = 0
                    var inString = false
                    var escaped = false
                    while cursor < bytes.count {
                        let byte = bytes[cursor]
                        if inString {
                            if escaped { escaped = false }
                            else if byte == 92 { escaped = true }
                            else if byte == 34 { inString = false }
                        } else if byte == 34 {
                            inString = true
                        } else if byte == 123 || byte == 91 {
                            depth += 1
                        } else if byte == 125 || byte == 93 {
                            depth -= 1
                            if depth == 0 { return cursor + 1 }
                        }
                        cursor += 1
                    }
                    return nil
                }
                var cursor = start
                while cursor < bytes.count && bytes[cursor] != 44 && bytes[cursor] != 125 { cursor += 1 }
                while cursor > start && [9, 10, 13, 32].contains(bytes[cursor - 1]) { cursor -= 1 }
                return cursor
            }

            skipWhitespace()
            guard index < bytes.count, bytes[index] == 123 else { return nil }
            index += 1
            while index < bytes.count {
                skipWhitespace()
                if index < bytes.count, bytes[index] == 125 { return nil }
                let keyStart = index
                guard let keyEnd = stringEnd(startingAt: keyStart) else { return nil }
                let keyData = Data(bytes: bytes.baseAddress!.advanced(by: keyStart), count: keyEnd - keyStart)
                guard let key = try? JSONDecoder().decode(String.self, from: keyData) else { return nil }
                index = keyEnd
                skipWhitespace()
                guard index < bytes.count, bytes[index] == 58 else { return nil }
                index += 1
                skipWhitespace()
                let start = index
                guard let end = valueEnd(startingAt: start) else { return nil }
                if key == target {
                    return Data(bytes: bytes.baseAddress!.advanced(by: start), count: end - start)
                }
                index = end
                skipWhitespace()
                if index < bytes.count, bytes[index] == 44 { index += 1; continue }
                if index < bytes.count, bytes[index] == 125 { return nil }
                return nil
            }
            return nil
        }
    }

    private static func fileSize(at url: URL, fileManager: FileManager) -> UInt64 {
        let attributes = try? fileManager.attributesOfItem(atPath: url.path)
        return (attributes?[.size] as? NSNumber)?.uint64Value ?? 0
    }

    private static func databaseSize(at url: URL, fileManager: FileManager) -> UInt64 {
        fileSize(at: url, fileManager: fileManager)
            + fileSize(at: URL(fileURLWithPath: url.path + "-wal"), fileManager: fileManager)
    }
}

extension JSONEncoder {
    static var health: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }
}

extension JSONDecoder {
    static var health: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
