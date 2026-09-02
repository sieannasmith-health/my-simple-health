import Foundation
import Testing
@testable import MSHHealthCore

private actor MockProvider: HealthDataProvider {
    nonisolated let provider: HealthProvider = .appleHealth
    var batches: [Result<HealthSyncBatch, Error>]
    var authorization: HealthAuthorizationResult
    var requestedSyncAreas: [Set<HealthDataArea>] = []

    init(batches: [Result<HealthSyncBatch, Error>] = []) {
        self.batches = batches
        self.authorization = HealthAuthorizationResult(outcome: .completed, requestedAreas: [.movement])
    }

    nonisolated func availability() -> HealthProviderAvailability { .available }

    func requestAuthorization(for areas: Set<HealthDataArea>) async -> HealthAuthorizationResult {
        HealthAuthorizationResult(outcome: authorization.outcome, requestedAreas: areas, message: authorization.message)
    }

    func sync(_ request: HealthSyncRequest) async throws -> HealthSyncBatch {
        requestedSyncAreas.append(request.areas)
        guard !batches.isEmpty else { return HealthSyncBatch(records: []) }
        return try batches.removeFirst().get()
    }

    func lastRequestedSyncAreas() -> Set<HealthDataArea>? { requestedSyncAreas.last }
    func syncRequestCount() -> Int { requestedSyncAreas.count }

    func disconnect() async {}
}

@Test("scoped sync uses only previously selected areas")
func scopedSync() async throws {
    let provider = MockProvider()
    let records = InMemoryHealthRecordRepository()
    let states = InMemoryHealthSyncStateRepository()
    let coordinator = HealthSyncCoordinator(provider: provider, records: records, states: states)
    _ = try await coordinator.connect(areas: [.movement, .sleep])
    _ = try await coordinator.sync(areas: [.movement, .bodyMeasurements])

    #expect(await provider.lastRequestedSyncAreas() == [.movement])
}

private enum TestFailure: Error { case interrupted }

private func record(id: String, value: Double = 1, at date: Date = Date(timeIntervalSince1970: 1_700_000_000)) -> HealthRecord {
    HealthRecordFactory.imported(
        sourceRecordID: id,
        domain: .movement,
        recordType: .stepSample,
        value: value,
        unit: "count",
        start: date,
        end: date,
        timezone: TimeZone(identifier: "America/Indiana/Indianapolis")!,
        importedAt: date
    )
}

@Test("initial sync stores records and checkpoint")
func initialSync() async throws {
    let provider = MockProvider(batches: [.success(HealthSyncBatch(records: [record(id: "one")], checkpoints: ["step_count": Data([1])] ))])
    let records = InMemoryHealthRecordRepository()
    let states = InMemoryHealthSyncStateRepository()
    let coordinator = HealthSyncCoordinator(provider: provider, records: records, states: states)
    _ = try await coordinator.connect(areas: [.movement])
    _ = try await coordinator.sync()

    #expect(try await records.records(provider: .appleHealth).count == 1)
    #expect(try await states.load(provider: .appleHealth).checkpoints["step_count"] == Data([1]))
}

@Test("repeat UUID upserts instead of duplicating")
func upsertAndNoChanges() async throws {
    let provider = MockProvider(batches: [
        .success(HealthSyncBatch(records: [record(id: "same", value: 10)])),
        .success(HealthSyncBatch(records: [record(id: "same", value: 12)])),
        .success(HealthSyncBatch(records: []))
    ])
    let records = InMemoryHealthRecordRepository()
    let states = InMemoryHealthSyncStateRepository()
    let coordinator = HealthSyncCoordinator(provider: provider, records: records, states: states)
    _ = try await coordinator.connect(areas: [.movement])
    _ = try await coordinator.sync()
    _ = try await coordinator.sync()
    _ = try await coordinator.sync()

    let stored = try await records.records(provider: .appleHealth)
    #expect(stored.count == 1)
    #expect(stored.first?.value == 12)
}

