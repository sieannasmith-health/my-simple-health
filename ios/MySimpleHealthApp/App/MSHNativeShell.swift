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
        case .myHealth:
            "Your personal health picture will come together here."
        case .calendar:
            "A calm view of what is happening across your health over time."
        case .movement:
            "Movement, workouts, and activity context will live here."
        case .track:
            "See how your confirmed health experiences connect and change over time."
        case .tools:
            "Personal tools and resources will be available here."
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
                MSHSectionNavigation(
                    section: section,
                    notificationRoute: notificationRouter.route?.appSection == section
                        ? notificationRouter.route
                        : nil
                )
                .tabItem {
                    Label(section.title, systemImage: section.systemImage)
                }
                .tag(section)
            }
        }
        .background(MSHColor.canvas.ignoresSafeArea())
        .toolbar(.hidden, for: .tabBar)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            MSHBottomTabBar(selection: $selection)
        }
        .preferredColorScheme(appearance.colorScheme)
        .onAppear { openNotificationRouteIfNeeded(notificationRouter.route) }
        .onChange(of: notificationRouter.route) { _, route in
            openNotificationRouteIfNeeded(route)
        }
    }

    private func openNotificationRouteIfNeeded(_ route: MSHWebRoute?) {
        guard let route else { return }
        selection = route.appSection
    }
}

struct MSHBottomTabBar: View {
    @Binding var selection: MSHAppSection

    var body: some View {
        HStack(spacing: 0) {
            ForEach(MSHAppSection.allCases) { section in
                Button {
                    selection = section
                } label: {
                    VStack(spacing: 3) {
                        Image(systemName: section.systemImage)
                            .font(.system(size: 19, weight: .medium))
                            .frame(height: 22)
                        Text(section.title)
                            .font(.caption2.weight(selection == section ? .semibold : .regular))
                            .lineLimit(1)
                            .minimumScaleFactor(0.82)
                    }
                    .foregroundStyle(selection == section ? MSHColor.accent : MSHColor.secondaryText)
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 48)
                    .contentShape(Rectangle())
                }
                .buttonStyle(MSHBottomTabButtonStyle())
                .accessibilityLabel(section.title)
                .accessibilityValue(selection == section ? "Selected" : "")
                .accessibilityAddTraits(selection == section ? .isSelected : [])
                .accessibilityIdentifier("msh-tab-\(section.rawValue)")
            }
        }
        .padding(.horizontal, 6)
        .padding(.top, 4)
        .padding(.bottom, 2)
        .background {
            MSHColor.surface
                .ignoresSafeArea(edges: .bottom)
        }
        .overlay(alignment: .top) {
            Rectangle()
                .fill(MSHColor.border)
                .frame(height: 0.5)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("msh-bottom-tab-bar")
    }
}

private struct MSHBottomTabButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(MSHColor.controlFill.opacity(configuration.isPressed ? 0.72 : 0))
                    .padding(.horizontal, 3)
                    .padding(.vertical, 2)
            }
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(
                reduceMotion ? nil : .easeOut(duration: configuration.isPressed ? 0.08 : 0.1),
                value: configuration.isPressed
            )
    }
}

private struct MSHSectionNavigation: View {
    let section: MSHAppSection
    let notificationRoute: MSHWebRoute?

