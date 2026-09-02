import Foundation
import SwiftUI
import UIKit
import UserNotifications

struct MSHWebRoute: RawRepresentable, Hashable, Identifiable, Sendable {
    let rawValue: String

    var id: String { rawValue }

    init?(rawValue: String) {
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              !trimmed.hasPrefix("/"),
              !trimmed.contains(".."),
              !trimmed.contains("#"),
              let components = URLComponents(string: trimmed),
              components.scheme == nil,
              components.host == nil,
              components.path.hasSuffix(".html") else { return nil }
        self.rawValue = trimmed
    }

    init(destination: MSHFeatureDestination) {
        rawValue = [destination.path, destination.query]
            .compactMap { $0 }
            .joined(separator: "?")
    }

    var appSection: MSHAppSection {
        guard let components = URLComponents(string: rawValue) else { return .calendar }
        switch components.path {
        case "my-health.html":
            let view = components.queryItems?.first(where: { $0.name == "view" })?.value
            return view == "explore" ? .tools : .myHealth
        case "calendar.html": return .calendar
        case "movement-library.html": return .movement
        case "my-health-story.html", "health-patterns-preview.html": return .track
        default: return .tools
        }
    }
}

@MainActor
final class MSHNotificationRouter: ObservableObject {
    static let shared = MSHNotificationRouter()

    @Published private(set) var route: MSHWebRoute?

    func open(_ route: MSHWebRoute) {
        self.route = route
        MSHDebugLifecycle.log("notification_deep_link", "route=\(route.rawValue) section=\(route.appSection.rawValue)")
    }

    func clear() {
        route = nil
    }
}

final class MSHApplicationDelegate: NSObject, UIApplicationDelegate {
    private let notificationDelegate = MSHNotificationDelegate()

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = notificationDelegate
#if DEBUG
        MSHNotificationDebugHarness.runIfRequested()
#endif
        return true
    }
}

private final class MSHNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let identifier = response.notification.request.identifier
        let userInfo = response.notification.request.content.userInfo
        let routeValue = userInfo["mshRoute"] as? String
        let actionIdentifier = response.actionIdentifier
        MSHDebugLifecycle.log(
            "notification_opened",
            "id=\(identifier) route=\(routeValue ?? "nil") action=\(actionIdentifier)"
        )
        if let routeValue, let route = MSHWebRoute(rawValue: routeValue) {
            Task { @MainActor in
                MSHNotificationRouter.shared.open(route)
            }
        }
        completionHandler()
    }
}

#if DEBUG
private enum MSHNotificationDebugHarness {
    static func runIfRequested(environment: [String: String] = ProcessInfo.processInfo.environment) {
        let eventID = "debug-workout-reminder"
        let identifier = MSHNotificationIdentifier.workout(eventID: eventID)
        if environment["MSH_NOTIFICATION_TEST_ACTION"] == "cancel" {
            Task {
                let canceled = await MSHNotificationService.shared.cancel(identifier: identifier)
                MSHDebugLifecycle.log("notification_test_cancel_complete", "canceled=\(canceled)")
            }
            return
        }
        guard let rawDelay = environment["MSH_NOTIFICATION_TEST_DELAY_SECONDS"],
              let delay = TimeInterval(rawDelay),
              delay > 0 else { return }

        Task {
            do {
                let status = try await MSHNotificationService.shared.requestAuthorization()
                guard status.canSchedule else {
                    MSHDebugLifecycle.log("notification_test_not_scheduled", "status=\(status.rawValue)")
                    return
                }
                let route = MSHWebRoute(rawValue: "calendar.html?view=movement")!
                let notification = MSHLocalNotification(
                    identifier: identifier,
                    title: "Movement reminder",
                    body: "Your planned movement is ready when you are.",
                    date: Date().addingTimeInterval(delay),
                    route: route,
                    eventID: eventID,
                    type: .workoutReminder
                )
                _ = try await MSHNotificationService.shared.schedule(notification)
                MSHDebugLifecycle.log("notification_test_ready", "delaySeconds=\(delay)")
            } catch {
                MSHDebugLifecycle.log(
                    "notification_test_failed",
                    "swiftType=\(String(reflecting: type(of: error))) description=\(error.localizedDescription)"
                )
            }
        }
    }
}
#endif
