import Foundation
import MSHAppleHealthKit
import MSHHealthCore
import UIKit

@MainActor
enum MSHAppleHealthRuntime {
    static let provider = AppleHealthKitProvider()
    static let store = FileHealthStore()
    static let coordinator = HealthSyncCoordinator(
        provider: provider,
        records: store,
        states: store
    )

    static func connect(areas: Set<HealthDataArea>) async throws -> HealthAuthorizationResult {
        let result = try await coordinator.connect(areas: areas)
        guard result.outcome == .completed else { return result }

        if UIApplication.shared.applicationState != .active {
            let notifications = NotificationCenter.default.notifications(
                named: UIApplication.didBecomeActiveNotification
            )
            if UIApplication.shared.applicationState != .active {
                for await _ in notifications {
                    try Task.checkCancellation()
                    if UIApplication.shared.applicationState == .active { break }
                }
            }
        }

        MSHDebugLifecycle.log(
            "healthkit_sync_started",
            "trigger=progressive_setup areas=\(areas.map(\.rawValue).sorted().joined(separator: ","))"
        )
        let passes = try await coordinator.syncUntilCaughtUp(areas: areas)
        MSHDebugLifecycle.log("healthkit_sync_finished", "trigger=progressive_setup passes=\(passes)")
        return result
    }

    static func refreshConnectedHealth() async throws {
        guard UIApplication.shared.applicationState == .active else { return }

        var state = try await store.load(provider: .appleHealth)
        let areas = state.selectedAreas

        // Never turn a routine dashboard refresh into a permission prompt.
        // Initial authorization only happens through the explicit progressive setup.
        guard !areas.isEmpty else { return }

        // A checkpoint can survive while the local SQLite cache is empty. In that
        // state an anchored HealthKit query correctly returns only changes after the
        // checkpoint, leaving My Health empty forever. Reset only the incremental
        // cursor so the provider performs its existing bounded first-sync lookback.
        let localRecordCount = (try? await store.diagnosticRecordCount()) ?? 0
        if localRecordCount == 0 && (!state.checkpoints.isEmpty || state.lastSuccessfulSyncAt != nil) {
            state.checkpoints = [:]
            state.lastSuccessfulSyncAt = nil
            state.lastAttemptedSyncAt = nil
            state.partialFailures = []
            try await store.save(state)
            MSHDebugLifecycle.log(
                "healthkit_empty_cache_repair",
                "trigger=my_health_refresh resetCheckpoints=true"
            )
        }

        MSHDebugLifecycle.log(
            "healthkit_sync_started",
            "trigger=my_health_refresh areas=\(areas.map(\.rawValue).sorted().joined(separator: ",")) localRecordCount=\(localRecordCount)"
        )
        let passes = try await coordinator.syncUntilCaughtUp(areas: areas)
        let finalState = try await store.load(provider: .appleHealth)
        MSHDebugLifecycle.log(
            "healthkit_sync_finished",
            "trigger=my_health_refresh passes=\(passes) partialFailures=\(finalState.partialFailures.count)"
        )
    }
}
