import Foundation
import SwiftUI

enum MSHMovementConnectionPath: String, Codable, Equatable {
    case native
    case appleHealth
    case directIntegration
    case importOrManual
}

enum MSHMovementRecordSource: String, Codable, CaseIterable, Equatable, Identifiable {
    case msh
    case appleFitness
    case appleHealth
    case youtube
    case strava
    case peloton
    case garminConnect
    case fitbit
    case nikeRunClub
    case runna
    case hevy
    case fitbod
    case jefit
    case caliber
    case whoop
    case zwift
    case trainerRoad
    case ifit
    case classApp
    case imported
    case manual

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .msh: return "MSH Movement Library"
        case .appleFitness: return "Apple Fitness"
        case .appleHealth: return "Apple Health"
        case .youtube: return "YouTube"
        case .strava: return "Strava"
        case .peloton: return "Peloton"
        case .garminConnect: return "Garmin Connect"
        case .fitbit: return "Fitbit"
        case .nikeRunClub: return "Nike Run Club"
        case .runna: return "Runna"
        case .hevy: return "Hevy"
        case .fitbod: return "Fitbod"
        case .jefit: return "JEFIT"
        case .caliber: return "Caliber"
        case .whoop: return "WHOOP"
        case .zwift: return "Zwift"
        case .trainerRoad: return "TrainerRoad"
        case .ifit: return "iFIT"
        case .classApp: return "Fitness class app"
        case .imported: return "Import from another app"
        case .manual: return "Add manually"
        }
    }

    var connectionPath: MSHMovementConnectionPath {
        switch self {
        case .msh, .manual:
            return .native
        case .appleFitness, .appleHealth, .peloton, .garminConnect, .fitbit, .nikeRunClub, .hevy, .fitbod, .jefit, .caliber, .whoop:
            return .appleHealth
        case .youtube, .strava, .zwift, .trainerRoad, .ifit, .runna:
            return .directIntegration
        case .classApp, .imported:
            return .importOrManual
        }
    }

    var availabilityLabel: String {
        switch connectionPath {
        case .native:
            return "Available in MSH"
        case .appleHealth:
            return "Use Apple Health when available"
        case .directIntegration:
            return "Connection pathway"
        case .importOrManual:
            return "Import or add manually"
        }
    }
}

struct MSHMovementDraft: Equatable {
    var title: String
    var date: Date
    var durationMinutes: Int
    var movementType: String
    var intensity: String
    var sets: Int?
    var reps: Int?
    var weight: Double?
    var distance: Double?
    var notes: String
    var isCompleted: Bool
}

protocol MSHMovementEditableRecord {
    var movementID: String { get }
    var source: MSHMovementRecordSource { get }
    var title: String { get }
    var date: Date { get }
    var durationMinutes: Int { get }
    var movementType: String { get }
    var intensity: String { get }
    var sets: Int? { get }
    var reps: Int? { get }
    var weight: Double? { get }
    var distance: Double? { get }
    var notes: String { get }
    var isCompleted: Bool { get }
}

struct MSHMovementSourcePicker: View {
    @Binding var selection: MSHMovementRecordSource

    var body: some View {
        List {
            Section("My movement") {
                sourceRow(.msh)
                sourceRow(.manual)
            }

            Section("Apple") {
                sourceRow(.appleFitness)
                sourceRow(.appleHealth)
            }

            Section("Workout apps") {
                ForEach([
                    MSHMovementRecordSource.youtube,
                    .strava,
                    .peloton,
                    .garminConnect,
                    .fitbit,
                    .nikeRunClub,
                    .runna,
                    .hevy,
                    .fitbod,
                    .jefit,
                    .caliber,
                    .whoop,
                    .zwift,
                    .trainerRoad,
                    .ifit,
                    .classApp,
                    .imported
                ]) { source in
                    sourceRow(source)
                }
            }
        }
        .navigationTitle("Add movement from")
    }

    @ViewBuilder
    private func sourceRow(_ source: MSHMovementRecordSource) -> some View {
        Button {
            selection = source
        } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(source.displayName)
                        .foregroundStyle(.primary)
                    Text(source.availabilityLabel)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                if selection == source {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(MSHColor.forest)
                }
            }
        }
        .buttonStyle(.plain)
    }
}

struct MSHMovementEditSheet<Record: MSHMovementEditableRecord>: View {
    let record: Record
    let onSave: (MSHMovementDraft) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var draft: MSHMovementDraft

    init(record: Record, onSave: @escaping (MSHMovementDraft) -> Void) {
        self.record = record
        self.onSave = onSave
        _draft = State(initialValue: MSHMovementDraft(
            title: record.title,
            date: record.date,
            durationMinutes: record.durationMinutes,
            movementType: record.movementType,
            intensity: record.intensity,
            sets: record.sets,
            reps: record.reps,
            weight: record.weight,
            distance: record.distance,
            notes: record.notes,
            isCompleted: record.isCompleted
        ))
    }

    private var sourceIsReadOnly: Bool {
        record.source == .appleHealth || record.source == .appleFitness
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Source") {
                    LabeledContent("Added from", value: record.source.displayName)
                    Text(record.source.availabilityLabel)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                if sourceIsReadOnly {
                    Section {
                        Text("Apple Health source data stays unchanged. You can update your MSH notes and completion context here.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Movement") {
                    TextField("Title", text: $draft.title)
                        .disabled(sourceIsReadOnly)
                    DatePicker("Date & time", selection: $draft.date)
                        .disabled(sourceIsReadOnly)
                    Stepper("Duration: \(draft.durationMinutes) min", value: $draft.durationMinutes, in: 0...1440)
                        .disabled(sourceIsReadOnly)
                    TextField("Movement type", text: $draft.movementType)
                        .disabled(sourceIsReadOnly)
                    TextField("Intensity", text: $draft.intensity)
                        .disabled(sourceIsReadOnly)
                }

                if !sourceIsReadOnly {
                    Section("Details") {
                        OptionalIntegerField(title: "Sets", value: $draft.sets)
                        OptionalIntegerField(title: "Reps", value: $draft.reps)
                        OptionalDoubleField(title: "Weight", value: $draft.weight)
                        OptionalDoubleField(title: "Distance", value: $draft.distance)
                    }
                }

                Section("MSH context") {
                    TextField("Notes", text: $draft.notes, axis: .vertical)
                        .lineLimit(3...8)
                    Toggle("Completed", isOn: $draft.isCompleted)
                }
            }
            .navigationTitle("Edit Movement")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(draft)
                        dismiss()
                    }
                    .disabled(!sourceIsReadOnly && draft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }
}

private struct OptionalIntegerField: View {
    let title: String
    @Binding var value: Int?

    var body: some View {
        TextField(title, text: Binding(
            get: { value.map(String.init) ?? "" },
            set: { value = Int($0) }
        ))
        .keyboardType(.numberPad)
    }
}

private struct OptionalDoubleField: View {
    let title: String
    @Binding var value: Double?

    var body: some View {
        TextField(title, text: Binding(
            get: {
                guard let value else { return "" }
                return String(value)
            },
            set: { value = Double($0) }
        ))
        .keyboardType(.decimalPad)
    }
}
