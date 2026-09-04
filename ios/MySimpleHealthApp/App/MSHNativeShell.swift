import SwiftUI

enum MSHAppSection: String, CaseIterable, Identifiable {
    case myHealth, explore, simple, progress, me

    var id: Self { self }

    var title: String {
        switch self {
        case .myHealth: "My Health"
        case .explore: "Explore"
        case .simple: "Simple"
        case .progress: "Progress"
        case .me: "Me"
        }
    }

    var systemImage: String {
        switch self {
        case .myHealth: "heart.text.square"
        case .explore: "safari"
        case .simple: "sparkles"
        case .progress: "chart.line.uptrend.xyaxis"
        case .me: "person.crop.circle"
        }
    }

    var introduction: String {
        switch self {
        case .myHealth: "See what is useful for you right now."
        case .explore: "Explore everything My Simple Health can help with."
        case .simple: "Make sense of what is happening with Simple."
        case .progress: "See what has changed, what you tried, and what you learned."
        case .me: "Manage your account, connections, sharing, and preferences."
        }
    }

    var isImplemented: Bool { true }
}

enum MSHAppearancePreference: String, CaseIterable, Identifiable {
    case system, light, dark

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
                    notificationRoute: notificationRouter.route?.appSection == section ? notificationRouter.route : nil
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
        HStack(spacing: 2) {
            ForEach(MSHAppSection.allCases) { section in
                Button {
                    if selection != section { MSHNativeHaptic.selection.play() }
                    selection = section
                } label: {
                    VStack(spacing: 3) {
                        Image(systemName: section.systemImage)
                            .font(.system(size: section == .simple ? 20 : 19, weight: .medium))
                            .frame(height: 22)
                        Text(section.title)
                            .font(.caption2.weight(selection == section ? .semibold : .regular))
                            .lineLimit(1)
                            .minimumScaleFactor(0.82)
                    }
                    .foregroundStyle(selection == section ? Color.white : Color.white.opacity(0.66))
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 50)
                    .contentShape(Rectangle())
                    .background {
                        if selection == section {
                            RoundedRectangle(cornerRadius: 15, style: .continuous)
                                .fill(Color.white.opacity(0.025))
                                .mshNativeGlass(
                                    in: RoundedRectangle(cornerRadius: 15, style: .continuous),
                                    tint: section == .simple ? MSHColor.sage : MSHColor.powder,
                                    edgeStrength: section == .simple ? 1.18 : 0.94,
                                    shadowStrength: 0.72,
                                    glowStrength: section == .simple ? 0.48 : 0.32
                                )
                                .padding(.horizontal, 3)
                                .padding(.vertical, 2)
                        }
                    }
                }
                .buttonStyle(MSHBottomTabButtonStyle(isSelected: selection == section))
                .accessibilityLabel(section.title)
                .accessibilityValue(selection == section ? "Selected" : "")
                .accessibilityAddTraits(selection == section ? .isSelected : [])
                .accessibilityIdentifier("msh-tab-\(section.rawValue)")
            }
        }
        .padding(.horizontal, 8)
        .padding(.top, 6)
        .padding(.bottom, 4)
        .background {
            Rectangle()
                .fill(.ultraThinMaterial)
                .overlay(
                    LinearGradient(
                        colors: [Color.white.opacity(0.08), Color.black.opacity(0.10)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .ignoresSafeArea(edges: .bottom)
        }
        .overlay(alignment: .top) {
            LinearGradient(
                colors: [
                    Color(red: 0.78, green: 0.46, blue: 1.0).opacity(0.46),
                    Color.white.opacity(0.58),
                    Color(red: 0.42, green: 0.82, blue: 1.0).opacity(0.46)
                ],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(height: 0.8)
            .blur(radius: 0.15)
        }
        .shadow(color: Color(red: 0.44, green: 0.78, blue: 1.0).opacity(0.11), radius: 12, y: -2)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("msh-bottom-tab-bar")
    }
}

private struct MSHBottomTabButtonStyle: ButtonStyle {
    let isSelected: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 1.055 : 1)
            .brightness(configuration.isPressed ? 0.06 : 0)
            .shadow(
                color: Color(red: 0.48, green: 0.82, blue: 1.0)
                    .opacity(configuration.isPressed ? 0.24 : (isSelected ? 0.10 : 0)),
                radius: configuration.isPressed ? 14 : 7,
                y: configuration.isPressed ? 0 : 2
            )
            .animation(
                reduceMotion ? nil : .spring(response: 0.19, dampingFraction: 0.75),
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
                            MSHNativeNotificationRouteScreen(route: notificationRoute)
                        } else {
                            MSHMyHealthHomeScreen()
                        }
                    case .explore:
                        if let notificationRoute {
                            MSHNativeNotificationRouteScreen(route: notificationRoute)
                        } else {
                            MSHExploreScreen()
                        }
                    case .simple:
                        MSHSimpleScreen()
                    case .progress:
                        if let notificationRoute {
                            MSHNativeNotificationRouteScreen(route: notificationRoute)
                        } else {
                            MSHProgressScreen()
                        }
                    case .me:
                        MSHProfileSettingsScreen()
                    }
                }
            }
            .navigationTitle(section.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(MSHColor.canvas, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
        .mshNavigationSurface()
    }
}

