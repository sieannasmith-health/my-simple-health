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
                        ForEach(Array(Calendar.current.veryShortStandaloneWeekdaySymbols.enumerated()), id: \.offset) { _, day in
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
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(selectedDay.formatted(.dateTime.weekday(.wide)))
                        .font(.caption.weight(.semibold)).foregroundStyle(MSHColor.secondaryText)
                    Text(selectedDay.formatted(.dateTime.month(.wide).day()))
                        .font(.system(.title2, design: .serif, weight: .semibold))
                }
                Spacer()
                HStack(spacing: 14) {
                    NavigationLink {
                        MSHNativeMovementLibraryScreen(defaultDate: selectedDay)
                    } label: {
                        Label("Movement", systemImage: "figure.walk.motion")
                            .labelStyle(.iconOnly)
                            .font(.headline)
                            .foregroundStyle(MSHColor.accent)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Plan movement")

                    Button("Add") { editingItem = nil; showEditor = true }
                        .buttonStyle(.plain)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(MSHColor.accent)
                }
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

// MARK: - Native Movement Library + Your Workouts

private struct MSHMovementOption: Identifiable, Hashable {
    let id: String
    let title: String
    let category: String

    static let all: [MSHMovementOption] = [
        .init(id: "hiit", title: "HIIT", category: "Exercise modalities"),
        .init(id: "miit", title: "MIIT", category: "Exercise modalities"),
        .init(id: "barre", title: "Barre", category: "Exercise modalities"),
        .init(id: "pilates", title: "Pilates", category: "Exercise modalities"),
        .init(id: "strength_training", title: "Strength training", category: "Exercise modalities"),
        .init(id: "yoga", title: "Yoga", category: "Exercise modalities"),
        .init(id: "circuit_training", title: "Circuit training", category: "Exercise modalities"),
        .init(id: "calisthenics", title: "Calisthenics", category: "Exercise modalities"),
        .init(id: "walking", title: "Walking", category: "Aerobic and locomotor movement"),
        .init(id: "running", title: "Running", category: "Aerobic and locomotor movement"),
        .init(id: "cycling", title: "Cycling", category: "Aerobic and locomotor movement"),
        .init(id: "swimming", title: "Swimming", category: "Aerobic and locomotor movement"),
        .init(id: "rowing", title: "Rowing", category: "Aerobic and locomotor movement"),
        .init(id: "stair_climbing", title: "Stair climbing", category: "Aerobic and locomotor movement"),
        .init(id: "stretching", title: "Stretching", category: "Mobility and recovery"),
        .init(id: "mobility", title: "Mobility", category: "Mobility and recovery"),
        .init(id: "gentle_movement", title: "Gentle movement", category: "Mobility and recovery"),
        .init(id: "basketball", title: "Basketball", category: "Sports"),
        .init(id: "tennis", title: "Tennis", category: "Sports"),
        .init(id: "pickleball", title: "Pickleball", category: "Sports"),
        .init(id: "soccer", title: "Soccer", category: "Sports"),
        .init(id: "volleyball", title: "Volleyball", category: "Sports"),
        .init(id: "golf", title: "Golf", category: "Sports"),
        .init(id: "softball_baseball", title: "Softball / baseball", category: "Sports"),
        .init(id: "martial_arts", title: "Martial arts", category: "Sports"),
        .init(id: "other_sport", title: "Other sport", category: "Sports"),
        .init(id: "hiking", title: "Hiking", category: "Recreation"),
        .init(id: "dancing", title: "Dancing", category: "Recreation"),
        .init(id: "kayaking", title: "Kayaking", category: "Recreation"),
        .init(id: "skiing_snowboarding", title: "Skiing / snowboarding", category: "Recreation"),
        .init(id: "skating", title: "Skating", category: "Recreation"),
        .init(id: "gardening", title: "Gardening", category: "Recreation"),
        .init(id: "housework", title: "Housework", category: "Activities of daily living"),
        .init(id: "yard_work", title: "Yard work", category: "Activities of daily living"),
        .init(id: "carrying_groceries", title: "Carrying groceries", category: "Activities of daily living"),
        .init(id: "moving_furniture", title: "Moving furniture", category: "Activities of daily living"),
        .init(id: "stairs", title: "Stairs", category: "Activities of daily living"),
        .init(id: "active_errands", title: "Active errands", category: "Activities of daily living"),
        .init(id: "physical_caregiving", title: "Physical caregiving", category: "Activities of daily living"),
        .init(id: "other_daily_movement", title: "Other daily-life movement", category: "Activities of daily living"),
        .init(id: "ran_5k", title: "Ran a 5K", category: "Events and meaningful accomplishments"),
        .init(id: "ran_10k", title: "Ran a 10K", category: "Events and meaningful accomplishments"),
        .init(id: "ran_half_marathon", title: "Ran a half marathon", category: "Events and meaningful accomplishments"),
        .init(id: "ran_marathon", title: "Ran a marathon", category: "Events and meaningful accomplishments"),
        .init(id: "walked_event", title: "Walked a race/event", category: "Events and meaningful accomplishments"),
        .init(id: "cycling_event", title: "Cycling event", category: "Events and meaningful accomplishments"),
        .init(id: "hiking_event", title: "Hiking event", category: "Events and meaningful accomplishments"),
        .init(id: "custom_event", title: "Custom event", category: "Events and meaningful accomplishments")
    ]
}

private struct MSHYouTubeWorkout: Identifiable, Codable, Hashable {
    let videoId: String
    let title: String
    let durationMinutes: Int?
    let focusTags: [String]?
    let youtubeUrl: String?
    let thumbnailUrl: String?
    var id: String { videoId }
}

private struct MSHYouTubePlaylistResponse: Decodable {
    let playlistId: String?
    let videos: [MSHYouTubeWorkout]
    let source: String?
    let limited: Bool?
    let note: String?
    let error: String?
}

@MainActor
private final class MSHMovementLibraryStore: ObservableObject {
    @Published var workouts: [MSHYouTubeWorkout] = []
    @Published var playlistURL = ""
    @Published var isLoading = false
    @Published var statusMessage = ""

    private let workoutsKey = "msh.nativeMovement.youtubeWorkouts.v1"
    private let playlistURLKey = "msh.nativeMovement.youtubePlaylistURL.v1"

    init() {
        playlistURL = UserDefaults.standard.string(forKey: playlistURLKey) ?? ""
        if let data = UserDefaults.standard.data(forKey: workoutsKey),
           let decoded = try? JSONDecoder().decode([MSHYouTubeWorkout].self, from: data) {
            workouts = decoded
        }
    }

    func connectPlaylist() async {
        let trimmed = playlistURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            statusMessage = "Paste a YouTube playlist link first."
            return
        }
        guard var components = URLComponents(string: "https://mysimplehealth.org/api/youtube-playlist") else {
            statusMessage = "The playlist service is unavailable."
            return
        }
        components.queryItems = [URLQueryItem(name: "url", value: trimmed)]
        guard let url = components.url else {
            statusMessage = "That playlist link could not be read."
            return
        }

        isLoading = true
        statusMessage = "Connecting your workouts…"
        defer { isLoading = false }

        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let http = response as? HTTPURLResponse else {
                statusMessage = "YouTube did not return a usable response."
                return
            }
            let decoded = try JSONDecoder().decode(MSHYouTubePlaylistResponse.self, from: data)
            guard (200..<300).contains(http.statusCode), !decoded.videos.isEmpty else {
                statusMessage = decoded.error ?? "That playlist could not be loaded."
                return
            }

            workouts = decoded.videos
            UserDefaults.standard.set(trimmed, forKey: playlistURLKey)
            if let encoded = try? JSONEncoder().encode(workouts) {
                UserDefaults.standard.set(encoded, forKey: workoutsKey)
            }
            statusMessage = decoded.limited == true
                ? "\(workouts.count) workouts connected. YouTube returned a limited public-feed view."
                : "\(workouts.count) workouts connected."
        } catch {
            statusMessage = "The playlist could not be loaded right now."
        }
    }

    func disconnectPlaylist() {
        workouts = []
        playlistURL = ""
        statusMessage = "Playlist disconnected."
        UserDefaults.standard.removeObject(forKey: workoutsKey)
        UserDefaults.standard.removeObject(forKey: playlistURLKey)
    }
}

