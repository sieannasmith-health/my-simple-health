import Darwin
import Foundation
import MSHHealthCore
import SQLite3

struct HealthRecordPersistenceMetrics: Equatable {
    let recordBytesBefore: UInt64
    let recordBytesAfter: UInt64
    let bytesWritten: UInt64
    let residentBytesBefore: UInt64
    let residentBytesAfter: UInt64
    let peakResidentBytes: UInt64
    let batchRecordCount: Int
    let decodedBulkRecordCollection: Bool
}

private enum SQLiteHealthRecordStoreError: LocalizedError {
    case sqlite(message: String)
    case corruptLegacyStore

    var errorDescription: String? {
        switch self {
        case .sqlite(let message): message
        case .corruptLegacyStore: "The existing HealthKit record store could not be read safely."
        }
    }
}

/// Device-local, incremental storage for imported HealthKit records.
///
/// The database stores each record independently so applying a sync batch never
/// requires decoding or encoding records that are already on disk.
final class SQLiteHealthRecordStore {
    private enum Binding {
        case text(String)
        case double(Double)
    }

    private static let schema = """
        CREATE TABLE IF NOT EXISTS health_records (
            deduplication_key TEXT PRIMARY KEY NOT NULL,
            provider TEXT NOT NULL,
            source_record_id TEXT NOT NULL,
            domain TEXT NOT NULL,
            record_type TEXT NOT NULL,
            event_start REAL NOT NULL,
            lifecycle_status TEXT NOT NULL,
            is_daily_summary INTEGER NOT NULL,
            payload BLOB NOT NULL
        ) WITHOUT ROWID;
        CREATE INDEX IF NOT EXISTS health_records_provider_date
            ON health_records(provider, lifecycle_status, event_start DESC);
        CREATE INDEX IF NOT EXISTS health_records_provider_source
            ON health_records(provider, source_record_id);
        CREATE INDEX IF NOT EXISTS health_records_calendar
            ON health_records(provider, domain, record_type, event_start DESC);
        """

    private static let upsertSQL = """
        INSERT INTO health_records (
            deduplication_key, provider, source_record_id, domain, record_type,
            event_start, lifecycle_status, is_daily_summary, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(deduplication_key) DO UPDATE SET
            provider = excluded.provider,
            source_record_id = excluded.source_record_id,
            domain = excluded.domain,
            record_type = excluded.record_type,
            event_start = excluded.event_start,
            lifecycle_status = excluded.lifecycle_status,
            is_daily_summary = excluded.is_daily_summary,
            payload = excluded.payload;
        """

    private static let migrationSchema = """
        CREATE TABLE IF NOT EXISTS migration_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            source_name TEXT NOT NULL,
            source_size INTEGER NOT NULL,
            next_offset INTEGER NOT NULL,
            imported_count INTEGER NOT NULL
        );
        """

    private let databaseURL: URL
    private let fileManager: FileManager
    private var database: OpaquePointer?
    private(set) var lastPersistenceMetrics: HealthRecordPersistenceMetrics?

    init(databaseURL: URL, migrationSources: [URL], fileManager: FileManager) throws {
        self.databaseURL = databaseURL
        self.fileManager = fileManager

        if !fileManager.fileExists(atPath: databaseURL.path) {
            if let source = migrationSources.first(where: { fileManager.fileExists(atPath: $0.path) }) {
                try migrateJSONStore(from: source)
            } else {
                let connection = try Self.openDatabase(at: databaseURL)
                do {
                    try Self.configure(connection)
                    try Self.execute(Self.schema, on: connection)
                    Self.close(connection)
                } catch {
                    Self.close(connection)
                    throw error
                }
                try protectDatabaseFiles()
            }
        }

        database = try Self.openDatabase(at: databaseURL)
        guard let database else { throw SQLiteHealthRecordStoreError.sqlite(message: "Database did not open.") }
        try Self.configure(database)
        try Self.execute(Self.schema, on: database)
    }

    deinit {
        if let database { Self.close(database) }
    }