private struct MSHNativeNotificationRouteScreen: View {
    let route: MSHWebRoute

    @ViewBuilder
    var body: some View {
        switch nativeDestination {
        case .some(let destination):
            MSHNativeFeatureScreen(destination: destination)
        case .none:
            switch route.appSection {
            case .myHealth:
                MSHMyHealthHomeScreen()
            case .explore:
                MSHExploreScreen()
            case .simple:
                MSHSimpleScreen()
            case .progress:
                MSHProgressScreen()
            case .me:
                MSHProfileSettingsScreen()
            }
        }
    }

    private var nativeDestination: MSHFeatureDestination? {
        guard let components = URLComponents(string: route.rawValue) else { return nil }
        let view = components.queryItems?.first(where: { $0.name == "view" })?.value

        switch components.path {
        case "calendar.html":
            if view == "movement" { return .movementPlan }
            if view == "cycle" { return .cycle }
            return .calendar
        case "movement-library.html": return .movementLibrary
        case "medications.html": return .medications
        case "health-landscape.html", "my-landscape.html": return .landscape
        case "assessments.html": return .selfInsight
        case "my-vision.html": return .horizon
        case "my-project.html": return .path
        case "my-practice.html": return .practice
        case "my-learning.html": return .discovery
        case "my-progress.html": return .journey
        case "my-health-story.html": return .healthStory
        case "my-food.html": return .food
        case "financial-health.html": return .financialHealth
        default: return nil
        }
    }
}

private struct MSHSimpleScreen: View {
    @State private var draft = ""

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    MSHEditorialHeader(
                        eyebrow: "SIMPLE",
                        title: "What would be useful right now?",
                        subtitle: "Ask a health question, make sense of something you’re noticing, or think through what may be ahead."
                    )

                    VStack(alignment: .leading, spacing: 12) {
                        MSHSimplePromptRow(title: "I have a health question", image: "questionmark.bubble")
                        MSHSimplePromptRow(title: "Help me make sense of something", image: "sparkles")
                        MSHSimplePromptRow(title: "Help me think ahead", image: "arrow.forward.circle")
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text("ASK SIMPLE")
                            .font(.caption2.weight(.semibold))
                            .tracking(1.6)
                            .foregroundStyle(MSHColor.secondaryText)

                        HStack(alignment: .bottom, spacing: 10) {
                            TextField("What’s on your mind?", text: $draft, axis: .vertical)
                                .lineLimit(1...5)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 14)
                                .background(MSHColor.controlFill)
                                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

                            Button {
                                MSHNativeHaptic.selection.play()
                            } label: {
                                Image(systemName: "arrow.up")
                                    .font(.headline)
                                    .foregroundStyle(.white)
                                    .frame(width: 46, height: 46)
                                    .background(MSHColor.accent)
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)
                            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                            .opacity(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.38 : 1)
                            .accessibilityLabel("Send to Simple")
                        }

