import SwiftUI

enum MSHAppSection: String, CaseIterable, Identifiable {
    case myHealth
    case calendar
    case movement
    case track
    case tools

    var id: Self { self }

    var title: String {
        switch self {
        case .myHealth: "My Health"
        case .calendar: "Calendar"
        case .movement: "Movement"
        case .track: "Track"
        case .tools: "Tools"
        }
    }

    var systemImage: String {
        switch self {
        case .myHealth: "heart.text.square"
        case .calendar: "calendar"
        case .movement: "figure.walk.motion"
        case .track: "plus.circle"
        case .tools: "square.grid.2x2"
        }
    }

    var introduction: String {
        switch self {
        case .myHealth: "Your personal health picture will come together here."
        case .calendar: "A calm view of what is happening across your health over time."
        case .movement: "Movement, workouts, and activity context will live here."
        case .track: "See how your confirmed health experiences connect and change over time."
        case .tools: "Personal tools and resources will be available here."
        }
    }

    var isImplemented: Bool { true }
}

enum MSHAppearancePreference: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: Self { self }

    var title: String {
        switch self {
        case .system: "System"
        case .light: "Light"
        case .dark: "Dark"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}

struct MSHAppShell: View {
    @State private var selection: MSHAppSection = .myHealth
    @StateObject private var notificationRouter = MSHNotificationRouter.shared
    @AppStorage("msh.appearance") private var appearanceRawValue = MSHAppearancePreference.system.rawValue

    private var appearance: MSHAppearancePreference {
        MSHAppearancePreference(rawValue: appearanceRawValue) ?? .system
    }

    var body: some View {
        TabView(selection: $selection) {
            ForEach(MSHAppSection.allCases) { section in
                MSHSectionNavigation(section: section)
                    .tabItem {
                        Label(section.title, systemImage: section.systemImage)
                    }
                    .tag(section)
            }
        }
        .preferredColorScheme(appearance.colorScheme)
        .tint(MSHColor.accent)
        .toolbarBackground(MSHColor.surface, for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
        .onAppear { openNotificationRouteIfNeeded(notificationRouter.route) }
        .onChange(of: notificationRouter.route) { _, route in
            openNotificationRouteIfNeeded(route)
        }
    }

    private func openNotificationRouteIfNeeded(_ route: MSHWebRoute?) {
        guard let route else { return }
        // Notification routes may still contain legacy web paths for compatibility,
        // but the app only uses them to choose a native tab. A notification never
        // creates a WKWebView inside the tab hierarchy.
        selection = route.appSection
    }
}

private struct MSHSectionNavigation: View {
    let section: MSHAppSection

    var body: some View {
        NavigationStack {
            Group {
                switch section {
                case .myHealth:
                    MSHMyHealthScreen()
                case .calendar:
                    MSHNativeCalendarScreen()
                case .movement:
                    MSHMovementScreen()
                case .track:
                    MSHTrackScreen()
                case .tools:
                    MSHToolsScreen()
                }
            }
            .navigationTitle(section.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if section == .myHealth {
                    ToolbarItem(placement: .topBarTrailing) {
                        NavigationLink {
                            MSHProfileSettingsScreen()
                        } label: {
                            Image(systemName: "person.crop.circle")
                                .accessibilityLabel("Profile and Settings")
                        }
                    }
                }

                if section == .calendar {
                    ToolbarItem(placement: .topBarTrailing) {
                        NavigationLink {
                            MSHPeopleSharingScreen()
                        } label: {
                            Label("Share Calendar", systemImage: "person.2")
                                .font(.subheadline.weight(.semibold))
                        }
                        .accessibilityLabel("Share Calendar")
                        .accessibilityIdentifier("calendar-share-button")
                    }
                }
            }
        }
    }
}

private enum MSHNativeDestination: String, CaseIterable, Identifiable {
    case movementPlan
    case movementLibrary
    case healthStory
    case landscape
    case selfInsight
    case journey
    case explore
    case cycle
    case medications
    case horizon
    case path
    case practice
    case discovery
    case food
    case financialHealth

    var id: Self { self }

    var title: String {
        switch self {
        case .movementPlan: "Plan Movement"
        case .movementLibrary: "Movement Library & Workouts"
        case .healthStory: "My Health Story"
        case .landscape: "Landscape"
        case .selfInsight: "Self-Insight"
        case .journey: "Journey"
        case .explore: "Explore"
        case .cycle: "Cycle"
        case .medications: "Medication Continuity"
        case .horizon: "Horizon"
        case .path: "Path"
        case .practice: "Practice"
        case .discovery: "Discovery"
        case .food: "Food"
        case .financialHealth: "Financial Health"
        }
    }

    var subtitle: String {
        switch self {
        case .movementPlan: "Plan movement in time without loading a web calendar."
        case .movementLibrary: "Browse movement and workout options in the native app."
        case .healthStory: "Review the health story built from confirmed records and reflections."
        case .landscape: "See the broader context of your health and life."
        case .selfInsight: "Use structured reflection when something needs more context."
        case .journey: "Review what has changed over time without turning it into a score."
        case .explore: "Browse the native MSH capability directory."
        case .cycle: "Record cycle context with clear, recognizable native symbols."
        case .medications: "Keep medication supply and refill continuity visible."
        case .horizon: "Clarify where you may want to head."
        case .path: "See what you are intentionally working toward."
        case .practice: "Return to what you are trying in real life."
        case .discovery: "Reflect on what your experience is showing you."
        case .food: "Keep food context in the same native health experience."
        case .financialHealth: "View financial health in the context of your life."
        }
    }

    var systemImage: String {
        switch self {
        case .movementPlan: "calendar.badge.plus"
        case .movementLibrary: "figure.run"
        case .healthStory: "book.pages"
        case .landscape: "map"
        case .selfInsight: "sparkles.rectangle.stack"
        case .journey: "clock.arrow.circlepath"
        case .explore: "safari"
        case .cycle: "drop.circle.fill"
        case .medications: "pills.fill"
        case .horizon: "sun.horizon.fill"
        case .path: "point.topleft.down.to.point.bottomright.curvepath"
        case .practice: "leaf.fill"
        case .discovery: "lightbulb.fill"
        case .food: "fork.knife"
        case .financialHealth: "chart.pie.fill"
        }
    }
}

private struct MSHNativeFeatureScreen: View {
    let destination: MSHNativeDestination

    @ViewBuilder
    var body: some View {
        switch destination {
        case .cycle:
            MSHNativeCycleScreen()
        default:
            MSHNativeFeatureSummaryScreen(destination: destination)
        }
    }
}

private struct MSHNativeFeatureSummaryScreen: View {
    let destination: MSHNativeDestination

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: MSHSpacing.large) {
                    Image(systemName: destination.systemImage)
                        .font(.system(.largeTitle, design: .default, weight: .semibold))
                        .foregroundStyle(MSHColor.accent)
                        .frame(width: 64, height: 64)
                        .background(MSHColor.controlFill)
                        .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))

                    Text(destination.title)
                        .font(MSHTypography.destinationTitle)
                        .foregroundStyle(MSHColor.primaryText)

                    Text(destination.subtitle)
                        .font(MSHTypography.body)
                        .foregroundStyle(MSHColor.secondaryText)
                        .fixedSize(horizontal: false, vertical: true)

                    MSHNativeBoundaryNote(
                        text: "This surface is native SwiftUI. Legacy website UI is not embedded in the app tabs. Feature data will move behind native services as each capability reaches parity."
                    )
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(MSHSpacing.large)
            }
        }
        .navigationTitle(destination.title)
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("native-feature-\(destination.rawValue)")
    }
}

