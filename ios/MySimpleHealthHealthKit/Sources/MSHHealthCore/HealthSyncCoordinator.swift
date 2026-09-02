import Foundation

#if DEBUG
private func mshCoordinatorDiagnostic(_ event: String, _ details: String = "") {
    let suffix = details.isEmpty ? "" : " \(details)"
    print("[MSHHealthDiagnostic] component=coordinator event=\(event)\(suffix)")
}
#else
private func mshCoordinatorDiagnostic(_ event: String, _ details: String = "") {}
#endif

public actor HealthSyncCoordinator {
    private let provider: any HealthDataProvider
    private let records: any HealthRecordRepository
    private let states: any HealthSyncStateRepository

    public init(
        provider: any HealthDataProvider,
        records: any HealthRecordRepository,
        states: any HealthSyncStateRepository
    ) {
        self.provider = provider
        self.records = records
        self.states = states
    }

    @discardableResult
    public func connect(areas: Set<HealthDataArea>) async throws -> HealthAuthorizationResult {
        let result = await provider.requestAuthorization(for: areas)
        guard result.outcome == .completed else { return result }
        var state = try await states.load(provider: provider.provider)
        state.selectedAreas = areas
        try await states.save(state)
        return result
    }

    @discardableResult
    public func sync(areas requestedAreas: Set<HealthDataArea>? = nil) async throws -> HealthSyncBatch {
        mshCoordinatorDiagnostic("sync_start", "requestedAreas=\(requestedAreas?.map(\.rawValue).sorted().joined(separator: ",") ?? "all_selected")")
        do {
            var state = try await states.load(provider: provider.provider)
            mshCoordinatorDiagnostic("state_loaded", "selectedAreas=\(state.selectedAreas.map(\.rawValue).sorted().joined(separator: ",")) checkpointCount=\(state.checkpoints.count) hasLastSuccessful=\(state.lastSuccessfulSyncAt != nil)")
            state.lastAttemptedSyncAt = Date()
            mshCoordinatorDiagnostic("last_attempt_persist_start")
            try await states.save(state)
            mshCoordinatorDiagnostic("last_attempt_persist_complete")

            let areas = requestedAreas.map { $0.intersection(state.selectedAreas) } ?? state.selectedAreas
            guard !areas.isEmpty else {
                mshCoordinatorDiagnostic("sync_skipped", "reason=no_selected_areas")
                return HealthSyncBatch(records: [], partialFailures: state.partialFailures)
            }

            let request = HealthSyncRequest(
                areas: areas,
                checkpoints: state.checkpoints,
                lastSuccessfulSyncAt: state.lastSuccessfulSyncAt
            )
            mshCoordinatorDiagnostic("provider_sync_start", "areas=\(areas.map(\.rawValue).sorted().joined(separator: ","))")
            let batch = try await provider.sync(request)
            mshCoordinatorDiagnostic("provider_sync_complete", "recordCount=\(batch.records.count) deletedCount=\(batch.deletedSourceRecordIDs.count) checkpointCount=\(batch.checkpoints.count) failureCount=\(batch.partialFailures.count) requiresContinuation=\(batch.requiresContinuation)")

            // Checkpoints advance only after the record transaction succeeds.
            mshCoordinatorDiagnostic("record_persistence_start", "recordCount=\(batch.records.count) deletedCount=\(batch.deletedSourceRecordIDs.count)")
            try await records.apply(
                records: batch.records,
                deletedSourceRecordIDs: batch.deletedSourceRecordIDs,
                provider: provider.provider
            )
            mshCoordinatorDiagnostic("record_persistence_complete")
            mshCoordinatorDiagnostic("checkpoint_merge_start", "incomingCount=\(batch.checkpoints.count)")
            state.checkpoints.merge(batch.checkpoints) { _, latest in latest }
            mshCoordinatorDiagnostic("checkpoint_merge_complete", "mergedCount=\(state.checkpoints.count)")
            state.lastSuccessfulSyncAt = batch.completedAt
            state.partialFailures = batch.partialFailures
            mshCoordinatorDiagnostic("checkpoint_state_persist_start")
            try await states.save(state)
            mshCoordinatorDiagnostic("checkpoint_state_persist_complete")
            mshCoordinatorDiagnostic("sync_complete")
            return batch
        } catch {
            let nsError = error as NSError
            mshCoordinatorDiagnostic("sync_error", "swiftType=\(String(reflecting: type(of: error))) domain=\(nsError.domain) code=\(nsError.code) description=\(nsError.localizedDescription)")
            throw error
        }
    }

    /// Continues bounded provider pages while persisting every page before the
    /// next one. This keeps peak memory bounded and lets an interrupted catch-up
    /// resume from the most recently committed HealthKit anchor.
    @discardableResult
    public func syncUntilCaughtUp(
        areas requestedAreas: Set<HealthDataArea>? = nil,
        maxPasses: Int = 32
    ) async throws -> Int {
        guard maxPasses > 0 else { return 0 }

        var passes = 0
        while passes < maxPasses {
            try Task.checkCancellation()
            let stateBeforePass = try await states.load(provider: provider.provider)
            let batch = try await sync(areas: requestedAreas)
            passes += 1

            guard batch.requiresContinuation else {
                mshCoordinatorDiagnostic("catch_up_complete", "passes=\(passes)")
                return passes
            }

            let stateAfterPass = try await states.load(provider: provider.provider)
            guard stateAfterPass.checkpoints != stateBeforePass.checkpoints else {
                mshCoordinatorDiagnostic("catch_up_stalled", "passes=\(passes) reason=checkpoint_not_advanced")
                return passes
            }
            mshCoordinatorDiagnostic("catch_up_continue", "completedPasses=\(passes)")
        }

        mshCoordinatorDiagnostic("catch_up_pass_limit_reached", "passes=\(passes)")
        return passes
    }

    public func disconnect() async throws {
        await provider.disconnect()
        try await states.clear(provider: provider.provider)
    }

    public func removeImportedRecords() async throws {
        try await records.removeRecords(provider: provider.provider)
    }
}