                        Text("The native conversation surface is now the app destination. Simple’s existing intelligence will be connected here without reopening the legacy web experience.")
                            .font(.footnote)
                            .foregroundStyle(MSHColor.secondaryText)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 36)
            }
        }
        .accessibilityIdentifier("simple-conversation-screen")
    }
}

private struct MSHSimplePromptRow: View {
    let title: String
    let image: String

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: image)
                .foregroundStyle(MSHColor.accent)
                .frame(width: 28)
            Text(title)
                .font(.system(.body, design: .serif, weight: .medium))
                .foregroundStyle(MSHColor.primaryText)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(MSHColor.secondaryText.opacity(0.65))
        }
        .padding(.vertical, 15)
        .overlay(alignment: .bottom) {
            Rectangle().fill(MSHColor.border.opacity(0.7)).frame(height: 0.5)
        }
    }
}

/// Compatibility wrapper for older call sites. Internal destinations are native.
/// Keeping the type name temporarily avoids a broad rename while eliminating its
/// former WKWebView behavior.
struct MSHWebFeatureScreen: View {
    let destination: MSHFeatureDestination

    var body: some View {
        MSHNativeFeatureScreen(destination: destination)
    }
}

struct MSHNativeFeatureScreen: View {
    let destination: MSHFeatureDestination

    @ViewBuilder
    var body: some View {
        switch destination {
        case .myHealth:
            MSHAppleHealthConnectionScreen()
        default:
            MSHNativeFeatureFoundation(destination: destination)
        }
    }
}

private struct MSHNativeFeatureFoundation: View {
    let destination: MSHFeatureDestination

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    MSHEditorialHeader(
                        eyebrow: "MY SIMPLE HEALTH",
                        title: destination.title,
                        subtitle: destination.nativeIntroduction
                    )

                    VStack(alignment: .leading, spacing: 14) {
                        Image(systemName: destination.nativeSystemImage)
                            .font(.system(size: 28, weight: .light))
                            .foregroundStyle(MSHColor.accent)
                            .frame(width: 54, height: 54)
                            .background(MSHColor.controlFill)
                            .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))

                        Text("This area now stays inside the iPhone app.")
                            .font(.system(.title3, design: .serif, weight: .semibold))
                            .foregroundStyle(MSHColor.primaryText)

                        Text(destination.nativeStatusCopy)
                            .font(.body)
                            .foregroundStyle(MSHColor.secondaryText)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(20)
                    .background(MSHColor.controlFill.opacity(0.55))
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 24, style: .continuous)
                            .stroke(MSHColor.border.opacity(0.72), lineWidth: 0.8)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 36)
            }
        }
        .navigationTitle(destination.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(MSHColor.canvas, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .accessibilityIdentifier("native-feature-\(destination.rawValue)")
    }
}

private extension MSHFeatureDestination {
    var nativeSystemImage: String {
        switch self {
        case .myHealth: "heart.text.square"
        case .calendar: "calendar"
        case .movementPlan: "figure.walk.motion"
        case .movementLibrary: "figure.run"
        case .cycle: "circle.dotted.circle"
        case .medications: "pills"
        case .landscape: "map"
        case .selfInsight: "sparkles.rectangle.stack"
        case .explore: "safari"
        case .horizon: "sun.horizon"
        case .path: "point.topleft.down.to.point.bottomright.curvepath"
        case .practice: "leaf"
        case .discovery: "lightbulb"
        case .journey: "clock.arrow.circlepath"
        case .healthStory: "book.pages"
        case .food: "fork.knife"
        case .financialHealth: "chart.pie"
        }
    }

