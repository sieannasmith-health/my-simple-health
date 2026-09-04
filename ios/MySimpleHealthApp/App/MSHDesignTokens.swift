import Foundation
import SwiftUI
import UIKit

enum MSHColor {
    static let ivory = Color(red: 0.973, green: 0.969, blue: 0.953)
    static let stone = Color(red: 0.878, green: 0.875, blue: 0.863)
    static let charcoal = Color(red: 0.122, green: 0.118, blue: 0.114)
    static let espresso = Color(red: 0.129, green: 0.118, blue: 0.118)
    static let sage = Color(red: 0.584, green: 0.600, blue: 0.506)
    static let powder = Color(red: 0.773, green: 0.812, blue: 0.855)
    static let clay = Color(red: 0.380, green: 0.259, blue: 0.184)
    static let mushroom = Color(red: 0.824, green: 0.753, blue: 0.686)
    static let forest = Color(red: 0.10, green: 0.25, blue: 0.16)
    static let cream = ivory
    static let warmWhite = Color(red: 0.992, green: 0.989, blue: 0.980)

    private static let accentLight = UIColor(red: 0.584, green: 0.600, blue: 0.506, alpha: 1)
    private static let accentDark = UIColor(red: 0.690, green: 0.704, blue: 0.620, alpha: 1)
    private static let canvasLight = UIColor(red: 0.973, green: 0.969, blue: 0.953, alpha: 1)
    private static let canvasDark = UIColor(red: 0.082, green: 0.075, blue: 0.075, alpha: 1)

    static let accent = adaptive(light: accentLight, dark: accentDark)
    static let canvas = adaptive(light: canvasLight, dark: canvasDark)
    static let surface = adaptive(
        light: UIColor(red: 0.995, green: 0.993, blue: 0.985, alpha: 1),
        dark: UIColor(red: 0.129, green: 0.118, blue: 0.118, alpha: 1)
    )
    static let secondarySurface = adaptive(
        light: UIColor(red: 0.878, green: 0.875, blue: 0.863, alpha: 1),
        dark: UIColor(red: 0.175, green: 0.164, blue: 0.160, alpha: 1)
    )
    static let controlFill = adaptive(
        light: UIColor(red: 0.930, green: 0.922, blue: 0.902, alpha: 1),
        dark: UIColor(red: 0.185, green: 0.174, blue: 0.168, alpha: 1)
    )
    static let primaryText = adaptive(
        light: UIColor(red: 0.122, green: 0.118, blue: 0.114, alpha: 1),
        dark: UIColor(red: 0.965, green: 0.957, blue: 0.933, alpha: 1)
    )
    static let secondaryText = adaptive(
        light: UIColor(red: 0.412, green: 0.396, blue: 0.376, alpha: 1),
        dark: UIColor(red: 0.745, green: 0.725, blue: 0.690, alpha: 1)
    )
    static let border = adaptive(
        light: UIColor(red: 0.122, green: 0.118, blue: 0.114, alpha: 0.14),
        dark: UIColor(red: 0.965, green: 0.957, blue: 0.933, alpha: 0.14)
    )

    static let supportingSage = sage
    static let supportingPowder = powder
    static let supportingClay = clay
    static let supportingMushroom = mushroom

    private static func adaptive(light: UIColor, dark: UIColor) -> Color {
        Color(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark ? dark : light
        })
    }
}

enum MSHSpacing {
    static let xSmall: CGFloat = 6
    static let small: CGFloat = 10
    static let medium: CGFloat = 16
    static let large: CGFloat = 24
    static let xLarge: CGFloat = 32
}

enum MSHRadius {
    static let small: CGFloat = 10
    static let medium: CGFloat = 14
    static let large: CGFloat = 18
}

enum MSHTypography {
    static let destinationTitle = Font.system(.largeTitle, design: .serif, weight: .medium)
    static let editorialTitle = Font.system(size: 38, weight: .regular, design: .serif)
    static let sectionTitle = Font.system(.title2, design: .serif, weight: .regular)
    static let cardTitle = Font.system(.headline, design: .default, weight: .medium)
    static let body = Font.system(.body, design: .default)
    static let utility = Font.system(.caption, design: .default, weight: .medium)
}

struct MSHSurfaceModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(MSHSpacing.large)
            .background(MSHColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: MSHRadius.large, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: MSHRadius.large, style: .continuous)
                    .stroke(MSHColor.border, lineWidth: 0.75)
            }
    }
}

