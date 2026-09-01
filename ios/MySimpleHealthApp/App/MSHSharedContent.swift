import Foundation
import Supabase

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

struct MSHSharedItem: Codable, Identifiable, Equatable {
    let id: UUID
    let grantID: UUID
    let ownerID: UUID
    let resourceType: MSHSharedResourceType
    let resourceKey: String
    let payload: [String: String]
    let source: MSHSharedContentSource
    let startsAt: String?
    let endsAt: String?
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case grantID = "grant_id"
        case ownerID = "owner_id"
        case resourceType = "resource_type"
        case resourceKey = "resource_key"
        case payload
        case source
        case startsAt = "starts_at"
        case endsAt = "ends_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

private struct MSHSharedItemInsert: Encodable {
    let grantID: UUID
    let ownerID: UUID
    let resourceType: MSHSharedResourceType
    let resourceKey: String
    let payload: [String: String]
    let source: MSHSharedContentSource
    let startsAt: String?
    let endsAt: String?

    enum CodingKeys: String, CodingKey {
        case grantID = "grant_id"
        case ownerID = "owner_id"
        case resourceType = "resource_type"
        case resourceKey = "resource_key"
        case payload
        case source
        case startsAt = "starts_at"
        case endsAt = "ends_at"
    }
}

@MainActor
final class MSHSharedContentStore: ObservableObject {
    @Published private(set) var sharedWithMe: [MSHSharedItem] = []
    @Published var errorMessage: String?

    private let authStore: MSHAuthStore

    init(authStore: MSHAuthStore = .shared) {
        self.authStore = authStore
    }

    func loadSharedWithMe() async {
        guard authStore.userID != nil else {
            sharedWithMe = []
            return
        }

        errorMessage = nil
        do {
            let allVisible: [MSHSharedItem] = try await authStore.client
                .from("msh_shared_items")
                .select()
                .order("updated_at", ascending: false)
                .execute()
                .value

            guard let userID = authStore.userID else {
                sharedWithMe = []
                return
            }
            sharedWithMe = allVisible.filter { $0.ownerID != userID }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Publish one deliberately selected item through an already-active grant.
    /// The resource type must match the grant category so a Calendar grant cannot be reused for health data, etc.
    func publish(
        type: MSHSharedResourceType,
        key: String,
        payload: [String: String],
        source: MSHSharedContentSource = .msh,
        startsAt: String? = nil,
        endsAt: String? = nil,
        through grant: MSHSharingGrant
    ) async -> Bool {
        guard let userID = authStore.userID,
              grant.ownerID == userID,
              grant.isActive,
              grant.category == type.requiredCategory else {
            errorMessage = "This item is not covered by an active sharing permission."
            return false
        }

        let cleanKey = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanKey.isEmpty else {
            errorMessage = "Shared items need a stable identifier."
            return false
        }

        errorMessage = nil
        do {
            let insert = MSHSharedItemInsert(
                grantID: grant.id,
                ownerID: userID,
                resourceType: type,
                resourceKey: cleanKey,
                payload: payload,
                source: source,
                startsAt: startsAt,
                endsAt: endsAt
            )

            try await authStore.client
                .from("msh_shared_items")
                .upsert(insert, onConflict: "grant_id,resource_type,resource_key")
                .execute()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func stopSharing(item: MSHSharedItem) async {
        guard let userID = authStore.userID, item.ownerID == userID else { return }
        errorMessage = nil
        do {
            try await authStore.client
                .from("msh_shared_items")
                .delete()
                .eq("id", value: item.id)
                .execute()
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

    /// Health sharing only accepts a compact metric summary. There is deliberately no API here
    /// for arrays of samples, HealthKit identifiers, or the on-device SQLite record store.
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
}
