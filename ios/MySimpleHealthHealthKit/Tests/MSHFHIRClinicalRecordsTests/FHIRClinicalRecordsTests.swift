import Foundation
import Testing
import MSHFHIRClinicalRecords
import MSHHealthCore

private actor MockAuthorization: FHIRAuthorizationSession {
    var requestedScopes: Set<String> = []
    var disconnected = false

    func authorize(scopes: Set<String>) async throws {
        requestedScopes = scopes
    }

    func accessToken() async throws -> String { "test-token" }

    func disconnect() async { disconnected = true }

    func scopes() -> Set<String> { requestedScopes }
}

private actor MockTransport: FHIRTransport {
    var requestedURLs: [URL] = []

    func get(url: URL, bearerToken: String) async throws -> Data {
        #expect(bearerToken == "test-token")
        requestedURLs.append(url)
        let resourceType = url.pathComponents.last ?? ""
        return Data("{\"resourceType\":\"Bundle\",\"entry\":[]}".utf8)
    }

    func urls() -> [URL] { requestedURLs }
}

private let configuration = FHIRConnectionConfiguration(
    connectionID: "example-health",
    baseURL: URL(string: "https://fhir.example.org/r4")!,
    patientID: "patient-123",
    sourceName: "Example Health"
)

@Test("SMART scopes stay limited to selected clinical areas")
func scopedSMARTPermissions() {
    let scopes = FHIRClinicalRecordsClient.smartScopes(for: [.conditions, .labsAndResults])

    #expect(scopes.contains("patient/Patient.rs"))
    #expect(scopes.contains("patient/Condition.rs"))
    #expect(scopes.contains("patient/Observation.rs"))
    #expect(scopes.contains("patient/DiagnosticReport.rs"))
    #expect(!scopes.contains("patient/MedicationRequest.rs"))
    #expect(!scopes.contains("patient/Encounter.rs"))
}

@Test("FHIR Condition and laboratory Observation normalize into canonical MSH records")
func normalizesFHIRBundle() throws {
    let json = """
    {
      "resourceType": "Bundle",
      "type": "searchset",
      "entry": [
        {
          "resource": {
            "resourceType": "Condition",
            "id": "condition-1",
            "clinicalStatus": {"coding": [{"code": "active"}]},
            "code": {"coding": [{"system": "http://snomed.info/sct", "code": "38341003", "display": "Hypertensive disorder"}]},
            "recordedDate": "2026-08-15T14:30:00Z"
          }
        },
        {
          "resource": {
            "resourceType": "Observation",
            "id": "lab-1",
            "status": "final",
            "code": {"coding": [{"system": "http://loinc.org", "code": "718-7", "display": "Hemoglobin"}]},
            "effectiveDateTime": "2026-08-20T10:00:00Z",
            "valueQuantity": {"value": 13.2, "unit": "g/dL", "system": "http://unitsofmeasure.org", "code": "g/dL"}
          }
        }
      ]
    }
    """

    let records = try FHIRResourceMapper.mapBundle(
        Data(json.utf8),
        configuration: configuration,
        timezone: TimeZone(identifier: "America/Indiana/Indianapolis")!,
        importedAt: Date(timeIntervalSince1970: 1_780_000_000)
    )

    #expect(records.count == 2)
    let condition = try #require(records.first { $0.recordType == .clinicalCondition })
    #expect(condition.source.provider == .fhir)
    #expect(condition.source.sourceRecordID == "example-health:Condition/condition-1")
    #expect(condition.metadata["clinicalDisplay"] == "Hypertensive disorder")
    #expect(condition.metadata["clinicalStatus"] == "active")

    let lab = try #require(records.first { $0.recordType == .clinicalObservation })
    #expect(lab.value == 13.2)
    #expect(lab.unit == "g/dL")
    #expect(lab.metadata["observationCode"] == "718-7")
    #expect(lab.metadata["status"] == "final")
}

@Test("FHIR client queries only selected resources and carries incremental timestamp")
func scopedIncrementalSync() async throws {
    let authorization = MockAuthorization()
    let transport = MockTransport()
    let client = FHIRClinicalRecordsClient(
        configuration: configuration,
        authorization: authorization,
        transport: transport,
        timezone: TimeZone(secondsFromGMT: 0)!
    )

    let auth = await client.authorize(areas: [.medications])
    #expect(auth.outcome == .completed)
    #expect(await authorization.scopes() == ["patient/Patient.rs", "patient/MedicationRequest.rs"])

    let since = Date(timeIntervalSince1970: 1_780_000_000)
    _ = try await client.sync(FHIRSyncRequest(areas: [.medications], lastSuccessfulSyncAt: since))

    let urls = await transport.urls()
    #expect(urls.count == 1)
    let url = try #require(urls.first)
    #expect(url.path.hasSuffix("/MedicationRequest"))
    let components = try #require(URLComponents(url: url, resolvingAgainstBaseURL: false))
    let query = Dictionary(uniqueKeysWithValues: (components.queryItems ?? []).compactMap { item in
        item.value.map { (item.name, $0) }
    })
    #expect(query["patient"] == "patient-123")
    #expect(query["_count"] == "100")
    #expect(query["_lastUpdated"]?.hasPrefix("gt") == true)
}
