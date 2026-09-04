import SwiftUI

struct MSHCycleDayRecord: Codable, Identifiable, Equatable {
    enum Bleeding: String, Codable, CaseIterable, Identifiable {
        case none
        case spotting
        case light
        case medium
        case heavy

        var id: Self { self }

        var title: String {
            switch self {
            case .none: "None"
            case .spotting: "Spotting"
            case .light: "Light"
            case .medium: "Medium"
            case .heavy: "Heavy"
            }
        }

        var marksPeriod: Bool {
            self != .none && self != .spotting
        }
    }

    let id: UUID
    var date: Date
    var bleeding: Bleeding
    var symptoms: [String]
    var note: String
    let createdAt: Date
    var updatedAt: Date

    init(
        id: UUID = UUID(),
        date: Date,
        bleeding: Bleeding,
        symptoms: [String] = [],
        note: String = "",
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.date = Calendar.current.startOfDay(for: date)
        self.bleeding = bleeding
        self.symptoms = symptoms
        self.note = note
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

struct MSHCyclePrediction: Equatable {
    let nextPeriodStart: Date
    let nextPeriodEnd: Date
    let fertileWindowStart: Date?
    let fertileWindowEnd: Date?
    let estimatedOvulation: Date?
    let averageCycleLength: Int
    let averagePeriodLength: Int
    let uncertaintyDays: Int
    let confidence: String
}

@MainActor
final class MSHCycleStore: ObservableObject {
    static let symptomOptions = [
        "Abdominal cramps",
        "Back discomfort",
        "Bloating",
        "Breast tenderness",
        "Cravings",
        "Fatigue",
        "Headache",
        "Irritability",
        "Lower mood",
        "Anxiety",
        "Pelvic pain",
        "Poor sleep"
    ]

    @Published private(set) var records: [MSHCycleDayRecord] = []

    private let defaults: UserDefaults
    private let storageKey = "msh.cycle.records.v1"
    private let calendar: Calendar

    init(defaults: UserDefaults = .standard, calendar: Calendar = .current) {
        self.defaults = defaults
        self.calendar = calendar
        load()
    }

    func record(on date: Date) -> MSHCycleDayRecord? {
        let day = calendar.startOfDay(for: date)
        return records.first { calendar.isDate($0.date, inSameDayAs: day) }
    }

    func save(
        date: Date,
        bleeding: MSHCycleDayRecord.Bleeding,
        symptoms: [String],
        note: String
    ) {
        let day = calendar.startOfDay(for: date)
        let cleanedSymptoms = Array(Set(symptoms.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }))
            .filter { !$0.isEmpty }
            .sorted()
        let cleanedNote = String(note.trimmingCharacters(in: .whitespacesAndNewlines).prefix(1600))

        if let index = records.firstIndex(where: { calendar.isDate($0.date, inSameDayAs: day) }) {
            records[index].date = day
            records[index].bleeding = bleeding
            records[index].symptoms = cleanedSymptoms
            records[index].note = cleanedNote
            records[index].updatedAt = Date()
        } else {
            records.append(
                MSHCycleDayRecord(
                    date: day,
                    bleeding: bleeding,
                    symptoms: cleanedSymptoms,
                    note: cleanedNote
                )
            )
        }

        records.sort { $0.date < $1.date }
        persist()
    }

    func remove(on date: Date) {
        records.removeAll { calendar.isDate($0.date, inSameDayAs: date) }
        persist()
    }

    var periodSegments: [(start: Date, end: Date, days: [Date])] {
        let days = records
            .filter { $0.bleeding.marksPeriod }
            .map { calendar.startOfDay(for: $0.date) }
            .sorted()

        guard !days.isEmpty else { return [] }
        var output: [(start: Date, end: Date, days: [Date])] = []

        for day in days {
            guard var last = output.popLast() else {
                output.append((day, day, [day]))
                continue
            }

            if let gap = calendar.dateComponents([.day], from: last.end, to: day).day, gap <= 1 {
                last.end = day
                last.days.append(day)
                output.append(last)
            } else {
                output.append(last)
                output.append((day, day, [day]))
            }
        }

        return output
    }

    var prediction: MSHCyclePrediction? {
        let segments = periodSegments
        guard let latest = segments.last else { return nil }

        let starts = segments.map(\.start)
        let cycleLengths = zip(starts, starts.dropFirst()).compactMap { first, second -> Int? in
            guard let days = calendar.dateComponents([.day], from: first, to: second).day,
                  (15...60).contains(days) else { return nil }
            return days
        }

        let averageCycle = cycleLengths.isEmpty
            ? 28
            : Int((Double(cycleLengths.reduce(0, +)) / Double(cycleLengths.count)).rounded())
        let periodLengths = segments.map(\.days.count)
        let averagePeriod = max(1, Int((Double(periodLengths.reduce(0, +)) / Double(periodLengths.count)).rounded()))

        guard let nextStart = calendar.date(byAdding: .day, value: averageCycle, to: latest.start),
              let nextEnd = calendar.date(byAdding: .day, value: averagePeriod - 1, to: nextStart) else {
            return nil
        }

        let observedRange: Int = {
            guard let min = cycleLengths.min(), let max = cycleLengths.max() else { return 8 }
            return max - min
        }()
        let uncertainty = cycleLengths.isEmpty ? 4 : max(2, Int(ceil(Double(observedRange) / 2.0)))
        let confidence = cycleLengths.count >= 3 ? "Moderate" : "Low"

        let estimatedOvulation = segments.count >= 2
            ? calendar.date(byAdding: .day, value: -14, to: nextStart)
            : nil
        let fertileStart = estimatedOvulation.flatMap { calendar.date(byAdding: .day, value: -5, to: $0) }

        return MSHCyclePrediction(
            nextPeriodStart: nextStart,
            nextPeriodEnd: nextEnd,
            fertileWindowStart: fertileStart,
            fertileWindowEnd: estimatedOvulation,
            estimatedOvulation: estimatedOvulation,
            averageCycleLength: averageCycle,
            averagePeriodLength: averagePeriod,
            uncertaintyDays: uncertainty,
            confidence: confidence
        )
    }

    func cycleDay(on date: Date) -> Int? {
        let day = calendar.startOfDay(for: date)
        guard let start = periodSegments.map(\.start).last(where: { $0 <= day }),
              let distance = calendar.dateComponents([.day], from: start, to: day).day else {
            return nil
        }
        return distance + 1
    }

    func phaseLabel(on date: Date) -> String? {
        guard let cycleDay = cycleDay(on: date) else { return nil }
        let averageCycle = prediction?.averageCycleLength ?? 28
        let averagePeriod = prediction?.averagePeriodLength ?? max(periodSegments.last?.days.count ?? 5, 1)

        if cycleDay <= averagePeriod { return "Menstrual phase" }
        if cycleDay < max(8, averageCycle - 16) { return "Follicular phase · estimated" }
        if cycleDay <= averageCycle - 12 { return "Ovulatory window · estimated" }
        return "Luteal phase · estimated"
    }

    func repeatedObservation() -> String? {
        let segments = periodSegments
        guard segments.count >= 3 else { return nil }

        var cyclesWithEarlyCramps = 0
        for segment in segments {
            let end = calendar.date(byAdding: .day, value: 1, to: segment.start) ?? segment.start
            let hasCramps = records.contains { record in
                record.date >= segment.start &&
                record.date <= end &&
                record.symptoms.contains(where: { $0.localizedCaseInsensitiveContains("cramp") })
            }
            if hasCramps { cyclesWithEarlyCramps += 1 }
        }

        guard cyclesWithEarlyCramps >= 2 else { return nil }
        return "Cramps were recorded during the first two cycle days in \(cyclesWithEarlyCramps) of your last \(segments.count) recorded cycles."
    }

    private func load() {
        guard let data = defaults.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode([MSHCycleDayRecord].self, from: data) else {
            records = []
            return
        }
        records = decoded.sorted { $0.date < $1.date }
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(records) else { return }
        defaults.set(data, forKey: storageKey)
    }
}

struct MSHCycleScreen: View {
    @StateObject private var store: MSHCycleStore
    @State private var selectedDate = Calendar.current.startOfDay(for: Date())
    @State private var displayedMonth = Calendar.current.startOfMonth(containing: Date())
    @State private var showingEditor = false