    var nativeIntroduction: String {
        switch self {
        case .calendar: "See planned health and life together in time."
        case .movementPlan: "Plan movement around the life you are actually living."
        case .movementLibrary: "Keep workouts, routines, classes, and movement options together."
        case .cycle: "Keep cycle context connected to the rest of your health."
        case .medications: "Keep medication supply, refill timing, and follow-through visible."
        case .landscape: "See the whole-health picture of where you are now."
        case .selfInsight: "Look more closely when part of your experience needs context."
        case .explore: "Browse the broader capabilities of My Simple Health."
        case .horizon: "Notice where you may want to head."
        case .path: "Keep what you are intentionally working toward in view."
        case .practice: "Return to what you are trying in real life."
        case .discovery: "Capture what experience is showing you."
        case .journey: "See what has changed without turning your life into a score."
        case .healthStory: "See the living story your confirmed health experiences are creating."
        case .food: "Understand, organize, plan, and act on food in one connected workspace."
        case .financialHealth: "Understand money in the context of your health and life."
        case .myHealth: "Your connected health data."
        }
    }

    var nativeStatusCopy: String {
        switch self {
        case .calendar:
            "The legacy calendar page is no longer used for in-app navigation. Native calendar records and editing are the next capability to surface here."
        case .movementPlan, .movementLibrary:
            "Movement now has a native destination boundary. Existing saved movement data can be connected to this surface without routing through an embedded webpage."
        case .cycle:
            "Cycle now has a native destination boundary so cycle context can be rebuilt as an iPhone experience rather than a calendar webpage mode."
        case .medications:
            "Medication continuity now has a native destination boundary. Existing medication capability can be moved here without reopening medications.html."
        case .landscape, .selfInsight, .horizon, .path, .practice, .discovery, .journey, .healthStory:
            "The existing Journey and self-understanding capability is being preserved underneath this native destination while its presentation is reconstructed for iOS."
        case .food:
            "This is the native home for Food: household inventory, nutrition context, waste reduction, meal planning, grocery-list creation, and future shopping handoff."
        case .financialHealth:
            "The existing Financial Core remains protected underneath this native destination while the contextual financial-health experience is built around it."
        case .explore:
            "Explore is already native and remains the place to browse MSH capabilities beyond what My Health selectively serves up."
        case .myHealth:
            "Apple Health remains native and connected to My Health."
        }
    }
}

@MainActor
private struct MSHAppleHealthConnectionScreen: View {
    @State private var status: MSHAppleHealthStatus?
    @State private var isWorking = false
    @State private var errorMessage: String?
    private let dataSource: any MSHMyHealthDataLoading = MSHMyHealthDataSource.live()