private struct MSHNativeCalendarScreen: View {
    @State private var selectedDate = Date()
    @State private var snapshot: MSHMyHealthSnapshot?
    @State private var loadError: String?
    @State private var isLoading = false

    private let dataSource = MSHMyHealthDataSource.live()

    private var activityForSelectedDate: [MSHRecentHealthActivity] {
        guard let snapshot else { return [] }
        return snapshot.recentActivity.filter {
            Calendar.current.isDate($0.occurredAt, inSameDayAs: selectedDate)
        }
    }

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()
            ScrollView {
                LazyVStack(alignment: .leading, spacing: MSHSpacing.large) {
                    DatePicker(
                        "Date",
                        selection: $selectedDate,
                        displayedComponents: .date
                    )
                    .datePickerStyle(.graphical)
                    .tint(MSHColor.accent)
                    .padding(MSHSpacing.small)
                    .background(MSHColor.surface)
                    .clipShape(RoundedRectangle(cornerRadius: MSHRadius.large, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: MSHRadius.large, style: .continuous)
                            .stroke(MSHColor.border, lineWidth: 0.75)
                    }

                    HStack(spacing: MSHSpacing.small) {
                        NavigationLink {
                            MSHNativeCycleScreen()
                        } label: {
                            Label("Cycle", systemImage: "drop.circle.fill")
                                .font(MSHTypography.button)
                                .frame(maxWidth: .infinity, minHeight: 48)
                                .background(MSHColor.controlFill)
                                .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))
                        }
                        .buttonStyle(.plain)

                        Button {
                            Task { await reload() }
                        } label: {
                            Label("Refresh", systemImage: "arrow.clockwise")
                                .font(MSHTypography.button)
                                .frame(maxWidth: .infinity, minHeight: 48)
                                .background(MSHColor.controlFill)
                                .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .disabled(isLoading)
                    }
                    .foregroundStyle(MSHColor.accent)

                    VStack(alignment: .leading, spacing: MSHSpacing.small) {
                        Text(selectedDate.formatted(date: .complete, time: .omitted))
                            .font(MSHTypography.sectionTitle)
                            .foregroundStyle(MSHColor.primaryText)

                        if isLoading && snapshot == nil {
                            ProgressView("Loading recent health context…")
                                .tint(MSHColor.accent)
                        } else if let loadError {
                            Label(loadError, systemImage: "exclamationmark.triangle")
                                .font(MSHTypography.body)
                                .foregroundStyle(MSHColor.secondaryText)
                        } else if activityForSelectedDate.isEmpty {
                            Text("No recent Apple Health activity is stored for this date.")
                                .font(MSHTypography.body)
                                .foregroundStyle(MSHColor.secondaryText)
                        } else {
                            ForEach(activityForSelectedDate) { activity in
                                HStack(spacing: MSHSpacing.medium) {
                                    Image(systemName: activity.systemImage)
                                        .font(.title3.weight(.semibold))
                                        .foregroundStyle(MSHColor.accent)
                                        .frame(width: 42, height: 42)
                                        .background(MSHColor.controlFill)
                                        .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(activity.title)
                                            .font(MSHTypography.cardTitle)
                                            .foregroundStyle(MSHColor.primaryText)
                                        if let detail = activity.detail {
                                            Text(detail)
                                                .font(MSHTypography.caption)
                                                .foregroundStyle(MSHColor.secondaryText)
                                        }
                                        Text(activity.occurredAt.formatted(date: .omitted, time: .shortened))
                                            .font(MSHTypography.caption)
                                            .foregroundStyle(MSHColor.secondaryText)
                                    }
                                    Spacer(minLength: 0)
                                }
                                .padding(MSHSpacing.medium)
                                .background(MSHColor.surface)
                                .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))
                            }
                        }
                    }
                }
                .padding(MSHSpacing.medium)
            }
        }
        .task { await reload() }
        .accessibilityIdentifier("native-calendar-screen")
    }

    @MainActor
    private func reload() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            async let status = dataSource.loadStatus()
            async let recent = dataSource.loadRecentActivity(limit: 20)
            let (resolvedStatus, resolvedRecent) = try await (status, recent)
            snapshot = MSHMyHealthMapper.snapshot(
                syncState: resolvedStatus,
                recentRecords: resolvedRecent,
                recentLimit: 20
            )
            loadError = nil
        } catch {
            loadError = "Recent health context could not be loaded."
        }
    }
}