    func apply(records: [HealthRecord], deletedSourceRecordIDs: Set<String>, provider: HealthProvider) throws {
        guard let database else { throw SQLiteHealthRecordStoreError.sqlite(message: "Database is closed.") }
        let bytesBefore = diskSize()
        let residentBefore = Self.residentMemoryBytes()
        Self.resetDatabaseWriteCount(database)
        MSHDebugLifecycle.log(
            "health_store_apply_started",
            "recordCount=\(records.count) deletedCount=\(deletedSourceRecordIDs.count) recordBytesBefore=\(bytesBefore) residentBytesBefore=\(residentBefore) bulkRecordDecoding=false"
        )

        try Self.execute("BEGIN IMMEDIATE TRANSACTION", on: database)
        do {
            let statement = try Self.prepare(Self.upsertSQL, on: database)
            defer { sqlite3_finalize(statement) }
            for record in records {
                try autoreleasepool {
                    try Self.bind(record: record, to: statement, database: database)
                    guard sqlite3_step(statement) == SQLITE_DONE else {
                        throw Self.sqliteError(database)
                    }
                    sqlite3_reset(statement)
                    sqlite3_clear_bindings(statement)
                }
            }

            if !deletedSourceRecordIDs.isEmpty {
                let delete = try Self.prepare(
                    "DELETE FROM health_records WHERE provider = ? AND source_record_id = ?",
                    on: database
                )
                defer { sqlite3_finalize(delete) }
                for sourceRecordID in deletedSourceRecordIDs {
                    try Self.bindText(provider.rawValue, index: 1, statement: delete, database: database)
                    try Self.bindText(sourceRecordID, index: 2, statement: delete, database: database)
                    guard sqlite3_step(delete) == SQLITE_DONE else { throw Self.sqliteError(database) }
                    sqlite3_reset(delete)
                    sqlite3_clear_bindings(delete)
                }
            }
            try Self.execute("COMMIT", on: database)
        } catch {
            try? Self.execute("ROLLBACK", on: database)
            throw error
        }

        try protectDatabaseFiles()
        let bytesAfter = diskSize()
        let residentAfter = Self.residentMemoryBytes()
        let bytesWritten = Self.databaseBytesWritten(database)
        let metrics = HealthRecordPersistenceMetrics(
            recordBytesBefore: bytesBefore,
            recordBytesAfter: bytesAfter,
            bytesWritten: bytesWritten,
            residentBytesBefore: residentBefore,
            residentBytesAfter: residentAfter,
            peakResidentBytes: Self.peakResidentMemoryBytes(),
            batchRecordCount: records.count,
            decodedBulkRecordCollection: false
        )
        lastPersistenceMetrics = metrics
        MSHDebugLifecycle.log(
            "health_store_apply_complete",
            "recordCount=\(records.count) recordBytesAfter=\(metrics.recordBytesAfter) databaseBytesWritten=\(metrics.bytesWritten) residentBytesAfter=\(metrics.residentBytesAfter) peakResidentBytes=\(metrics.peakResidentBytes) bulkRecordDecoding=false"
        )
    }

    func records(provider: HealthProvider) throws -> [HealthRecord] {
        try query(
            sql: """
                SELECT payload FROM health_records
                WHERE provider = ? AND lifecycle_status = ?
                ORDER BY event_start DESC
                """,
            bindings: [.text(provider.rawValue), .text(HealthRecordLifecycle.active.rawValue)]
        )
    }