    var body: some View {
        ZStack {
            MSHColor.ivory.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("APPLE HEALTH")
                            .font(.caption2.weight(.semibold))
                            .tracking(2.0)
                            .foregroundStyle(MSHColor.sage)

                        Text("Your connected health data.")
                            .font(.system(size: 34, weight: .regular, design: .serif))
                            .foregroundStyle(MSHColor.charcoal)

                        Text("Apple Health brings movement, sleep, heart activity, and body measurements into My Simple Health as context.")
                            .font(.body)
                            .foregroundStyle(MSHColor.charcoal.opacity(0.66))
                    }

                    if let status {
                        VStack(alignment: .leading, spacing: 14) {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(status.isConnected ? "Connected" : "Not connected")
                                        .font(.system(.title3, design: .serif, weight: .semibold))
                                    Text(status.isConnected ? "\(status.selectedAreas.count) health areas selected" : "Connect Apple Health when you’re ready.")
                                        .font(.subheadline)
                                        .foregroundStyle(MSHColor.charcoal.opacity(0.62))
                                }
                                Spacer()
                                Image(systemName: status.isConnected ? "checkmark.circle.fill" : "heart.text.square")
                                    .font(.title2)
                                    .foregroundStyle(MSHColor.sage)
                            }

                            if let lastSync = status.lastSuccessfulSyncAt {
                                Divider()
                                HStack {
                                    Text("Last synced")
                                    Spacer()
                                    Text(lastSync, format: .relative(presentation: .named))
                                }
                                .font(.caption)
                                .foregroundStyle(MSHColor.charcoal.opacity(0.58))
                            }
                        }
                        .padding(18)
                        .background(Color.white.opacity(0.54))
                        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 22, style: .continuous)
                                .stroke(Color.black.opacity(0.06), lineWidth: 0.8)
                        }

                        VStack(alignment: .leading, spacing: 0) {
                            Text("CONNECTED AREAS")
                                .font(.caption2.weight(.semibold))
                                .tracking(1.5)
                                .foregroundStyle(MSHColor.charcoal.opacity(0.54))
                                .padding(.bottom, 10)

                            ForEach(MSHHealthArea.allCases) { area in
                                HStack(spacing: 14) {
                                    Image(systemName: area.systemImage)
                                        .foregroundStyle(MSHColor.sage)
                                        .frame(width: 28)
                                    Text(area.title)
                                        .font(.system(.body, design: .serif))
                                        .foregroundStyle(MSHColor.charcoal)
                                    Spacer()
                                    Image(systemName: status.selectedAreas.contains(area) ? "checkmark.circle.fill" : "circle")
                                        .foregroundStyle(status.selectedAreas.contains(area) ? MSHColor.sage : MSHColor.charcoal.opacity(0.22))
                                }
                                .padding(.vertical, 13)

                                if area != MSHHealthArea.allCases.last {
                                    Divider()
                                }
                            }
                        }

                        Button {
                            Task { await performPrimaryAction(connected: status.isConnected) }
                        } label: {
                            HStack(spacing: 9) {
                                if isWorking { ProgressView().tint(.white) }
                                Text(status.isConnected ? "Refresh Apple Health" : "Connect Apple Health")
                                    .font(.headline)
                            }
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .background(MSHColor.charcoal)
                            .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .disabled(isWorking)
                    } else {
                        ProgressView("Loading Apple Health…")
                            .tint(MSHColor.sage)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 50)
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }

                    Text("Your Apple Health permissions remain controlled by iOS. My Simple Health only reads the areas you have allowed.")
                        .font(.footnote)
                        .foregroundStyle(MSHColor.charcoal.opacity(0.54))
                }
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 36)
            }
        }
        .navigationTitle("Apple Health")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(MSHColor.ivory, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .task { await loadStatus() }
        .accessibilityIdentifier("apple-health-native-connection")
    }

    private func loadStatus() async {
        do {
            let syncState = try await dataSource.loadStatus()
            status = MSHAppleHealthStatus(syncState: syncState)
            errorMessage = nil
        } catch {
            errorMessage = "Apple Health status could not be loaded right now."
        }
    }

    private func performPrimaryAction(connected: Bool) async {
        guard !isWorking else { return }
        isWorking = true
        defer { isWorking = false }

        do {
            if connected {
                try await MSHAppleHealthRuntime.refreshConnectedHealth()
            } else {
                _ = try await MSHAppleHealthRuntime.connectForOnboarding()
            }
            await loadStatus()
        } catch {
            errorMessage = "Apple Health could not be updated right now."
        }
    }
}

private struct MSHProgressScreen: View {
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
                    eyebrow: "PROGRESS",
                    title: "See how things are changing.",
                    subtitle: "What happened, what you tried, and what you learned belong together here."
                )
                MSHDestinationGroup(title: "Your picture over time", destinations: reflection)
                MSHDestinationGroup(title: "Your direction", destinations: direction)
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 36)
        }
        .background(MSHColor.canvas)
        .accessibilityIdentifier("progress-integration-screen")
    }
}

