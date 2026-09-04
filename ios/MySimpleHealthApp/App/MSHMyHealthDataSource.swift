import Foundation
import MSHHealthCore
import SQLite3

protocol MSHHealthStateReading: Sendable {
    func load(provider: HealthProvider) async throws -> HealthSyncState
}

extension FileHealthStore: MSHHealthStateReading {}

protocol MSHRecentHealthReading: Sendable {
    func recentRecords(provider: HealthProvider, limit: Int) async throws -> [HealthRecord]
}

protocol MSHMyHealthDataLoading: Sendable {
    func loadStatus() async throws -> HealthSyncState
    func loadRecentActivity(limit: Int) async throws -> [HealthRecord]
}

actor MSHMyHealthDataSource: MSHMyHealthDataLoading {
    private let stateReader: any MSHHealthStateReading
    private let recentReader: any MSHRecentHealthReading

    init(
        stateReader: any MSHHealthStateReading,
        recentReader: any MSHRecentHealthReading
    ) {
        self.stateReader = stateReader
        self.recentReader = recentReader
    }

    static func live() -> MSHMyHealthDataSource {
        let directory = FileManager.default
            .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("MySimpleHealth/ConnectedHealth", isDirectory: true)
        return MSHMyHealthDataSource(
            stateReader: FileHealthStore(directoryURL: directory),
            recentReader: SQLiteRecentHealthRecordReader(
                databaseURL: directory.appendingPathComponent("health-records-v3.sqlite")
            )
        )
    }

    func loadStatus() async throws -> HealthSyncState {
        // My Health should refresh already-selected HealthKit areas when the
        // dashboard loads, not only during onboarding.
        try? await MSHAppleHealthRuntime.refreshConnectedHealth()
        return try await stateReader.load(provider: .appleHealth)
    }

    func loadRecentActivity(limit: Int) async throws -> [HealthRecord] {
        try await recentReader.recentRecords(provider: .appleHealth, limit: limit)
    }
}

actor SQLiteRecentHealthRecordReader: MSHRecentHealthReading {
    private enum ReaderError: LocalizedError {
        case sqlite(String)

        var errorDescription: String? {
            switch self {
            case .sqlite(let message): message
            }
        }
    }

    // My Health contains Day / Week / Month views. A small cap per broad domain
    // loses useful daily summaries because high-frequency samples (especially
    // steps and heart rate) can consume the entire allowance in a few hours.
    // Keep a bounded history per record type instead, with enough samples for
    // daily/weekly/monthly aggregation while still avoiding an unbounded decode.
    static let minimumHistoryPerRecordType = 90
    static let maximumHistoryPerRecordType = 120

    private let databaseURL: URL

    init(databaseURL: URL) {
        self.databaseURL = databaseURL
    }

    func recentRecords(provider: HealthProvider, limit: Int) throws -> [HealthRecord] {
        let requested = max(0, limit)
        guard requested > 0, FileManager.default.fileExists(atPath: databaseURL.path) else { return [] }
        let boundedLimit = min(
            max(requested, Self.minimumHistoryPerRecordType),
            Self.maximumHistoryPerRecordType
        )

        var database: OpaquePointer?
        let flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX
        guard sqlite3_open_v2(databaseURL.path, &database, flags, nil) == SQLITE_OK,
              let database else {
            defer { if let database { sqlite3_close(database) } }
            throw ReaderError.sqlite("The on-device health record store could not be opened.")
        }
        defer { sqlite3_close(database) }

        // Older builds created derived sleep-session rows from only the intervals
        // present in a single incremental HealthKit batch. Those partial sessions
        // could overwrite a complete night. Remove only those MSH-generated rows;
        // raw HealthKit sleep intervals remain untouched and are the source of truth.
        try purgeLegacyDerivedSleepSessions(provider: provider, database: database)

        let sql = """
            WITH ranked AS (
                SELECT payload, record_type, event_start,
                       ROW_NUMBER() OVER (
                           PARTITION BY record_type
                           ORDER BY event_start DESC
                       ) AS type_rank
                FROM health_records
                WHERE provider = ?
                  AND lifecycle_status = ?
                  AND NOT (domain = ? AND record_type = ?)
            )
            SELECT payload
            FROM ranked
            WHERE type_rank <= ?
            ORDER BY event_start DESC
            """
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK,
              let statement else {
            throw ReaderError.sqlite(String(cString: sqlite3_errmsg(database)))
        }
        defer { sqlite3_finalize(statement) }

        guard sqlite3_bind_text(statement, 1, provider.rawValue, -1, sqliteTransient) == SQLITE_OK,
              sqlite3_bind_text(statement, 2, HealthRecordLifecycle.active.rawValue, -1, sqliteTransient) == SQLITE_OK,
              sqlite3_bind_text(statement, 3, HealthDomain.sleep.rawValue, -1, sqliteTransient) == SQLITE_OK,
              sqlite3_bind_text(statement, 4, HealthRecordType.sleepSession.rawValue, -1, sqliteTransient) == SQLITE_OK,
              sqlite3_bind_int(statement, 5, Int32(boundedLimit)) == SQLITE_OK else {
            throw ReaderError.sqlite(String(cString: sqlite3_errmsg(database)))
        }

        var records: [HealthRecord] = []
        records.reserveCapacity(boundedLimit * 8)
        while true {
            let result = sqlite3_step(statement)
            if result == SQLITE_DONE { return records }
            guard result == SQLITE_ROW else {
                throw ReaderError.sqlite(String(cString: sqlite3_errmsg(database)))
            }
            guard let bytes = sqlite3_column_blob(statement, 0) else { continue }
            let count = Int(sqlite3_column_bytes(statement, 0))
            let payload = Data(bytes: bytes, count: count)
            records.append(try JSONDecoder.health.decode(HealthRecord.self, from: payload))
        }
    }

    private func purgeLegacyDerivedSleepSessions(provider: HealthProvider, database: OpaquePointer) throws {
        let sql = """
            DELETE FROM health_records
            WHERE provider = ?
              AND domain = ?
              AND record_type = ?
              AND source_record_id LIKE 'sleep-session:%'
            """
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK,
              let statement else {
            throw ReaderError.sqlite(String(cString: sqlite3_errmsg(database)))
        }
        defer { sqlite3_finalize(statement) }

        guard sqlite3_bind_text(statement, 1, provider.rawValue, -1, sqliteTransient) == SQLITE_OK,
              sqlite3_bind_text(statement, 2, HealthDomain.sleep.rawValue, -1, sqliteTransient) == SQLITE_OK,
              sqlite3_bind_text(statement, 3, HealthRecordType.sleepSession.rawValue, -1, sqliteTransient) == SQLITE_OK,
              sqlite3_step(statement) == SQLITE_DONE else {
            throw ReaderError.sqlite(String(cString: sqlite3_errmsg(database)))
        }
    }

    private var sqliteTransient: sqlite3_destructor_type {
        unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    }
}
