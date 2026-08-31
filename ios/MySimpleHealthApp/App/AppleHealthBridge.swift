import Foundation
import MSHAppleHealthKit
import MSHHealthCore
import UIKit
import WebKit

@MainActor
final class AppleHealthBridge: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?
    private var provider: AppleHealthKitProvider { MSHAppleHealthRuntime.provider }
    private var store: FileHealthStore { MSHAppleHealthRuntime.store }
    private var coordinator: HealthSyncCoordinator { MSHAppleHealthRuntime.coordinator }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "mshHealth", let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
        let requestID = body["requestId"] as? String
        let requestedAreas = Set((body["areas"] as? [String] ?? []).compactMap(HealthDataArea.init(rawValue:)))
        let requestedDateRange = Self.dateRange(
            startDate: body["startDate"] as? String,
            endDate: body["endDate"] as? String
        )
#if DEBUG
        print("[MSHHealth] action received:", action)
#endif
        MSHDebugLifecycle.log("healthkit_action_received", "action=\(action)")
        Task {
            MSHDebugLifecycle.log("healthkit_task_started", "action=\(action)")
            var responseAreas = requestedAreas
            do {
                switch action {
                case "connect":
                    let areas = requestedAreas.isEmpty ? Set([HealthDataArea.movement]) : requestedAreas
                    responseAreas = areas
#if DEBUG
                    print("[MSHHealth] connect/authorization started")
#endif
                    MSHDebugLifecycle.log("healthkit_authorization_started", "areas=\(areas.map(\.rawValue).sorted().joined(separator: ","))")
                    let result = try await coordinator.connect(areas: areas)
#if DEBUG
                    print("[MSHHealth] connect/authorization returned:", String(describing: result.outcome))
#endif
                    MSHDebugLifecycle.log("healthkit_authorization_finished", "outcome=\(String(describing: result.outcome))")
                    if result.outcome == .completed {
                        try await waitUntilApplicationIsActiveForFirstSync()
#if DEBUG
                        print("[MSHHealth] coordinator.sync() started")
#endif
                        MSHDebugLifecycle.log("healthkit_sync_started", "trigger=connect")
                        _ = try await coordinator.sync()
#if DEBUG
                        print("[MSHHealth] coordinator.sync() finished")
#endif
                        MSHDebugLifecycle.log("healthkit_sync_finished", "trigger=connect")
                    }
                case "sync":
#if DEBUG
                    print("[MSHHealth] coordinator.sync() started")
#endif
                    MSHDebugLifecycle.log("healthkit_sync_started", "trigger=explicit_sync")
                    _ = try await coordinator.sync(areas: requestedAreas.isEmpty ? nil : requestedAreas)
#if DEBUG
                    print("[MSHHealth] coordinator.sync() finished")
#endif
                    MSHDebugLifecycle.log("healthkit_sync_finished", "trigger=explicit_sync")
                case "disconnect": try await coordinator.disconnect()
                case "removeImportedData": try await coordinator.removeImportedRecords()
                case "manage":
                    if let url = URL(string: UIApplication.openSettingsURLString) { await UIApplication.shared.open(url) }
                case "calendarRange":
                    guard !requestedAreas.isEmpty, requestedDateRange != nil else {
                        await respond(requestID: requestID, action: action, error: true, areas: responseAreas)
                        return
                    }
                case "status": break
                default: return
                }
                MSHDebugLifecycle.log("healthkit_action_operations_complete", "action=\(action)")
                await respond(requestID: requestID, action: action, areas: responseAreas, dateRange: requestedDateRange)
                MSHDebugLifecycle.log("healthkit_task_complete", "action=\(action)")
            } catch {
                let nsError = error as NSError
#if DEBUG
                print("[MSHHealth] action failed:", action)
                print("[MSHHealth] error domain:", nsError.domain)
                print("[MSHHealth] error code:", nsError.code)
                print("[MSHHealth] error description:", nsError.localizedDescription)
#endif
                MSHDebugLifecycle.log(
                    "healthkit_action_failed",
                    "action=\(action) swiftType=\(String(reflecting: type(of: error))) domain=\(nsError.domain) code=\(nsError.code) description=\(nsError.localizedDescription)"
                )
                await respond(requestID: requestID, action: action, error: true, areas: responseAreas)
                MSHDebugLifecycle.log("healthkit_task_complete_after_error", "action=\(action)")
            }
        }
    }

    private func waitUntilApplicationIsActiveForFirstSync() async throws {
        let initialState = UIApplication.shared.applicationState
        guard initialState != .active else {
            MSHDebugLifecycle.log("healthkit_first_sync_application_active", "source=immediate")
            return
        }

        MSHDebugLifecycle.log(
            "healthkit_first_sync_waiting_for_application_active",
            "applicationState=\(String(describing: initialState))"
        )
        let notifications = NotificationCenter.default.notifications(
            named: UIApplication.didBecomeActiveNotification
        )

        // Close the small gap between the initial state read and observer setup.
        if UIApplication.shared.applicationState == .active {
            MSHDebugLifecycle.log("healthkit_first_sync_application_active", "source=observer_setup_recheck")
            return
        }

        for await _ in notifications {
            try Task.checkCancellation()
            let state = UIApplication.shared.applicationState
            MSHDebugLifecycle.log(
                "healthkit_first_sync_did_become_active_notification",
                "applicationState=\(String(describing: state))"
            )
            if state == .active {
                MSHDebugLifecycle.log("healthkit_first_sync_application_active", "source=notification")
                return
            }
        }

        try Task.checkCancellation()
    }

    private func respond(
        requestID: String?,
        action: String,
        error: Bool = false,
        areas: Set<HealthDataArea> = [],
        dateRange: DateInterval? = nil
    ) async {
        let storeFileSize = await store.diagnosticFileSize()
        MSHDebugLifecycle.log(
            "healthkit_response_before_state_read",
            "action=\(action) stateFileBytes=shared storeFileBytes=\(storeFileSize)"
        )
        let state = (try? await store.load(provider: .appleHealth)) ?? HealthSyncState(provider: .appleHealth)
        MSHDebugLifecycle.log(
            "healthkit_response_after_state_read",
            "action=\(action) stateSource=in_memory stateFileBytes=shared storeFileBytes=\(storeFileSize) selectedAreaCount=\(state.selectedAreas.count)"
        )
        // Startup status is metadata-only. Records are returned only for an
        // explicit, area-scoped import request so an unscoped action can never
        // duplicate the complete HealthKit store across Swift, JSON, Base64,
        // JavaScript source, and WebKit.
        let shouldIncludeRecords = ((action == "connect" || action == "sync") && !areas.isEmpty)
            || (action == "calendarRange" && !areas.isEmpty && dateRange != nil)
        let bridgeRecords: [HealthRecord]?
        if shouldIncludeRecords {
            MSHDebugLifecycle.log(
                "healthkit_response_before_record_read",
                "action=\(action) storeFileBytes=\(storeFileSize) requestedAreaCount=\(areas.count)"
            )
            let movementCutoff = Calendar.autoupdatingCurrent.date(byAdding: .day, value: -90, to: Date()) ?? .distantPast
            bridgeRecords = (try? await store.records(
                provider: .appleHealth,
                areas: areas,
                movementCutoff: action == "calendarRange" ? .distantPast : movementCutoff,
                dateRange: dateRange,
                calendarProjectionOnly: action == "calendarRange"
            )) ?? []
            MSHDebugLifecycle.log(
                "healthkit_response_after_record_read",
                "action=\(action) storeFileBytes=\(storeFileSize) recordCount=\(bridgeRecords?.count ?? 0)"
            )
            MSHDebugLifecycle.log(
                "healthkit_response_after_filtering",
                "action=\(action) filteringLocation=store responseRecordCount=\(bridgeRecords?.count ?? 0)"
            )
        } else {
            bridgeRecords = nil
            MSHDebugLifecycle.log(
                "healthkit_response_metadata_only",
                "action=\(action) responseRecordCount=0"
            )
        }
        let payload = BridgeResponse(
            requestId: requestID,
            error: error,
            state: BridgeState(
                available: provider.availability() == .available,
                connected: !state.selectedAreas.isEmpty,
                status: error ? "partial" : (!state.selectedAreas.isEmpty ? "connected" : "not_connected"),
                selectedAreas: state.selectedAreas.map(\.rawValue).sorted(),
                records: bridgeRecords,
                partialFailures: state.partialFailures,
                lastAttemptedSyncAt: state.lastAttemptedSyncAt,
                lastSuccessfulSyncAt: state.lastSuccessfulSyncAt
            )
        )
        guard let data = try? JSONEncoder.health.encode(payload) else {
            MSHDebugLifecycle.log("healthkit_response_encoding_failed", "action=\(action)")
            return
        }
        MSHDebugLifecycle.log(
            "healthkit_response_after_json_encoding",
            "action=\(action) responseRecordCount=\(bridgeRecords?.count ?? 0) encodedResponseBytes=\(data.count)"
        )
        let base64 = data.base64EncodedString()
        // Base64 keeps imported values out of source strings, URLs, and logs.
        let script = "window.MSHConnectedHealthReceive(JSON.parse(atob('\(base64)')))"
        MSHDebugLifecycle.log(
            "healthkit_response_before_javascript_callback",
            "action=\(action) encodedResponseBytes=\(data.count) base64Bytes=\(base64.utf8.count) scriptBytes=\(script.utf8.count)"
        )
        do {
            _ = try await webView?.evaluateJavaScript(script)
            MSHDebugLifecycle.log(
                "healthkit_response_after_javascript_callback",
                "action=\(action) encodedResponseBytes=\(data.count)"
            )
        } catch {
            let nsError = error as NSError
            MSHDebugLifecycle.log(
                "healthkit_response_javascript_callback_failed",
                "action=\(action) domain=\(nsError.domain) code=\(nsError.code) description=\(nsError.localizedDescription)"
            )
        }
    }

    private static func dateRange(startDate: String?, endDate: String?) -> DateInterval? {
        guard let startDate, let endDate else { return nil }
        let formatter = DateFormatter()
        formatter.calendar = .autoupdatingCurrent
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .autoupdatingCurrent
        formatter.dateFormat = "yyyy-MM-dd"
        guard let start = formatter.date(from: startDate),
              let inclusiveEnd = formatter.date(from: endDate),
              start <= inclusiveEnd,
              let exclusiveEnd = formatter.calendar.date(byAdding: .day, value: 1, to: inclusiveEnd) else { return nil }
        return DateInterval(start: start, end: exclusiveEnd)
    }
}

private struct BridgeResponse: Encodable { let requestId: String?; let error: Bool; let state: BridgeState }
private struct BridgeState: Encodable {
    let available: Bool
    let connected: Bool
    let status: String
    let selectedAreas: [String]
    let records: [HealthRecord]?
    let partialFailures: [String]
    let lastAttemptedSyncAt: Date?
    let lastSuccessfulSyncAt: Date?
}