    var body: some View {
        NavigationStack {
            ZStack {
                MSHColor.canvas.ignoresSafeArea()

                Group {
                    switch section {
                    case .myHealth:
                        if let notificationRoute {
                            MSHNotificationWebRouteScreen(route: notificationRoute)
                        } else {
                            MSHMyHealthHomeScreen()
                        }
                    case .calendar:
                        if let notificationRoute {
                            MSHNotificationWebRouteScreen(route: notificationRoute)
                        } else {
                            MSHWebFeatureScreen(destination: .calendar)
                        }
                    case .movement:
                        if let notificationRoute {
                            MSHNotificationWebRouteScreen(route: notificationRoute)
                        } else {
                            MSHMovementScreen()
                        }
                    case .tools:
                        if let notificationRoute {
                            MSHNotificationWebRouteScreen(route: notificationRoute)
                        } else {
                            MSHToolsScreen()
                        }
                    case .track:
                        MSHTrackScreen()
                    }
                }
            }
            .navigationTitle(section.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(MSHColor.canvas, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                if section == .myHealth {
                    ToolbarItem(placement: .topBarTrailing) {
                        NavigationLink {
                            MSHImmediateDestination(title: "Profile & Settings") {
                                MSHProfileSettingsScreen()
                            }
                        } label: {
                            Image(systemName: "person.crop.circle")
                                .accessibilityLabel("Profile and Settings")
                        }
                    }
                }

                if section == .calendar {
                    ToolbarItem(placement: .topBarTrailing) {
                        NavigationLink {
                            MSHImmediateDestination(title: "People & Sharing") {
                                MSHPeopleSharingScreen()
                            }
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
        .mshNavigationSurface()
    }
}

private struct MSHNotificationWebRouteScreen: View {
    let route: MSHWebRoute

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()
            MSHWebView(route: route)
        }
        .toolbarBackground(MSHColor.canvas, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .accessibilityIdentifier("notification-route-\(route.rawValue)")
    }
}

struct MSHWebFeatureScreen: View {
    let destination: MSHFeatureDestination

    var body: some View {
        MSHImmediateDestination(title: destination.title) {
            ZStack {
                MSHColor.canvas.ignoresSafeArea()
                MSHWebView(destination: destination)
            }
        }
        .navigationTitle(destination.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(MSHColor.canvas, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .accessibilityIdentifier("native-feature-\(destination.rawValue)")
    }
}

private struct MSHMovementScreen: View {
    private let destinations: [(destination: MSHFeatureDestination, subtitle: String, image: String)] = [
        (.movementPlan, "Plan a workout or movement session, then record how it went. Existing MSH movements can be opened and edited without creating a duplicate.", "calendar.badge.plus"),
        (.calendar, "See scheduled and completed movement beside other dated health context.", "calendar"),
        (.movementLibrary, "Browse movement, saved workouts, favorites, and the existing YouTube playlist connection in one library.", "figure.run")
    ]

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: MSHSpacing.large) {
                    VStack(alignment: .leading, spacing: MSHSpacing.small) {
                        Text("Movement")
                            .font(MSHTypography.destinationTitle)
                            .foregroundStyle(MSHColor.primaryText)
                        Text("Choose movement, plan it in time, and keep your experience separate from what Apple Health records.")
                            .font(MSHTypography.body)
                            .foregroundStyle(MSHColor.secondaryText)
                    }

                    ForEach(destinations.indices, id: \.self) { index in
                        let item = destinations[index]
                        NavigationLink {
                            MSHWebFeatureScreen(destination: item.destination)
                        } label: {
                            MSHFeatureDoorway(
                                title: item.destination.title,
                                subtitle: item.subtitle,
                                systemImage: item.image
                            )
                        }
                        .buttonStyle(.plain)
                    }

                    MSHNativeBoundaryNote(
                        text: "Recent Apple Health movement remains available in My Health. Calendar requests only the visible date range rather than loading your complete HealthKit history. Apple Health source records stay unchanged; MSH can edit only its own attached context."
                    )
                }
                .padding(MSHSpacing.medium)
            }
        }
    }
}

private struct MSHTrackScreen: View {
    private let destinations: [(destination: MSHFeatureDestination, subtitle: String, image: String)] = [
        (.healthStory, "Review the living story compiled from your confirmed Landscape, direction, practices, reflections, Calendar, and Journey records.", "book.pages"),
        (.landscape, "Revisit the whole-health and life domains that form your current picture.", "map"),
        (.selfInsight, "Use structured reflection when one part of your experience needs more context.", "sparkles.rectangle.stack"),
        (.journey, "See recorded change through time without turning it into a streak or score.", "clock.arrow.circlepath"),
        (.calendar, "Review dated health and life context in the shared time layer.", "calendar")
    ]

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()
            ScrollView {
                LazyVStack(alignment: .leading, spacing: MSHSpacing.medium) {
                    VStack(alignment: .leading, spacing: MSHSpacing.small) {
                        Text("Track")
                            .font(MSHTypography.destinationTitle)
                            .foregroundStyle(MSHColor.primaryText)
                        Text("See how your health and life picture is changing across domains and through time.")
                            .font(MSHTypography.body)
                            .foregroundStyle(MSHColor.secondaryText)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.bottom, MSHSpacing.small)

                    ForEach(destinations.indices, id: \.self) { index in
                        let item = destinations[index]
                        NavigationLink {
                            MSHWebFeatureScreen(destination: item.destination)
                        } label: {
                            MSHFeatureDoorway(
                                title: item.destination.title,
                                subtitle: item.subtitle,
                                systemImage: item.image
                            )
                        }
                        .buttonStyle(.plain)
                    }

                    MSHNativeBoundaryNote(
                        text: "Track connects existing records and reflections. It does not diagnose, infer causes, or turn a nearby event into an explanation."
                    )
                }
                .padding(MSHSpacing.medium)
            }
        }
        .accessibilityIdentifier("track-integration-screen")
    }
}

private struct MSHToolsScreen: View {
    private let destinations: [(destination: MSHFeatureDestination, subtitle: String, image: String)] = [
        (.explore, "Browse the current My Health directory and choose where you want to go next.", "safari"),
        (.landscape, "See the broader picture of where you are.", "map"),
        (.selfInsight, "Choose a working self-reflection instrument.", "sparkles.rectangle.stack"),
        (.cycle, "Open Cycle as a layer of the shared Calendar.", "circle.dotted.circle"),
        (.medications, "Track medication supply, refill timing, and reviewable outreach actions.", "pills"),
        (.horizon, "Explore where you may want to head.", "sun.horizon"),
        (.path, "See what you are intentionally working toward.", "point.topleft.down.to.point.bottomright.curvepath"),
        (.practice, "Return to what you are trying in real life.", "leaf"),
        (.discovery, "Reflect on what experience is showing you.", "lightbulb"),
        (.journey, "See what has unfolded over time.", "clock.arrow.circlepath"),
        (.food, "Use the existing personal food workspace.", "fork.knife"),
        (.financialHealth, "Explore financial health in the context of your life.", "chart.pie")
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
                        Text("Open a working My Simple Health experience without leaving the native app shell.")
                            .font(MSHTypography.body)
                            .foregroundStyle(MSHColor.secondaryText)
                    }
                    .padding(.bottom, MSHSpacing.small)

