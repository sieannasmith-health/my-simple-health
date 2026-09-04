import Foundation
import MSHHealthCore

public enum FHIRClinicalDataArea: String, Codable, CaseIterable, Hashable, Sendable {
    case conditions
    case medications
    case allergies
    case labsAndResults = "labs_and_results"
    case careHistory = "care_history"
}

public struct FHIRAuthorizationResult: Equatable, Sendable {
    public let outcome: HealthAuthorizationOutcome
    public let requestedAreas: Set<FHIRClinicalDataArea>
    public let message: String?

    public init(outcome: HealthAuthorizationOutcome, requestedAreas: Set<FHIRClinicalDataArea>, message: String? = nil) {
        self.outcome = outcome
        self.requestedAreas = requestedAreas
        self.message = message
    }
}

public struct FHIRSyncRequest: Sendable {
    public let areas: Set<FHIRClinicalDataArea>
    public let lastSuccessfulSyncAt: Date?

    public init(areas: Set<FHIRClinicalDataArea>, lastSuccessfulSyncAt: Date? = nil) {
        self.areas = areas
        self.lastSuccessfulSyncAt = lastSuccessfulSyncAt
    }
}

public struct FHIRSyncBatch: Sendable {
    public let records: [HealthRecord]
    public let completedAt: Date
    public let partialFailures: [String]

    public init(records: [HealthRecord], completedAt: Date = Date(), partialFailures: [String] = []) {
        self.records = records
        self.completedAt = completedAt
        self.partialFailures = partialFailures
    }
}

public struct FHIRConnectionConfiguration: Equatable, Sendable {
    public let connectionID: String
    public let baseURL: URL
    public let patientID: String
    public let sourceName: String

    public init(connectionID: String, baseURL: URL, patientID: String, sourceName: String) {
        self.connectionID = connectionID
        self.baseURL = baseURL
        self.patientID = patientID
        self.sourceName = sourceName
    }
}

public protocol FHIRAuthorizationSession: Sendable {
    func authorize(scopes: Set<String>) async throws
    func accessToken() async throws -> String
    func disconnect() async
}

public protocol FHIRTransport: Sendable {
    func get(url: URL, bearerToken: String) async throws -> Data
}

public struct URLSessionFHIRTransport: FHIRTransport {
    public init() {}

    public func get(url: URL, bearerToken: String) async throws -> Data {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/fhir+json", forHTTPHeaderField: "Accept")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let status = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw FHIRClinicalRecordsError.httpStatus(status)
        }
        return data
    }
}

public enum FHIRClinicalRecordsError: LocalizedError, Equatable {
    case invalidBaseURL
    case malformedBundle
    case httpStatus(Int)

    public var errorDescription: String? {
        switch self {
        case .invalidBaseURL: "The clinical record server URL is invalid."
        case .malformedBundle: "The clinical record response could not be read as a FHIR Bundle."
        case .httpStatus(let status): "The clinical record server returned HTTP \(status)."
        }
    }
}