    func records(
        provider: HealthProvider,
        areas: Set<HealthDataArea>,
        movementCutoff: Date,
        dateRange: DateInterval?,
        calendarProjectionOnly: Bool
    ) throws -> [HealthRecord] {
        guard !areas.isEmpty else { return [] }
        var clauses = ["provider = ?", "lifecycle_status = ?"]
        var bindings: [Binding] = [.text(provider.rawValue), .text(HealthRecordLifecycle.active.rawValue)]

        if let dateRange {
            clauses.append("event_start >= ? AND event_start < ?")
            bindings.append(.double(dateRange.start.timeIntervalSince1970))
            bindings.append(.double(dateRange.end.timeIntervalSince1970))
        }

        let domains = Set(areas.map(Self.domain(for:))).sorted { $0.rawValue < $1.rawValue }
        clauses.append("domain IN (\(Array(repeating: "?", count: domains.count).joined(separator: ",")))")
        bindings.append(contentsOf: domains.map { .text($0.rawValue) })

        clauses.append("(domain != ? OR event_start >= ?)")
        bindings.append(.text(HealthDomain.movement.rawValue))
        bindings.append(.double(movementCutoff.timeIntervalSince1970))

        if calendarProjectionOnly {
            let types: [HealthRecordType] = [.workout, .sleepSession, .sleepInterval, .bodyMass]
            clauses.append("record_type IN (\(Array(repeating: "?", count: types.count).joined(separator: ",")))")
            bindings.append(contentsOf: types.map { .text($0.rawValue) })
        }

        if areas == [.movement] {
            clauses.append("(record_type IN (?, ?) OR is_daily_summary = 1)")
            bindings.append(.text(HealthRecordType.workout.rawValue))
            bindings.append(.text(HealthRecordType.stepDailySummary.rawValue))
        }

        return try query(
            sql: "SELECT payload FROM health_records WHERE \(clauses.joined(separator: " AND ")) ORDER BY event_start DESC",
            bindings: bindings
        )
    }

    func removeRecords(provider: HealthProvider) throws {
        guard let database else { throw SQLiteHealthRecordStoreError.sqlite(message: "Database is closed.") }
        let statement = try Self.prepare("DELETE FROM health_records WHERE provider = ?", on: database)
        defer { sqlite3_finalize(statement) }
        try Self.bindText(provider.rawValue, index: 1, statement: statement, database: database)
        guard sqlite3_step(statement) == SQLITE_DONE else { throw Self.sqliteError(database) }
        try protectDatabaseFiles()
    }

    func diskSize() -> UInt64 {
        [databaseURL, URL(fileURLWithPath: databaseURL.path + "-wal")].reduce(0) {
            $0 + Self.fileSize(at: $1, fileManager: fileManager)
        }
    }

    func recordCount() throws -> Int {
        guard let database else { throw SQLiteHealthRecordStoreError.sqlite(message: "Database is closed.") }
        return try Self.recordCount(on: database)
    }

    private static func recordCount(on database: OpaquePointer) throws -> Int {
        let statement = try prepare("SELECT COUNT(*) FROM health_records", on: database)
        defer { sqlite3_finalize(statement) }
        guard sqlite3_step(statement) == SQLITE_ROW else { throw sqliteError(database) }
        return Int(sqlite3_column_int64(statement, 0))
    }

    private static func migrationProgress(on database: OpaquePointer) throws -> (sourceName: String, sourceSize: UInt64, nextOffset: Int, importedCount: Int)? {
        let statement = try prepare(
            "SELECT source_name, source_size, next_offset, imported_count FROM migration_state WHERE id = 1",
            on: database
        )
        defer { sqlite3_finalize(statement) }
        let status = sqlite3_step(statement)
        if status == SQLITE_DONE { return nil }
        guard status == SQLITE_ROW, let sourceNameBytes = sqlite3_column_text(statement, 0) else {
            throw sqliteError(database)
        }
        return (
            String(cString: sourceNameBytes),
            UInt64(sqlite3_column_int64(statement, 1)),
            Int(sqlite3_column_int64(statement, 2)),
            Int(sqlite3_column_int64(statement, 3))
        )
    }

    private static func saveMigrationProgress(
        sourceName: String,
        sourceSize: UInt64,
        nextOffset: Int,
        importedCount: Int,
        on database: OpaquePointer
    ) throws {
        let statement = try prepare(
            """
            INSERT INTO migration_state (id, source_name, source_size, next_offset, imported_count)
            VALUES (1, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                source_name = excluded.source_name,
                source_size = excluded.source_size,
                next_offset = excluded.next_offset,
                imported_count = excluded.imported_count
            """,
            on: database
        )
        defer { sqlite3_finalize(statement) }
        try bindText(sourceName, index: 1, statement: statement, database: database)
        guard sqlite3_bind_int64(statement, 2, sqlite3_int64(sourceSize)) == SQLITE_OK,
              sqlite3_bind_int64(statement, 3, sqlite3_int64(nextOffset)) == SQLITE_OK,
              sqlite3_bind_int64(statement, 4, sqlite3_int64(importedCount)) == SQLITE_OK,
              sqlite3_step(statement) == SQLITE_DONE else {
            throw sqliteError(database)
        }
    }