    init(store: MSHCycleStore? = nil) {
        _store = StateObject(wrappedValue: store ?? MSHCycleStore())
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                header
                todayCard
                calendarSection
                patternsSection
                integrityNote
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 40)
        }
        .background(MSHColor.canvas)
        .navigationTitle("Cycle")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(MSHColor.canvas, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    selectedDate = Calendar.current.startOfDay(for: Date())
                    showingEditor = true
                } label: {
                    Label("Log", systemImage: "plus")
                }
                .accessibilityIdentifier("cycle-log-button")
            }
        }
        .sheet(isPresented: $showingEditor) {
            NavigationStack {
                MSHCycleEditor(store: store, date: selectedDate)
            }
        }
        .accessibilityIdentifier("native-cycle-screen")
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("CYCLE")
                .font(.caption2.weight(.semibold))
                .tracking(2.2)
                .foregroundStyle(MSHColor.accent)

            Text("Keep cycle context close to the rest of your health.")
                .font(.system(size: 31, weight: .medium, design: .serif))
                .foregroundStyle(MSHColor.primaryText)
                .fixedSize(horizontal: false, vertical: true)

            Text("Record what happened. Estimates remain clearly separate from what you entered.")
                .font(.system(size: 16, design: .serif))
                .foregroundStyle(MSHColor.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var todayCard: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("TODAY")
                        .font(.caption2.weight(.semibold))
                        .tracking(1.5)
                        .foregroundStyle(MSHColor.secondaryText)
                    Text(todayStatus)
                        .font(.system(.title2, design: .serif, weight: .semibold))
                        .foregroundStyle(MSHColor.primaryText)
                }
                Spacer(minLength: 12)
                if let cycleDay = store.cycleDay(on: Date()) {
                    Text("DAY \(cycleDay)")
                        .font(.caption.weight(.semibold))
                        .tracking(1.1)
                        .foregroundStyle(MSHColor.accent)
                }
            }

            if let prediction = store.prediction {
                Divider().overlay(MSHColor.border)
                VStack(alignment: .leading, spacing: 5) {
                    Text("ESTIMATE")
                        .font(.caption2.weight(.semibold))
                        .tracking(1.4)
                        .foregroundStyle(MSHColor.secondaryText)
                    Text("Next period around \(prediction.nextPeriodStart.formatted(date: .abbreviated, time: .omitted))")
                        .font(.system(.headline, design: .serif))
                        .foregroundStyle(MSHColor.primaryText)
                    Text("\(prediction.confidence) confidence · about ±\(prediction.uncertaintyDays) days from recorded history")
                        .font(.caption)
                        .foregroundStyle(MSHColor.secondaryText)
                }
            } else {
                Text("Record a period start to begin building your timeline. Predictions become more useful as your own history grows.")
                    .font(.subheadline)
                    .foregroundStyle(MSHColor.secondaryText)
            }

            Button {
                selectedDate = Calendar.current.startOfDay(for: Date())
                showingEditor = true
            } label: {
                Label(store.record(on: Date()) == nil ? "Log today" : "Edit today", systemImage: "square.and.pencil")
                    .font(.subheadline.weight(.semibold))
            }
            .buttonStyle(.borderedProminent)
            .tint(MSHColor.accent)
        }
        .mshSurface()
    }

    private var calendarSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("YOUR TIMELINE")
                .font(.caption2.weight(.semibold))
                .tracking(1.6)
                .foregroundStyle(MSHColor.secondaryText)

            MSHCycleMonthCalendar(
                store: store,
                month: $displayedMonth,
                selection: $selectedDate
            ) { date in
                selectedDate = date
                showingEditor = true
            }
        }
    }

    @ViewBuilder
    private var patternsSection: some View {
        if let observation = store.repeatedObservation() {
            VStack(alignment: .leading, spacing: 8) {
                Text("A PATTERN IN YOUR RECORDS")
                    .font(.caption2.weight(.semibold))
                    .tracking(1.5)
                    .foregroundStyle(MSHColor.accent)
                Text(observation)
                    .font(.system(.headline, design: .serif))
                    .foregroundStyle(MSHColor.primaryText)
                Text("Personal observation · descriptive only. Missing days can change the picture.")
                    .font(.caption)
                    .foregroundStyle(MSHColor.secondaryText)
            }
            .mshSurface()
        }
    }

    private var integrityNote: some View {
        Text("Recorded entries are your facts. Cycle day, phase, fertile-window, ovulation, and future-period timing are estimates unless confirmed by information you record from another source.")
            .font(.footnote)
            .foregroundStyle(MSHColor.secondaryText)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var todayStatus: String {
        if let phase = store.phaseLabel(on: Date()) { return phase }
        if store.record(on: Date())?.bleeding.marksPeriod == true { return "Period recorded" }
        return "No cycle day yet"
    }
}

