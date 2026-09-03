import SwiftUI
import UIKit

enum MSHMySpace: String, CaseIterable, Identifiable {
    case warmHouse, gardenHouse, libraryHouse, coastalRetreat, meditationRetreat
    case quietMinimal, executiveStudy, sunsetHouse, cityAtNight, morningHighRise, plain

    var id: Self { self }

    var title: String {
        switch self {
        case .warmHouse: "Warm House"
        case .gardenHouse: "Garden House"
        case .libraryHouse: "Library House"
        case .coastalRetreat: "Coastal Retreat"
        case .meditationRetreat: "Meditation Retreat"
        case .quietMinimal: "Quiet Minimal"
        case .executiveStudy: "Executive Study"
        case .sunsetHouse: "Sunset House"
        case .cityAtNight: "City at Night"
        case .morningHighRise: "Morning High-Rise"
        case .plain: "Plain"
        }
    }

    var assetName: String? {
        switch self {
        case .warmHouse: "MySpaceWarmHouse"
        case .gardenHouse: "MySpaceGardenHouse"
        case .libraryHouse: "MySpaceLibraryHouse"
        case .coastalRetreat: "MySpaceCoastalRetreat"
        case .meditationRetreat: "MySpaceMeditationRetreat"
        case .quietMinimal: "MySpaceQuietMinimal"
        case .executiveStudy: "MySpaceExecutiveStudy"
        case .sunsetHouse: "MySpaceSunsetHouse"
        case .cityAtNight: "MySpaceCityAtNight"
        case .morningHighRise: "MySpaceMorningHighRise"
        case .plain: nil
        }
    }

    var focalAlignment: Alignment {
        switch self {
        case .gardenHouse, .coastalRetreat, .sunsetHouse: .leading
        default: .center
        }
    }
}

enum MSHSpaceLighting: String, CaseIterable, Identifiable {
    case light, dim, dark, auto
    var id: Self { self }
    var title: String {
        switch self {
        case .light: "Light"
        case .dim: "Dim"
        case .dark: "Dark"
        case .auto: "Auto"
        }
    }
}

@MainActor
struct MSHMyHealthHomeScreen: View {
    @StateObject private var viewModel: MSHMyHealthViewModel
    @EnvironmentObject private var authStore: MSHAuthStore
    @Environment(\.colorScheme) private var systemColorScheme
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @AppStorage("msh.displayName") private var displayName = ""
    @AppStorage("msh.mySpace") private var mySpaceRawValue = MSHMySpace.warmHouse.rawValue
    @AppStorage("msh.mySpaceLighting") private var lightingRawValue = MSHSpaceLighting.auto.rawValue

    init(viewModel: MSHMyHealthViewModel = MSHMyHealthViewModel()) {
        _viewModel = StateObject(wrappedValue: viewModel)
    }

    private var selectedSpace: MSHMySpace { MSHMySpace(rawValue: mySpaceRawValue) ?? .warmHouse }
    private var selectedLighting: MSHSpaceLighting { MSHSpaceLighting(rawValue: lightingRawValue) ?? .auto }

    private var resolvedDarkPresentation: Bool {
        switch selectedLighting {
        case .light: false
        case .dim, .dark: true
        case .auto: systemColorScheme == .dark
        }
    }

