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
        let state = try await store.load(provider: .appleHealth)
        let areas = state.selectedAreas
        guard !areas.isEmpty else { return }
        guard UIApplication.shared.applicationState == .active else { return }

        MSHDebugLifecycle.log(
            "healthkit_sync_started",
            "trigger=my_health_refresh areas=\(areas.map(\.rawValue).sorted().joined(separator: ","))"
        )
        _ = try await coordinator.sync(areas: areas)
        MSHDebugLifecycle.log("healthkit_sync_finished", "trigger=my_health_refresh")
    }
}