private struct MSHCycleMonthCalendar: View {
    @ObservedObject var store: MSHCycleStore
    @Binding var month: Date
    @Binding var selection: Date
    let onSelect: (Date) -> Void

    private let calendar = Calendar.current
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)

    var body: some View {
        VStack(spacing: 14) {
            HStack {
                Button { moveMonth(-1) } label: {
                    Image(systemName: "chevron.left")
                        .frame(width: 36, height: 36)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Previous month")

                Spacer()
                Text(month.formatted(.dateTime.month(.wide).year()))
                    .font(.system(.headline, design: .serif))
                    .foregroundStyle(MSHColor.primaryText)
                Spacer()

                Button { moveMonth(1) } label: {
                    Image(systemName: "chevron.right")
                        .frame(width: 36, height: 36)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Next month")
            }

            LazyVGrid(columns: columns, spacing: 6) {
                ForEach(shortWeekdays, id: \.self) { weekday in
                    Text(weekday)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(MSHColor.secondaryText)
                        .frame(maxWidth: .infinity)
                }

                ForEach(Array(days.enumerated()), id: \.offset) { _, date in
                    if let date {
                        Button {
                            selection = date
                            onSelect(date)
                        } label: {
                            dayCell(date)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(accessibilityLabel(for: date))
                    } else {
                        Color.clear.frame(height: 43)
                    }
                }
            }
        }
        .padding(16)
        .background(MSHColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: MSHRadius.large, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MSHRadius.large, style: .continuous)
                .stroke(MSHColor.border, lineWidth: 0.75)
        }
    }

    private var shortWeekdays: [String] {
        let symbols = calendar.veryShortStandaloneWeekdaySymbols
        let first = calendar.firstWeekday - 1
        return Array(symbols[first...] + symbols[..<first])
    }

    private var days: [Date?] {
        guard let range = calendar.range(of: .day, in: .month, for: month),
              let firstDay = calendar.date(from: calendar.dateComponents([.year, .month], from: month)) else {
            return []
        }

        let weekday = calendar.component(.weekday, from: firstDay)
        let leading = (weekday - calendar.firstWeekday + 7) % 7
        var output = Array<Date?>(repeating: nil, count: leading)
        output += range.compactMap { day in
            calendar.date(byAdding: .day, value: day - 1, to: firstDay)
        }.map(Optional.some)
        return output
    }

    @ViewBuilder
    private func dayCell(_ date: Date) -> some View {
        let record = store.record(on: date)
        let estimateKind = estimateKind(for: date)
        let isToday = calendar.isDateInToday(date)

        VStack(spacing: 4) {
            Text(String(calendar.component(.day, from: date)))
                .font(.subheadline.weight(isToday ? .semibold : .regular))
                .foregroundStyle(MSHColor.primaryText)

            HStack(spacing: 3) {
                if record?.bleeding.marksPeriod == true {
                    Circle().fill(CyclePalette.recorded).frame(width: 6, height: 6)
                } else if record?.bleeding == .spotting {
                    Circle().stroke(CyclePalette.recorded, lineWidth: 1).frame(width: 6, height: 6)
                }

                if estimateKind != nil {
                    Circle().fill(CyclePalette.estimated).frame(width: 5, height: 5)
                }
            }
            .frame(height: 7)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 43)
        .background(isToday ? MSHColor.controlFill : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func estimateKind(for date: Date) -> String? {
        guard let prediction = store.prediction else { return nil }
        let day = calendar.startOfDay(for: date)
        if day >= calendar.startOfDay(for: prediction.nextPeriodStart),
           day <= calendar.startOfDay(for: prediction.nextPeriodEnd) {
            return "predicted period"
        }
        if let start = prediction.fertileWindowStart,
           let end = prediction.fertileWindowEnd,
           day >= calendar.startOfDay(for: start),
           day <= calendar.startOfDay(for: end) {
            return "estimated fertile window"
        }
        return nil
    }

    private func accessibilityLabel(for date: Date) -> String {
        var parts = [date.formatted(date: .complete, time: .omitted)]
        if let record = store.record(on: date) {
            parts.append("Recorded: \(record.bleeding.title) bleeding")
            if !record.symptoms.isEmpty { parts.append(record.symptoms.joined(separator: ", ")) }
        }
        if let estimateKind = estimateKind(for: date) { parts.append("Estimate: \(estimateKind)") }
        return parts.joined(separator: ". ")
    }

    private func moveMonth(_ value: Int) {
        guard let next = calendar.date(byAdding: .month, value: value, to: month) else { return }
        month = calendar.startOfMonth(containing: next)
    }
}

private struct MSHCycleEditor: View {
    @ObservedObject var store: MSHCycleStore
    @Environment(\.dismiss) private var dismiss

    let date: Date
    @State private var bleeding: MSHCycleDayRecord.Bleeding
    @State private var symptoms: Set<String>
    @State private var note: String
    private let existingRecord: MSHCycleDayRecord?

    init(store: MSHCycleStore, date: Date) {
        self.store = store
        self.date = Calendar.current.startOfDay(for: date)
        let existing = store.record(on: date)
        existingRecord = existing
        _bleeding = State(initialValue: existing?.bleeding ?? .none)
        _symptoms = State(initialValue: Set(existing?.symptoms ?? []))
        _note = State(initialValue: existing?.note ?? "")
    }

    var body: some View {
        Form {
            Section {
                DatePicker("Date", selection: .constant(date), displayedComponents: .date)
                    .disabled(true)
            }

            Section("Bleeding") {
                Picker("Bleeding", selection: $bleeding) {
                    ForEach(MSHCycleDayRecord.Bleeding.allCases) { option in
                        Text(option.title).tag(option)
                    }
                }
                .pickerStyle(.segmented)
            }

            Section("Symptoms and comfort") {
                ForEach(MSHCycleStore.symptomOptions, id: \.self) { symptom in
                    Button {
                        if symptoms.contains(symptom) {
                            symptoms.remove(symptom)
                        } else {
                            symptoms.insert(symptom)
                        }
                    } label: {
                        HStack {
                            Text(symptom)
                                .foregroundStyle(MSHColor.primaryText)
                            Spacer()
                            if symptoms.contains(symptom) {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(MSHColor.accent)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }

            Section("Notes") {
                TextField("Anything else you want to remember", text: $note, axis: .vertical)
                    .lineLimit(3...7)
            }

            if existingRecord != nil {
                Section {
                    Button("Remove this day", role: .destructive) {
                        store.remove(on: date)
                        dismiss()
                    }
                }
            }
        }
        .navigationTitle(date.formatted(date: .abbreviated, time: .omitted))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    store.save(
                        date: date,
                        bleeding: bleeding,
                        symptoms: Array(symptoms),
                        note: note
                    )
                    dismiss()
                }
                .fontWeight(.semibold)
            }
        }
    }
}

private enum CyclePalette {
    static let recorded = Color(red: 0.63, green: 0.25, blue: 0.31)
    static let estimated = Color(red: 0.56, green: 0.57, blue: 0.48)
}

private extension Calendar {
    func startOfMonth(containing date: Date) -> Date {
        self.date(from: dateComponents([.year, .month], from: date)) ?? startOfDay(for: date)
    }
}
