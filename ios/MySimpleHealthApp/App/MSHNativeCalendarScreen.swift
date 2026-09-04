import Foundation
import SwiftUI

struct MSHCalendarEvent: Identifiable, Codable, Equatable {
    enum Kind: String, Codable, CaseIterable, Identifiable {
        case appointment
        case movement
        case medication
        case cycle
        case personal

        var id: String { rawValue }

        var title: String {
            switch self {
            case .appointment: "Appointment"
            case .movement: "Movement"
            case .medication: "Medication"
            case .cycle: "Cycle"
            case .personal: "Personal"
            }
        }

        var systemImage: String {
            switch self {
            case .appointment: "cross.case"
            case .movement: "figure.walk.motion"
            case .medication: "pills"
            case .cycle: "circle.dotted.circle"
            case .personal: "calendar"
            }
        }
    }

    var id: UUID
    var title: String
    var start: Date
    var end: Date
    var kind: Kind
    var notes: String

    init(
        id: UUID = UUID(),
        title: String,
        start: Date,
        end: Date,
        kind: Kind,
        notes: String = ""
    ) {
        self.id = id
        self.title = title
        self.start = start
        self.end = end
        self.kind = kind
        self.notes = notes
    }
}

@MainActor
final class MSHNativeCalendarStore: ObservableObject {
    @Published private(set) var events: [MSHCalendarEvent] = []

    private let defaults: UserDefaults
    private let key = "msh.nativeCalendar.events.v1"
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        load()
    }

    func events(on day: Date) -> [MSHCalendarEvent] {
        events
            .filter { Calendar.current.isDate($0.start, inSameDayAs: day) }
            .sorted { $0.start < $1.start }
    }

    func upsert(_ event: MSHCalendarEvent) {
        if let index = events.firstIndex(where: { $0.id == event.id }) {
            events[index] = event
        } else {
            events.append(event)
        }
        events.sort { $0.start < $1.start }
        persist()
    }

    func delete(_ event: MSHCalendarEvent) {
        events.removeAll { $0.id == event.id }
        persist()
        Task { _ = await MSHNotificationService.shared.cancelNotifications(eventID: event.id.uuidString) }
    }

    private func load() {
        guard let data = defaults.data(forKey: key),
              let decoded = try? decoder.decode([MSHCalendarEvent].self, from: data) else {
            events = []
            return
        }
        events = decoded.sorted { $0.start < $1.start }
    }

    private func persist() {
        guard let data = try? encoder.encode(events) else { return }
        defaults.set(data, forKey: key)
    }
}