private struct MSHMovementPlanChoice: Identifiable {
    let id = UUID()
    let title: String
    let defaultDuration: Int
    let youtubeURL: String?
}

struct MSHNativeMovementLibraryScreen: View {
    @StateObject private var library = MSHMovementLibraryStore()
    @State private var searchText = ""
    @State private var planChoice: MSHMovementPlanChoice?
    let defaultDate: Date

    init(defaultDate: Date = Date()) {
        self.defaultDate = defaultDate
    }

    private var filteredMovement: [MSHMovementOption] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return MSHMovementOption.all }
        return MSHMovementOption.all.filter {
            $0.title.lowercased().contains(query) || $0.category.lowercased().contains(query)
        }
    }

    private var categories: [String] {
        var seen = Set<String>()
        return filteredMovement.compactMap { item in
            guard seen.insert(item.category).inserted else { return nil }
            return item.category
        }
    }

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("MOVEMENT LIBRARY")
                            .font(.caption2.weight(.semibold))
                            .tracking(2.1)
                            .foregroundStyle(MSHColor.accent)
                        Text("Find a way to move.")
                            .font(.system(size: 34, design: .serif))
                            .foregroundStyle(MSHColor.primaryText)
                        Text("Browse movement, keep the workouts you already use, and place either one directly into your Calendar.")
                            .foregroundStyle(MSHColor.secondaryText)
                    }

                    yourWorkouts

                    VStack(alignment: .leading, spacing: 14) {
                        Text("MOVEMENT LIBRARY")
                            .font(.caption2.weight(.semibold))
                            .tracking(1.6)
                            .foregroundStyle(MSHColor.secondaryText)

                        TextField("Search walking, Pilates, gardening…", text: $searchText)
                            .textInputAutocapitalization(.never)
                            .padding(.horizontal, 16)
                            .frame(height: 48)
                            .background(MSHColor.controlFill, in: RoundedRectangle(cornerRadius: 16, style: .continuous))

                        ForEach(categories, id: \.self) { category in
                            VStack(alignment: .leading, spacing: 10) {
                                Text(category)
                                    .font(.system(.headline, design: .serif))
                                    .foregroundStyle(MSHColor.primaryText)

                                FlowLayout(spacing: 8) {
                                    ForEach(filteredMovement.filter { $0.category == category }) { movement in
                                        Button {
                                            planChoice = MSHMovementPlanChoice(title: movement.title, defaultDuration: 30, youtubeURL: nil)
                                            MSHNativeHaptic.selection.play()
                                        } label: {
                                            Text(movement.title)
                                                .font(.subheadline)
                                                .foregroundStyle(MSHColor.primaryText)
                                                .padding(.horizontal, 13)
                                                .frame(minHeight: 40)
                                                .background(MSHColor.controlFill.opacity(0.7), in: Capsule())
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                            .padding(18)
                            .background(MSHColor.surface.opacity(0.72), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                            .overlay { RoundedRectangle(cornerRadius: 22).stroke(MSHColor.border, lineWidth: 0.7) }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 40)
            }
        }
        .navigationTitle("Movement Library")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $planChoice) { choice in
            MSHMovementPlanner(choice: choice, defaultDate: defaultDate)
        }
        .accessibilityIdentifier("native-movement-library")
    }

    private var yourWorkouts: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("YOUR WORKOUTS")
                .font(.caption2.weight(.semibold))
                .tracking(1.6)
                .foregroundStyle(MSHColor.accent)
            Text("Keep your workouts here.")
                .font(.system(.title3, design: .serif, weight: .semibold))
                .foregroundStyle(MSHColor.primaryText)
            Text("Connect the YouTube fitness playlist you already use. Saved workouts can be planned directly into your MSH Calendar.")
                .font(.subheadline)
                .foregroundStyle(MSHColor.secondaryText)

            HStack(spacing: 10) {
                TextField("YouTube playlist link", text: $library.playlistURL)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                    .autocorrectionDisabled()
                    .padding(.horizontal, 14)
                    .frame(height: 46)
                    .background(MSHColor.controlFill, in: RoundedRectangle(cornerRadius: 14, style: .continuous))

                Button {
                    Task { await library.connectPlaylist() }
                } label: {
                    Group {
                        if library.isLoading { ProgressView().tint(.white) }
                        else { Image(systemName: library.workouts.isEmpty ? "link" : "arrow.clockwise").font(.headline) }
                    }
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                }
                .background(MSHColor.accent, in: Circle())
                .buttonStyle(.plain)
                .disabled(library.isLoading)
                .accessibilityLabel(library.workouts.isEmpty ? "Connect YouTube playlist" : "Sync YouTube playlist")
            }

            if !library.statusMessage.isEmpty {
                Text(library.statusMessage).font(.caption).foregroundStyle(MSHColor.secondaryText)
            }

            if !library.workouts.isEmpty {
                VStack(spacing: 0) {
                    ForEach(Array(library.workouts.prefix(100))) { workout in
                        Button {
                            planChoice = MSHMovementPlanChoice(
                                title: workout.title,
                                defaultDuration: workout.durationMinutes ?? 30,
                                youtubeURL: workout.youtubeUrl
                            )
                            MSHNativeHaptic.selection.play()
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "play.rectangle.fill")
                                    .font(.title3)
                                    .foregroundStyle(MSHColor.clay)
                                    .frame(width: 34)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(workout.title)
                                        .font(.system(.body, design: .serif, weight: .medium))
                                        .foregroundStyle(MSHColor.primaryText)
                                        .lineLimit(2)
                                    HStack(spacing: 8) {
                                        Text("YouTube")
                                        if let minutes = workout.durationMinutes { Text("• \(minutes) min") }
                                    }
                                    .font(.caption)
                                    .foregroundStyle(MSHColor.secondaryText)
                                }
                                Spacer()
                                Image(systemName: "calendar.badge.plus").foregroundStyle(MSHColor.accent)
                            }
                            .padding(.vertical, 13)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        Divider()
                    }
                }

                Button("Disconnect playlist", role: .destructive) { library.disconnectPlaylist() }
                    .font(.caption.weight(.medium))
            }
        }
        .padding(18)
        .background(MSHColor.surface.opacity(0.72), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: 22).stroke(MSHColor.border, lineWidth: 0.7) }
    }
}