/// Read-only FHIR R4 ingestion. SMART authorization is supplied by the app layer
/// so tokens never become part of the canonical health-record model.
public actor FHIRClinicalRecordsClient {
    private let configuration: FHIRConnectionConfiguration
    private let authorization: any FHIRAuthorizationSession
    private let transport: any FHIRTransport
    private let timezone: TimeZone

    public init(
        configuration: FHIRConnectionConfiguration,
        authorization: any FHIRAuthorizationSession,
        transport: any FHIRTransport = URLSessionFHIRTransport(),
        timezone: TimeZone = .current
    ) {
        self.configuration = configuration
        self.authorization = authorization
        self.transport = transport
        self.timezone = timezone
    }

    public func authorize(areas: Set<FHIRClinicalDataArea>) async -> FHIRAuthorizationResult {
        guard !areas.isEmpty else {
            return FHIRAuthorizationResult(outcome: .failed, requestedAreas: [], message: "No clinical record areas were selected.")
        }
        do {
            try await authorization.authorize(scopes: Self.smartScopes(for: areas))
            return FHIRAuthorizationResult(outcome: .completed, requestedAreas: areas)
        } catch {
            return FHIRAuthorizationResult(outcome: .failed, requestedAreas: areas, message: error.localizedDescription)
        }
    }

    public func sync(_ request: FHIRSyncRequest) async throws -> FHIRSyncBatch {
        guard !request.areas.isEmpty else { return FHIRSyncBatch(records: []) }

        let token = try await authorization.accessToken()
        let importedAt = Date()
        var records: [HealthRecord] = []
        var failures: [String] = []

        for query in Self.queries(for: request.areas, patientID: configuration.patientID, since: request.lastSuccessfulSyncAt) {
            do {
                let url = try makeURL(resourceType: query.resourceType, queryItems: query.queryItems)
                let data = try await transport.get(url: url, bearerToken: token)
                records.append(contentsOf: try FHIRResourceMapper.mapBundle(
                    data,
                    configuration: configuration,
                    timezone: timezone,
                    importedAt: importedAt
                ))
            } catch {
                failures.append("\(query.resourceType): \(error.localizedDescription)")
            }
        }

        return FHIRSyncBatch(records: records, completedAt: importedAt, partialFailures: failures)
    }

    public func disconnect() async {
        await authorization.disconnect()
    }

    public static func smartScopes(for areas: Set<FHIRClinicalDataArea>) -> Set<String> {
        var resources: Set<String> = ["Patient"]
        if areas.contains(.conditions) { resources.insert("Condition") }
        if areas.contains(.medications) { resources.insert("MedicationRequest") }
        if areas.contains(.allergies) { resources.insert("AllergyIntolerance") }
        if areas.contains(.labsAndResults) {
            resources.insert("Observation")
            resources.insert("DiagnosticReport")
        }
        if areas.contains(.careHistory) {
            resources.insert("Encounter")
            resources.insert("CarePlan")
        }
        return Set(resources.map { "patient/\($0).rs" })
    }

    private struct Query {
        let resourceType: String
        let queryItems: [URLQueryItem]
    }

    private static func queries(for areas: Set<FHIRClinicalDataArea>, patientID: String, since: Date?) -> [Query] {
        func items(extra: [URLQueryItem] = []) -> [URLQueryItem] {
            var value = [
                URLQueryItem(name: "patient", value: patientID),
                URLQueryItem(name: "_count", value: "100")
            ]
            if let since {
                value.append(URLQueryItem(name: "_lastUpdated", value: "gt\(fhirInstant(since))"))
            }
            value.append(contentsOf: extra)
            return value
        }

        var result: [Query] = []
        if areas.contains(.conditions) { result.append(Query(resourceType: "Condition", queryItems: items())) }
        if areas.contains(.medications) { result.append(Query(resourceType: "MedicationRequest", queryItems: items())) }
        if areas.contains(.allergies) { result.append(Query(resourceType: "AllergyIntolerance", queryItems: items())) }
        if areas.contains(.labsAndResults) {
            result.append(Query(resourceType: "Observation", queryItems: items(extra: [URLQueryItem(name: "category", value: "laboratory")])))
            result.append(Query(resourceType: "DiagnosticReport", queryItems: items()))
        }
        if areas.contains(.careHistory) {
            result.append(Query(resourceType: "Encounter", queryItems: items()))
            result.append(Query(resourceType: "CarePlan", queryItems: items()))
        }
        return result
    }

    private func makeURL(resourceType: String, queryItems: [URLQueryItem]) throws -> URL {
        let endpoint = configuration.baseURL.appendingPathComponent(resourceType)
        guard var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false) else {
            throw FHIRClinicalRecordsError.invalidBaseURL
        }
        components.queryItems = queryItems
        guard let url = components.url else { throw FHIRClinicalRecordsError.invalidBaseURL }
        return url
    }

    private static func fhirInstant(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }
}

public enum FHIRResourceMapper {
    public static func mapBundle(
        _ data: Data,
        configuration: FHIRConnectionConfiguration,
        timezone: TimeZone,
        importedAt: Date = Date()
    ) throws -> [HealthRecord] {
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              object["resourceType"] as? String == "Bundle" else {
            throw FHIRClinicalRecordsError.malformedBundle
        }
        let entries = object["entry"] as? [[String: Any]] ?? []

        return entries.compactMap { entry in
            guard let resource = entry["resource"] as? [String: Any] else { return nil }
            return mapResource(resource, configuration: configuration, timezone: timezone, importedAt: importedAt)
        }
    }

