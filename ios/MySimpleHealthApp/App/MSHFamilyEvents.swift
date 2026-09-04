import SwiftUI
import UserNotifications

struct MSHFamilyBirthday: Codable, Identifiable, Equatable {
    enum MessageMode: String, Codable, CaseIterable, Identifiable {
        case reminder
        case draft

        var id: Self { self }

        var title: String {
            switch self {
            case .reminder: "Remind me"
            case .draft: "Prepare message"
            }
        }
    }

    var id: UUID
    var name: String
    var relationship: String
    var month: Int
    var day: Int
    var message: String
    var mode: MessageMode
    var hour: Int
    var minute: Int
    var isEnabled: Bool

    init(
        id: UUID = UUID(),
        name: String,
        relationship: String,
        month: Int,
        day: Int,
        message: String,
        mode: MessageMode = .draft,
        hour: Int = 9,
        minute: Int = 0,
        isEnabled: Bool = true
    ) {
        self.id = id
        self.name = name
        self.relationship = relationship
        self.month = month
        self.day = day
        self.message = message
        self.mode = mode
        self.hour = hour
        self.minute = minute
        self.isEnabled = isEnabled
    }
}

@MainActor
final class MSHFamilyBirthdayStore: ObservableObject {
    @Published private(set) var birthdays: [MSHFamilyBirthday] = []

    private let defaults: UserDefaults
    private let storageKey = "msh.family.birthdays.v1"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        load()
    }

    func save(_ birthday: MSHFamilyBirthday) {
        if let index = birthdays.firstIndex(where: { $0.id == birthday.id }) {
            birthdays[index] = birthday
        } else {
            birthdays.append(birthday)
        }
        birthdays.sort { ($0.month, $0.day, $0.name) < ($1.month, $1.day, $1.name) }
        persist()
        Task { await MSHFamilyBirthdayScheduler.schedule(birthday) }
    }

    func delete(at offsets: IndexSet) {
        let removed = offsets.map { birthdays[$0] }
        birthdays.remove(atOffsets: offsets)
        persist()
        for birthday in removed {
            MSHFamilyBirthdayScheduler.cancel(birthday)
        }
    }

    private func load() {
        guard let data = defaults.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode([MSHFamilyBirthday].self, from: data) else { return }
        birthdays = decoded
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(birthdays) else { return }
        defaults.set(data, forKey: storageKey)
    }
}

enum MSHFamilyBirthdayScheduler {
    private static func identifier(for birthday: MSHFamilyBirthday) -> String {
        "msh.family.birthday.\(birthday.id.uuidString)"
    }

    static func schedule(_ birthday: MSHFamilyBirthday) async {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [identifier(for: birthday)])
        guard birthday.isEnabled else { return }

        let settings = await center.notificationSettings()
        if settings.authorizationStatus == .notDetermined {
            _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
        }

        let content = UNMutableNotificationContent()
        content.title = birthday.mode == .draft ? "Birthday message for \(birthday.name)" : "\(birthday.name)’s birthday"
        content.body = birthday.mode == .draft
            ? (birthday.message.isEmpty ? "It’s \(birthday.name)’s birthday. Open MSH to write your message." : birthday.message)
            : "It’s \(birthday.name)’s birthday today."
        content.sound = .default
        content.userInfo = ["mshFamilyBirthdayID": birthday.id.uuidString]

        var components = DateComponents()
        components.month = birthday.month
        components.day = birthday.day
        components.hour = birthday.hour
        components.minute = birthday.minute

        let request = UNNotificationRequest(
            identifier: identifier(for: birthday),
            content: content,
            trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
        )
        try? await center.add(request)
    }

    static func cancel(_ birthday: MSHFamilyBirthday) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier(for: birthday)])
    }
}

struct MSHFamilyEventsScreen: View {
    @StateObject private var store = MSHFamilyBirthdayStore()
    @State private var showingAddBirthday = false

