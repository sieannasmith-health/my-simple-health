import Combine
import FirebaseAuth
import FirebaseFirestore
import Foundation

/// Resource types that may cross an account boundary after an explicit sharing grant.
/// Raw HealthKit samples are intentionally not represented here.
enum MSHSharedResourceType: String, Codable, CaseIterable {
    case calendarEvent = "calendar_event"
    case workoutVideo = "workout_video"
    case workoutCollection = "workout_collection"
    case financialItem = "financial_item"
    case healthMetricSummary = "health_metric_summary"

    var requiredCategory: MSHSharingCategory {
        switch self {
        case .calendarEvent: .calendar
        case .workoutVideo, .workoutCollection: .workouts
        case .financialItem: .finances
        case .healthMetricSummary: .health
        }
    }
}

enum MSHSharedContentSource: String, Codable {
    case msh
    case manual
    case appleHealth = "apple_health"
    case connectedSource = "connected_source"
}

struct MSHSharedItem: Identifiable, Equatable, Sendable {
    let id: String
    let grantID: String
    let ownerID: String
    let recipientID: String
    let resourceType: MSHSharedResourceType
    let resourceKey: String
    let payload: [String: String]
    let source: MSHSharedContentSource
    let startsAt: String?
    let endsAt: String?
    let createdAt: Date?
    let updatedAt: Date?
}

@MainActor
final class MSHSharedContentStore: ObservableObject {
    @Published private(set) var sharedWithMe: [MSHSharedItem] = []
    @Published var errorMessage: String?

    private let db = Firestore.firestore()

    func loadSharedWithMe() async {
        guard let uid = Auth.auth().currentUser?.uid else {
            sharedWithMe = []
            return
        }

        do {
            let snapshot = try await db.collection("sharedItems")
                .whereField("recipientID", isEqualTo: uid)
                .getDocuments()
            sharedWithMe = snapshot.documents
                .compactMap(Self.item)
                .sorted { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) }
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func publish(
        type: MSHSharedResourceType,
        key: String,
        payload: [String: String],
        source: MSHSharedContentSource = .msh,
        startsAt: String? = nil,
        endsAt: String? = nil,
        through grant: MSHSharingGrant
    ) async -> Bool {
        guard let uid = Auth.auth().currentUser?.uid,
              grant.ownerID == uid,
              grant.isActive,
              grant.category == type.requiredCategory else {
            errorMessage = "This item is not covered by an active sharing permission."
            return false
        }

        if type == .healthMetricSummary && grant.permission != .view {
            errorMessage = "Health summaries use view-only permission."
            return false
        }

        let itemID = Self.itemID(grantID: grant.id, type: type, key: key)
        do {
            try await db.collection("sharedItems").document(itemID).setData([
                "grantID": grant.id,
                "ownerID": uid,
                "recipientID": grant.recipientID,
                "resourceType": type.rawValue,
                "resourceKey": key,
                "payload": payload,
                "source": source.rawValue,
                "startsAt": startsAt ?? NSNull(),
                "endsAt": endsAt ?? NSNull(),
                "createdAt": FieldValue.serverTimestamp(),
                "updatedAt": FieldValue.serverTimestamp()
            ], merge: true)
            errorMessage = nil
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func stopSharing(item: MSHSharedItem) async {
        guard item.ownerID == Auth.auth().currentUser?.uid else { return }
        do {
            try await db.collection("sharedItems").document(item.id).delete()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func publishCalendarEvent(
        id: String,
        title: String,
        detail: String?,
        startsAt: String?,
        endsAt: String?,
        grant: MSHSharingGrant
    ) async -> Bool {
        var payload = ["title": title]
        if let detail, !detail.isEmpty { payload["detail"] = detail }
        return await publish(
            type: .calendarEvent,
            key: id,
            payload: payload,
            source: .msh,
            startsAt: startsAt,
            endsAt: endsAt,
            through: grant
        )
    }

    func publishWorkoutVideo(
        videoID: String,
        title: String,
        videoURL: String,
        grant: MSHSharingGrant
    ) async -> Bool {
        await publish(
            type: .workoutVideo,
            key: videoID,
            payload: ["title": title, "url": videoURL],
            source: .msh,
            through: grant
        )
    }

    func publishFinancialItem(
        id: String,
        label: String,
        amount: String,
        period: String,
        grant: MSHSharingGrant
    ) async -> Bool {
        await publish(
            type: .financialItem,
            key: id,
            payload: ["label": label, "amount": amount, "period": period],
            source: .msh,
            through: grant
        )
    }

    /// Health sharing remains summary-only. There is deliberately no API here for raw
    /// HealthKit samples or the on-device health record store.
    func publishHealthMetricSummary(
        metricID: String,
        title: String,
        value: String,
        unit: String,
        window: String,
        interpretation: String? = nil,
        source: MSHSharedContentSource,
        grant: MSHSharingGrant
    ) async -> Bool {
        guard grant.category == .health, grant.permission == .view else {
            errorMessage = "Health summaries require an active view-only health permission."
            return false
        }

        var payload = [
            "title": title,
            "value": value,
            "unit": unit,
            "window": window
        ]
        if let interpretation, !interpretation.isEmpty {
            payload["interpretation"] = interpretation
        }

        return await publish(
            type: .healthMetricSummary,
            key: metricID,
            payload: payload,
            source: source,
            through: grant
        )
    }

    private static func item(_ document: QueryDocumentSnapshot) -> MSHSharedItem? {
        let data = document.data()
        guard let grantID = data["grantID"] as? String,
              let ownerID = data["ownerID"] as? String,
              let recipientID = data["recipientID"] as? String,
              let typeRaw = data["resourceType"] as? String,
              let type = MSHSharedResourceType(rawValue: typeRaw),
              let resourceKey = data["resourceKey"] as? String,
              let sourceRaw = data["source"] as? String,
              let source = MSHSharedContentSource(rawValue: sourceRaw) else { return nil }

        return MSHSharedItem(
            id: document.documentID,
            grantID: grantID,
            ownerID: ownerID,
            recipientID: recipientID,
            resourceType: type,
            resourceKey: resourceKey,
            payload: data["payload"] as? [String: String] ?? [:],
            source: source,
            startsAt: data["startsAt"] as? String,
            endsAt: data["endsAt"] as? String,
            createdAt: (data["createdAt"] as? Timestamp)?.dateValue(),
            updatedAt: (data["updatedAt"] as? Timestamp)?.dateValue()
        )
    }

    private static func itemID(grantID: String, type: MSHSharedResourceType, key: String) -> String {
        let raw = "\(grantID)_\(type.rawValue)_\(key)"
        return raw.replacingOccurrences(of: "/", with: "_")
    }
}