    private func query(sql: String, bindings: [Binding]) throws -> [HealthRecord] {
        guard let database else { throw SQLiteHealthRecordStoreError.sqlite(message: "Database is closed.") }
        let statement = try Self.prepare(sql, on: database)
        defer { sqlite3_finalize(statement) }
        try Self.bind(bindings, to: statement, database: database)
        var result: [HealthRecord] = []
        while true {
            let status = sqlite3_step(statement)
            if status == SQLITE_DONE { return result }
            guard status == SQLITE_ROW else { throw Self.sqliteError(database) }
            guard let bytes = sqlite3_column_blob(statement, 0) else { continue }
            let count = Int(sqlite3_column_bytes(statement, 0))
            let data = Data(bytes: bytes, count: count)
            result.append(try JSONDecoder.health.decode(HealthRecord.self, from: data))
        }
    }

    private func migrateJSONStore(from sourceURL: URL) throws {
        let temporaryURL = databaseURL.deletingLastPathComponent()
            .appendingPathComponent(databaseURL.lastPathComponent + ".migrating")
        let sourceBytes = Self.fileSize(at: sourceURL, fileManager: fileManager)
        var connection = try Self.openDatabase(at: temporaryURL)
        try Self.configure(connection)
        try Self.execute(Self.schema, on: connection)
        try Self.execute(Self.migrationSchema, on: connection)

        var progress = try Self.migrationProgress(on: connection)
        let existingCount = try Self.recordCount(on: connection)
        let progressMatchesSource = progress.map {
            $0.sourceName == sourceURL.lastPathComponent && $0.sourceSize == sourceBytes
        } ?? (existingCount == 0)
        if !progressMatchesSource {
            Self.close(connection)
            try Self.removeDatabaseFiles(at: temporaryURL, fileManager: fileManager)
            connection = try Self.openDatabase(at: temporaryURL)
            try Self.configure(connection)
            try Self.execute(Self.schema, on: connection)
            try Self.execute(Self.migrationSchema, on: connection)
            progress = nil
        }

        var migrationSucceeded = false
        var connectionIsOpen = true
        defer {
            if connectionIsOpen { Self.close(connection) }
            if !migrationSucceeded {
                MSHDebugLifecycle.log(
                    "health_record_migration_incomplete",
                    "source=\(sourceURL.lastPathComponent) sourcePreserved=true"
                )
            }
        }

        let statement = try Self.prepare(Self.upsertSQL, on: connection)
        MSHDebugLifecycle.log(
            "health_record_migration_started",
            "source=\(sourceURL.lastPathComponent) sourceBytes=\(sourceBytes) resumeOffset=\(progress?.nextOffset ?? 0) importedCount=\(progress?.importedCount ?? 0) sourcePreserved=true bulkRecordDecoding=false"
        )

        var count = progress?.importedCount ?? 0
        var recordsInTransaction = 0
        var lastOffset = progress?.nextOffset
        try Self.execute("BEGIN IMMEDIATE TRANSACTION", on: connection)
        do {
            try LegacyHealthRecordStream(url: sourceURL).forEachRecord(startingAt: progress?.nextOffset) { record, nextOffset in
                try autoreleasepool {
                    try Self.bind(record: record, to: statement, database: connection)
                    guard sqlite3_step(statement) == SQLITE_DONE else { throw Self.sqliteError(connection) }
                    sqlite3_reset(statement)
                    sqlite3_clear_bindings(statement)
                }
                count += 1
                recordsInTransaction += 1
                lastOffset = nextOffset
                if recordsInTransaction == 500 {
                    try Self.saveMigrationProgress(
                        sourceName: sourceURL.lastPathComponent,
                        sourceSize: sourceBytes,
                        nextOffset: nextOffset,
                        importedCount: count,
                        on: connection
                    )
                    try Self.execute("COMMIT", on: connection)
                    MSHDebugLifecycle.log(
                        "health_record_migration_batch_complete",
                        "importedCount=\(count) nextOffset=\(nextOffset) databaseBytes=\(Self.databaseSize(at: temporaryURL, fileManager: fileManager)) sourcePreserved=true bulkRecordDecoding=false"
                    )
                    try Self.execute("BEGIN IMMEDIATE TRANSACTION", on: connection)
                    recordsInTransaction = 0
                }
            }
            if let lastOffset {
                try Self.saveMigrationProgress(
                    sourceName: sourceURL.lastPathComponent,
                    sourceSize: sourceBytes,
                    nextOffset: lastOffset,
                    importedCount: count,
                    on: connection
                )
            }
            try Self.execute("COMMIT", on: connection)
        } catch {
            try? Self.execute("ROLLBACK", on: connection)
            sqlite3_finalize(statement)
            throw error
        }

        sqlite3_finalize(statement)
        try Self.execute("DROP TABLE migration_state", on: connection)
        try Self.execute("PRAGMA wal_checkpoint(TRUNCATE)", on: connection)
        Self.close(connection)
        connectionIsOpen = false
        try fileManager.moveItem(at: temporaryURL, to: databaseURL)
        migrationSucceeded = true
        try protectDatabaseFiles()
        MSHDebugLifecycle.log(
            "health_record_migration_complete",
            "recordCount=\(count) sourceBytes=\(sourceBytes) databaseBytes=\(diskSize()) sourcePreserved=true bulkRecordDecoding=false"
        )
    }