    var body: some View {
        List {
            Section {
                Text("Keep meaningful dates in one place. MSH can remind you or prepare the message you chose, while you stay in control of what gets sent.")
                    .font(.subheadline)
                    .foregroundStyle(MSHColor.secondaryText)
            }

            Section("Birthdays") {
                if store.birthdays.isEmpty {
                    ContentUnavailableView(
                        "No birthdays yet",
                        systemImage: "birthday.cake",
                        description: Text("Add a family birthday and choose how MSH should help each year.")
                    )
                } else {
                    ForEach(store.birthdays) { birthday in
                        NavigationLink {
                            MSHFamilyBirthdayEditor(store: store, existing: birthday)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(birthday.name).font(.headline)
                                Text(summary(for: birthday))
                                    .font(.subheadline)
                                    .foregroundStyle(MSHColor.secondaryText)
                            }
                        }
                    }
                    .onDelete(perform: store.delete)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(MSHColor.canvas)
        .navigationTitle("Family Events")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showingAddBirthday = true } label: {
                    Label("Add Birthday", systemImage: "plus")
                }
            }
        }
        .sheet(isPresented: $showingAddBirthday) {
            NavigationStack {
                MSHFamilyBirthdayEditor(store: store)
            }
        }
    }

    private func summary(for birthday: MSHFamilyBirthday) -> String {
        let date = DateComponents(calendar: .current, year: 2000, month: birthday.month, day: birthday.day).date ?? Date()
        let dateText = date.formatted(.dateTime.month(.wide).day())
        let relationship = birthday.relationship.trimmingCharacters(in: .whitespacesAndNewlines)
        return [relationship, dateText, birthday.mode.title].filter { !$0.isEmpty }.joined(separator: " · ")
    }
}

private struct MSHFamilyBirthdayEditor: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: MSHFamilyBirthdayStore
    let existing: MSHFamilyBirthday?

    @State private var name: String
    @State private var relationship: String
    @State private var birthday: Date
    @State private var message: String
    @State private var mode: MSHFamilyBirthday.MessageMode
    @State private var deliveryTime: Date
    @State private var isEnabled: Bool

    init(store: MSHFamilyBirthdayStore, existing: MSHFamilyBirthday? = nil) {
        self.store = store
        self.existing = existing
        let calendar = Calendar.current
        let initialBirthday = calendar.date(from: DateComponents(year: 2000, month: existing?.month ?? 1, day: existing?.day ?? 1)) ?? Date()
        let initialTime = calendar.date(from: DateComponents(year: 2000, month: 1, day: 1, hour: existing?.hour ?? 9, minute: existing?.minute ?? 0)) ?? Date()
        _name = State(initialValue: existing?.name ?? "")
        _relationship = State(initialValue: existing?.relationship ?? "")
        _birthday = State(initialValue: initialBirthday)
        _message = State(initialValue: existing?.message ?? "Happy birthday! Thinking of you today and hoping you have a wonderful day.")
        _mode = State(initialValue: existing?.mode ?? .draft)
        _deliveryTime = State(initialValue: initialTime)
        _isEnabled = State(initialValue: existing?.isEnabled ?? true)
    }

    var body: some View {
        Form {
            Section("Person") {
                TextField("Name", text: $name)
                    .textInputAutocapitalization(.words)
                TextField("Relationship", text: $relationship)
                    .textInputAutocapitalization(.words)
                DatePicker("Birthday", selection: $birthday, displayedComponents: .date)
            }

            Section("Each year") {
                Picker("MSH should", selection: $mode) {
                    ForEach(MSHFamilyBirthday.MessageMode.allCases) { mode in
                        Text(mode.title).tag(mode)
                    }
                }
                DatePicker("Time", selection: $deliveryTime, displayedComponents: .hourAndMinute)
                Toggle("Enabled", isOn: $isEnabled)
            }

            if mode == .draft {
                Section("Message") {
                    TextEditor(text: $message)
                        .frame(minHeight: 110)
                    Text("MSH prepares this message in the reminder. It does not send a text without you.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle(existing == nil ? "Add Birthday" : "Birthday")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                if existing == nil { Button("Cancel") { dismiss() } }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { save() }
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }

    private func save() {
        let calendar = Calendar.current
        let birthdayParts = calendar.dateComponents([.month, .day], from: birthday)
        let timeParts = calendar.dateComponents([.hour, .minute], from: deliveryTime)
        let value = MSHFamilyBirthday(
            id: existing?.id ?? UUID(),
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            relationship: relationship.trimmingCharacters(in: .whitespacesAndNewlines),
            month: birthdayParts.month ?? 1,
            day: birthdayParts.day ?? 1,
            message: message.trimmingCharacters(in: .whitespacesAndNewlines),
            mode: mode,
            hour: timeParts.hour ?? 9,
            minute: timeParts.minute ?? 0,
            isEnabled: isEnabled
        )
        store.save(value)
        dismiss()
    }
}
