import Foundation
import MSHHealthCore
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
                    if source.route == .healthKit {
                        NavigationLink {
                            MSHAppleHealthSetupView()
                        } label: {
                            sourceRow(source)
                        }
                        .accessibilityIdentifier("apple-health-connection-row")
                    } else {
                        sourceRow(source)
                    }
                }
            }
        }
        .navigationTitle("Connected Devices & Apps")
    }

    private func sourceRow(_ source: MSHConnectedHealthSource) -> some View {
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

    private func statusLabel(for route: MSHHealthConnectionRoute) -> String {
        switch route {
        case .healthKit:
            return "Set up"
        case .directIntegration:
            return "Connect"
        case .futureIntegration:
            return "Planned"
        }
    }
}

struct MSHAppleHealthSetupView: View {
    @State private var selectedAreas: Set<MSHHealthArea> = []
    @State private var connectedAreas: Set<MSHHealthArea> = []
    @State private var isLoading = true
    @State private var isConnecting = false
    @State private var errorMessage: String?

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Choose what belongs in My Health")
                        .font(.system(.title3, design: .serif, weight: .semibold))
                    Text("Connect only the areas that are useful to you. You can return here and add another area whenever it becomes relevant.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 6)
            }

            Section("Health areas") {
                ForEach(MSHHealthArea.allCases) { area in
                    Toggle(isOn: selectionBinding(for: area)) {
                        Label(area.title, systemImage: area.systemImage)
                    }
                    .disabled(isLoading || isConnecting)
                    .accessibilityIdentifier("apple-health-area-\(area.healthDataArea.rawValue)")
                }
            } footer: {
                Text("Apple shows its permission sheet only after you tap Connect. MSH reads the areas you approve and does not write health data back to Apple Health.")
            }

            Section {
                Button {
                    connect()
                } label: {
                    HStack {
                        Spacer()
                        if isConnecting {
                            ProgressView()
                        } else {
                            Text(connectionButtonTitle)
                                .fontWeight(.semibold)
                        }
                        Spacer()
                    }
                }
                .disabled(selectedAreas.isEmpty || isLoading || isConnecting || selectedAreas == connectedAreas)
                .accessibilityIdentifier("connect-apple-health-button")
            }

            if !connectedAreas.isEmpty {
                Section("Connected") {
                    Text(connectedAreas.map(\.title).sorted().joined(separator: " · "))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Apple Health")
        .task { await loadConnection() }
        .alert("Apple Health couldn't connect", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "Please try again.")
        }
    }

    private var connectionButtonTitle: String {
        connectedAreas.isEmpty ? "Connect Apple Health" : "Update Apple Health"
    }

    private func selectionBinding(for area: MSHHealthArea) -> Binding<Bool> {
        Binding(
            get: { selectedAreas.contains(area) },
            set: { isSelected in
                if isSelected {
                    selectedAreas.insert(area)
                } else {
                    selectedAreas.remove(area)
                }
            }
        )
    }

    @MainActor
    private func loadConnection() async {
        defer { isLoading = false }
        do {
            let state = try await MSHAppleHealthRuntime.store.load(provider: .appleHealth)
            let areas = Set(MSHHealthArea.allCases.filter { state.selectedAreas.contains($0.healthDataArea) })
            connectedAreas = areas
            selectedAreas = areas
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func connect() {
        let requestedAreas = selectedAreas
        guard !requestedAreas.isEmpty, requestedAreas != connectedAreas else { return }
        isConnecting = true
        Task { @MainActor in
            defer { isConnecting = false }
            do {
                let result = try await MSHAppleHealthRuntime.connect(
                    areas: Set(requestedAreas.map(\.healthDataArea))
                )
                guard result.outcome == .completed else {
                    errorMessage = result.message ?? "Apple Health did not complete the connection."
                    return
                }
                connectedAreas = requestedAreas
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