    private func protectDatabaseFiles() throws {
        for url in [databaseURL, URL(fileURLWithPath: databaseURL.path + "-wal"), URL(fileURLWithPath: databaseURL.path + "-shm")] where fileManager.fileExists(atPath: url.path) {
            try fileManager.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: url.path)
        }
    }

    private static func configure(_ database: OpaquePointer) throws {
        try execute("PRAGMA journal_mode=WAL", on: database)
        try execute("PRAGMA synchronous=FULL", on: database)
        try execute("PRAGMA busy_timeout=5000", on: database)
    }

    private static func openDatabase(at url: URL) throws -> OpaquePointer {
        var database: OpaquePointer?
        let status = sqlite3_open_v2(url.path, &database, SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil)
        guard status == SQLITE_OK, let database else {
            let message = database.map { String(cString: sqlite3_errmsg($0)) } ?? "Unknown SQLite open error."
            if let database { sqlite3_close(database) }
            throw SQLiteHealthRecordStoreError.sqlite(message: message)
        }
        return database
    }

    private static func close(_ database: OpaquePointer) {
        sqlite3_close_v2(database)
    }

    private static func execute(_ sql: String, on database: OpaquePointer) throws {
        var errorMessage: UnsafeMutablePointer<CChar>?
        guard sqlite3_exec(database, sql, nil, nil, &errorMessage) == SQLITE_OK else {
            let message = errorMessage.map { String(cString: $0) } ?? String(cString: sqlite3_errmsg(database))
            sqlite3_free(errorMessage)
            throw SQLiteHealthRecordStoreError.sqlite(message: message)
        }
    }

    private static func prepare(_ sql: String, on database: OpaquePointer) throws -> OpaquePointer {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
            throw sqliteError(database)
        }
        return statement
    }

    private static func bind(record: HealthRecord, to statement: OpaquePointer, database: OpaquePointer) throws {
        let payload = try JSONEncoder.health.encode(record)
        try bindText(record.deduplicationKey, index: 1, statement: statement, database: database)
        try bindText(record.source.provider.rawValue, index: 2, statement: statement, database: database)
        try bindText(record.source.sourceRecordID, index: 3, statement: statement, database: database)
        try bindText(record.domain.rawValue, index: 4, statement: statement, database: database)
        try bindText(record.recordType.rawValue, index: 5, statement: statement, database: database)
        guard sqlite3_bind_double(statement, 6, record.eventStart.timeIntervalSince1970) == SQLITE_OK,
              sqlite3_bind_int(statement, 8, record.metadata["summary"] == "daily" ? 1 : 0) == SQLITE_OK else {
            throw sqliteError(database)
        }
        try bindText(record.lifecycleStatus.rawValue, index: 7, statement: statement, database: database)
        let status = payload.withUnsafeBytes { buffer in
            sqlite3_bind_blob(statement, 9, buffer.baseAddress, Int32(buffer.count), sqliteTransient)
        }
        guard status == SQLITE_OK else { throw sqliteError(database) }
    }

    private static func bind(_ bindings: [Binding], to statement: OpaquePointer, database: OpaquePointer) throws {
        for (offset, binding) in bindings.enumerated() {
            let index = Int32(offset + 1)
            switch binding {
            case .text(let value): try bindText(value, index: index, statement: statement, database: database)
            case .double(let value):
                guard sqlite3_bind_double(statement, index, value) == SQLITE_OK else { throw sqliteError(database) }
            }
        }
    }

    private static func bindText(_ value: String, index: Int32, statement: OpaquePointer, database: OpaquePointer) throws {
        guard sqlite3_bind_text(statement, index, value, -1, sqliteTransient) == SQLITE_OK else {
            throw sqliteError(database)
        }
    }

    private static var sqliteTransient: sqlite3_destructor_type {
        unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    }

    private static func sqliteError(_ database: OpaquePointer) -> SQLiteHealthRecordStoreError {
        .sqlite(message: String(cString: sqlite3_errmsg(database)))
    }

    private static func resetDatabaseWriteCount(_ database: OpaquePointer) {
        var current: Int32 = 0
        var highwater: Int32 = 0
        sqlite3_db_status(database, SQLITE_DBSTATUS_CACHE_WRITE, &current, &highwater, 1)
    }

    private static func databaseBytesWritten(_ database: OpaquePointer) -> UInt64 {
        var pageWrites: Int32 = 0
        var highwater: Int32 = 0
        guard sqlite3_db_status(database, SQLITE_DBSTATUS_CACHE_WRITE, &pageWrites, &highwater, 0) == SQLITE_OK else {
            return 0
        }
        let statement = try? prepare("PRAGMA page_size", on: database)
        guard let statement else { return 0 }
        defer { sqlite3_finalize(statement) }
        guard sqlite3_step(statement) == SQLITE_ROW else { return 0 }
        return UInt64(max(pageWrites, 0)) * UInt64(sqlite3_column_int64(statement, 0))
    }

    private static func domain(for area: HealthDataArea) -> HealthDomain {
        switch area {
        case .movement: .movement
        case .sleep: .sleep
        case .heartActivity: .cardio
        case .bodyMeasurements: .body
        }
    }

    private static func removeDatabaseFiles(at url: URL, fileManager: FileManager) throws {
        for candidate in [url, URL(fileURLWithPath: url.path + "-wal"), URL(fileURLWithPath: url.path + "-shm")] where fileManager.fileExists(atPath: candidate.path) {
            try fileManager.removeItem(at: candidate)
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

    private static func residentMemoryBytes() -> UInt64 {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size / MemoryLayout<integer_t>.size)
        let result = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }
        return result == KERN_SUCCESS ? UInt64(info.resident_size) : 0
    }

    private static func peakResidentMemoryBytes() -> UInt64 {
        var usage = rusage()
        return getrusage(RUSAGE_SELF, &usage) == 0 ? UInt64(usage.ru_maxrss) : 0
    }
}

