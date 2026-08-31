import Foundation
import SwiftUI

enum MSHHealthConnectionRoute: String, Codable, Equatable {
    case healthKit
    case directIntegration
    case futureIntegration
}

enum MSHHealthDataCapability: String, Codable, CaseIterable, Equatable {
    case movement = "Movement"
    case workouts = "Workouts"
    case sleep = "Sleep"
    case heart = "Heart"
    case recovery = "Recovery"
    case bodyMeasurements = "Body measurements"
}

struct MSHConnectedHealthSource: Identifiable, Equatable {
    let id: String
    let name: String
    let route: MSHHealthConnectionRoute
    let capabilities: [MSHHealthDataCapability]
    let detail: String
}

enum MSHConnectedHealthSourceCatalog {
    static let sources: [MSHConnectedHealthSource] = [
        .init(id: "apple-health", name: "Apple Health & Apple Watch", route: .healthKit, capabilities: [.movement, .workouts, .sleep, .heart, .bodyMeasurements], detail: "Connect through Apple Health permissions."),
        .init(id: "fitbit", name: "Fitbit", route: .futureIntegration, capabilities: [.movement, .workouts, .sleep, .heart], detail: "Connect directly when the Fitbit integration is available; use Apple Health data when supported."),
        .init(id: "oura", name: "Oura Ring", route: .futureIntegration, capabilities: [.movement, .sleep, .heart, .recovery], detail: "Designed for activity, sleep, heart and recovery context."),
        .init(id: "garmin", name: "Garmin", route: .futureIntegration, capabilities: [.movement, .workouts, .sleep, .heart, .recovery], detail: "Designed for Garmin activity and wellness data."),
        .init(id: "whoop", name: "WHOOP", route: .futureIntegration, capabilities: [.movement, .workouts, .sleep, .heart, .recovery], detail: "Designed for workout, sleep and recovery context."),
        .init(id: "polar", name: "Polar", route: .futureIntegration, capabilities: [.movement, .workouts, .sleep, .heart], detail: "Designed for training and health data."),
        .init(id: "coros", name: "COROS", route: .futureIntegration, capabilities: [.movement, .workouts, .heart], detail: "Designed for training and workout data."),
        .init(id: "withings", name: "Withings", route: .futureIntegration, capabilities: [.movement, .sleep, .heart, .bodyMeasurements], detail: "Designed for activity, sleep, heart and connected body measurements."),
        .init(id: "samsung-health", name: "Samsung Health", route: .futureIntegration, capabilities: [.movement, .workouts, .sleep, .heart, .bodyMeasurements], detail: "Planned cross-platform health connection.")
    ]
}

struct MSHConnectedHealthSourcesView: View {
    var body: some View {
        List {
            Section {
                Text("Bring health and movement data together from the devices and apps you already use.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Section("Devices & health apps") {
                ForEach(MSHConnectedHealthSourceCatalog.sources) { source in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(source.name)
                                .font(.headline)
                            Spacer()
                            Text(statusLabel(for: source.route))
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                        }

                        Text(source.capabilities.map(\.rawValue).joined(separator: " · "))
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        Text(source.detail)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .navigationTitle("Connected Devices & Apps")
    }

    private func statusLabel(for route: MSHHealthConnectionRoute) -> String {
        switch route {
        case .healthKit:
            return "Apple Health"
        case .directIntegration:
            return "Connect"
        case .futureIntegration:
            return "Planned"
        }
    }
}