    public static func mapResource(
        _ resource: [String: Any],
        configuration: FHIRConnectionConfiguration,
        timezone: TimeZone,
        importedAt: Date = Date()
    ) -> HealthRecord? {
        guard let resourceType = resource["resourceType"] as? String,
              let resourceID = resource["id"] as? String else { return nil }

        // Namespace source IDs by the MSH connection, because FHIR resource IDs
        // are unique only within a server/resource namespace.
        let identity = "\(configuration.connectionID):\(resourceType)/\(resourceID)"
        var metadata: [String: String] = [
            "fhirResourceType": resourceType,
            "fhirResourceID": resourceID,
            "fhirConnectionID": configuration.connectionID
        ]

        let domain: HealthDomain
        let recordType: HealthRecordType
        let start: Date
        var end: Date?
        var value: Double?
        var unit: String?

        switch resourceType {
        case "Condition":
            domain = .clinical
            recordType = .clinicalCondition
            start = firstDate(resource["onsetDateTime"], resource["recordedDate"], metaLastUpdated(resource)) ?? importedAt
            end = date(resource["abatementDateTime"])
            copyCode(resource["code"], prefix: "clinical", into: &metadata)
            copyCodingStatus(resource["clinicalStatus"], key: "clinicalStatus", into: &metadata)
            copyCodingStatus(resource["verificationStatus"], key: "verificationStatus", into: &metadata)

        case "MedicationRequest":
            domain = .medications
            recordType = .medicationRequest
            start = firstDate(resource["authoredOn"], metaLastUpdated(resource)) ?? importedAt
            copyCode(resource["medicationCodeableConcept"], prefix: "medication", into: &metadata)
            copyString(resource["status"], key: "status", into: &metadata)
            copyString(resource["intent"], key: "intent", into: &metadata)

        case "AllergyIntolerance":
            domain = .clinical
            recordType = .clinicalAllergy
            start = firstDate(resource["recordedDate"], metaLastUpdated(resource)) ?? importedAt
            copyCode(resource["code"], prefix: "allergy", into: &metadata)
            copyString(resource["criticality"], key: "criticality", into: &metadata)
            copyCodingStatus(resource["clinicalStatus"], key: "clinicalStatus", into: &metadata)

        case "Observation":
            domain = .clinical
            recordType = .clinicalObservation
            start = firstDate(resource["effectiveDateTime"], resource["issued"], metaLastUpdated(resource)) ?? importedAt
            copyCode(resource["code"], prefix: "observation", into: &metadata)
            copyString(resource["status"], key: "status", into: &metadata)
            if let quantity = resource["valueQuantity"] as? [String: Any] {
                value = (quantity["value"] as? NSNumber)?.doubleValue
                unit = (quantity["unit"] as? String) ?? (quantity["code"] as? String)
                copyString(quantity["system"], key: "unitSystem", into: &metadata)
                copyString(quantity["code"], key: "unitCode", into: &metadata)
            } else if let text = resource["valueString"] as? String {
                metadata["valueText"] = text
            }

        case "DiagnosticReport":
            domain = .clinical
            recordType = .clinicalDiagnosticReport
            start = firstDate(resource["effectiveDateTime"], resource["issued"], metaLastUpdated(resource)) ?? importedAt
            copyCode(resource["code"], prefix: "report", into: &metadata)
            copyString(resource["status"], key: "status", into: &metadata)
            copyString(resource["conclusion"], key: "conclusion", into: &metadata)

        case "Encounter":
            domain = .care
            recordType = .clinicalEncounter
            let period = resource["period"] as? [String: Any]
            start = firstDate(period?["start"], metaLastUpdated(resource)) ?? importedAt
            end = date(period?["end"])
            copyString(resource["status"], key: "status", into: &metadata)
            if let types = resource["type"] as? [[String: Any]], let first = types.first {
                copyCode(first, prefix: "encounter", into: &metadata)
            }

        case "CarePlan":
            domain = .care
            recordType = .clinicalCarePlan
            let period = resource["period"] as? [String: Any]
            start = firstDate(period?["start"], resource["created"], metaLastUpdated(resource)) ?? importedAt
            end = date(period?["end"])
            copyString(resource["status"], key: "status", into: &metadata)
            copyString(resource["intent"], key: "intent", into: &metadata)
            copyString(resource["title"], key: "title", into: &metadata)
            copyString(resource["description"], key: "description", into: &metadata)

        default:
            return nil
        }

        return HealthRecordFactory.imported(
            provider: .fhir,
            sourceSystem: configuration.baseURL.absoluteString,
            sourceRecordID: identity,
            domain: domain,
            recordType: recordType,
            value: value,
            unit: unit,
            start: start,
            end: end,
            timezone: timezone,
            sourceName: configuration.sourceName,
            metadata: metadata,
            importedAt: importedAt
        )
    }

    private static func metaLastUpdated(_ resource: [String: Any]) -> Any? {
        (resource["meta"] as? [String: Any])?["lastUpdated"]
    }

    private static func firstDate(_ candidates: Any?...) -> Date? {
        candidates.compactMap(date).first
    }

    private static func date(_ value: Any?) -> Date? {
        guard let string = value as? String else { return nil }
        let formatter = ISO8601DateFormatter()
        if let full = formatter.date(from: string) { return full }

        let dateOnly = DateFormatter()
        dateOnly.locale = Locale(identifier: "en_US_POSIX")
        dateOnly.dateFormat = "yyyy-MM-dd"
        dateOnly.timeZone = TimeZone(secondsFromGMT: 0)
        return dateOnly.date(from: string)
    }

    private static func copyString(_ value: Any?, key: String, into metadata: inout [String: String]) {
        if let string = value as? String, !string.isEmpty { metadata[key] = string }
    }

    private static func copyCodingStatus(_ value: Any?, key: String, into metadata: inout [String: String]) {
        guard let object = value as? [String: Any],
              let coding = (object["coding"] as? [[String: Any]])?.first else { return }
        copyString(coding["code"], key: key, into: &metadata)
    }

    private static func copyCode(_ value: Any?, prefix: String, into metadata: inout [String: String]) {
        guard let object = value as? [String: Any] else { return }
        copyString(object["text"], key: "\(prefix)Text", into: &metadata)
        guard let coding = (object["coding"] as? [[String: Any]])?.first else { return }
        copyString(coding["display"], key: "\(prefix)Display", into: &metadata)
        copyString(coding["code"], key: "\(prefix)Code", into: &metadata)
        copyString(coding["system"], key: "\(prefix)CodeSystem", into: &metadata)
    }
}