private struct MSHExploreScreen: View {
    private let timeAndMovement: [(destination: MSHFeatureDestination, subtitle: String, image: String)] = [
        (.calendar, "See health and life together in time.", "calendar"),
        (.movementPlan, "Plan movement in the context of your real schedule.", "figure.walk.motion"),
        (.movementLibrary, "Return to workouts, classes, videos, routines, and favorites.", "figure.run")
    ]
    private let care: [(destination: MSHFeatureDestination, subtitle: String, image: String)] = [
        (.cycle, "Keep cycle context close to the rest of your health.", "circle.dotted.circle"),
        (.medications, "Manage medication supply, refill timing, and follow-through.", "pills")
    ]
    private let everyday: [(destination: MSHFeatureDestination, subtitle: String, image: String)] = [
        (.food, "Use your personal food workspace.", "fork.knife"),
        (.financialHealth, "See where money is going and understand it in the context of your life.", "chart.pie")
    ]
    private let understanding: [(destination: MSHFeatureDestination, subtitle: String, image: String)] = [
        (.landscape, "Explore the whole-health picture of where you are now.", "map"),
        (.selfInsight, "Look more closely when one part of your experience needs context.", "sparkles.rectangle.stack")
    ]

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 30) {
                MSHEditorialHeader(
                    eyebrow: "EXPLORE",
                    title: "Everything is here when you want it.",
                    subtitle: "My Health stays selective. Explore is where you can browse the broader capabilities of My Simple Health."
                )
                MSHDestinationGroup(title: "Health in time", destinations: timeAndMovement)
                MSHDestinationGroup(title: "Understand your health", destinations: understanding)
                MSHDestinationGroup(title: "Care", destinations: care)
                MSHDestinationGroup(title: "Everyday life", destinations: everyday)
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 36)
        }
        .background(MSHColor.canvas)
        .accessibilityIdentifier("explore-integration-screen")
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
            Text(title.uppercased())
                .font(.caption.weight(.semibold))
                .tracking(1.3)
                .foregroundStyle(MSHColor.secondaryText)
                .padding(.bottom, 8)

            ForEach(destinations.indices, id: \.self) { index in
                let item = destinations[index]
                NavigationLink {
                    MSHNativeFeatureScreen(destination: item.destination)
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
            Rectangle().fill(MSHColor.border.opacity(0.7)).frame(height: 0.5)
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
    @AppStorage("msh.mySpace") private var mySpaceRawValue = MSHMySpace.warmHouse.rawValue
    @AppStorage("msh.mySpaceLighting") private var lightingRawValue = MSHSpaceLighting.auto.rawValue

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    MSHEditorialHeader(
                        eyebrow: "ME",
                        title: "Your space.",
                        subtitle: "Your profile, appearance, connections, sharing, and privacy controls live here."
                    )

                    VStack(alignment: .leading, spacing: 12) {
                        Text("Profile").font(.headline)
                        TextField("Name or nickname", text: $displayName)
                            .textInputAutocapitalization(.words)
                            .padding(.horizontal, 16)
                            .frame(height: 48)
                            .background(MSHColor.controlFill)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        Text("Appearance").font(.headline)
                        Picker("Appearance", selection: $appearanceRawValue) {
                            ForEach(MSHAppearancePreference.allCases) { preference in
                                Text(preference.title).tag(preference.rawValue)
                            }
                        }
                        .pickerStyle(.segmented)

                        Text("My Space").font(.headline).padding(.top, 8)
                        Picker("My Space", selection: $mySpaceRawValue) {
                            ForEach(MSHMySpace.allCases) { space in
                                Text(space.title).tag(space.rawValue)
                            }
                        }

                        Text("Lighting").font(.headline)
                        Picker("Lighting", selection: $lightingRawValue) {
                            ForEach(MSHSpaceLighting.allCases) { lighting in
                                Text(lighting.title).tag(lighting.rawValue)
                            }
                        }
                        .pickerStyle(.segmented)
                    }

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
                }
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 36)
            }
        }
        .navigationTitle("Me")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(MSHColor.canvas, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
    }
}
