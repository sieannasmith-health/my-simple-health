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

    static func connectForOnboarding() async throws -> HealthAuthorizationResult {
        let areas = Set(HealthDataArea.allCases)
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
            "trigger=onboarding areas=\(areas.map(\.rawValue).sorted().joined(separator: ","))"
        )
        _ = try await coordinator.sync(areas: areas)
        MSHDebugLifecycle.log("healthkit_sync_finished", "trigger=onboarding")
        return result
    }

    static func refreshConnectedHealth() async throws {
        guard UIApplication.shared.applicationState == .active else { return }

        var state = try await store.load(provider: .appleHealth)
        var areas = state.selectedAreas

        // Recover installations that still have HealthKit authorization but lost the
        // local selected-area state during the auth/backend migration. HealthKit does
        // not re-prompt for permissions the user has already answered.
        if areas.isEmpty {
            let requestedAreas = Set(HealthDataArea.allCases)
            MSHDebugLifecycle.log(
                "healthkit_connection_repair_started",
                "trigger=my_health_refresh"
            )
            let authorization = try await coordinator.connect(areas: requestedAreas)
            guard authorization.outcome == .completed else {
                MSHDebugLifecycle.log(
                    "healthkit_connection_repair_skipped",
                    "reason=authorization_not_completed"
                )
                return
            }
            state = try await store.load(provider: .appleHealth)
            areas = state.selectedAreas
            MSHDebugLifecycle.log(
                "healthkit_connection_repair_finished",
                "areas=\(areas.map(\.rawValue).sorted().joined(separator: ","))"
            )
        }

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
        let batch = try await coordinator.sync(areas: areas)
        MSHDebugLifecycle.log(
            "healthkit_sync_finished",
            "trigger=my_health_refresh imported=\(batch.records.count) partialFailures=\(batch.partialFailures.count)"
        )
    }
}
