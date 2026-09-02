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

/// The previous implementation wrote directly to Supabase. Firebase now owns identity,
/// so shared-content transport is intentionally disabled until these operations move
/// behind the Google backend. Keeping the store API prevents unrelated UI call sites
/// from becoming coupled to the migration.
@MainActor
final class MSHSharedContentStore: ObservableObject {
    @Published private(set) var sharedWithMe: [MSHSharedItem] = []
    @Published var errorMessage: String?

    private let migrationMessage = "Sharing is temporarily unavailable while it is being connected to the new account system."

    func loadSharedWithMe() async {
        sharedWithMe = []
        errorMessage = nil
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
        errorMessage = migrationMessage
        return false
    }

    func stopSharing(item: MSHSharedItem) async {
        errorMessage = migrationMessage
    }

    func publishCalendarEvent(
        id: String,
        title: String,
        detail: String?,
        startsAt: String?,
        endsAt: String?,
        grant: MSHSharingGrant
    ) async -> Bool {
        await publish(
            type: .calendarEvent,
            key: id,
            payload: ["title": title],
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
}
