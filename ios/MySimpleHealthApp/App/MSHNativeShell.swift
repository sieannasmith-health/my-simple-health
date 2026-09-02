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
        case .myHealth: "Understand what is happening across your health."
        case .calendar: "See when health and life happen."
        case .movement: "Move in ways that work for you."
        case .track: "Notice what is changing over time."
        case .tools: "Open focused tools when you need them."
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
                .tabItem { Label(section.title, systemImage: section.systemImage) }
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
        .background { MSHColor.surface.ignoresSafeArea(edges: .bottom) }
        .overlay(alignment: .top) {
            Rectangle().fill(MSHColor.border).frame(height: 0.5)
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
                    case .track:
                        MSHTrackScreen()
                    case .tools:
                        if let notificationRoute {
                            MSHNotificationWebRouteScreen(route: notificationRoute)
                        } else {
                            MSHToolsScreen()
                        }
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
        (.movementPlan, "Plan a movement session and record how it felt.", "calendar.badge.plus"),
        (.movementLibrary, "Return to workouts, classes, videos, routines, and favorites you want to keep.", "figure.run")
    ]

    var body: some View {
        MSHEditorialDestinationList(
            eyebrow: "MOVEMENT",
            title: "Move in ways that work for you.",
            subtitle: "Plan something, or return to what you already enjoy.",
            destinations: destinations
        )
    }
}

private struct MSHTrackScreen: View {
    private let reflection: [(destination: MSHFeatureDestination, subtitle: String, image: String)] = [
        (.healthStory, "See the living story your confirmed health experiences are creating.", "book.pages"),
        (.landscape, "Return to the whole-health picture of where you are now.", "map"),
        (.selfInsight, "Look more closely when one part of your experience needs context.", "sparkles.rectangle.stack"),
        (.journey, "See what has changed over time without turning it into a score.", "clock.arrow.circlepath")
    ]

    private let direction: [(destination: MSHFeatureDestination, subtitle: String, image: String)] = [
        (.horizon, "Notice where you may want to head.", "sun.horizon"),
        (.path, "Keep what you are intentionally working toward in view.", "point.topleft.down.to.point.bottomright.curvepath"),
        (.practice, "Return to what you are trying in real life.", "leaf"),
        (.discovery, "Capture what experience is showing you.", "lightbulb")
    ]

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 30) {
                MSHEditorialHeader(
                    eyebrow: "TRACK",
                    title: "Notice what is changing.",
                    subtitle: "Your reflections, direction, and lived experience belong together here."
                )

                MSHDestinationGroup(title: "Your picture", destinations: reflection)
                MSHDestinationGroup(title: "Your direction", destinations: direction)
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 36)
        }
        .background(MSHColor.canvas)
        .accessibilityIdentifier("track-integration-screen")
    }
}

private struct MSHToolsScreen: View {
    private let care: [(destination: MSHFeatureDestination, subtitle: String, image: String)] = [
        (.cycle, "Keep cycle context close to the rest of your health.", "circle.dotted.circle"),
        (.medications, "Manage medication supply, refill timing, and follow-through.", "pills")
    ]

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 30) {
                MSHEditorialHeader(
                    eyebrow: "TOOLS",
                    title: "Useful when you need them.",
                    subtitle: "Focused capabilities stay here instead of competing with your everyday health view."
                )

                VStack(alignment: .leading, spacing: 0) {
                    MSHGroupLabel(title: "Wellbeing")
                    NavigationLink {
                        MSHImmediateDestination(title: "Meditate") {
                            MSHMeditateScreen()
                        }
                    } label: {
                        MSHEditorialDoorway(
                            title: "Meditate",
                            subtitle: "Meditation, breathwork, body scan, or quiet timer.",
                            systemImage: "moon.stars"
                        )
                    }
                    .buttonStyle(.plain)
                }

                MSHDestinationGroup(title: "Care", destinations: care)

                VStack(alignment: .leading, spacing: 0) {
                    MSHGroupLabel(title: "Everyday life")

                    NavigationLink {
                        MSHImmediateDestination(title: "Food") {
                            MSHFoodScreen()
                        }
                    } label: {
                        MSHEditorialDoorway(
                            title: "Food",
                            subtitle: "Keep inventory, groceries, product details, and what gets used in one native flow.",
                            systemImage: "fork.knife"
                        )
                    }
                    .buttonStyle(.plain)

                    NavigationLink {
                        MSHWebFeatureScreen(destination: .financialHealth)
                    } label: {
                        MSHEditorialDoorway(
                            title: "Financial Health",
                            subtitle: "Understand financial health in the context of your life.",
                            systemImage: "chart.pie"
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 36)
        }
        .background(MSHColor.canvas)
    }
}