struct MSHNativeCalendarScreen: View {
    @StateObject private var store = MSHNativeCalendarStore()
    @State private var displayedMonth = Calendar.current.date(from: Calendar.current.dateComponents([.year, .month], from: Date())) ?? Date()
    @State private var selectedDay = Date()
    @State private var editingEvent: MSHCalendarEvent?
    @State private var showingEditor = false

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 6), count: 7)
    private let weekdaySymbols = Calendar.current.veryShortStandaloneWeekdaySymbols

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    header
                    monthControls
                    weekdayHeader
                    monthGrid
                    selectedDaySection
                }
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 40)
            }
        }
        .navigationTitle("Calendar")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(MSHColor.canvas, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    editingEvent = nil
                    showingEditor = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Add calendar item")
            }
        }
        .sheet(isPresented: $showingEditor) {
            MSHCalendarEventEditor(
                event: editingEvent,
                defaultDate: selectedDay
            ) { event in
                store.upsert(event)
                selectedDay = event.start
            }
        }
        .accessibilityIdentifier("native-calendar-screen")
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("CALENDAR")
                .font(.caption2.weight(.semibold))
                .tracking(2.1)
                .foregroundStyle(MSHColor.accent)

            Text("Your health in time.")
                .font(.system(size: 34, weight: .regular, design: .serif))
                .foregroundStyle(MSHColor.primaryText)

            Text("Appointments, movement, medication actions, cycle context, and everyday life can sit together without becoming a score.")
                .font(.body)
                .foregroundStyle(MSHColor.secondaryText)
        }
    }

    private var monthControls: some View {
        HStack {
            Button { moveMonth(-1) } label: {
                Image(systemName: "chevron.left")
                    .frame(width: 42, height: 42)
            }
            .buttonStyle(.plain)

            Spacer()

            Text(displayedMonth.formatted(.dateTime.month(.wide).year()))
                .font(.system(.title3, design: .serif, weight: .semibold))
                .foregroundStyle(MSHColor.primaryText)

            Spacer()

            Button { moveMonth(1) } label: {
                Image(systemName: "chevron.right")
                    .frame(width: 42, height: 42)
            }
            .buttonStyle(.plain)
        }
        .foregroundStyle(MSHColor.primaryText)
    }

    private var weekdayHeader: some View {
        LazyVGrid(columns: columns, spacing: 6) {
            ForEach(weekdaySymbols, id: \.self) { symbol in
                Text(symbol.uppercased())
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(MSHColor.secondaryText)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private var monthGrid: some View {
        let cells = monthCells
        return LazyVGrid(columns: columns, spacing: 8) {
            ForEach(Array(cells.enumerated()), id: \.offset) { _, date in
                if let date {
                    dayCell(date)
                } else {
                    Color.clear.frame(height: 48)
                }
            }
        }
    }

    private func dayCell(_ date: Date) -> some View {
        let isSelected = Calendar.current.isDate(date, inSameDayAs: selectedDay)
        let isToday = Calendar.current.isDateInToday(date)
        let dayEvents = store.events(on: date)

        return Button {
            selectedDay = date
            MSHNativeHaptic.selection.play()
        } label: {
            VStack(spacing: 5) {
                Text(date.formatted(.dateTime.day()))
                    .font(.subheadline.weight(isSelected ? .semibold : .regular))
                    .foregroundStyle(isSelected ? Color.white : MSHColor.primaryText)

                HStack(spacing: 3) {
                    ForEach(dayEvents.prefix(3)) { event in
                        Circle()
                            .fill(event.kind == .movement ? MSHColor.sage : MSHColor.mushroom)
                            .frame(width: 4, height: 4)
                    }
                }
                .frame(height: 5)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background {
                if isSelected {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(MSHColor.charcoal)
                } else if isToday {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(MSHColor.accent.opacity(0.72), lineWidth: 1)
                }
            }
        }
        .buttonStyle(.plain)
    }

    private var selectedDaySection: some View {
        let dayEvents = store.events(on: selectedDay)
        return VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(selectedDay.formatted(.dateTime.weekday(.wide)))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(MSHColor.secondaryText)
                    Text(selectedDay.formatted(.dateTime.month(.wide).day()))
                        .font(.system(.title2, design: .serif, weight: .semibold))
                        .foregroundStyle(MSHColor.primaryText)
                }
                Spacer()
                Button("Add") {
                    editingEvent = nil
                    showingEditor = true
                }
                .buttonStyle(.plain)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(MSHColor.accent)
            }

            if dayEvents.isEmpty {
                VStack(alignment: .leading, spacing: 7) {
                    Text("Nothing scheduled.")
                        .font(.system(.headline, design: .serif))
                        .foregroundStyle(MSHColor.primaryText)
                    Text("A quiet day is still useful information. Add something only when it belongs here.")
                        .font(.subheadline)
                        .foregroundStyle(MSHColor.secondaryText)
                }
                .padding(18)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(MSHColor.controlFill.opacity(0.45))
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            } else {
                ForEach(dayEvents) { event in
                    eventRow(event)
                }
            }
        }
        .padding(.top, 6)
    }

    private func eventRow(_ event: MSHCalendarEvent) -> some View {
        Button {
            editingEvent = event
            showingEditor = true
        } label: {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: event.kind.systemImage)
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(MSHColor.accent)
                    .frame(width: 36, height: 36)
                    .background(MSHColor.controlFill)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                VStack(alignment: .leading, spacing: 4) {
                    Text(event.title)
                        .font(.system(.body, design: .serif, weight: .semibold))
                        .foregroundStyle(MSHColor.primaryText)
                    Text(event.start.formatted(date: .omitted, time: .shortened))
                        .font(.subheadline)
                        .foregroundStyle(MSHColor.secondaryText)
                    if !event.notes.isEmpty {
                        Text(event.notes)
                            .font(.caption)
                            .foregroundStyle(MSHColor.secondaryText)
                            .lineLimit(2)
                    }
                }

                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(MSHColor.secondaryText.opacity(0.7))
            }
            .padding(16)
            .background(MSHColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(MSHColor.border, lineWidth: 0.8)
            }
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button(role: .destructive) {
                store.delete(event)
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }

    private var monthCells: [Date?] {
        let calendar = Calendar.current
        guard let interval = calendar.dateInterval(of: .month, for: displayedMonth),
              let dayRange = calendar.range(of: .day, in: .month, for: displayedMonth) else { return [] }

        let firstWeekday = calendar.component(.weekday, from: interval.start)
        let leading = (firstWeekday - calendar.firstWeekday + 7) % 7
        var result = Array<Date?>(repeating: nil, count: leading)

        for day in dayRange {
            var components = calendar.dateComponents([.year, .month], from: displayedMonth)
            components.day = day
            result.append(calendar.date(from: components))
        }
        return result
    }

    private func moveMonth(_ offset: Int) {
        guard let next = Calendar.current.date(byAdding: .month, value: offset, to: displayedMonth) else { return }
        displayedMonth = next
        if !Calendar.current.isDate(selectedDay, equalTo: next, toGranularity: .month) {
            selectedDay = next
        }
    }
}