private struct MSHNativeCycleScreen: View {
    private struct CycleItem: Identifiable {
        let id: String
        let title: String
        let systemImage: String
        let note: String
    }

    private let items: [CycleItem] = [
        .init(id: "flow", title: "Flow", systemImage: "drop.fill", note: "Bleeding and flow"),
        .init(id: "cramps", title: "Cramps", systemImage: "waveform.path.ecg", note: "Pelvic or abdominal discomfort"),
        .init(id: "ovulation", title: "Ovulation", systemImage: "circle.circle.fill", note: "Ovulation context"),
        .init(id: "breast", title: "Breast tenderness", systemImage: "figure.arms.open", note: "Tenderness or sensitivity"),
        .init(id: "headache", title: "Headache", systemImage: "brain.head.profile", note: "Headache or migraine"),
        .init(id: "mood", title: "Mood", systemImage: "face.smiling.inverse", note: "Mood and emotional changes"),
        .init(id: "fatigue", title: "Fatigue", systemImage: "battery.25percent", note: "Energy and fatigue"),
        .init(id: "digestion", title: "Digestion", systemImage: "stomach", note: "Bloating, nausea, or digestion"),
        .init(id: "medication", title: "Medication", systemImage: "pills.fill", note: "Medication or contraception")
    ]

