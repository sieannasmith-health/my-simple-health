import Foundation
import UserNotifications
import XCTest
@testable import MySimpleHealth

final class MSHNotificationTests: XCTestCase {
    private actor NotificationCenter: MSHUserNotificationCenter {
        var status: UNAuthorizationStatus
        var requests: [String: UNNotificationRequest] = [:]
        var authorizationRequestCount = 0

        init(status: UNAuthorizationStatus) {
            self.status = status
        }

        func authorizationStatus() -> UNAuthorizationStatus { status }

        func requestAuthorization(options: UNAuthorizationOptions) -> Bool {
            authorizationRequestCount += 1
            status = .authorized
            return true
        }

        func add(_ request: UNNotificationRequest) {
            requests[request.identifier] = request
        }

        func pendingNotificationRequests() -> [UNNotificationRequest] {
            Array(requests.values)
        }

        func removePendingRequests(withIdentifiers identifiers: [String]) {
            for identifier in identifiers { requests.removeValue(forKey: identifier) }
        }

        func requestCount() -> Int { authorizationRequestCount }
        func storedRequests() -> [UNNotificationRequest] { Array(requests.values) }
    }

    func testDeterministicIdentifiersRemainStableForEveryInitialType() {
        XCTAssertEqual(
            MSHNotificationIdentifier.workout(eventID: "Movement Plan 42"),
            "msh-workout-movement-plan-42-reminder"
        )
        XCTAssertEqual(
            MSHNotificationIdentifier.medication(eventID: "Rx 123", type: .medicationRefillReady),
            "msh-medication-rx-123-refill-ready"
        )
        XCTAssertEqual(
            MSHNotificationIdentifier.medication(eventID: "Rx 123", type: .medicationRunLow),
            "msh-medication-rx-123-run-low"
        )
        XCTAssertEqual(
            MSHNotificationIdentifier.medication(eventID: "Rx 123", type: .medicationRefillFollowUp),
            "msh-medication-rx-123-refill-follow-up"
        )
        XCTAssertEqual(
            MSHNotificationIdentifier.calendar(eventID: "Appointment 7"),
            "msh-calendar-appointment-7-reminder"
        )
    }

    func testPermissionRequestOccursOnlyWhileStatusIsNotDetermined() async throws {
        let center = NotificationCenter(status: .notDetermined)
        let service = MSHNotificationService(center: center)

        let firstStatus = try await service.requestAuthorization()
        let secondStatus = try await service.requestAuthorization()
        let requestCount = await center.requestCount()
        XCTAssertEqual(firstStatus, .authorized)
        XCTAssertEqual(secondStatus, .authorized)
        XCTAssertEqual(requestCount, 1)
    }

    func testReschedulingSameIdentifierReplacesRatherThanDuplicates() async throws {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let center = NotificationCenter(status: .authorized)
        let service = MSHNotificationService(center: center, now: { now })
        let original = notification(
            id: "msh-workout-42-reminder",
            body: "Original",
            date: now.addingTimeInterval(60)
        )
        let updated = notification(
            id: original.identifier,
            body: "Updated",
            date: now.addingTimeInterval(120)
        )

        let originalOutcome = try await service.schedule(original)
        let updatedOutcome = try await service.schedule(updated)
        XCTAssertEqual(originalOutcome, .scheduled)
        XCTAssertEqual(updatedOutcome, .replaced)

        let requests = await center.storedRequests()
        XCTAssertEqual(requests.count, 1)
        XCTAssertEqual(requests.first?.content.body, "Updated")
    }

    func testCancelOneRemovesOnlyItsPendingRequest() async throws {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let center = NotificationCenter(status: .authorized)
        let service = MSHNotificationService(center: center, now: { now })
        _ = try await service.schedule(notification(id: "msh-calendar-one-reminder", date: now.addingTimeInterval(60)))
        _ = try await service.schedule(notification(id: "msh-calendar-two-reminder", date: now.addingTimeInterval(60)))

        let canceled = await service.cancel(identifier: "msh-calendar-one-reminder")
        let remaining = await center.storedRequests().map(\.identifier)
        XCTAssertTrue(canceled)
        XCTAssertEqual(remaining, ["msh-calendar-two-reminder"])
    }

    func testCancelEventRemovesEveryNotificationAssociatedWithThatEvent() async throws {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let center = NotificationCenter(status: .authorized)
        let service = MSHNotificationService(center: center, now: { now })
        _ = try await service.schedule(notification(
            id: "msh-medication-rx-refill-ready",
            date: now.addingTimeInterval(60),
            eventID: "rx"
        ))
        _ = try await service.schedule(notification(
            id: "msh-medication-rx-follow-up",
            date: now.addingTimeInterval(120),
            eventID: "rx"
        ))
        _ = try await service.schedule(notification(
            id: "msh-calendar-appointment-reminder",
            date: now.addingTimeInterval(180),
            eventID: "appointment"
        ))

        let canceled = await service.cancelNotifications(eventID: "rx")

        let remaining = await center.storedRequests().map(\.identifier)
        XCTAssertEqual(Set(canceled), ["msh-medication-rx-refill-ready", "msh-medication-rx-follow-up"])
        XCTAssertEqual(remaining, ["msh-calendar-appointment-reminder"])
    }

    @MainActor
    func testBridgeDecodesSuggestedMedicationContractAndInfersType() throws {
        let request = try MSHNotificationBridge.notification(from: [
            "action": "scheduleNotification",
            "id": "msh-medication-123-refill",
            "title": "Refill request ready",
            "body": "Your medication refill action is ready to review.",
            "date": "2026-09-05T09:00:00Z",
            "route": "calendar.html?view=medications"
        ])

        XCTAssertEqual(request.type, .medicationRefillReady)
        XCTAssertEqual(request.eventID, request.identifier)
        XCTAssertEqual(request.route.rawValue, "calendar.html?view=medications")
        XCTAssertEqual(request.route.appSection, .calendar)
    }

    func testRoutesRejectExternalAndTraversalDestinations() {
        XCTAssertNil(MSHWebRoute(rawValue: "https://example.com/calendar.html"))
        XCTAssertNil(MSHWebRoute(rawValue: "../calendar.html"))
        XCTAssertNotNil(MSHWebRoute(rawValue: "calendar.html?event=msh-42"))
    }

    func testRouteBuildsExactExistingTestOriginURL() {
        let route = MSHWebRoute(rawValue: "calendar.html?view=movement&event=msh-42")!
        let url = MSHWebRuntime.url(
            for: route,
            environment: ["MSH_WEB_APP_URL": "http://192.168.1.10:4173/my-health.html"]
        )

        XCTAssertEqual(
            url.absoluteString,
            "http://192.168.1.10:4173/calendar.html?view=movement&event=msh-42"
        )
    }

    func testInjectedWebBridgeExposesGenericNotificationActions() {
        let script = MSHWebView.notificationBridgeScript
        XCTAssertTrue(script.contains("requestNotificationAuthorization"))
        XCTAssertTrue(script.contains("notificationStatus"))
        XCTAssertTrue(script.contains("scheduleNotification"))
        XCTAssertTrue(script.contains("cancelNotification"))
        XCTAssertTrue(script.contains("cancelNotificationsForEvent"))
    }

    private func notification(
        id: String,
        body: String = "Reminder",
        date: Date,
        eventID: String = "event-1"
    ) -> MSHLocalNotification {
        MSHLocalNotification(
            identifier: id,
            title: "MSH reminder",
            body: body,
            date: date,
            route: MSHWebRoute(rawValue: "calendar.html")!,
            eventID: eventID,
            type: .calendarReminder
        )
    }
}