private struct MSHEditorialDestinationList: View {
    let eyebrow: String
    let title: String
    let subtitle: String
    let destinations: [(destination: MSHFeatureDestination, subtitle: String, image: String)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 30) {
                MSHEditorialHeader(eyebrow: eyebrow, title: title, subtitle: subtitle)
                MSHDestinationGroup(title: "Your movement", destinations: destinations)
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 36)
        }
        .background(MSHColor.canvas)
    }
}

private struct MSHEditorialHeader: View {
    let eyebrow: String
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(eyebrow)
                .font(.caption2.weight(.semibold))
                .tracking(2.2)
                .foregroundStyle(MSHColor.accent)
            Text(title)
                .font(.system(size: 30, weight: .medium, design: .serif))
                .foregroundStyle(MSHColor.primaryText)
                .fixedSize(horizontal: false, vertical: true)
            Text(subtitle)
                .font(.system(size: 16, design: .serif))
                .foregroundStyle(MSHColor.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct MSHDestinationGroup: View {
    let title: String
    let destinations: [(destination: MSHFeatureDestination, subtitle: String, image: String)]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            MSHGroupLabel(title: title)
            ForEach(destinations.indices, id: \.self) { index in
                let item = destinations[index]
                NavigationLink {
                    MSHWebFeatureScreen(destination: item.destination)
                } label: {
                    MSHEditorialDoorway(
                        title: item.destination.title,
                        subtitle: item.subtitle,
                        systemImage: item.image
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }
}

private struct MSHGroupLabel: View {
    let title: String

    var body: some View {
        Text(title.uppercased())
            .font(.caption.weight(.semibold))
            .tracking(1.3)
            .foregroundStyle(MSHColor.secondaryText)
            .padding(.bottom, 8)
    }
}

private struct MSHEditorialDoorway: View {
    let title: String
    let subtitle: String
    let systemImage: String

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: systemImage)
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(MSHColor.accent)
                .frame(width: 30, height: 30)

            VStack(alignment: .leading, spacing: 5) {
                Text(title)
                    .font(.system(size: 18, weight: .medium, design: .serif))
                    .foregroundStyle(MSHColor.primaryText)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(MSHColor.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 8)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(MSHColor.secondaryText.opacity(0.7))
                .padding(.top, 5)
        }
        .padding(.vertical, 16)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(MSHColor.border.opacity(0.7))
                .frame(height: 0.5)
        }
        .contentShape(Rectangle())
    }
}

struct MSHFeatureDoorway: View {
    let title: String
    let subtitle: String
    let systemImage: String

    var body: some View {
        MSHEditorialDoorway(title: title, subtitle: subtitle, systemImage: systemImage)
    }
}

struct MSHProfileSettingsScreen: View {
    @AppStorage("msh.displayName") private var displayName = ""
    @AppStorage("msh.appearance") private var appearanceRawValue = MSHAppearancePreference.system.rawValue

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    MSHEditorialHeader(
                        eyebrow: "PROFILE",
                        title: "Make this space yours.",
                        subtitle: "Your preferences and sharing controls live here."
                    )

                    NavigationLink {
                        MSHImmediateDestination(title: "People & Sharing") {
                            MSHPeopleSharingScreen()
                        }
                    } label: {
                        MSHFeatureDoorway(
                            title: "People & Sharing",
                            subtitle: "Choose exactly what you share and with whom.",
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

                    VStack(alignment: .leading, spacing: MSHSpacing.medium) {
                        Text("Appearance")
                            .font(MSHTypography.cardTitle)
                            .foregroundStyle(MSHColor.primaryText)
                        Picker("Appearance", selection: $appearanceRawValue) {
                            ForEach(MSHAppearancePreference.allCases) { preference in
                                Text(preference.title).tag(preference.rawValue)
                            }
                        }
                        .pickerStyle(.segmented)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 36)
            }
        }
        .navigationTitle("Profile & Settings")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(MSHColor.canvas, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
    }
}