    private let columns = [GridItem(.adaptive(minimum: 145), spacing: MSHSpacing.small)]

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: MSHSpacing.large) {
                    VStack(alignment: .leading, spacing: MSHSpacing.small) {
                        Text("Cycle")
                            .font(MSHTypography.destinationTitle)
                            .foregroundStyle(MSHColor.primaryText)
                        Text("Clear symbols first, labels always. Nothing should require decoding a tiny abstract shape.")
                            .font(MSHTypography.body)
                            .foregroundStyle(MSHColor.secondaryText)
                    }

                    LazyVGrid(columns: columns, spacing: MSHSpacing.small) {
                        ForEach(items) { item in
                            VStack(alignment: .leading, spacing: MSHSpacing.small) {
                                Image(systemName: item.systemImage)
                                    .font(.system(size: 30, weight: .bold))
                                    .foregroundStyle(MSHColor.accent)
                                    .frame(width: 58, height: 58)
                                    .background(MSHColor.controlFill)
                                    .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))
                                Text(item.title)
                                    .font(MSHTypography.cardTitle)
                                    .foregroundStyle(MSHColor.primaryText)
                                Text(item.note)
                                    .font(MSHTypography.caption)
                                    .foregroundStyle(MSHColor.secondaryText)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .frame(maxWidth: .infinity, minHeight: 150, alignment: .topLeading)
                            .padding(MSHSpacing.medium)
                            .background(MSHColor.surface)
                            .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))
                            .overlay {
                                RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous)
                                    .stroke(MSHColor.border, lineWidth: 0.75)
                            }
                        }
                    }
                }
                .padding(MSHSpacing.medium)
            }
        }
        .navigationTitle("Cycle")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("native-cycle-screen")
    }
}

private struct MSHMovementScreen: View {
    private let destinations: [MSHNativeDestination] = [.movementPlan, .movementLibrary]

    var body: some View {
        MSHNativeDirectoryScreen(
            title: "Movement",
            introduction: "Choose movement, plan it in time, and keep your experience separate from what Apple Health records.",
            destinations: destinations,
            footer: "Recent Apple Health movement remains available in My Health. Native screens use bounded on-device data rather than loading a complete HealthKit history."
        )
    }
}

private struct MSHTrackScreen: View {
    private let destinations: [MSHNativeDestination] = [.healthStory, .landscape, .selfInsight, .journey]

    var body: some View {
        MSHNativeDirectoryScreen(
            title: "Track",
            introduction: "See how your health and life picture is changing across domains and through time.",
            destinations: destinations,
            footer: "Track connects confirmed records and reflections without treating a nearby event as proof of a cause."
        )
        .accessibilityIdentifier("track-integration-screen")
    }
}

private struct MSHToolsScreen: View {
    private let destinations: [MSHNativeDestination] = [
        .explore, .landscape, .selfInsight, .cycle, .medications,
        .horizon, .path, .practice, .discovery, .journey, .food, .financialHealth
    ]

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()
            ScrollView {
                LazyVStack(alignment: .leading, spacing: MSHSpacing.medium) {
                    VStack(alignment: .leading, spacing: MSHSpacing.small) {
                        Text("Tools")
                            .font(MSHTypography.destinationTitle)
                            .foregroundStyle(MSHColor.primaryText)
                        Text("Native capabilities that support your health without embedding the mobile website.")
                            .font(MSHTypography.body)
                            .foregroundStyle(MSHColor.secondaryText)
                    }
                    .padding(.bottom, MSHSpacing.small)

                    NavigationLink {
                        MSHMeditateScreen()
                    } label: {
                        MSHFeatureDoorway(
                            title: "Meditate",
                            subtitle: "Choose meditation, breathwork, a body scan, or a quiet timer.",
                            systemImage: "moon.stars.fill"
                        )
                    }
                    .buttonStyle(.plain)

                    ForEach(destinations) { destination in
                        NavigationLink {
                            MSHNativeFeatureScreen(destination: destination)
                        } label: {
                            MSHFeatureDoorway(
                                title: destination.title,
                                subtitle: destination.subtitle,
                                systemImage: destination.systemImage
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(MSHSpacing.medium)
            }
        }
    }
}

private struct MSHNativeDirectoryScreen: View {
    let title: String
    let introduction: String
    let destinations: [MSHNativeDestination]
    let footer: String

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()
            ScrollView {
                LazyVStack(alignment: .leading, spacing: MSHSpacing.medium) {
                    VStack(alignment: .leading, spacing: MSHSpacing.small) {
                        Text(title)
                            .font(MSHTypography.destinationTitle)
                            .foregroundStyle(MSHColor.primaryText)
                        Text(introduction)
                            .font(MSHTypography.body)
                            .foregroundStyle(MSHColor.secondaryText)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.bottom, MSHSpacing.small)

                    ForEach(destinations) { destination in
                        NavigationLink {
                            MSHNativeFeatureScreen(destination: destination)
                        } label: {
                            MSHFeatureDoorway(
                                title: destination.title,
                                subtitle: destination.subtitle,
                                systemImage: destination.systemImage
                            )
                        }
                        .buttonStyle(.plain)
                    }

                    MSHNativeBoundaryNote(text: footer)
                }
                .padding(MSHSpacing.medium)
            }
        }
    }
}