    var body: some View {
        ZStack {
            ambientBackground

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 18) {
                    hero

                    Group {
                        switch viewModel.loadState {
                        case .loading: loading
                        case .loaded(let snapshot): interpretedContent(snapshot)
                        case .failed: failed
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 34)
                }
            }
            .refreshable { await viewModel.reload() }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { mySpaceMenu }
        }
        .toolbarBackground(.hidden, for: .navigationBar)
        .task {
            seedDisplayNameIfNeeded()
            await viewModel.loadIfNeeded()
        }
        .accessibilityIdentifier("my-health-home")
    }

    @ViewBuilder
    private var ambientBackground: some View {
        if let assetName = selectedSpace.assetName, UIImage(named: assetName) != nil {
            GeometryReader { proxy in
                Image(assetName)
                    .resizable()
                    .scaledToFill()
                    .frame(width: proxy.size.width, height: max(proxy.size.height, 900), alignment: selectedSpace.focalAlignment)
                    .clipped()
                    .overlay(environmentTone)
                    .overlay(
                        LinearGradient(
                            colors: [Color.black.opacity(0.08), Color.black.opacity(0.18), Color.black.opacity(0.34)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .blur(radius: 0.4)
            }
            .ignoresSafeArea()
        } else {
            LinearGradient(
                colors: [MSHColor.ivory, MSHColor.stone.opacity(0.82), MSHColor.mushroom.opacity(0.62)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
        }
    }

    private var environmentTone: some View {
        let opacity: Double = {
            switch selectedLighting {
            case .light: 0.05
            case .dim: 0.18
            case .dark: 0.31
            case .auto: systemColorScheme == .dark ? 0.24 : 0.10
            }
        }()
        return Color.black.opacity(opacity)
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("MY HEALTH")
                .font(.caption2.weight(.semibold))
                .tracking(2.2)
                .foregroundStyle(.white.opacity(0.78))

            Text(greetingLine)
                .font(.system(size: 42, weight: .regular, design: .serif))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)

            Text("Here’s what’s useful for you right now.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.84))

            Button(action: {}) {
                HStack(spacing: 8) {
                    Text("Ask Simple")
                    Image(systemName: "sparkles")
                }
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.white)
                .padding(.horizontal, 18)
                .frame(height: 42)
                .background(.ultraThinMaterial, in: Capsule())
                .overlay(Capsule().stroke(.white.opacity(0.28), lineWidth: 0.8))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20)
        .padding(.top, 72)
        .padding(.bottom, 28)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func interpretedContent(_ snapshot: MSHMyHealthSnapshot) -> some View {
        let sleep = summary(for: .sleep, in: snapshot.recentActivity)
        let movement = summary(for: .movement, in: snapshot.recentActivity)
        let heart = summary(for: .heartActivity, in: snapshot.recentActivity)

        VStack(alignment: .leading, spacing: 18) {
            ambientGlass {
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        Text("AT A GLANCE")
                            .font(.caption2.weight(.semibold))
                            .tracking(1.7)
                        Spacer()
                        Text("View all insights →").font(.caption)
                    }
                    .foregroundStyle(.white.opacity(0.78))

                    HStack(alignment: .top, spacing: 10) {
                        MSHGlassMetric(title: "Sleep", value: sleep.value, icon: "moon.stars", note: sleep.context)
                        MSHGlassMetric(title: "Movement", value: movement.value, icon: "figure.walk", note: movement.context)
                    }
                    HStack(alignment: .top, spacing: 10) {
                        MSHGlassMetric(title: "Heart", value: heart.value, icon: "heart", note: heart.context)
                        MSHGlassMetric(title: "Mind", value: "Calm", icon: "leaf", note: "A quieter place to reflect on what you’re noticing.")
                    }
                }
            }

            ambientGlass {
                HStack(alignment: .top, spacing: 14) {
                    Image(systemName: "calendar")
                        .font(.headline)
                        .foregroundStyle(.white.opacity(0.86))
                    VStack(alignment: .leading, spacing: 5) {
                        Text("LOOKING AHEAD")
                            .font(.caption2.weight(.semibold))
                            .tracking(1.5)
                        Text("Your calendar keeps appointments, planned movement, medication actions and other dated health activity together.")
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.80))
                    }
                    Spacer(minLength: 4)
                    NavigationLink {
                        MSHWebFeatureScreen(destination: .calendar)
                    } label: {
                        Image(systemName: "arrow.right")
                            .foregroundStyle(.white.opacity(0.85))
                    }
                }
                .foregroundStyle(.white)
            }

            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("YOUR HEALTH")
                        .font(.caption2.weight(.semibold))
                        .tracking(1.6)
                        .foregroundStyle(.white.opacity(0.80))
                    Spacer()
                    Text("Lifestyle + data")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.62))
                }

                HStack(spacing: 10) {
                    MSHLifestyleTile(title: "Sleep", subtitle: "Patterns and quality", systemImage: "bed.double")
                    MSHLifestyleTile(title: "Movement", subtitle: "Activity and workouts", systemImage: "dumbbell")
                }
                HStack(spacing: 10) {
                    MSHLifestyleTile(title: "Nutrition", subtitle: "Meals and hydration", systemImage: "fork.knife")
                    MSHLifestyleTile(title: "Wellbeing", subtitle: "Mood and reflection", systemImage: "book.closed")
                }
            }

            NavigationLink {
                MSHImmediateDestination(title: "Explore Your Health") {
                    MSHMyHealthScreen(viewModel: viewModel)
                }
            } label: {
                ambientGlass {
                    HStack {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("EXPLORE YOUR HEALTH")
                                .font(.caption2.weight(.semibold))
                                .tracking(1.5)
                            Text("See the data behind the picture")
                                .font(.system(.title3, design: .serif))
                            Text("Day, Week and Month charts, Apple Health measurements, Sleep, Heart, Movement and Body details.")
                                .font(.caption)
                                .foregroundStyle(.white.opacity(0.76))
                        }
                        Spacer()
                        Image(systemName: "chart.xyaxis.line")
                            .font(.title3)
                    }
                    .foregroundStyle(.white)
                }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("explore-your-health")

            ambientGlass {
                VStack(alignment: .leading, spacing: 10) {
                    Text("SIMPLE’S INSIGHT")
                        .font(.caption2.weight(.semibold))
                        .tracking(1.6)
                        .foregroundStyle(.white.opacity(0.72))
                    Text("Your health can be understood without turning your life into a health project.")
                        .font(.system(size: 24, design: .serif))
                        .foregroundStyle(.white)
                    Text("Simple can help connect the data to your actual routines, environment, priorities and lived experience.")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.79))
                }
            }
        }
    }

    private func ambientGlass<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                if reduceTransparency {
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .fill(Color.black.opacity(resolvedDarkPresentation ? 0.60 : 0.42))
                } else {
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .fill(.ultraThinMaterial)
                        .overlay(
                            RoundedRectangle(cornerRadius: 22, style: .continuous)
                                .fill(Color.black.opacity(resolvedDarkPresentation ? 0.18 : 0.08))
                        )
                }
            }
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(.white.opacity(0.18), lineWidth: 0.8)
            )
            .shadow(color: .black.opacity(0.10), radius: 18, y: 8)
    }

    private var mySpaceMenu: some View {
        Menu {
            Section("My Space") {
                ForEach(MSHMySpace.allCases) { space in
                    Button {
                        mySpaceRawValue = space.rawValue
                    } label: {
                        if space == selectedSpace { Label(space.title, systemImage: "checkmark") }
                        else { Text(space.title) }
                    }
                }
            }
            Section("Lighting") {
                ForEach(MSHSpaceLighting.allCases) { lighting in
                    Button {
                        lightingRawValue = lighting.rawValue
                    } label: {
                        if lighting == selectedLighting { Label(lighting.title, systemImage: "checkmark") }
                        else { Text(lighting.title) }
                    }
                }
            }
        } label: {
            Image(systemName: "circle.lefthalf.filled")
                .font(.system(size: 17, weight: .medium))
                .foregroundStyle(.white)
                .frame(width: 34, height: 34)
                .background(.ultraThinMaterial, in: Circle())
                .overlay(Circle().stroke(.white.opacity(0.22), lineWidth: 0.7))
        }
        .accessibilityLabel("My Space and lighting")
    }

    private var greeting: String {
        switch Calendar.current.component(.hour, from: Date()) {
        case 5..<12: "Good morning"
        case 12..<17: "Good afternoon"
        case 17..<22: "Good evening"
        default: "Welcome back"
        }
    }

    private var greetingLine: String {
        let trimmed = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "\(greeting)." : "\(greeting), \(trimmed)."
    }

    private func seedDisplayNameIfNeeded() {
        guard displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let firebaseName = authStore.user?.displayName?.trimmingCharacters(in: .whitespacesAndNewlines),
              !firebaseName.isEmpty else { return }
        let firstName = firebaseName.split(whereSeparator: \Character.isWhitespace).first.map(String.init)
        displayName = firstName ?? firebaseName
    }

    private var loading: some View {
        ambientGlass {
            HStack(spacing: 12) {
                ProgressView().tint(.white)
                Text("Gathering today’s context…")
                    .font(.system(.body, design: .serif))
                    .foregroundStyle(.white.opacity(0.86))
            }
        }
        .padding(.horizontal, 16)
    }

    private var failed: some View {
        ambientGlass {
            VStack(alignment: .leading, spacing: 8) {
                Text("Your health overview is temporarily unavailable")
                    .font(.system(.headline, design: .serif))
                    .foregroundStyle(.white)
                Text("Pull down to try again. Your records remain on this iPhone.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.76))
            }
        }
        .padding(.horizontal, 16)
    }

    private func summary(for area: MSHHealthArea, in activity: [MSHRecentHealthActivity]) -> (value: String, context: String) {
        let items = activity.filter { $0.area == area }.sorted { $0.occurredAt > $1.occurredAt }
        guard let latest = items.first else {
            return ("No recent data", "Ready when Apple Health has something recent to share.")
        }

        switch area {
        case .sleep:
            let asleep = items.filter {
                guard ($0.durationMinutes ?? 0) > 0 else { return false }
                let stage = ($0.sleepStage ?? "").lowercased()
                return !stage.contains("awake") && !stage.contains("inbed") && !stage.contains("in_bed")
            }
            let latestNight = sleepNightAnchor(for: latest.occurredAt)
            let minutes = asleep.filter { sleepNightAnchor(for: $0.occurredAt) == latestNight }.compactMap(\.durationMinutes).reduce(0, +)
            return (duration(minutes: minutes), "Recent sleep, held in context rather than scored.")
        case .movement:
            return (displayValue(latest), "Your latest movement, without turning the day into a performance score.")
        case .heartActivity:
            return (displayValue(latest), "Your latest heart context. Trends stay one level deeper.")
        case .bodyMeasurements:
            return (displayValue(latest), "Recent body context is available in the deeper data view.")
        }
    }

    private func sleepNightAnchor(for date: Date) -> Date {
        let calendar = Calendar.current
        let hour = calendar.component(.hour, from: date)
        let shifted = hour < 12 ? (calendar.date(byAdding: .day, value: -1, to: date) ?? date) : date
        return calendar.startOfDay(for: shifted)
    }

    private func displayValue(_ item: MSHRecentHealthActivity) -> String {
        if let detail = item.detail, !detail.isEmpty { return detail }
        guard let value = item.numericValue else { return item.title }
        let number = value.formatted(.number.precision(.fractionLength(0...1)))
        if let unit = item.unit, !unit.isEmpty { return "\(number) \(unit)" }
        return number
    }

    private func duration(minutes: Double) -> String {
        guard minutes > 0 else { return "Recent sleep available" }
        let rounded = Int(minutes.rounded())
        let hours = rounded / 60
        let remainder = rounded % 60
        return hours > 0 ? "\(hours)h \(remainder)m" : "\(remainder)m"
    }
}

private struct MSHGlassMetric: View {
    let title: String
    let value: String
    let icon: String
    let note: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                Text(title)
            }
            .font(.caption.weight(.medium))
            .foregroundStyle(.white.opacity(0.82))

            Text(value)
                .font(.system(size: 24, weight: .regular, design: .serif))
                .foregroundStyle(.white)
                .lineLimit(2)
                .minimumScaleFactor(0.72)

            Text(note)
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.64))
                .lineLimit(3)
        }
        .padding(13)
        .frame(maxWidth: .infinity, minHeight: 150, alignment: .topLeading)
        .background(Color.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(.white.opacity(0.12), lineWidth: 0.7))
    }
}

private struct MSHLifestyleTile: View {
    let title: String
    let subtitle: String
    let systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: systemImage)
                .font(.headline)
            Spacer(minLength: 10)
            Text(title)
                .font(.system(.headline, design: .serif))
            Text(subtitle)
                .font(.caption)
                .foregroundStyle(.white.opacity(0.67))
        }
        .foregroundStyle(.white)
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 120, alignment: .topLeading)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(.white.opacity(0.15), lineWidth: 0.7))
    }
}