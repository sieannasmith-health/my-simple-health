import Foundation
import MSHHealthCore

enum MSHHealthArea: CaseIterable, Identifiable, Equatable, Sendable {
    case movement
    case sleep
    case heartActivity
    case bodyMeasurements

    var id: Self { self }

    var title: String {
        switch self {
        case .movement: "Movement"
        case .sleep: "Sleep"
        case .heartActivity: "Heart activity"
        case .bodyMeasurements: "Body measurements"
        }
    }

    var systemImage: String {
        switch self {
        case .movement: "figure.walk.motion"
        case .sleep: "moon.stars"
        case .heartActivity: "heart.text.square"
        case .bodyMeasurements: "scalemass"
        }
    }

    var healthDataArea: HealthDataArea {
        switch self {
        case .movement: .movement
        case .sleep: .sleep
        case .heartActivity: .heartActivity
        case .bodyMeasurements: .bodyMeasurements
        }
    }

    func includes(_ domain: HealthDomain) -> Bool {
        switch self {
        case .movement: domain == .movement
        case .sleep: domain == .sleep
        case .heartActivity: domain == .cardio
        case .bodyMeasurements: domain == .body
        }
    }
}

struct MSHAppleHealthStatus: Equatable, Sendable {
    let isConnected: Bool
    let selectedAreas: [MSHHealthArea]
    let lastSuccessfulSyncAt: Date?

    init(syncState: HealthSyncState) {
        selectedAreas = MSHHealthArea.allCases.filter {
            syncState.selectedAreas.contains($0.healthDataArea)
        }
        isConnected = !selectedAreas.isEmpty
        lastSuccessfulSyncAt = syncState.lastSuccessfulSyncAt
    }
}

struct MSHHealthAreaCardModel: Identifiable, Equatable, Sendable {
    let area: MSHHealthArea
    let isSelected: Bool
    let mostRecentActivityAt: Date?

    var id: MSHHealthArea { area }

    var stateDescription: String {
        if !isSelected { return "Not selected in Apple Health" }
        if mostRecentActivityAt != nil { return "Recent activity available" }
        return "Ready when recent data is available"
    }
}

struct MSHRecentHealthActivity: Identifiable, Equatable, Sendable {
    let id: String
    let area: MSHHealthArea
    let title: String
    let detail: String?
    let systemImage: String
    let occurredAt: Date

    // Chart-ready values are carried beside the human-readable presentation.
    // They remain source-derived Apple Health values rather than inferred scores.
    let numericValue: Double?
    let unit: String?
    let durationMinutes: Double?
    let sleepStage: String?

    init(
        id: String,
        area: MSHHealthArea,
        title: String,
        detail: String?,
        systemImage: String,
        occurredAt: Date,
        numericValue: Double? = nil,
        unit: String? = nil,
        durationMinutes: Double? = nil,
        sleepStage: String? = nil
    ) {
        self.id = id
        self.area = area
        self.title = title
        self.detail = detail
        self.systemImage = systemImage
        self.occurredAt = occurredAt
        self.numericValue = numericValue
        self.unit = unit
        self.durationMinutes = durationMinutes
        self.sleepStage = sleepStage
    }
}

struct MSHMyHealthSnapshot: Equatable, Sendable {
    let appleHealth: MSHAppleHealthStatus
    let areaCards: [MSHHealthAreaCardModel]
    let recentActivity: [MSHRecentHealthActivity]
}

enum MSHMyHealthMapper {
    static func snapshot(
        syncState: HealthSyncState,
        recentRecords: [HealthRecord],
        recentLimit: Int
    ) -> MSHMyHealthSnapshot {
        let status = MSHAppleHealthStatus(syncState: syncState)
        let perAreaLimit = max(0, recentLimit)
        let balancedRecords = MSHHealthArea.allCases
            .flatMap { area in
                recentRecords
                    .filter { area.includes($0.domain) }
                    .prefix(perAreaLimit)
            }
            .sorted { $0.eventStart > $1.eventStart }

        let cards = MSHHealthArea.allCases.map { area in
            MSHHealthAreaCardModel(
                area: area,
                isSelected: status.selectedAreas.contains(area),
                mostRecentActivityAt: balancedRecords.first(where: { area.includes($0.domain) })?.eventStart
            )
        }
        return MSHMyHealthSnapshot(
            appleHealth: status,
            areaCards: cards,
            recentActivity: balancedRecords.map(recentActivity)
        )
    }

    private static func recentActivity(_ record: HealthRecord) -> MSHRecentHealthActivity {
        let presentation = recordPresentation(record)
        let durationMinutes: Double? = {
            guard record.recordType == .sleepInterval,
                  let end = record.eventEnd else { return nil }
            return max(0, end.timeIntervalSince(record.eventStart) / 60)
        }()

        return MSHRecentHealthActivity(
            id: record.id,
            area: presentation.area,
            title: presentation.title,
            detail: presentation.detail,
            systemImage: presentation.systemImage,
            occurredAt: record.eventStart,
            numericValue: record.value,
            unit: record.unit,
            durationMinutes: durationMinutes,
            sleepStage: record.metadata["sleepStage"]
        )
    }

    private static func recordPresentation(_ record: HealthRecord) -> (area: MSHHealthArea, title: String, detail: String?, systemImage: String) {
        let numericDetail = record.value.flatMap { value -> String? in
            guard let unit = record.unit else { return nil }
            return "\(value.formatted(.number.precision(.fractionLength(0...1)))) \(unit)"
        }

        switch record.recordType {
        case .workout:
            return (.movement, record.metadata["activityName"] ?? "Workout", nil, "figure.run")
        case .stepSample, .stepDailySummary:
            return (.movement, "Steps", numericDetail, "shoeprints.fill")
        case .activeEnergy:
            return (.movement, "Active energy", numericDetail, "flame")
        case .exerciseTime:
            return (.movement, "Exercise time", numericDetail, "timer")
        case .distanceWalkingRunning:
            return (.movement, "Walking + running distance", numericDetail, "figure.walk")
        case .distanceCycling:
            return (.movement, "Cycling distance", numericDetail, "bicycle")
        case .distanceSwimming:
            return (.movement, "Swimming distance", numericDetail, "figure.pool.swim")
        case .heartRate:
            return (.heartActivity, "Heart rate", numericDetail, "heart.fill")
        case .restingHeartRate:
            return (.heartActivity, "Resting heart rate", numericDetail, "heart.text.square")
        case .bodyMass:
            return (.bodyMeasurements, "Body mass", numericDetail, "scalemass")
        case .sleepInterval, .sleepSession:
            return (
                .sleep,
                "Sleep",
                record.metadata["sleepStage"]?.replacingOccurrences(of: "_", with: " ").capitalized,
                "moon.stars.fill"
            )
        }
    }
}