extension View {
    func mshSurface() -> some View { modifier(MSHSurfaceModifier()) }
}

extension MSHNativeHaptic {
    @MainActor
    func fire() { play() }
}

// MARK: - Native Calendar

private struct MSHCalendarItem: Identifiable, Codable, Equatable {
    enum Kind: String, Codable, CaseIterable, Identifiable {
        case appointment, movement, medication, cycle, personal
        var id: String { rawValue }
        var title: String { rawValue.capitalized }
        var icon: String {
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
}

@MainActor
private final class MSHCalendarStore: ObservableObject {
    @Published var items: [MSHCalendarItem] = []
    private let key = "msh.nativeCalendar.events.v1"

    init() {
        guard let data = UserDefaults.standard.data(forKey: key),
              let decoded = try? JSONDecoder().decode([MSHCalendarItem].self, from: data) else { return }
        items = decoded.sorted { $0.start < $1.start }
    }

    func items(on date: Date) -> [MSHCalendarItem] {
        items.filter { Calendar.current.isDate($0.start, inSameDayAs: date) }.sorted { $0.start < $1.start }
    }

    func save(_ item: MSHCalendarItem) {
        if let index = items.firstIndex(where: { $0.id == item.id }) { items[index] = item }
        else { items.append(item) }
        items.sort { $0.start < $1.start }
        persist()
    }

    func delete(_ item: MSHCalendarItem) {
        items.removeAll { $0.id == item.id }
        persist()
        Task { _ = await MSHNotificationService.shared.cancelNotifications(eventID: item.id.uuidString) }
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(items) { UserDefaults.standard.set(data, forKey: key) }
    }
}

struct MSHNativeCalendarScreen: View {
    @StateObject private var store = MSHCalendarStore()
    @State private var month = Calendar.current.dateInterval(of: .month, for: Date())?.start ?? Date()
    @State private var selectedDay = Date()
    @State private var editingItem: MSHCalendarItem?
    @State private var showEditor = false

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 6), count: 7)

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("CALENDAR")
                            .font(.caption2.weight(.semibold)).tracking(2.1)
                            .foregroundStyle(MSHColor.accent)
                        Text("Your health in time.")
                            .font(.system(size: 34, design: .serif))
                            .foregroundStyle(MSHColor.primaryText)
                        Text("Appointments, movement, medication actions, cycle context, and everyday life can sit together here.")
                            .foregroundStyle(MSHColor.secondaryText)
                    }

                    HStack {
                        Button { moveMonth(-1) } label: { Image(systemName: "chevron.left").frame(width: 42, height: 42) }
                        Spacer()
                        Text(month.formatted(.dateTime.month(.wide).year()))
                            .font(.system(.title3, design: .serif, weight: .semibold))
                        Spacer()
                        Button { moveMonth(1) } label: { Image(systemName: "chevron.right").frame(width: 42, height: 42) }
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(MSHColor.primaryText)

                    LazyVGrid(columns: columns, spacing: 6) {
                        ForEach(Calendar.current.veryShortStandaloneWeekdaySymbols, id: \.self) { day in
                            Text(day.uppercased())
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(MSHColor.secondaryText)
                                .frame(maxWidth: .infinity)
                        }
                    }

                    LazyVGrid(columns: columns, spacing: 8) {
                        ForEach(Array(monthCells.enumerated()), id: \.offset) { _, date in
                            if let date { dayButton(date) }
                            else { Color.clear.frame(height: 48) }
                        }
                    }

                    dayAgenda
                }
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 40)
            }
        }
        .navigationTitle("Calendar")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showEditor) {
            MSHCalendarEditor(item: editingItem, defaultDate: selectedDay) { item in
                store.save(item)
                selectedDay = item.start
            }
        }
        .accessibilityIdentifier("native-calendar-screen")
    }

    private func dayButton(_ date: Date) -> some View {
        let selected = Calendar.current.isDate(date, inSameDayAs: selectedDay)
        let hasItems = !store.items(on: date).isEmpty
        return Button {
            selectedDay = date
            MSHNativeHaptic.selection.play()
        } label: {
            VStack(spacing: 5) {
                Text(date.formatted(.dateTime.day()))
                Circle().fill(hasItems ? MSHColor.sage : Color.clear).frame(width: 4, height: 4)
            }
            .font(.subheadline.weight(selected ? .semibold : .regular))
            .foregroundStyle(selected ? Color.white : MSHColor.primaryText)
            .frame(maxWidth: .infinity).frame(height: 48)
            .background(selected ? MSHColor.charcoal : Color.clear, in: RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
    }

    private var dayAgenda: some View {
        let items = store.items(on: selectedDay)
        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(selectedDay.formatted(.dateTime.weekday(.wide)))
                        .font(.caption.weight(.semibold)).foregroundStyle(MSHColor.secondaryText)
                    Text(selectedDay.formatted(.dateTime.month(.wide).day()))
                        .font(.system(.title2, design: .serif, weight: .semibold))
                }
                Spacer()
                Button("Add") { editingItem = nil; showEditor = true }
                    .buttonStyle(.plain).font(.subheadline.weight(.semibold)).foregroundStyle(MSHColor.accent)
            }

            if items.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Nothing scheduled.").font(.system(.headline, design: .serif))
                    Text("A quiet day is still useful information.").font(.subheadline).foregroundStyle(MSHColor.secondaryText)
                }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading)
                .background(MSHColor.controlFill.opacity(0.45), in: RoundedRectangle(cornerRadius: 20))
            } else {
                ForEach(items) { item in
                    Button {
                        editingItem = item
                        showEditor = true
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: item.kind.icon).foregroundStyle(MSHColor.accent).frame(width: 34)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(item.title).font(.system(.body, design: .serif, weight: .semibold))
                                Text(item.start.formatted(date: .omitted, time: .shortened))
                                    .font(.caption).foregroundStyle(MSHColor.secondaryText)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").font(.caption).foregroundStyle(MSHColor.secondaryText)
                        }
                        .padding(16).background(MSHColor.surface, in: RoundedRectangle(cornerRadius: 20))
                        .overlay { RoundedRectangle(cornerRadius: 20).stroke(MSHColor.border, lineWidth: 0.8) }
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        Button(role: .destructive) { store.delete(item) } label: { Label("Delete", systemImage: "trash") }
                    }
                }
            }
        }
        .foregroundStyle(MSHColor.primaryText)
        .padding(.top, 6)
    }

    private var monthCells: [Date?] {
        let cal = Calendar.current
        guard let range = cal.range(of: .day, in: .month, for: month) else { return [] }
        let firstWeekday = cal.component(.weekday, from: month)
        let leading = (firstWeekday - cal.firstWeekday + 7) % 7
        var result = Array<Date?>(repeating: nil, count: leading)
        for day in range {
            var components = cal.dateComponents([.year, .month], from: month)
            components.day = day
            result.append(cal.date(from: components))
        }
        return result
    }

    private func moveMonth(_ offset: Int) {
        guard let next = Calendar.current.date(byAdding: .month, value: offset, to: month) else { return }
        month = Calendar.current.dateInterval(of: .month, for: next)?.start ?? next
        selectedDay = month
    }
}

