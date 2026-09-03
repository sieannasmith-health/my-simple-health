import SwiftUI
import UIKit
import PhotosUI

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
        case .light: "Bright"
        case .dim: "Soft"
        case .dark: "Dim"
        case .auto: "Follow iPhone"
        }
    }

    var symbol: String {
        switch self {
        case .light: "sun.max.fill"
        case .dim: "sun.haze.fill"
        case .dark: "moon.fill"
        case .auto: "iphone"
        }
    }
}

private enum MSHPersonalEnvironmentStore {
    private static let filename = "msh-personal-environment.jpg"

    private static var fileURL: URL? {
        guard let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            return nil
        }
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent(filename)
    }

    static func load() -> UIImage? {
        guard let url = fileURL,
              let data = try? Data(contentsOf: url) else { return nil }
        return UIImage(data: data)
    }

    static func save(_ image: UIImage) {
        guard let url = fileURL,
              let data = image.jpegData(compressionQuality: 0.90) else { return }
        try? data.write(to: url, options: .atomic)
    }

    static func remove() {
        guard let url = fileURL else { return }
        try? FileManager.default.removeItem(at: url)
    }
}

@MainActor
struct MSHMyHealthHomeScreen: View {
    @StateObject private var viewModel: MSHMyHealthViewModel
    @EnvironmentObject private var authStore: MSHAuthStore
    @Environment(\.colorScheme) private var systemColorScheme
    @AppStorage("msh.displayName") private var displayName = ""
    @AppStorage("msh.mySpace") private var mySpaceRawValue = MSHMySpace.warmHouse.rawValue
    @AppStorage("msh.mySpaceLighting") private var lightingRawValue = MSHSpaceLighting.auto.rawValue
    @AppStorage("msh.usePersonalEnvironment") private var usePersonalEnvironment = false
    @State private var isEnvironmentPresented = false
    @State private var personalEnvironmentImage: UIImage?

    init(viewModel: MSHMyHealthViewModel = MSHMyHealthViewModel()) {
        _viewModel = StateObject(wrappedValue: viewModel)
    }