private struct MSHMovementPlanner: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var calendarStore = MSHCalendarStore()
    let choice: MSHMovementPlanChoice
    @State private var start: Date
    @State private var duration: Int
    @State private var notes = ""

    init(choice: MSHMovementPlanChoice, defaultDate: Date) {
        self.choice = choice
        let proposedStart = Calendar.current.date(bySettingHour: 9, minute: 0, second: 0, of: defaultDate) ?? defaultDate
        _start = State(initialValue: proposedStart)
        _duration = State(initialValue: max(5, choice.defaultDuration))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Movement") {
                    Text(choice.title).font(.system(.headline, design: .serif))
                    if choice.youtubeURL != nil {
                        Label("From Your Workouts on YouTube", systemImage: "play.rectangle.fill")
                            .font(.caption).foregroundStyle(MSHColor.secondaryText)
                    }
                }
                Section("Plan") {
                    DatePicker("Starts", selection: $start)
                    Stepper("\(duration) minutes", value: $duration, in: 5...240, step: 5)
                }
                Section("Context") {
                    TextField("Notes", text: $notes, axis: .vertical).lineLimit(2...6)
                }
                if let rawURL = choice.youtubeURL, let url = URL(string: rawURL) {
                    Section {
                        Link(destination: url) { Label("Open workout on YouTube", systemImage: "play.rectangle") }
                    }
                }
            }
            .navigationTitle("Plan Movement")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add to Calendar") {
                        var context = notes.trimmingCharacters(in: .whitespacesAndNewlines)
                        if let youtubeURL = choice.youtubeURL {
                            context = [context, "Workout: \(youtubeURL)"].filter { !$0.isEmpty }.joined(separator: "\n")
                        }
                        calendarStore.save(MSHCalendarItem(
                            id: UUID(),
                            title: choice.title,
                            start: start,
                            end: start.addingTimeInterval(TimeInterval(duration * 60)),
                            kind: .movement,
                            notes: context
                        ))
                        MSHNativeHaptic.confirmation.play()
                        dismiss()
                    }
                }
            }
        }
    }
}

private struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    struct Cache { var sizes: [CGSize] = [] }

    func makeCache(subviews: Subviews) -> Cache {
        Cache(sizes: subviews.map { $0.sizeThatFits(.unspecified) })
    }

    func updateCache(_ cache: inout Cache, subviews: Subviews) {
        cache.sizes = subviews.map { $0.sizeThatFits(.unspecified) }
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout Cache) -> CGSize {
        let maxWidth = proposal.width ?? 0
        guard maxWidth > 0 else {
            return CGSize(width: cache.sizes.reduce(0) { $0 + $1.width + spacing }, height: cache.sizes.map(\.height).max() ?? 0)
        }
        var width: CGFloat = 0
        var rowWidth: CGFloat = 0
        var rowHeight: CGFloat = 0
        var totalHeight: CGFloat = 0
        for size in cache.sizes {
            if rowWidth > 0 && rowWidth + spacing + size.width > maxWidth {
                width = max(width, rowWidth)
                totalHeight += rowHeight + spacing
                rowWidth = size.width
                rowHeight = size.height
            } else {
                rowWidth += (rowWidth > 0 ? spacing : 0) + size.width
                rowHeight = max(rowHeight, size.height)
            }
        }
        width = max(width, rowWidth)
        totalHeight += rowHeight
        return CGSize(width: width, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout Cache) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0
        for index in subviews.indices {
            let size = cache.sizes[index]
            if x > bounds.minX && x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subviews[index].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(width: size.width, height: size.height))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
