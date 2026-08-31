import Foundation
import UserNotifications

enum MSHNotificationPermissionStatus: String, Equatable, Sendable {
    case notDetermined
    case denied
    case authorized
    case provisional
    case ephemeral
    case unknown

    init(_ status: UNAuthorizationStatus) {
        switch status {
        case .notDetermined: self = .notDetermined
        case .denied: self = .denied
        case .authorized: self = .authorized
        case .provisional: self = .provisional
        case .ephemeral: self = .ephemeral
        @unknown default: self = .unknown
        }
    }

    var canSchedule: Bool {
        switch self {
        case .authorized, .provisional, .ephemeral: true
        case .notDetermined, .denied, .unknown: false
        }
    }
}

enum MSHNotificationType: String, Equatable, Sendable {
    case workoutReminder = "workout_reminder"
    case medicationRefillReady = "medication_refill_ready"
    case medicationRunLow = "medication_run_low"
    case medicationRefillFollowUp = "medication_refill_follow_up"
    case calendarReminder = "calendar_reminder"

    static func inferred(identifier: String, route: String) -> Self {
        let searchable = (identifier + " " + route).lowercased()
        if searchable.contains("medication") {
            if searchable.contains("run-low") || searchable.contains("run_low") { return .medicationRunLow }
            if searchable.contains("follow-up") || searchable.contains("follow_up") { return .medicationRefillFollowUp }
            return .medicationRefillReady
        }
        if searchable.contains("workout") || searchable.contains("view=movement") { return .workoutReminder }
        return .calendarReminder
    }
}

enum MSHNotificationIdentifier {
    static func workout(eventID: String) -> String {
        "msh-workout-\(component(eventID))-reminder"
    }

    static func medication(eventID: String, type: MSHNotificationType) -> String {
        let suffix: String
        switch type {
        case .medicationRefillReady: suffix = "refill-ready"
        case .medicationRunLow: suffix = "run-low"
        case .medicationRefillFollowUp: suffix = "refill-follow-up"
        case .workoutReminder, .calendarReminder: suffix = type.rawValue.replacingOccurrences(of: "_", with: "-")
        }
        return "msh-medication-\(component(eventID))-\(suffix)"
    }

    static func calendar(eventID: String) -> String {
        "msh-calendar-\(component(eventID))-reminder"
    }

    private static func component(_ value: String) -> String {
        let normalized = value.lowercased().unicodeScalars.map { scalar -> Character in
            CharacterSet.alphanumerics.contains(scalar) ? Character(String(scalar)) : "-"
        }
        let collapsed = String(normalized)
            .split(separator: "-", omittingEmptySubsequences: true)
            .joined(separator: "-")
        return collapsed.isEmpty ? "event" : collapsed
    }
}

struct MSHLocalNotification: Equatable, Sendable {
    let identifier: String
    let title: String
    let body: String
    let date: Date
    let route: MSHWebRoute
    let eventID: String
    let type: MSHNotificationType
}

enum MSHNotificationScheduleOutcome: String, Equatable, Sendable {
    case scheduled
    case replaced
}

enum MSHNotificationServiceError: LocalizedError, Equatable {
    case invalidIdentifier
    case notificationPermissionUnavailable(MSHNotificationPermissionStatus)
    case dateIsNotInFuture

    var errorDescription: String? {
        switch self {
        case .invalidIdentifier:
            "Notification identifiers must be deterministic MSH identifiers beginning with msh-."
        case .notificationPermissionUnavailable(let status):
            "Notification permission is not available (\(status.rawValue))."
        case .dateIsNotInFuture:
            "A local notification must be scheduled for a future date."
        }
    }
}

protocol MSHUserNotificationCenter: Sendable {
    func authorizationStatus() async -> UNAuthorizationStatus
    func requestAuthorization(options: UNAuthorizationOptions) async throws -> Bool
    func add(_ request: UNNotificationRequest) async throws
    func pendingNotificationRequests() async -> [UNNotificationRequest]
    func removePendingRequests(withIdentifiers identifiers: [String]) async
}

extension UNUserNotificationCenter: MSHUserNotificationCenter {
    func authorizationStatus() async -> UNAuthorizationStatus {
        await notificationSettings().authorizationStatus
    }