/// Reads the legacy top-level `records` object one value at a time from a
/// memory-mapped file. Only one encoded and one decoded record are retained.
private struct LegacyHealthRecordStream {
    let data: Data

    init(url: URL) throws {
        data = try Data(contentsOf: url, options: [.mappedIfSafe])
    }

    func forEachRecord(startingAt savedOffset: Int?, _ body: (HealthRecord, Int) throws -> Void) throws {
        guard let recordsRange = topLevelValueRange(named: "records"),
              recordsRange.lowerBound < recordsRange.upperBound,
              data[recordsRange.lowerBound] == 123 else {
            throw SQLiteHealthRecordStoreError.corruptLegacyStore
        }
        var index = savedOffset ?? (recordsRange.lowerBound + 1)
        guard index > recordsRange.lowerBound, index < recordsRange.upperBound else {
            throw SQLiteHealthRecordStoreError.corruptLegacyStore
        }
        while index < recordsRange.upperBound {
            skipWhitespace(&index)
            guard index < recordsRange.upperBound else { throw SQLiteHealthRecordStoreError.corruptLegacyStore }
            if data[index] == 125 { return }
            guard let keyEnd = stringEnd(startingAt: index) else { throw SQLiteHealthRecordStoreError.corruptLegacyStore }
            index = keyEnd
            skipWhitespace(&index)
            guard index < recordsRange.upperBound, data[index] == 58 else { throw SQLiteHealthRecordStoreError.corruptLegacyStore }
            index += 1
            skipWhitespace(&index)
            let valueStart = index
            guard let valueEnd = valueEnd(startingAt: valueStart) else { throw SQLiteHealthRecordStoreError.corruptLegacyStore }
            let encoded = data.subdata(in: valueStart..<valueEnd)
            let record = try autoreleasepool { try JSONDecoder.health.decode(HealthRecord.self, from: encoded) }
            index = valueEnd
            skipWhitespace(&index)
            guard index < recordsRange.upperBound else { throw SQLiteHealthRecordStoreError.corruptLegacyStore }
            if data[index] == 44 {
                index += 1
                skipWhitespace(&index)
                try body(record, index)
                continue
            }
            if data[index] == 125 {
                try body(record, index)
                return
            }
            throw SQLiteHealthRecordStoreError.corruptLegacyStore
        }
        throw SQLiteHealthRecordStoreError.corruptLegacyStore
    }