@Test("source deletion removes imported record")
func deletion() async throws {
    let provider = MockProvider(batches: [
        .success(HealthSyncBatch(records: [record(id: "deleted")])) ,
        .success(HealthSyncBatch(records: [], deletedSourceRecordIDs: ["deleted"]))
    ])
    let records = InMemoryHealthRecordRepository()
    let states = InMemoryHealthSyncStateRepository()
    let coordinator = HealthSyncCoordinator(provider: provider, records: records, states: states)
    _ = try await coordinator.connect(areas: [.movement])
    _ = try await coordinator.sync()
    _ = try await coordinator.sync()
    #expect(try await records.records(provider: .appleHealth).isEmpty)
}

@Test("interrupted sync does not advance checkpoint and can resume")
func interruptedSync() async throws {
    let provider = MockProvider(batches: [
        .failure(TestFailure.interrupted),
        .success(HealthSyncBatch(records: [record(id: "resumed")], checkpoints: ["workout": Data([9])]))
    ])
    let records = InMemoryHealthRecordRepository()
    let states = InMemoryHealthSyncStateRepository()
    let coordinator = HealthSyncCoordinator(provider: provider, records: records, states: states)
    _ = try await coordinator.connect(areas: [.movement])
    await #expect(throws: TestFailure.self) { try await coordinator.sync() }
    #expect(try await states.load(provider: .appleHealth).checkpoints.isEmpty)
    _ = try await coordinator.sync()
    #expect(try await states.load(provider: .appleHealth).checkpoints["workout"] == Data([9]))
}

@Test("bounded pages persist and continue until caught up")
func boundedCatchUp() async throws {
    let provider = MockProvider(batches: [
        .success(HealthSyncBatch(
            records: [record(id: "page-one")],
            checkpoints: ["steps": Data([1])],
            requiresContinuation: true
        )),
        .success(HealthSyncBatch(
            records: [record(id: "page-two")],
            checkpoints: ["steps": Data([2])]
        ))
    ])
    let records = InMemoryHealthRecordRepository()
    let states = InMemoryHealthSyncStateRepository()
    let coordinator = HealthSyncCoordinator(provider: provider, records: records, states: states)
    _ = try await coordinator.connect(areas: [.movement])

    let passes = try await coordinator.syncUntilCaughtUp()

    #expect(passes == 2)
    #expect(await provider.syncRequestCount() == 2)
    #expect(try await records.records(provider: .appleHealth).count == 2)
    #expect(try await states.load(provider: .appleHealth).checkpoints["steps"] == Data([2]))
}

@Test("catch-up stops if a bounded page does not advance its checkpoint")
func stalledCatchUpStops() async throws {
    let provider = MockProvider(batches: [
        .success(HealthSyncBatch(records: [record(id: "stalled")], requiresContinuation: true)),
        .success(HealthSyncBatch(records: [record(id: "should-not-run")]))
    ])
    let records = InMemoryHealthRecordRepository()
    let states = InMemoryHealthSyncStateRepository()
    let coordinator = HealthSyncCoordinator(provider: provider, records: records, states: states)
    _ = try await coordinator.connect(areas: [.movement])

    let passes = try await coordinator.syncUntilCaughtUp()

    #expect(passes == 1)
    #expect(await provider.syncRequestCount() == 1)
    #expect(try await records.records(provider: .appleHealth).count == 1)
}

@Test("timestamps, timezone, units, and source provenance survive normalization")
func normalizedRecordContract() {
    let start = Date(timeIntervalSince1970: 1_730_611_800)
    let end = start.addingTimeInterval(2_700)
    let timezone = TimeZone(identifier: "America/New_York")!
    let workout = HealthRecordFactory.imported(
        sourceRecordID: "workout-uuid",
        domain: .movement,
        recordType: .workout,
        value: 2_700,
        unit: "s",
        start: start,
        end: end,
        timezone: timezone,
        sourceName: "Apple Watch",
        sourceDevice: "Watch",
        metadata: ["category": "strength", "sourceActivityType": "traditionalStrengthTraining"],
        importedAt: end
    )
    #expect(workout.eventStart == start)
    #expect(workout.eventEnd == end)
    #expect(workout.timezoneIdentifier == timezone.identifier)
    #expect(workout.unit == "s")
    #expect(workout.source.sourceRecordID == "workout-uuid")
    #expect(workout.provenance == "IMPORTED")
    #expect(workout.metadata["sourceActivityType"] == "traditionalStrengthTraining")
}