    private var selectedSpace: MSHMySpace { MSHMySpace(rawValue: mySpaceRawValue) ?? .warmHouse }
    private var selectedLighting: MSHSpaceLighting { MSHSpaceLighting(rawValue: lightingRawValue) ?? .auto }

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
        .toolbar(.hidden, for: .navigationBar)
        .task {
            seedDisplayNameIfNeeded()
            loadPersonalEnvironmentIfNeeded()
            await viewModel.loadIfNeeded()
        }
        .sheet(isPresented: $isEnvironmentPresented) {
            MSHDigitalEnvironmentSheet(
                selectedSpace: selectedSpace,
                selectedLighting: selectedLighting,
                personalImage: personalEnvironmentImage,
                usingPersonalImage: usePersonalEnvironment,
                onSelectSpace: { space in
                    mySpaceRawValue = space.rawValue
                    usePersonalEnvironment = false
                },
                onSelectLighting: { lighting in
                    lightingRawValue = lighting.rawValue
                },
                onSelectPersonalImage: { image in
                    MSHPersonalEnvironmentStore.save(image)
                    personalEnvironmentImage = image
                    usePersonalEnvironment = true
                },
                onUsePersonalImage: {
                    if personalEnvironmentImage != nil {
                        usePersonalEnvironment = true
                    }
                },
                onRemovePersonalImage: {
                    MSHPersonalEnvironmentStore.remove()
                    personalEnvironmentImage = nil
                    usePersonalEnvironment = false
                }
            )
        }
        .accessibilityIdentifier("my-health-home")
    }

    @ViewBuilder
    private var ambientBackground: some View {
        if usePersonalEnvironment, let personalEnvironmentImage {
            GeometryReader { proxy in
                Image(uiImage: personalEnvironmentImage)
                    .resizable()
                    .scaledToFill()
                    .frame(width: proxy.size.width, height: max(proxy.size.height, 900), alignment: .center)
                    .clipped()
                    .overlay(environmentTone)
                    .overlay(backgroundDepth)
                    .blur(radius: 0.25)
            }
            .ignoresSafeArea()
        } else if let assetName = selectedSpace.assetName, UIImage(named: assetName) != nil {
            GeometryReader { proxy in
                Image(assetName)
                    .resizable()
                    .scaledToFill()
                    .frame(width: proxy.size.width, height: max(proxy.size.height, 900), alignment: selectedSpace.focalAlignment)
                    .clipped()
                    .overlay(environmentTone)
                    .overlay(backgroundDepth)
                    .blur(radius: 0.25)
            }
            .ignoresSafeArea()
        } else {
            LinearGradient(
                colors: [MSHColor.ivory, MSHColor.stone.opacity(0.82), MSHColor.mushroom.opacity(0.62)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .overlay(environmentTone)
            .ignoresSafeArea()
        }
    }

    private var backgroundDepth: some View {
        LinearGradient(
            colors: [Color.black.opacity(0.05), Color.black.opacity(0.12), Color.black.opacity(0.24)],
            startPoint: .top,
            endPoint: .bottom
        )
    }

    private var environmentTone: some View {
        let opacity: Double = {
            switch selectedLighting {
            case .light: 0.03
            case .dim: 0.14
            case .dark: 0.30
            case .auto: systemColorScheme == .dark ? 0.20 : 0.07
            }
        }()
        return Color.black.opacity(opacity)
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center) {
                Text("MY HEALTH")
                    .font(.caption2.weight(.semibold))
                    .tracking(2.2)
                    .foregroundStyle(.white.opacity(0.82))

                Spacer()

                Button {
                    MSHNativeHaptic.softImpact.fire()
                    isEnvironmentPresented = true
                } label: {
                    Image(systemName: "house.and.flag.fill")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 40, height: 40)
                        .mshNativeGlass(
                            in: Circle(),
                            tint: MSHColor.mushroom,
                            edgeStrength: 0.96,
                            shadowStrength: 0.72,
                            glowStrength: 0.24
                        )
                }
                .buttonStyle(MSHMyHealthLiftButtonStyle())
                .accessibilityLabel("Choose your digital environment")
            }

            Text(greetingLine)
                .font(.system(size: 42, weight: .regular, design: .serif))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)

            Text("Here’s what’s useful for you right now.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.88))

            MSHNativeGlassButton(
                shape: Capsule(),
                tint: MSHColor.sage,
                foreground: .white,
                haptic: .softImpact,
                action: {}
            ) {
                HStack(spacing: 8) {
                    Text("Ask Simple")
                    Image(systemName: "sparkles")
                }
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 18)
                .frame(height: 44)
            }
            .accessibilityIdentifier("ask-simple")
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
            ambientGlass(tint: MSHColor.powder, glow: 0.30) {
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        Text("AT A GLANCE")
                            .font(.caption2.weight(.semibold))
                            .tracking(1.7)
                        Spacer()
                        Text("View all insights →").font(.caption)
                    }
                    .foregroundStyle(.white.opacity(0.84))

                    HStack(alignment: .top, spacing: 10) {
                        MSHGlassMetric(title: "Sleep", value: sleep.value, icon: "moon.stars", note: sleep.context, tint: MSHColor.powder)
                        MSHGlassMetric(title: "Movement", value: movement.value, icon: "figure.walk", note: movement.context, tint: MSHColor.sage)
                    }
                    HStack(alignment: .top, spacing: 10) {
                        MSHGlassMetric(title: "Heart", value: heart.value, icon: "heart", note: heart.context, tint: MSHColor.clay)
                        MSHGlassMetric(title: "Mind", value: "Calm", icon: "leaf", note: "A quieter place to reflect on what you’re noticing.", tint: MSHColor.sage)
                    }
                }
            }

            ambientGlass(tint: MSHColor.powder, glow: 0.34) {
                HStack(alignment: .top, spacing: 14) {
                    Image(systemName: "calendar")
                        .font(.headline)
                        .foregroundStyle(.white.opacity(0.90))
                    VStack(alignment: .leading, spacing: 5) {
                        Text("LOOKING AHEAD")
                            .font(.caption2.weight(.semibold))
                            .tracking(1.5)
                        Text("Your calendar keeps appointments, planned movement, medication actions and other dated health activity together.")
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.84))
                    }
                    Spacer(minLength: 4)
                    NavigationLink {
                        MSHWebFeatureScreen(destination: .calendar)
                    } label: {
                        Image(systemName: "arrow.right")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 42, height: 42)
                            .mshNativeGlass(in: Circle(), tint: MSHColor.powder, edgeStrength: 1.18, shadowStrength: 0.95, glowStrength: 0.46)
                    }
                    .buttonStyle(MSHMyHealthLiftButtonStyle())
                }
                .foregroundStyle(.white)
            }

            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("YOUR HEALTH")
                        .font(.caption2.weight(.semibold))
                        .tracking(1.6)
                        .foregroundStyle(.white.opacity(0.84))
                    Spacer()
                    Text("Lifestyle + data")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.68))
                }

                HStack(spacing: 10) {
                    MSHLifestyleTile(title: "Sleep", subtitle: "Patterns and quality", systemImage: "bed.double", tint: MSHColor.powder)
                    MSHLifestyleTile(title: "Movement", subtitle: "Activity and workouts", systemImage: "dumbbell", tint: MSHColor.sage)
                }
                HStack(spacing: 10) {
                    MSHLifestyleTile(title: "Nutrition", subtitle: "Meals and hydration", systemImage: "fork.knife", tint: MSHColor.mushroom)
                    MSHLifestyleTile(title: "Wellbeing", subtitle: "Mood and reflection", systemImage: "book.closed", tint: MSHColor.sage)
                }
            }

            NavigationLink {
                MSHImmediateDestination(title: "Explore Your Health") {
                    MSHMyHealthScreen(viewModel: viewModel)
                }
            } label: {
                ambientGlass(tint: MSHColor.sage, glow: 0.34) {
                    HStack {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("EXPLORE YOUR HEALTH")
                                .font(.caption2.weight(.semibold))
                                .tracking(1.5)
                            Text("See the data behind the picture")
                                .font(.system(.title3, design: .serif))
                            Text("Day, Week and Month charts, Apple Health measurements, Sleep, Heart, Movement and Body details.")
                                .font(.caption)
                                .foregroundStyle(.white.opacity(0.80))
                        }
                        Spacer()
                        Image(systemName: "chart.xyaxis.line")
                            .font(.title3)
                    }
                    .foregroundStyle(.white)
                }
            }
            .buttonStyle(MSHMyHealthLiftButtonStyle())
            .accessibilityIdentifier("explore-your-health")

            ambientGlass(tint: MSHColor.mushroom, glow: 0.26) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("SIMPLE’S INSIGHT")
                        .font(.caption2.weight(.semibold))
                        .tracking(1.6)
                        .foregroundStyle(.white.opacity(0.76))
                    Text("Your health can be understood without turning your life into a health project.")
                        .font(.system(size: 24, design: .serif))
                        .foregroundStyle(.white)
                    Text("Simple can help connect the data to your actual routines, environment, priorities and lived experience.")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.82))
                }
            }
        }
    }

    private func ambientGlass<Content: View>(
        tint: Color = .white,
        glow: Double = 0.28,
        @ViewBuilder content: () -> Content
    ) -> some View {
        let shape = RoundedRectangle(cornerRadius: 24, style: .continuous)
        return content()
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(shape.fill(Color.black.opacity(0.10)))
            .mshNativeGlass(
                in: shape,
                tint: tint,
                edgeStrength: 0.92,
                shadowStrength: 0.88,
                glowStrength: glow
            )
    }

    private func loadPersonalEnvironmentIfNeeded() {
        guard personalEnvironmentImage == nil else { return }
        personalEnvironmentImage = MSHPersonalEnvironmentStore.load()
        if personalEnvironmentImage == nil {
            usePersonalEnvironment = false
        }
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
        ambientGlass(tint: MSHColor.powder) {
            HStack(spacing: 12) {
                ProgressView().tint(.white)
                Text("Gathering today’s context…")
                    .font(.system(.body, design: .serif))
                    .foregroundStyle(.white.opacity(0.88))
            }
        }
        .padding(.horizontal, 16)
    }

    private var failed: some View {
        ambientGlass(tint: MSHColor.clay) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Your health overview is temporarily unavailable")
                    .font(.system(.headline, design: .serif))
                    .foregroundStyle(.white)
                Text("Pull down to try again. Your records remain on this iPhone.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.80))
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

@MainActor
private struct MSHDigitalEnvironmentSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var selectedPhotoItem: PhotosPickerItem?

    let selectedSpace: MSHMySpace
    let selectedLighting: MSHSpaceLighting
    let personalImage: UIImage?
    let usingPersonalImage: Bool
    let onSelectSpace: (MSHMySpace) -> Void
    let onSelectLighting: (MSHSpaceLighting) -> Void
    let onSelectPersonalImage: (UIImage) -> Void
    let onUsePersonalImage: () -> Void
    let onRemovePersonalImage: () -> Void

    private let columns = [
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible(), spacing: 10)
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                MSHColor.ivory.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 28) {
                        introduction
                        meaningfulSection
                        mshSpacesSection
                        lightingSection
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 12)
                    .padding(.bottom, 36)
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(MSHColor.charcoal)
                }
            }
        }
        .onChange(of: selectedPhotoItem) { _, item in
            guard let item else { return }
            Task {
                guard let data = try? await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: data) else { return }
                onSelectPersonalImage(image)
            }
        }
    }

    private var introduction: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("THIS IS YOUR WORKSPACE")
                .font(.caption2.weight(.semibold))
                .tracking(2.0)
                .foregroundStyle(MSHColor.clay.opacity(0.82))

            Text("Make it feel like home.")
                .font(.system(size: 38, weight: .regular, design: .serif))
                .foregroundStyle(MSHColor.charcoal)

            Text("Add something meaningful that keeps you motivated.")
                .font(.body)
                .foregroundStyle(MSHColor.charcoal.opacity(0.68))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var meaningfulSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionLabel("SOMETHING MEANINGFUL")

            if let personalImage {
                ZStack(alignment: .bottomLeading) {
                    Image(uiImage: personalImage)
                        .resizable()
                        .scaledToFill()
                        .frame(height: 190)
                        .frame(maxWidth: .infinity)
                        .clipped()

                    LinearGradient(
                        colors: [.clear, .black.opacity(0.54)],
                        startPoint: .center,
                        endPoint: .bottom
                    )

                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(usingPersonalImage ? "Your current environment" : "Your photo")
                                .font(.headline)
                            Text("A place, person, memory or goal that means something to you.")
                                .font(.caption)
                                .foregroundStyle(.white.opacity(0.80))
                        }
                        Spacer()
                        if usingPersonalImage {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.title3)
                        }
                    }
                    .foregroundStyle(.white)
                    .padding(16)
                }
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .stroke(Color.white.opacity(usingPersonalImage ? 0.82 : 0.22), lineWidth: 1.2)
                )
                .onTapGesture {
                    onUsePersonalImage()
                    MSHNativeHaptic.selection.fire()
                }
            }

            PhotosPicker(selection: $selectedPhotoItem, matching: .images) {
                HStack(spacing: 12) {
                    Image(systemName: "photo.on.rectangle.angled")
                        .font(.headline)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(personalImage == nil ? "Choose from Photos" : "Choose a different photo")
                            .font(.headline)
                        Text("Your image stays on this iPhone.")
                            .font(.caption)
                            .foregroundStyle(MSHColor.charcoal.opacity(0.58))
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                }
                .foregroundStyle(MSHColor.charcoal)
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .mshNativeGlass(
                    in: RoundedRectangle(cornerRadius: 20, style: .continuous),
                    tint: MSHColor.warmWhite,
                    edgeStrength: 0.52,
                    shadowStrength: 0.20,
                    glowStrength: 0.03
                )
            }

            if personalImage != nil {
                Button("Remove personal photo", role: .destructive) {
                    onRemovePersonalImage()
                    MSHNativeHaptic.selection.fire()
                }
                .font(.caption.weight(.medium))
            }
        }
    }

    private var mshSpacesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionLabel("MSH SPACES")

            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(MSHMySpace.allCases.filter { $0 != .plain }) { space in
                    Button {
                        onSelectSpace(space)
                        MSHNativeHaptic.selection.fire()
                    } label: {
                        spaceTile(space)
                    }
                    .buttonStyle(.plain)
                }

                Button {
                    onSelectSpace(.plain)
                    MSHNativeHaptic.selection.fire()
                } label: {
                    VStack(alignment: .leading, spacing: 9) {
                        RoundedRectangle(cornerRadius: 15, style: .continuous)
                            .fill(
                                LinearGradient(
                                    colors: [MSHColor.ivory, MSHColor.stone.opacity(0.72)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(height: 106)
                            .overlay {
                                Image(systemName: "rectangle.portrait")
                                    .font(.title2)
                                    .foregroundStyle(MSHColor.charcoal.opacity(0.38))
                            }

                        HStack {
                            Text("Plain")
                                .font(.subheadline.weight(.medium))
                            Spacer()
                            if !usingPersonalImage && selectedSpace == .plain {
                                Image(systemName: "checkmark.circle.fill")
                            }
                        }
                        .foregroundStyle(MSHColor.charcoal)
                    }
                    .padding(8)
                    .background(
                        RoundedRectangle(cornerRadius: 19, style: .continuous)
                            .fill(Color.white.opacity(0.36))
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func spaceTile(_ space: MSHMySpace) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            Group {
                if let assetName = space.assetName, UIImage(named: assetName) != nil {
                    Image(assetName)
                        .resizable()
                        .scaledToFill()
                } else {
                    MSHColor.stone
                }
            }
            .frame(height: 106)
            .frame(maxWidth: .infinity)
            .clipped()
            .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))

            HStack(spacing: 6) {
                Text(space.title)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.78)
                Spacer(minLength: 2)
                if !usingPersonalImage && selectedSpace == space {
                    Image(systemName: "checkmark.circle.fill")
                }
            }
            .foregroundStyle(MSHColor.charcoal)
        }
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 19, style: .continuous)
                .fill(Color.white.opacity(0.36))
                .overlay(
                    RoundedRectangle(cornerRadius: 19, style: .continuous)
                        .stroke(
                            !usingPersonalImage && selectedSpace == space ? MSHColor.sage.opacity(0.72) : Color.black.opacity(0.05),
                            lineWidth: !usingPersonalImage && selectedSpace == space ? 1.3 : 0.7
                        )
                )
        )
    }

    private var lightingSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionLabel("ROOM LIGHTING")

            Text("Control the light in your digital environment without changing your iPhone’s actual screen brightness.")
                .font(.caption)
                .foregroundStyle(MSHColor.charcoal.opacity(0.58))

            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(MSHSpaceLighting.allCases) { lighting in
                    Button {
                        onSelectLighting(lighting)
                        MSHNativeHaptic.selection.fire()
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: lighting.symbol)
                                .frame(width: 24)
                            Text(lighting.title)
                                .font(.subheadline.weight(.medium))
                                .lineLimit(1)
                                .minimumScaleFactor(0.76)
                            Spacer(minLength: 0)
                            if selectedLighting == lighting {
                                Image(systemName: "checkmark")
                                    .font(.caption.weight(.bold))
                            }
                        }
                        .foregroundStyle(MSHColor.charcoal)
                        .padding(.horizontal, 13)
                        .frame(maxWidth: .infinity, minHeight: 54)
                        .background(
                            RoundedRectangle(cornerRadius: 17, style: .continuous)
                                .fill(selectedLighting == lighting ? MSHColor.mushroom.opacity(0.30) : Color.white.opacity(0.30))
                        )
                        .mshNativeGlass(
                            in: RoundedRectangle(cornerRadius: 17, style: .continuous),
                            tint: selectedLighting == lighting ? MSHColor.mushroom : MSHColor.warmWhite,
                            edgeStrength: selectedLighting == lighting ? 0.88 : 0.42,
                            shadowStrength: selectedLighting == lighting ? 0.40 : 0.16,
                            glowStrength: selectedLighting == lighting ? 0.12 : 0.02
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .tracking(1.55)
            .foregroundStyle(MSHColor.charcoal.opacity(0.58))
    }
}