    func removePendingRequests(withIdentifiers identifiers: [String]) async {
        removePendingNotificationRequests(withIdentifiers: identifiers)
    }
}

actor MSHNotificationService {
    static let shared = MSHNotificationService(center: UNUserNotificationCenter.current())

    private enum UserInfoKey {
        static let route = "mshRoute"
        static let eventID = "mshEventID"
        static let type = "mshNotificationType"
    }

    private let center: any MSHUserNotificationCenter
    private let now: @Sendable () -> Date

    init(
        center: any MSHUserNotificationCenter,
        now: @escaping @Sendable () -> Date = Date.init
    ) {
        self.center = center
        self.now = now
    }

    func authorizationStatus() async -> MSHNotificationPermissionStatus {
        let status = MSHNotificationPermissionStatus(await center.authorizationStatus())
        MSHDebugLifecycle.log("notification_permission_state", "status=\(status.rawValue)")
        return status
    }

    func requestAuthorization() async throws -> MSHNotificationPermissionStatus {
        let current = await authorizationStatus()
        if current == .notDetermined {
            _ = try await center.requestAuthorization(options: [.alert, .badge, .sound])
        }
        let updated = MSHNotificationPermissionStatus(await center.authorizationStatus())
        MSHDebugLifecycle.log("notification_permission_state", "status=\(updated.rawValue) source=request")
        return updated
    }

    func schedule(_ notification: MSHLocalNotification) async throws -> MSHNotificationScheduleOutcome {
        guard notification.identifier.hasPrefix("msh-"),
              !notification.identifier.contains(where: { $0.isWhitespace }) else {
            throw MSHNotificationServiceError.invalidIdentifier
        }
        guard notification.date > now() else {
            throw MSHNotificationServiceError.dateIsNotInFuture
        }

        let status = await authorizationStatus()
        guard status.canSchedule else {
            throw MSHNotificationServiceError.notificationPermissionUnavailable(status)
        }

        let pending = await center.pendingNotificationRequests()
        let outcome: MSHNotificationScheduleOutcome = pending.contains {
            $0.identifier == notification.identifier
        } ? .replaced : .scheduled

        let content = UNMutableNotificationContent()
        content.title = notification.title
        content.body = notification.body
        content.sound = .default
        content.threadIdentifier = "msh-event:\(notification.eventID)"
        content.userInfo = [
            UserInfoKey.route: notification.route.rawValue,
            UserInfoKey.eventID: notification.eventID,
            UserInfoKey.type: notification.type.rawValue
        ]

        let trigger = UNCalendarNotificationTrigger(
            dateMatching: Calendar.autoupdatingCurrent.dateComponents(
                [.year, .month, .day, .hour, .minute, .second],
                from: notification.date
            ),
            repeats: false
        )
        try await center.add(UNNotificationRequest(
            identifier: notification.identifier,
            content: content,
            trigger: trigger
        ))

        let event = outcome == .replaced ? "notification_replaced" : "notification_scheduled"
        MSHDebugLifecycle.log(
            event,
            "id=\(notification.identifier) type=\(notification.type.rawValue) eventID=\(notification.eventID) route=\(notification.route.rawValue)"
        )
        return outcome
    }

    @discardableResult
    func cancel(identifier: String) async -> Bool {
        let pending = await center.pendingNotificationRequests()
        let existed = pending.contains { $0.identifier == identifier }
        await center.removePendingRequests(withIdentifiers: [identifier])
        MSHDebugLifecycle.log("notification_canceled", "id=\(identifier) existed=\(existed)")
        return existed
    }

    @discardableResult
    func cancelNotifications(eventID: String) async -> [String] {
        let pending = await center.pendingNotificationRequests()
        let identifiers = pending.compactMap { request -> String? in
            request.content.userInfo[UserInfoKey.eventID] as? String == eventID
                ? request.identifier
                : nil
        }
        await center.removePendingRequests(withIdentifiers: identifiers)
        MSHDebugLifecycle.log(
            "notification_event_canceled",
            "eventID=\(eventID) count=\(identifiers.count) ids=\(identifiers.sorted().joined(separator: ","))"
        )
        return identifiers
    }
}
