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
    let title: String
    let detail: String?
    let systemImage: String
    let occurredAt: Date
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
        let boundedRecords = Array(recentRecords.prefix(max(0, recentLimit)))
        let cards = MSHHealthArea.allCases.map { area in
            MSHHealthAreaCardModel(
                area: area,
                isSelected: status.selectedAreas.contains(area),
                mostRecentActivityAt: boundedRecords.first(where: { area.includes($0.domain) })?.eventStart
            )
        }
        return MSHMyHealthSnapshot(
            appleHealth: status,
            areaCards: cards,
            recentActivity: boundedRecords.map(recentActivity)
        )
    }

    private static func recentActivity(_ record: HealthRecord) -> MSHRecentHealthActivity {
        let presentation = recordPresentation(record)
        return MSHRecentHealthActivity(
            id: record.id,
            title: presentation.title,
            detail: presentation.detail,
            systemImage: presentation.systemImage,
            occurredAt: record.eventStart
        )
    }

    private static func recordPresentation(_ record: HealthRecord) -> (title: String, detail: String?, systemImage: String) {
        let numericDetail = record.value.flatMap { value -> String? in
            guard let unit = record.unit else { return nil }
            return "\(value.formatted(.number.precision(.fractionLength(0...1)))) \(unit)"
        }

        switch record.recordType {
        case .workout:
            return (record.metadata["activityName"] ?? "Workout", nil, "figure.run")
        case .stepSample, .stepDailySummary:
            return ("Steps", numericDetail, "shoeprints.fill")
        case .activeEnergy:
            return ("Active energy", numericDetail, "flame")
        case .exerciseTime:
            return ("Exercise time", numericDetail, "timer")
        case .distanceWalkingRunning, .distanceCycling, .distanceSwimming:
            return ("Movement distance", numericDetail, "point.topleft.down.to.point.bottomright.curvepath")
        case .heartRate:
            return ("Heart rate", numericDetail, "heart.fill")
        case .restingHeartRate:
            return ("Resting heart rate", numericDetail, "heart.text.square")
        case .bodyMass:
            return ("Body measurement", numericDetail, "scalemass")
        case .sleepInterval, .sleepSession:
            return ("Sleep", record.metadata["sleepStage"]?.replacingOccurrences(of: "_", with: " ").capitalized, "moon.stars.fill")
        }
    }
}
