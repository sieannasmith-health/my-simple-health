import Foundation

public enum HealthProvider: String, Codable, Sendable {
    case appleHealth = "apple_health"
    case fhir = "fhir"
}

public enum HealthDomain: String, Codable, Sendable {
    case movement
    case cardio
    case body
    case sleep
    case clinical
    case medications
    case care
}

public enum HealthDataArea: String, Codable, CaseIterable, Hashable, Sendable {
    case movement
    case sleep
    case heartActivity = "heart_activity"
    case bodyMeasurements = "body_measurements"
    case conditions
    case medications
    case allergies
    case labsAndResults = "labs_and_results"
    case careHistory = "care_history"
}

public enum HealthRecordType: String, Codable, Sendable {
    case workout = "movement.workout"
    case stepSample = "movement.step_sample"
    case stepDailySummary = "movement.step_daily_summary"
    case activeEnergy = "movement.active_energy"
    case exerciseTime = "movement.exercise_time"
    case distanceWalkingRunning = "movement.distance_walking_running"
    case distanceCycling = "movement.distance_cycling"
    case distanceSwimming = "movement.distance_swimming"
    case heartRate = "cardio.heart_rate"
    case restingHeartRate = "cardio.resting_heart_rate"
    case bodyMass = "body.body_mass"
    case sleepInterval = "sleep.interval"
    case sleepSession = "sleep.session"
    case clinicalCondition = "clinical.condition"
    case clinicalAllergy = "clinical.allergy"
    case clinicalObservation = "clinical.observation"
    case clinicalDiagnosticReport = "clinical.diagnostic_report"
    case medicationRequest = "medications.request"
    case clinicalEncounter = "care.encounter"
    case clinicalCarePlan = "care.care_plan"
}

public enum HealthRecordLifecycle: String, Codable, Sendable {
    case active = "ACTIVE"
    case deleted = "DELETED"
}

public struct HealthRecordSource: Codable, Equatable, Sendable {
    public let provider: HealthProvider
    public let sourceSystem: String
    public let sourceRecordID: String
    public let sourceName: String?
    public let sourceBundleIdentifier: String?
    public let sourceVersion: String?
    public let sourceDevice: String?

    public init(
        provider: HealthProvider,
        sourceSystem: String,
        sourceRecordID: String,
        sourceName: String? = nil,
        sourceBundleIdentifier: String? = nil,
        sourceVersion: String? = nil,
        sourceDevice: String? = nil
    ) {
        self.provider = provider
        self.sourceSystem = sourceSystem
        self.sourceRecordID = sourceRecordID
        self.sourceName = sourceName
        self.sourceBundleIdentifier = sourceBundleIdentifier
        self.sourceVersion = sourceVersion
        self.sourceDevice = sourceDevice
    }
}

public struct HealthRecord: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let ownerID: String?
    public let domain: HealthDomain
    public let recordType: HealthRecordType
    public let value: Double?
    public let unit: String?
    public let eventStart: Date
    public let eventEnd: Date?
    public let timezoneIdentifier: String
    public let source: HealthRecordSource
    public let provenance: String
    public let informationClass: String
    public let importedAt: Date
    public let updatedAt: Date
    public let lifecycleStatus: HealthRecordLifecycle
    public let metadata: [String: String]

    public var deduplicationKey: String {
        "\(source.provider.rawValue):\(source.sourceRecordID)"
    }

    public init(
        id: String,
        ownerID: String? = nil,
        domain: HealthDomain,
        recordType: HealthRecordType,
        value: Double? = nil,
        unit: String? = nil,
        eventStart: Date,
        eventEnd: Date? = nil,
        timezoneIdentifier: String,
        source: HealthRecordSource,
        provenance: String = "IMPORTED",
        informationClass: String = "RECORDED",
        importedAt: Date,
        updatedAt: Date,
        lifecycleStatus: HealthRecordLifecycle = .active,
        metadata: [String: String] = [:]
    ) {
        self.id = id
        self.ownerID = ownerID
        self.domain = domain
        self.recordType = recordType
        self.value = value
        self.unit = unit
        self.eventStart = eventStart
        self.eventEnd = eventEnd
        self.timezoneIdentifier = timezoneIdentifier
        self.source = source
        self.provenance = provenance
        self.informationClass = informationClass
        self.importedAt = importedAt
        self.updatedAt = updatedAt
        self.lifecycleStatus = lifecycleStatus
        self.metadata = metadata
    }
}

public enum HealthRecordFactory {
    public static func imported(
        sourceRecordID: String,
        domain: HealthDomain,
        recordType: HealthRecordType,
        value: Double?,
        unit: String?,
        start: Date,
        end: Date?,
        timezone: TimeZone,
        sourceName: String? = nil,
        sourceBundleIdentifier: String? = nil,
        sourceVersion: String? = nil,
        sourceDevice: String? = nil,
        metadata: [String: String] = [:],
        importedAt: Date = Date()
    ) -> HealthRecord {
        imported(
            provider: .appleHealth,
            sourceSystem: "healthkit",
            sourceRecordID: sourceRecordID,
            domain: domain,
            recordType: recordType,
            value: value,
            unit: unit,
            start: start,
            end: end,
            timezone: timezone,
            sourceName: sourceName,
            sourceBundleIdentifier: sourceBundleIdentifier,
            sourceVersion: sourceVersion,
            sourceDevice: sourceDevice,
            metadata: metadata,
            importedAt: importedAt
        )
    }

    public static func imported(
        provider: HealthProvider,
        sourceSystem: String,
        sourceRecordID: String,
        domain: HealthDomain,
        recordType: HealthRecordType,
        value: Double?,
        unit: String?,
        start: Date,
        end: Date?,
        timezone: TimeZone,
        sourceName: String? = nil,
        sourceBundleIdentifier: String? = nil,
        sourceVersion: String? = nil,
        sourceDevice: String? = nil,
        metadata: [String: String] = [:],
        importedAt: Date = Date()
    ) -> HealthRecord {
        HealthRecord(
            id: "\(provider.rawValue):\(sourceRecordID)",
            domain: domain,
            recordType: recordType,
            value: value,
            unit: unit,
            eventStart: start,
            eventEnd: end,
            timezoneIdentifier: timezone.identifier,
            source: HealthRecordSource(
                provider: provider,
                sourceSystem: sourceSystem,
                sourceRecordID: sourceRecordID,
                sourceName: sourceName,
                sourceBundleIdentifier: sourceBundleIdentifier,
                sourceVersion: sourceVersion,
                sourceDevice: sourceDevice
            ),
            importedAt: importedAt,
            updatedAt: importedAt,
            metadata: metadata
        )
    }
}