    private func topLevelValueRange(named target: String) -> Range<Int>? {
        var index = 0
        skipWhitespace(&index)
        guard index < data.count, data[index] == 123 else { return nil }
        index += 1
        while index < data.count {
            skipWhitespace(&index)
            guard index < data.count else { return nil }
            if data[index] == 125 { return nil }
            let keyStart = index
            guard let keyEnd = stringEnd(startingAt: keyStart) else { return nil }
            let keyData = data.subdata(in: keyStart..<keyEnd)
            guard let key = try? JSONDecoder().decode(String.self, from: keyData) else { return nil }
            index = keyEnd
            skipWhitespace(&index)
            guard index < data.count, data[index] == 58 else { return nil }
            index += 1
            skipWhitespace(&index)
            let start = index
            guard let end = valueEnd(startingAt: start) else { return nil }
            if key == target { return start..<end }
            index = end
            skipWhitespace(&index)
            guard index < data.count else { return nil }
            if data[index] == 44 { index += 1; continue }
            if data[index] == 125 { return nil }
            return nil
        }
        return nil
    }

    private func skipWhitespace(_ index: inout Int) {
        while index < data.count && [9, 10, 13, 32].contains(data[index]) { index += 1 }
    }

    private func stringEnd(startingAt start: Int) -> Int? {
        guard start < data.count, data[start] == 34 else { return nil }
        var cursor = start + 1
        var escaped = false
        while cursor < data.count {
            let byte = data[cursor]
            if escaped { escaped = false }
            else if byte == 92 { escaped = true }
            else if byte == 34 { return cursor + 1 }
            cursor += 1
        }
        return nil
    }

    private func valueEnd(startingAt start: Int) -> Int? {
        guard start < data.count else { return nil }
        if data[start] == 34 { return stringEnd(startingAt: start) }
        if data[start] == 123 || data[start] == 91 {
            var cursor = start
            var depth = 0
            var inString = false
            var escaped = false
            while cursor < data.count {
                let byte = data[cursor]
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
        while cursor < data.count && data[cursor] != 44 && data[cursor] != 125 { cursor += 1 }
        while cursor > start && [9, 10, 13, 32].contains(data[cursor - 1]) { cursor -= 1 }
        return cursor
    }
}
