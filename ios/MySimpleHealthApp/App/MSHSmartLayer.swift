import Foundation

/// The Smart Layer is the boundary between source-derived health data and the
/// experience MSH presents. It interprets known context without changing the
/// underlying record, inventing a score, or inferring a diagnosis.
enum MSHSmartLayerLane: String, Sendable {
    case understand
    case decide
    case prepare
}

enum MSHSmartDecisionKind: String, Sendable {
    case sourceConnection
    case awaitingData
}

enum MSHSmartActionKind: String, Sendable {
    case connectAppleHealth
}

struct MSHSmartSummary: Identifiable, Equatable, Sendable {
    let area: MSHHealthArea
    let value: String
    let context: String
    let evidenceRecordIDs: [String]

    var id: MSHHealthArea { area }
}

struct MSHSmartDecision: Identifiable, Equatable, Sendable {
    let id: String
    let kind: MSHSmartDecisionKind
    let title: String
    let detail: String
    let area: MSHHealthArea?
}

struct MSHSmartPreparedAction: Identifiable, Equatable, Sendable {
    let id: String
    let kind: MSHSmartActionKind
    let title: String
    let detail: String
    let requiresUserApproval: Bool
}

struct MSHSmartLayerOutput: Equatable, Sendable {
    let summaries: [MSHSmartSummary]
    let decisions: [MSHSmartDecision]
    let preparedActions: [MSHSmartPreparedAction]

    func summary(for area: MSHHealthArea) -> MSHSmartSummary? {
        summaries.first { $0.area == area }
    }
}

protocol MSHSmartLayerEvaluating: Sendable {
    func evaluate(snapshot: MSHMyHealthSnapshot, now: Date) -> MSHSmartLayerOutput
}

/// First implementation of the Smart Layer. Rules are deliberately explicit
/// and deterministic. More sophisticated classifiers or native processing can
/// be added behind the same boundary later without pushing interpretation into
/// SwiftUI views.
struct MSHRuleBasedSmartLayer: MSHSmartLayerEvaluating {
    func evaluate(snapshot: MSHMyHealthSnapshot, now: Date = Date()) -> MSHSmartLayerOutput {
        let summaries = MSHHealthArea.allCases.map { area in
            makeSummary(for: area, activity: snapshot.recentActivity, now: now)
        }

        var decisions: [MSHSmartDecision] = []
        var preparedActions: [MSHSmartPreparedAction] = []

        if !snapshot.appleHealth.isConnected {
            decisions.append(
                MSHSmartDecision(
                    id: "apple-health-not-connected",
                    kind: .sourceConnection,
                    title: "Apple Health is not connected",
                    detail: "Connect it when you want My Health to interpret your recent health data.",
                    area: nil
                )
            )
            preparedActions.append(
                MSHSmartPreparedAction(
                    id: "connect-apple-health",
                    kind: .connectAppleHealth,
                    title: "Connect Apple Health",
                    detail: "Choose which health areas MSH may read.",
                    requiresUserApproval: true
                )
            )
        } else {
            for card in snapshot.areaCards where card.isSelected && card.mostRecentActivityAt == nil {
                decisions.append(
                    MSHSmartDecision(
                        id: "awaiting-\(String(describing: card.area))",
                        kind: .awaitingData,
                        title: "Waiting for \(card.area.title.lowercased()) data",
                        detail: "The area is connected, but there is not enough recent source data to interpret yet.",
                        area: card.area
                    )
                )
            }
        }

        return MSHSmartLayerOutput(
            summaries: summaries,
            decisions: decisions,
            preparedActions: preparedActions
        )
    }

    private func makeSummary(
        for area: MSHHealthArea,
        activity: [MSHRecentHealthActivity],
        now: Date
    ) -> MSHSmartSummary {
        let items = activity
            .filter { $0.area == area }
            .sorted { $0.occurredAt > $1.occurredAt }

        guard let latest = items.first else {
            return MSHSmartSummary(
                area: area,
                value: "No recent data",
                context: "Ready when Apple Health has something recent to share.",
                evidenceRecordIDs: []
            )
        }

        switch area {
        case .sleep:
            let latestNight = sleepNightAnchor(for: latest.occurredAt)
            let asleep = items.filter {
                guard ($0.durationMinutes ?? 0) > 0 else { return false }
                let stage = ($0.sleepStage ?? "").lowercased()
                return !stage.contains("awake") && !stage.contains("inbed") && !stage.contains("in_bed")
            }
            let nightItems = asleep.filter { sleepNightAnchor(for: $0.occurredAt) == latestNight }
            let minutes = nightItems.compactMap(\.durationMinutes).reduce(0, +)
            return MSHSmartSummary(
                area: area,
                value: duration(minutes: minutes),
                context: freshnessContext(
                    date: latest.occurredAt,
                    now: now,
                    current: "Your recent sleep is here as context. Open the deeper view when you want the stages and trend."
                ),
                evidenceRecordIDs: nightItems.map(\.id)
            )

        case .movement:
            return MSHSmartSummary(
                area: area,
                value: displayValue(latest),
                context: freshnessContext(
                    date: latest.occurredAt,
                    now: now,
                    current: "Your latest movement measurement is available without turning the home screen into a performance score."
                ),
                evidenceRecordIDs: [latest.id]
            )

        case .heartActivity:
            return MSHSmartSummary(
                area: area,
                value: displayValue(latest),
                context: freshnessContext(
                    date: latest.occurredAt,
                    now: now,
                    current: "This is your latest heart context. The full range and trend live in Explore Your Health."
                ),
                evidenceRecordIDs: [latest.id]
            )

        case .bodyMeasurements:
            return MSHSmartSummary(
                area: area,
                value: displayValue(latest),
                context: freshnessContext(
                    date: latest.occurredAt,
                    now: now,
                    current: "Recent body context is available in the deeper data view."
                ),
                evidenceRecordIDs: [latest.id]
            )
        }
    }

    private func freshnessContext(date: Date, now: Date, current: String) -> String {
        let age = now.timeIntervalSince(date)
        guard age > 14 * 24 * 60 * 60 else { return current }
        return "This is the latest available source data, but it is more than two weeks old."
    }

    private func sleepNightAnchor(for date: Date) -> Date {
        let calendar = Calendar.current
        let hour = calendar.component(.hour, from: date)
        let shifted = hour < 12
            ? (calendar.date(byAdding: .day, value: -1, to: date) ?? date)
            : date
        return calendar.startOfDay(for: shifted)
    }

    private func displayValue(_ item: MSHRecentHealthActivity) -> String {
        if let detail = item.detail, !detail.isEmpty { return detail }
        guard let value = item.numericValue else { return item.title }
        let number = value.formatted(.number.precision(.fractionLength(0...1)))
        if let unit = item.unit, !unit.isEmpty { return "\(number) \(unit)" }
        return number
    }

    private func duration(minutes: Double) -> String {
        guard minutes > 0 else { return "Recent sleep available" }
        let rounded = Int(minutes.rounded())
        let hours = rounded / 60
        let remainder = rounded % 60
        return hours > 0 ? "\(hours)h \(remainder)m" : "\(remainder)m"
    }
}
