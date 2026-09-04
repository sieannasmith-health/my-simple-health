import Foundation
import MSHHealthCore
import SQLite3

/// MSH-owned corrections for imported health records.
///
/// Source rows keep their original identity and provenance. A correction changes the
/// canonical MSH view only; it never writes back to HealthKit. Corrections are stored
/// separately and protected by SQLite triggers so a later provider upsert/delete cannot
/// silently undo a person's MSH correction.
actor MSHHealthRecordCorrectionStore {
    enum CorrectionKind: String, Sendable {
        case corrected
        case deleted
    }

    enum CorrectionError: LocalizedError {
        case databaseUnavailable
        case recordNotFound
        case identityMismatch
        case sqlite(String)

        var errorDescription: String? {
            switch self {
            case .databaseUnavailable:
                return "The on-device health record store is not available."
            case .recordNotFound:
                return "The health record could not be found."
            case .identityMismatch:
                return "A correction cannot change the original record identity or source provenance."
            case .sqlite(let message):
                return message
            }
        }
    }

    private static let schema = """
        CREATE TABLE IF NOT EXISTS msh_health_record_corrections (
            deduplication_key TEXT PRIMARY KEY NOT NULL,
            provider TEXT NOT NULL,
            source_record_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            corrected_payload BLOB,
            corrected_at REAL NOT NULL
        ) WITHOUT ROWID;

        CREATE TRIGGER IF NOT EXISTS msh_preserve_corrected_health_record_update
        BEFORE UPDATE ON health_records
        WHEN EXISTS (
            SELECT 1 FROM msh_health_record_corrections
            WHERE deduplication_key = OLD.deduplication_key
        )
        BEGIN
            SELECT RAISE(IGNORE);
        END;

        CREATE TRIGGER IF NOT EXISTS msh_preserve_corrected_health_record_delete
        BEFORE DELETE ON health_records
        WHEN EXISTS (
            SELECT 1 FROM msh_health_record_corrections
            WHERE deduplication_key = OLD.deduplication_key
        )
        BEGIN
            SELECT RAISE(IGNORE);
        END;
        """

    private let databaseURL: URL

    init(databaseURL: URL? = nil) {
        if let databaseURL {
            self.databaseURL = databaseURL
        } else {
            self.databaseURL = FileManager.default
                .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
                .appendingPathComponent("MySimpleHealth/ConnectedHealth/health-records-v3.sqlite")
        }
    }

    func install() throws {
        let database = try openDatabase()
        defer { sqlite3_close(database) }
        try execute(Self.schema, on: database)
    }

    func correct(_ proposed: HealthRecord, at correctedAt: Date = Date()) throws {
        let database = try openDatabase()
        defer { sqlite3_close(database) }
        try execute(Self.schema, on: database)

        let original = try loadRecord(deduplicationKey: proposed.deduplicationKey, database: database)
        guard original.id == proposed.id,
              original.domain == proposed.domain,
              original.recordType == proposed.recordType,
              original.source == proposed.source,
              original.importedAt == proposed.importedAt,
              original.provenance == proposed.provenance else {
            throw CorrectionError.identityMismatch
        }

        var metadata = proposed.metadata
        metadata["msh.correction"] = "corrected"
        metadata["msh.correction.updatedAt"] = ISO8601DateFormatter().string(from: correctedAt)

        let corrected = HealthRecord(
            id: original.id,
            ownerID: proposed.ownerID,
            domain: original.domain,
            recordType: original.recordType,
            value: proposed.value,
            unit: proposed.unit,
            eventStart: proposed.eventStart,
            eventEnd: proposed.eventEnd,
            timezoneIdentifier: proposed.timezoneIdentifier,
            source: original.source,
            provenance: original.provenance,
            informationClass: proposed.informationClass,
            importedAt: original.importedAt,
            updatedAt: correctedAt,
            lifecycleStatus: .active,
            metadata: metadata
        )

        try replaceCanonicalRecord(corrected, kind: .corrected, correctedAt: correctedAt, database: database)
    }

    func delete(_ record: HealthRecord, at correctedAt: Date = Date()) throws {
        let database = try openDatabase()
        defer { sqlite3_close(database) }
        try execute(Self.schema, on: database)

        let original = try loadRecord(deduplicationKey: record.deduplicationKey, database: database)
        guard original.id == record.id, original.source == record.source else {
            throw CorrectionError.identityMismatch
        }

        var metadata = original.metadata
        metadata["msh.correction"] = "deleted"
        metadata["msh.correction.updatedAt"] = ISO8601DateFormatter().string(from: correctedAt)

        let tombstone = HealthRecord(
            id: original.id,
            ownerID: original.ownerID,
            domain: original.domain,
            recordType: original.recordType,
            value: original.value,
            unit: original.unit,
            eventStart: original.eventStart,
            eventEnd: original.eventEnd,
            timezoneIdentifier: original.timezoneIdentifier,
            source: original.source,
            provenance: original.provenance,
            informationClass: original.informationClass,
            importedAt: original.importedAt,
            updatedAt: correctedAt,
            lifecycleStatus: .deleted,
            metadata: metadata
        )

        try replaceCanonicalRecord(tombstone, kind: .deleted, correctedAt: correctedAt, database: database)
    }

    func kind(for record: HealthRecord) throws -> CorrectionKind? {
        let database = try openDatabase()
        defer { sqlite3_close(database) }
        try execute(Self.schema, on: database)

        let sql = "SELECT kind FROM msh_health_record_corrections WHERE deduplication_key = ? LIMIT 1"
        let statement = try prepare(sql, on: database)
        defer { sqlite3_finalize(statement) }
        try bindText(record.deduplicationKey, index: 1, statement: statement, database: database)

        let result = sqlite3_step(statement)
        if result == SQLITE_DONE { return nil }
        guard result == SQLITE_ROW,
              let text = sqlite3_column_text(statement, 0),
              let kind = CorrectionKind(rawValue: String(cString: text)) else {
            throw sqliteError(database)
        }
        return kind
    }

    private func replaceCanonicalRecord(
        _ record: HealthRecord,
        kind: CorrectionKind,
        correctedAt: Date,
        database: OpaquePointer
    ) throws {
        let payload = try JSONEncoder.health.encode(record)

        try execute("BEGIN IMMEDIATE TRANSACTION", on: database)
        do {
            // Remove the correction row temporarily so our own canonical update is not
            // blocked by the protection trigger. Source syncs cannot interleave while
            // this immediate transaction holds the write lock.
            try deleteCorrectionRow(record.deduplicationKey, database: database)

            let updateSQL = """
                UPDATE health_records
                SET event_start = ?, lifecycle_status = ?, payload = ?
                WHERE deduplication_key = ?
                """
            let update = try prepare(updateSQL, on: database)
            defer { sqlite3_finalize(update) }
            guard sqlite3_bind_double(update, 1, record.eventStart.timeIntervalSince1970) == SQLITE_OK else {
                throw sqliteError(database)
            }
            try bindText(record.lifecycleStatus.rawValue, index: 2, statement: update, database: database)
            try bindBlob(payload, index: 3, statement: update, database: database)
            try bindText(record.deduplicationKey, index: 4, statement: update, database: database)
            guard sqlite3_step(update) == SQLITE_DONE else { throw sqliteError(database) }
            guard sqlite3_changes(database) == 1 else { throw CorrectionError.recordNotFound }

            let correctionSQL = """
                INSERT INTO msh_health_record_corrections (
                    deduplication_key, provider, source_record_id, kind, corrected_payload, corrected_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(deduplication_key) DO UPDATE SET
                    provider = excluded.provider,
                    source_record_id = excluded.source_record_id,
                    kind = excluded.kind,
                    corrected_payload = excluded.corrected_payload,
                    corrected_at = excluded.corrected_at
                """
            let correction = try prepare(correctionSQL, on: database)
            defer { sqlite3_finalize(correction) }
            try bindText(record.deduplicationKey, index: 1, statement: correction, database: database)
            try bindText(record.source.provider.rawValue, index: 2, statement: correction, database: database)
            try bindText(record.source.sourceRecordID, index: 3, statement: correction, database: database)
            try bindText(kind.rawValue, index: 4, statement: correction, database: database)
            try bindBlob(payload, index: 5, statement: correction, database: database)
            guard sqlite3_bind_double(correction, 6, correctedAt.timeIntervalSince1970) == SQLITE_OK,
                  sqlite3_step(correction) == SQLITE_DONE else {
                throw sqliteError(database)
            }

            try execute("COMMIT", on: database)
        } catch {
            try? execute("ROLLBACK", on: database)
            throw error
        }
    }

    private func deleteCorrectionRow(_ deduplicationKey: String, database: OpaquePointer) throws {
        let statement = try prepare(
            "DELETE FROM msh_health_record_corrections WHERE deduplication_key = ?",
            on: database
        )
        defer { sqlite3_finalize(statement) }
        try bindText(deduplicationKey, index: 1, statement: statement, database: database)
        guard sqlite3_step(statement) == SQLITE_DONE else { throw sqliteError(database) }
    }

    private func loadRecord(deduplicationKey: String, database: OpaquePointer) throws -> HealthRecord {
        let statement = try prepare(
            "SELECT payload FROM health_records WHERE deduplication_key = ? LIMIT 1",
            on: database
        )
        defer { sqlite3_finalize(statement) }
        try bindText(deduplicationKey, index: 1, statement: statement, database: database)

        guard sqlite3_step(statement) == SQLITE_ROW,
              let bytes = sqlite3_column_blob(statement, 0) else {
            throw CorrectionError.recordNotFound
        }
        let count = Int(sqlite3_column_bytes(statement, 0))
        return try JSONDecoder.health.decode(HealthRecord.self, from: Data(bytes: bytes, count: count))
    }

    private func openDatabase() throws -> OpaquePointer {
        guard FileManager.default.fileExists(atPath: databaseURL.path) else {
            throw CorrectionError.databaseUnavailable
        }
        var database: OpaquePointer?
        let flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX
        guard sqlite3_open_v2(databaseURL.path, &database, flags, nil) == SQLITE_OK,
              let database else {
            if let database { sqlite3_close(database) }
            throw CorrectionError.databaseUnavailable
        }
        sqlite3_busy_timeout(database, 5_000)
        return database
    }

    private func execute(_ sql: String, on database: OpaquePointer) throws {
        var message: UnsafeMutablePointer<Int8>?
        guard sqlite3_exec(database, sql, nil, nil, &message) == SQLITE_OK else {
            let description = message.map { String(cString: $0) } ?? String(cString: sqlite3_errmsg(database))
            sqlite3_free(message)
            throw CorrectionError.sqlite(description)
        }
    }

    private func prepare(_ sql: String, on database: OpaquePointer) throws -> OpaquePointer {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK,
              let statement else {
            throw sqliteError(database)
        }
        return statement
    }

    private func bindText(_ value: String, index: Int32, statement: OpaquePointer, database: OpaquePointer) throws {
        guard sqlite3_bind_text(statement, index, value, -1, sqliteTransient) == SQLITE_OK else {
            throw sqliteError(database)
        }
    }

    private func bindBlob(_ value: Data, index: Int32, statement: OpaquePointer, database: OpaquePointer) throws {
        let result = value.withUnsafeBytes { bytes in
            sqlite3_bind_blob(statement, index, bytes.baseAddress, Int32(value.count), sqliteTransient)
        }
        guard result == SQLITE_OK else { throw sqliteError(database) }
    }

    private var sqliteTransient: sqlite3_destructor_type {
        unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    }

    private func sqliteError(_ database: OpaquePointer) -> CorrectionError {
        .sqlite(String(cString: sqlite3_errmsg(database)))
    }
}