private struct MSHCalendarEditor: View {
    @Environment(\.dismiss) private var dismiss
    private let id: UUID
    private let onSave: (MSHCalendarItem) -> Void
    @State private var title: String
    @State private var start: Date
    @State private var end: Date
    @State private var kind: MSHCalendarItem.Kind
    @State private var notes: String

    init(item: MSHCalendarItem?, defaultDate: Date, onSave: @escaping (MSHCalendarItem) -> Void) {
        let start = item?.start ?? Calendar.current.date(bySettingHour: 9, minute: 0, second: 0, of: defaultDate) ?? defaultDate
        id = item?.id ?? UUID()
        self.onSave = onSave
        _title = State(initialValue: item?.title ?? "")
        _start = State(initialValue: start)
        _end = State(initialValue: item?.end ?? start.addingTimeInterval(3600))
        _kind = State(initialValue: item?.kind ?? .appointment)
        _notes = State(initialValue: item?.notes ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("What") {
                    TextField("Title", text: $title)
                    Picker("Type", selection: $kind) {
                        ForEach(MSHCalendarItem.Kind.allCases) { kind in
                            Label(kind.title, systemImage: kind.icon).tag(kind)
                        }
                    }
                }
                Section("When") {
                    DatePicker("Starts", selection: $start)
                    DatePicker("Ends", selection: $end, in: start...)
                }
                Section("Context") {
                    TextField("Notes", text: $notes, axis: .vertical).lineLimit(3...7)
                }
            }
            .navigationTitle(title.isEmpty ? "Add to Calendar" : "Edit Calendar Item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(MSHCalendarItem(
                            id: id,
                            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
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