private struct MSHCalendarEventEditor: View {
    @Environment(\.dismiss) private var dismiss

    private let existingID: UUID
    private let onSave: (MSHCalendarEvent) -> Void

    @State private var title: String
    @State private var start: Date
    @State private var end: Date
    @State private var kind: MSHCalendarEvent.Kind
    @State private var notes: String

    init(
        event: MSHCalendarEvent?,
        defaultDate: Date,
        onSave: @escaping (MSHCalendarEvent) -> Void
    ) {
        let calendar = Calendar.current
        let defaultStart = calendar.date(bySettingHour: 9, minute: 0, second: 0, of: defaultDate) ?? defaultDate
        let initial = event ?? MSHCalendarEvent(
            title: "",
            start: defaultStart,
            end: defaultStart.addingTimeInterval(3600),
            kind: .appointment
        )
        existingID = initial.id
        self.onSave = onSave
        _title = State(initialValue: initial.title)
        _start = State(initialValue: initial.start)
        _end = State(initialValue: initial.end)
        _kind = State(initialValue: initial.kind)
        _notes = State(initialValue: initial.notes)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("What") {
                    TextField("Title", text: $title)
                    Picker("Type", selection: $kind) {
                        ForEach(MSHCalendarEvent.Kind.allCases) { kind in
                            Label(kind.title, systemImage: kind.systemImage).tag(kind)
                        }
                    }
                }

                Section("When") {
                    DatePicker("Starts", selection: $start)
                    DatePicker("Ends", selection: $end, in: start...)
                }

                Section("Context") {
                    TextField("Notes", text: $notes, axis: .vertical)
                        .lineLimit(3...7)
                }
            }
            .navigationTitle(title.isEmpty ? "Add to Calendar" : "Edit Calendar Item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
                        onSave(MSHCalendarEvent(
                            id: existingID,
                            title: cleanTitle,
                            start: start,
                            end: max(end, start),
                            kind: kind,
                            notes: notes.trimmingCharacters(in: .whitespacesAndNewlines)
                        ))
                        dismiss()
                    }
                    .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }
}
