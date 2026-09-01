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
        try await stateReader.load(provider: .appleHealth)
    }

    func loadRecentActivity(limit: Int) async throws -> [HealthRecord] {
        // Sleep arrives as several stage intervals plus a derived session. Give
        // the snapshot a wider bounded window so one night cannot consume every
        // recent slot before the sleep session and other health areas are read.
        try await recentReader.recentRecords(provider: .appleHealth, limit: max(limit, 20))
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

    static let maximumLimit = 20

    private let databaseURL: URL

    init(databaseURL: URL) {
        self.databaseURL = databaseURL
    }

    func recentRecords(provider: HealthProvider, limit: Int) throws -> [HealthRecord] {
        let boundedLimit = min(max(0, limit), Self.maximumLimit)
        guard boundedLimit > 0, FileManager.default.fileExists(atPath: databaseURL.path) else { return [] }

        var database: OpaquePointer?
        let flags = SQLITE_OPEN_READONLY | SQLITE_OPEN_FULLMUTEX
        guard sqlite3_open_v2(databaseURL.path, &database, flags, nil) == SQLITE_OK,
              let database else {
            defer { if let database { sqlite3_close(database) } }
            throw ReaderError.sqlite("The on-device health record store could not be opened for reading.")
        }
        defer { sqlite3_close(database) }

        let sql = """
            SELECT payload FROM health_records
            WHERE provider = ? AND lifecycle_status = ?
            ORDER BY event_start DESC
            LIMIT ?
            """
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK,
              let statement else {
            throw ReaderError.sqlite(String(cString: sqlite3_errmsg(database)))
        }
        defer { sqlite3_finalize(statement) }

        guard sqlite3_bind_text(statement, 1, provider.rawValue, -1, sqliteTransient) == SQLITE_OK,
              sqlite3_bind_text(statement, 2, HealthRecordLifecycle.active.rawValue, -1, sqliteTransient) == SQLITE_OK,
              sqlite3_bind_int(statement, 3, Int32(boundedLimit)) == SQLITE_OK else {
            throw ReaderError.sqlite(String(cString: sqlite3_errmsg(database)))
        }

        var records: [HealthRecord] = []
        records.reserveCapacity(boundedLimit)
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

    private var sqliteTransient: sqlite3_destructor_type {
        unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    }
}