private struct MSHGlassMetric: View {
    let title: String
    let value: String
    let icon: String
    let note: String
    let tint: Color

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 18, style: .continuous)
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                Text(title)
            }
            .font(.caption.weight(.medium))
            .foregroundStyle(.white.opacity(0.86))

            Text(value)
                .font(.system(size: 24, weight: .regular, design: .serif))
                .foregroundStyle(.white)
                .lineLimit(2)
                .minimumScaleFactor(0.72)

            Text(note)
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.68))
                .lineLimit(3)
        }
        .padding(13)
        .frame(maxWidth: .infinity, minHeight: 150, alignment: .topLeading)
        .background(shape.fill(Color.white.opacity(0.025)))
        .mshNativeGlass(in: shape, tint: tint, edgeStrength: 0.56, shadowStrength: 0.42, glowStrength: 0.16)
    }
}

private struct MSHLifestyleTile: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let tint: Color

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 18, style: .continuous)
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: systemImage)
                .font(.headline)
            Spacer(minLength: 10)
            Text(title)
                .font(.system(.headline, design: .serif))
            Text(subtitle)
                .font(.caption)
                .foregroundStyle(.white.opacity(0.70))
        }
        .foregroundStyle(.white)
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 120, alignment: .topLeading)
        .background(shape.fill(Color.white.opacity(0.03)))
        .mshNativeGlass(in: shape, tint: tint, edgeStrength: 0.68, shadowStrength: 0.52, glowStrength: 0.20)
    }
}

private struct MSHMyHealthLiftButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 1.035 : 1)
            .brightness(configuration.isPressed ? 0.055 : 0)
            .shadow(
                color: Color(red: 0.48, green: 0.82, blue: 1.0).opacity(configuration.isPressed ? 0.26 : 0.08),
                radius: configuration.isPressed ? 18 : 8,
                y: configuration.isPressed ? 1 : 4
            )
            .animation(reduceMotion ? nil : .spring(response: 0.20, dampingFraction: 0.76), value: configuration.isPressed)
    }
}