struct MSHFeatureDoorway: View {
    let title: String
    let subtitle: String
    let systemImage: String

    var body: some View {
        HStack(spacing: MSHSpacing.medium) {
            Image(systemName: systemImage)
                .font(.title3.weight(.semibold))
                .foregroundStyle(MSHColor.accent)
                .frame(width: 44, height: 44)
                .background(MSHColor.controlFill)
                .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))
            VStack(alignment: .leading, spacing: MSHSpacing.xSmall) {
                Text(title)
                    .font(MSHTypography.cardTitle)
                    .foregroundStyle(MSHColor.primaryText)
                Text(subtitle)
                    .font(MSHTypography.caption)
                    .foregroundStyle(MSHColor.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: MSHSpacing.small)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(MSHColor.secondaryText)
        }
        .padding(MSHSpacing.medium)
        .background(MSHColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous)
                .stroke(MSHColor.border, lineWidth: 0.75)
        }
        .contentShape(Rectangle())
    }
}

private struct MSHNativeBoundaryNote: View {
    let text: String

    var body: some View {
        Text(text)
            .font(MSHTypography.caption)
            .foregroundStyle(MSHColor.secondaryText)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, MSHSpacing.small)
    }
}

struct MSHProfileSettingsScreen: View {
    @AppStorage("msh.displayName") private var displayName = ""
    @AppStorage("msh.appearance") private var appearanceRawValue = MSHAppearancePreference.system.rawValue

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: MSHSpacing.large) {
                    VStack(alignment: .leading, spacing: MSHSpacing.medium) {
                        Image(systemName: "person.crop.circle")
                            .font(.system(size: 30, weight: .medium))
                            .foregroundStyle(MSHColor.accent)

                        Text("Profile & Settings")
                            .font(MSHTypography.destinationTitle)
                            .foregroundStyle(MSHColor.primaryText)

                        Text("Keep this space personal and comfortable to return to.")
                            .font(MSHTypography.body)
                            .foregroundStyle(MSHColor.secondaryText)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .mshSurface()

                    NavigationLink {
                        MSHPeopleSharingScreen()
                    } label: {
                        MSHFeatureDoorway(
                            title: "People & Sharing",
                            subtitle: "Invite someone and choose exactly which Calendar, workout, financial, and health information you share.",
                            systemImage: "person.2"
                        )
                    }
                    .buttonStyle(.plain)

                    VStack(alignment: .leading, spacing: MSHSpacing.medium) {
                        Text("What should we call you?")
                            .font(MSHTypography.cardTitle)
                            .foregroundStyle(MSHColor.primaryText)
                        TextField("Name or nickname", text: $displayName)
                            .textInputAutocapitalization(.words)
                            .font(MSHTypography.body)
                            .padding(.horizontal, MSHSpacing.medium)
                            .frame(minHeight: 48)
                            .background(MSHColor.controlFill)
                            .foregroundStyle(MSHColor.primaryText)
                            .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))
                            .overlay {
                                RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous)
                                    .stroke(MSHColor.border, lineWidth: 1)
                            }
                    }
                    .mshSurface()

                    VStack(alignment: .leading, spacing: MSHSpacing.medium) {
                        Text("Appearance")
                            .font(MSHTypography.cardTitle)
                            .foregroundStyle(MSHColor.primaryText)
                        Text("Choose the environment that is easiest for you to read.")
                            .font(MSHTypography.caption)
                            .foregroundStyle(MSHColor.secondaryText)

                        Picker("Appearance", selection: $appearanceRawValue) {
                            ForEach(MSHAppearancePreference.allCases) { preference in
                                Text(preference.title).tag(preference.rawValue)
                            }
                        }
                        .pickerStyle(.segmented)
                    }
                    .mshSurface()
                }
                .padding(MSHSpacing.medium)
            }
        }
        .navigationTitle("Profile & Settings")
        .navigationBarTitleDisplayMode(.inline)
    }
}
