import Foundation
import WebKit

@MainActor
final class MSHNotificationBridge: NSObject, WKScriptMessageHandler {
    static let handlerName = "mshNotifications"

    weak var webView: WKWebView?
    private let service: MSHNotificationService

    init(service: MSHNotificationService = .shared) {
        self.service = service
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == Self.handlerName,
              let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }
        let requestID = body["requestId"] as? String
        MSHDebugLifecycle.log("notification_bridge_action_received", "action=\(action)")

        Task {
            do {
                switch action {
                case "requestNotificationAuthorization":
                    let status = try await service.requestAuthorization()
                    await respond(requestID: requestID, action: action, status: status)
                case "notificationStatus":
                    let status = await service.authorizationStatus()
                    await respond(requestID: requestID, action: action, status: status)
                case "scheduleNotification":
                    let notification = try Self.notification(from: body)
                    let outcome = try await service.schedule(notification)
                    await respond(
                        requestID: requestID,
                        action: action,
                        identifier: notification.identifier,
                        outcome: outcome
                    )
                case "cancelNotification":
                    guard let identifier = body["id"] as? String, !identifier.isEmpty else {
                        throw BridgeError.missingField("id")
                    }
                    let canceled = await service.cancel(identifier: identifier)
                    await respond(
                        requestID: requestID,
                        action: action,
                        identifier: identifier,
                        canceledCount: canceled ? 1 : 0
                    )
                case "cancelNotificationsForEvent":
                    guard let eventID = body["eventId"] as? String, !eventID.isEmpty else {
                        throw BridgeError.missingField("eventId")
                    }
                    let canceled = await service.cancelNotifications(eventID: eventID)
                    await respond(
                        requestID: requestID,
                        action: action,
                        canceledCount: canceled.count
                    )
                default:
                    throw BridgeError.unsupportedAction(action)
                }
            } catch {
                MSHDebugLifecycle.log(
                    "notification_bridge_action_failed",
                    "action=\(action) swiftType=\(String(reflecting: type(of: error))) description=\(error.localizedDescription)"
                )
                await respond(
                    requestID: requestID,
                    action: action,
                    error: error.localizedDescription
                )
            }
        }
    }

    static func notification(from body: [String: Any]) throws -> MSHLocalNotification {
        let identifier = try requiredString("id", in: body)
        let title = try requiredString("title", in: body)
        let message = try requiredString("body", in: body)
        let dateValue = try requiredString("date", in: body)
        let routeValue = try requiredString("route", in: body)
        guard let date = dateFormatter.date(from: dateValue) ?? fractionalDateFormatter.date(from: dateValue) else {
            throw BridgeError.invalidDate(dateValue)
        }
        guard let route = MSHWebRoute(rawValue: routeValue) else {
            throw BridgeError.invalidRoute(routeValue)
        }
        let type = (body["type"] as? String).flatMap(MSHNotificationType.init(rawValue:))
            ?? MSHNotificationType.inferred(identifier: identifier, route: routeValue)
        let eventID = (body["eventId"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        return MSHLocalNotification(
            identifier: identifier,
            title: title,
            body: message,
            date: date,
            route: route,
            eventID: eventID?.isEmpty == false ? eventID! : identifier,
            type: type
        )
    }

    private func respond(
        requestID: String?,
        action: String,
        status: MSHNotificationPermissionStatus? = nil,
        identifier: String? = nil,
        outcome: MSHNotificationScheduleOutcome? = nil,
        canceledCount: Int? = nil,
        error: String? = nil
    ) async {
        let response = BridgeResponse(
            requestId: requestID,
            action: action,
            status: status?.rawValue,
            identifier: identifier,
            outcome: outcome?.rawValue,
            canceledCount: canceledCount,
            error: error
        )
        guard let data = try? JSONEncoder().encode(response) else { return }
        let script = "window.MSHNotificationsReceive(JSON.parse(atob('\(data.base64EncodedString())')))"
        do {
            _ = try await webView?.evaluateJavaScript(script)
        } catch {
            MSHDebugLifecycle.log(
                "notification_bridge_callback_failed",
                "action=\(action) description=\(error.localizedDescription)"
            )
        }
    }

    private static func requiredString(_ key: String, in body: [String: Any]) throws -> String {
        guard let value = body[key] as? String,
              !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw BridgeError.missingField(key)
        }
        return value
    }

    private static let dateFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private static let fractionalDateFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private enum BridgeError: LocalizedError {
        case missingField(String)
        case invalidDate(String)
        case invalidRoute(String)
        case unsupportedAction(String)

        var errorDescription: String? {
            switch self {
            case .missingField(let field): "Missing required notification field: \(field)."
            case .invalidDate(let date): "Invalid ISO-8601 notification date: \(date)."
            case .invalidRoute(let route): "Invalid local MSH notification route: \(route)."
            case .unsupportedAction(let action): "Unsupported notification action: \(action)."
            }
        }
    }
}

private struct BridgeResponse: Encodable {
    let requestId: String?
    let action: String
    let status: String?
    let identifier: String?
    let outcome: String?
    let canceledCount: Int?
    let error: String?
}