                    NavigationLink {
                        MSHImmediateDestination(title: "Meditate") {
                            MSHMeditateScreen()
                        }
                    } label: {
                        MSHFeatureDoorway(
                            title: "Meditate",
                            subtitle: "Choose meditation, breathwork, a body scan, or a quiet timer.",
                            systemImage: "moon.stars"
                        )
                    }
                    .buttonStyle(.plain)

                    ForEach(destinations.indices, id: \.self) { index in
                        let item = destinations[index]
                        NavigationLink {
                            MSHWebFeatureScreen(destination: item.destination)
                        } label: {
                            MSHFeatureDoorway(
                                title: item.destination.title,
                                subtitle: item.subtitle,
                                systemImage: item.image
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

struct MSHFeatureDoorway: View {
    let title: String
    let subtitle: String
    let systemImage: String

    var body: some View {
        HStack(spacing: MSHSpacing.medium) {
            Image(systemName: systemImage)
                .font(.title3)
                .foregroundStyle(MSHColor.accent)
                .frame(width: 42, height: 42)
                .background(MSHColor.controlFill)
                .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))
            VStack(alignment: .leading, spacing: MSHSpacing.xSmall) {
                Text(title)
                    .font(MSHTypography.cardTitle)
                    .foregroundStyle(MSHColor.primaryText)
                Text(subtitle)
                    .font(.subheadline)
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
                .stroke(MSHColor.border, lineWidth: 1)
        }
        .contentShape(Rectangle())
    }
}

private struct MSHNativeBoundaryNote: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.footnote)
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
                        MSHImmediateDestination(title: "People & Sharing") {
                            MSHPeopleSharingScreen()
                        }
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
                            .padding(.horizontal, MSHSpacing.medium)
                            .frame(height: 48)
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
                            .font(.subheadline)
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
        .toolbarBackground(MSHColor.canvas, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
    }
}
