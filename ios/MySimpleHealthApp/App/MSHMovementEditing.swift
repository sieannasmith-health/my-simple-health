import Foundation
import SwiftUI

enum MSHMovementRecordSource: String, Codable, Equatable {
    case msh
    case appleHealth
    case youtube
    case imported
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
        record.source == .appleHealth
    }

    var body: some View {
        NavigationStack {
            Form {
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
    @State private var text = ""

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
