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
            "A simple place to record experiences that matter to you."
        case .tools:
            "Personal tools and resources will be available here."
        }
    }

    var isImplemented: Bool {
        switch self {
        case .myHealth, .calendar, .movement, .tools: true
        case .track: false
        }
    }
}

struct MSHAppShell: View {
    @State private var selection: MSHAppSection = .myHealth
    @StateObject private var notificationRouter = MSHNotificationRouter.shared

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
        selection = route.appSection
    }
}

private struct MSHSectionNavigation: View {
    let section: MSHAppSection
    let notificationRoute: MSHWebRoute?

    var body: some View {
        NavigationStack {
            Group {
                switch section {
                case .myHealth:
                    if let notificationRoute {
                        MSHNotificationWebRouteScreen(route: notificationRoute)
                    } else {
                        MSHMyHealthScreen()
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
                    MSHDestinationScreen(section: section)
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
                }
        }
    }
}

private struct MSHNotificationWebRouteScreen: View {
    let route: MSHWebRoute

    var body: some View {
        MSHWebView(route: route)
            .background(MSHColor.canvas)
            .accessibilityIdentifier("notification-route-\(route.rawValue)")
    }
}

private struct MSHWebFeatureScreen: View {
    let destination: MSHFeatureDestination

    var body: some View {
        MSHWebView(destination: destination)
            .background(MSHColor.canvas)
            .navigationTitle(destination.title)
            .navigationBarTitleDisplayMode(.inline)
            .accessibilityIdentifier("native-feature-\(destination.rawValue)")
    }
}

private struct MSHMovementScreen: View {
    private let destinations: [(destination: MSHFeatureDestination, subtitle: String, image: String)] = [
        (.movementPlan, "Plan a workout or movement session, then record how it went.", "calendar.badge.plus"),
        (.calendar, "See scheduled and completed movement beside other dated health context.", "calendar"),
        (.movementLibrary, "Browse the existing movement vocabulary across exercise, recreation, daily life, and mobility.", "figure.run")
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
                        text: "Recent Apple Health movement remains available in My Health. Calendar requests only the visible date range rather than loading your complete HealthKit history."
                    )
                }
                .padding(MSHSpacing.medium)
            }
        }
    }
}

private struct MSHToolsScreen: View {
    private let destinations: [(destination: MSHFeatureDestination, subtitle: String, image: String)] = [
        (.landscape, "See the broader picture of where you are.", "map"),
        (.selfInsight, "Choose a working self-reflection instrument.", "sparkles.rectangle.stack"),
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

private struct MSHFeatureDoorway: View {
    let title: String
    let subtitle: String
    let systemImage: String

    var body: some View {
        HStack(spacing: MSHSpacing.medium) {
            Image(systemName: systemImage)
                .font(.title3)
                .foregroundStyle(MSHColor.accent)
                .frame(width: 42, height: 42)
                .background(MSHColor.sage.opacity(0.14))
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

private struct MSHDestinationScreen: View {
    let section: MSHAppSection

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: MSHSpacing.large) {
                    VStack(alignment: .leading, spacing: MSHSpacing.medium) {
                        Image(systemName: section.systemImage)
                            .font(.system(size: 30, weight: .medium))
                            .foregroundStyle(MSHColor.accent)
                            .frame(width: 56, height: 56)
                            .background(MSHColor.sage.opacity(0.18))
                            .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))

                        Text(section.title)
                            .font(MSHTypography.destinationTitle)
                            .foregroundStyle(MSHColor.primaryText)

                        Text(section.introduction)
                            .font(MSHTypography.body)
                            .foregroundStyle(MSHColor.secondaryText)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .mshSurface()

                    Text("This native space is ready for the next stage of the iPhone experience.")
                        .font(.footnote)
                        .foregroundStyle(MSHColor.secondaryText)
                        .padding(.horizontal, MSHSpacing.small)
                }
                .padding(MSHSpacing.medium)
            }
        }
    }
}

struct MSHProfileSettingsScreen: View {
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

                        Text("Your profile, preferences, privacy, and app settings will live here.")
                            .font(MSHTypography.body)
                            .foregroundStyle(MSHColor.secondaryText)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .mshSurface()
                }
                .padding(MSHSpacing.medium)
            }
        }
        .navigationTitle("Profile & Settings")
        .navigationBarTitleDisplayMode(.inline)
    }
}
