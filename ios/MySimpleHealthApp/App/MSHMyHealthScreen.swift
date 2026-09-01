import SwiftUI

@MainActor
final class MSHMyHealthViewModel: ObservableObject {
    enum LoadState: Equatable {
        case loading
        case loaded(MSHMyHealthSnapshot)
        case failed
    }

    static let recentActivityLimit = 8

    @Published private(set) var loadState: LoadState = .loading
    private let dataSource: any MSHMyHealthDataLoading
    private var hasLoaded = false

    init(dataSource: any MSHMyHealthDataLoading = MSHMyHealthDataSource.live()) {
        self.dataSource = dataSource
    }

    func loadIfNeeded() async {
        guard !hasLoaded else { return }
        hasLoaded = true
        await reload()
    }

    func reload() async {
        loadState = .loading
        MSHDebugLifecycle.log(
            "native_my_health_load_started",
            "recentLimit=\(Self.recentActivityLimit) bulkRecordDecoding=false"
        )
        do {
            let status = try await dataSource.loadStatus()
            let records = try await dataSource.loadRecentActivity(limit: Self.recentActivityLimit)
            let snapshot = MSHMyHealthMapper.snapshot(
                syncState: status,
                recentRecords: records,
                recentLimit: Self.recentActivityLimit
            )
            loadState = .loaded(snapshot)
            MSHDebugLifecycle.log(
                "native_my_health_load_complete",
                "recentCount=\(snapshot.recentActivity.count) selectedAreaCount=\(snapshot.appleHealth.selectedAreas.count) bulkRecordDecoding=false"
            )
        } catch {
            MSHDebugLifecycle.log(
                "native_my_health_load_failed",
                "swiftType=\(String(reflecting: type(of: error))) description=\(error.localizedDescription)"
            )
            loadState = .failed
        }
    }
}

@MainActor
struct MSHMyHealthScreen: View {
    @StateObject private var viewModel: MSHMyHealthViewModel
    @AppStorage("msh.displayName") private var displayName = ""
    @AppStorage("msh.appearance") private var appearanceRawValue = MSHAppearancePreference.system.rawValue
    @State private var pendingName = ""

    init(viewModel: MSHMyHealthViewModel = MSHMyHealthViewModel()) {
        _viewModel = StateObject(wrappedValue: viewModel)
    }

    private var hasDisplayName: Bool {
        !displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()

            if hasDisplayName {
                homeContent
            } else {
                doorway
            }
        }
        .task(id: hasDisplayName) {
            if hasDisplayName {
                await viewModel.loadIfNeeded()
            }
        }
    }

    private var homeContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: MSHSpacing.xLarge) {
                header
                MSHTimeOfDayCard()

                switch viewModel.loadState {
                case .loading:
                    loadingContent
                case .loaded(let snapshot):
                    loadedContent(snapshot)
                case .failed:
                    failedContent
                }
            }
            .padding(.horizontal, MSHSpacing.medium)
            .padding(.vertical, MSHSpacing.large)
        }
        .refreshable { await viewModel.reload() }
    }

    private var doorway: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: MSHSpacing.xLarge) {
                Spacer(minLength: 44)

                VStack(alignment: .leading, spacing: MSHSpacing.small) {
                    Text("My Health")
                        .font(MSHTypography.destinationTitle)
                        .foregroundStyle(MSHColor.primaryText)

                    Text("Before you come in, make this space yours.")
                        .font(.title3)
                        .foregroundStyle(MSHColor.secondaryText)
                }

                VStack(alignment: .leading, spacing: MSHSpacing.large) {
                    VStack(alignment: .leading, spacing: MSHSpacing.small) {
                        Text("What should we call you here?")
                            .font(.system(.title2, design: .serif, weight: .semibold))
                            .foregroundStyle(MSHColor.primaryText)
                        Text("Your name, nickname, or whatever feels natural to you.")
                            .font(MSHTypography.body)
                            .foregroundStyle(MSHColor.secondaryText)
                    }

                    TextField("Name or nickname", text: $pendingName)
                        .textInputAutocapitalization(.words)
                        .submitLabel(.done)
                        .padding(.horizontal, MSHSpacing.medium)
                        .frame(height: 52)
                        .background(MSHColor.controlFill)
                        .foregroundStyle(MSHColor.primaryText)
                        .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous)
                                .stroke(MSHColor.border, lineWidth: 1)
                        }
                        .onSubmit { enterHome() }

                    VStack(alignment: .leading, spacing: MSHSpacing.small) {
                        Text("Appearance")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(MSHColor.primaryText)
                        Picker("Appearance", selection: $appearanceRawValue) {
                            ForEach(MSHAppearancePreference.allCases) { preference in
                                Text(preference.title).tag(preference.rawValue)
                            }
                        }
                        .pickerStyle(.segmented)
                    }

                    Button(action: enterHome) {
                        Text("Come in")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(MSHColor.warmWhite)
                    .background(MSHColor.forest)
                    .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))
                    .disabled(pendingName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .opacity(pendingName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.45 : 1)
                }
                .mshSurface()

                Text("You can change your name or appearance later in Profile & Settings.")
                    .font(.footnote)
                    .foregroundStyle(MSHColor.secondaryText)
            }
            .padding(.horizontal, MSHSpacing.medium)
            .padding(.bottom, MSHSpacing.large)
        }
    }

    private func enterHome() {
        let trimmed = pendingName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        displayName = trimmed
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.small) {
            Text("\(timeGreeting), \(displayName).")
                .font(MSHTypography.destinationTitle)
                .foregroundStyle(MSHColor.primaryText)
            Text("You’re home. Here’s what matters right now.")
                .font(MSHTypography.body)
                .foregroundStyle(MSHColor.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var timeGreeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<12: return "Good morning"
        case 12..<17: return "Good afternoon"
        case 17..<22: return "Good evening"
        default: return "Welcome back"
        }
    }

    private var loadingContent: some View {
        VStack(spacing: MSHSpacing.medium) {
            ProgressView()
                .tint(MSHColor.accent)
            Text("Bringing together your current picture…")
                .font(MSHTypography.body)
                .foregroundStyle(MSHColor.secondaryText)
        }
        .frame(maxWidth: .infinity)
        .mshSurface()
        .accessibilityIdentifier("my-health-loading")
    }

    private func loadedContent(_ snapshot: MSHMyHealthSnapshot) -> some View {
        Group {
            MSHSection(title: "Health areas", subtitle: "The areas you choose to bring into My Health.") {
                VStack(spacing: MSHSpacing.small) {
                    ForEach(snapshot.areaCards) { card in
                        MSHHealthAreaCard(model: card)
                    }
                }
            }

            MSHSection(title: "Data visualization", subtitle: "Only keep what matters to you.") {
                MSHHealthDataVisualization(activity: snapshot.recentActivity)
            }

            MSHComingUpCard()

            MSHAppleHealthStatusCard(status: snapshot.appleHealth)
        }
    }

    private var failedContent: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.medium) {
            Text("My Health is temporarily unavailable")
                .font(MSHTypography.cardTitle)
                .foregroundStyle(MSHColor.primaryText)
            Text("Your information remains on this iPhone. Pull down to try again.")
                .font(MSHTypography.body)
                .foregroundStyle(MSHColor.secondaryText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .mshSurface()
        .accessibilityIdentifier("my-health-error")
    }
}

private struct MSHTimeOfDayCard: View {
    private var hour: Int { Calendar.current.component(.hour, from: Date()) }

    private var title: String {
        switch hour {
        case 5..<12: "This morning"
        case 12..<17: "This afternoon"
        case 17..<22: "This evening"
        default: "Right now"
        }
    }

    private var message: String {
        switch hour {
        case 5..<12:
            "Begin with what carried over from overnight and what needs your attention today."
        case 12..<17:
            "See what has already happened today and what still deserves your attention."
        case 17..<22:
            "Let the day settle. Notice what happened, what remains, and what can wait until tomorrow."
        default:
            "Keep this quiet. Notice what matters now and leave the rest for later."
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.small) {
            Text(title.uppercased())
                .font(.caption.weight(.semibold))
                .tracking(1.2)
                .foregroundStyle(MSHColor.accent)
            Text(message)
                .font(.system(.title3, design: .serif))
                .foregroundStyle(MSHColor.primaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, MSHSpacing.small)
    }
}

private struct MSHSection<Content: View>: View {
    let title: String
    let subtitle: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.medium) {
            VStack(alignment: .leading, spacing: MSHSpacing.xSmall) {
                Text(title)
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(MSHColor.primaryText)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(MSHColor.secondaryText)
            }
            content
        }
    }
}

private struct MSHAppleHealthStatusCard: View {
    let status: MSHAppleHealthStatus

    var body: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.medium) {
            HStack(alignment: .top, spacing: MSHSpacing.medium) {
                Image(systemName: "heart.fill")
                    .font(.title3)
                    .foregroundStyle(MSHColor.accent)
                    .frame(width: 42, height: 42)
                    .background(MSHColor.controlFill)
                    .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))

                VStack(alignment: .leading, spacing: MSHSpacing.xSmall) {
                    Text("Apple Health")
                        .font(MSHTypography.cardTitle)
                        .foregroundStyle(MSHColor.primaryText)
                    Text(status.isConnected ? "Connected" : "Not connected")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(status.isConnected ? MSHColor.accent : MSHColor.secondaryText)
                }
                Spacer()
            }

            if status.selectedAreas.isEmpty {
                Text("No Health areas are currently selected.")
                    .font(MSHTypography.body)
                    .foregroundStyle(MSHColor.secondaryText)
            } else {
                FlowLayout(spacing: MSHSpacing.xSmall) {
                    ForEach(status.selectedAreas) { area in
                        Text(area.title)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(MSHColor.primaryText)
                            .padding(.horizontal, MSHSpacing.small)
                            .padding(.vertical, MSHSpacing.xSmall)
                            .background(MSHColor.controlFill)
                            .clipShape(Capsule())
                    }
                }
            }

            if let date = status.lastSuccessfulSyncAt {
                HStack(spacing: MSHSpacing.xSmall) {
                    Image(systemName: "checkmark.circle")
                    Text("Last synced")
                    Text(date, format: .relative(presentation: .named))
                }
                .font(.caption)
                .foregroundStyle(MSHColor.secondaryText)
            } else if status.isConnected {
                Text("A successful sync has not been recorded yet.")
                    .font(.caption)
                    .foregroundStyle(MSHColor.secondaryText)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .mshSurface()
        .accessibilityIdentifier("apple-health-status-card")
    }
}

private struct MSHHealthAreaCard: View {
    let model: MSHHealthAreaCardModel

    var body: some View {
        HStack(spacing: MSHSpacing.medium) {
            Image(systemName: model.area.systemImage)
                .font(.title3)
                .foregroundStyle(model.isSelected ? MSHColor.accent : MSHColor.secondaryText)
                .frame(width: 42, height: 42)
                .background(MSHColor.controlFill)
                .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))

            VStack(alignment: .leading, spacing: MSHSpacing.xSmall) {
                Text(model.area.title)
                    .font(MSHTypography.cardTitle)
                    .foregroundStyle(MSHColor.primaryText)
                Text(model.stateDescription)
                    .font(.subheadline)
                    .foregroundStyle(MSHColor.secondaryText)
                if let date = model.mostRecentActivityAt {
                    Text(date, format: .relative(presentation: .named))
                        .font(.caption)
                        .foregroundStyle(MSHColor.secondaryText)
                }
            }
            Spacer()
        }
        .padding(MSHSpacing.medium)
        .background(MSHColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous)
                .stroke(MSHColor.border, lineWidth: 1)
        }
    }
}

private enum MSHHealthWidgetArea: String, CaseIterable, Identifiable {
    case heart
    case movement
    case sleep
    case body
    case other

    var id: String { rawValue }

    var title: String {
        switch self {
        case .heart: "Heart activity"
        case .movement: "Movement"
        case .sleep: "Sleep"
        case .body: "Body measurements"
        case .other: "Other health data"
        }
    }

    var icon: String {
        switch self {
        case .heart: "heart.fill"
        case .movement: "figure.walk"
        case .sleep: "moon.zzz"
        case .body: "scalemass"
        case .other: "waveform.path.ecg"
        }
    }

    var description: String {
        switch self {
        case .heart: "Heart rate and other recent heart measures"
        case .movement: "Steps, active energy, distance and movement"
        case .sleep: "Recent sleep measures and patterns"
        case .body: "Weight and other body measurements"
        case .other: "Other recent Apple Health measurements"
        }
    }
}

private struct MSHHealthDataVisualization: View {
    let activity: [MSHRecentHealthActivity]

    @AppStorage("msh.healthWidgets.heart") private var showHeart = true
    @AppStorage("msh.healthWidgets.movement") private var showMovement = true
    @AppStorage("msh.healthWidgets.sleep") private var showSleep = true
    @AppStorage("msh.healthWidgets.body") private var showBody = true
    @AppStorage("msh.healthWidgets.other") private var showOther = false

    private func area(for item: MSHRecentHealthActivity) -> MSHHealthWidgetArea {
        let value = item.title.lowercased()
        if value.contains("heart") || value.contains("pulse") { return .heart }
        if value.contains("sleep") { return .sleep }
        if value.contains("weight") || value.contains("body") || value.contains("mass") || value.contains("bmi") || value.contains("height") { return .body }
        if value.contains("step") || value.contains("energy") || value.contains("distance") || value.contains("movement") || value.contains("workout") || value.contains("exercise") { return .movement }
        return .other
    }

    private func isEnabled(_ area: MSHHealthWidgetArea) -> Bool {
        switch area {
        case .heart: showHeart
        case .movement: showMovement
        case .sleep: showSleep
        case .body: showBody
        case .other: showOther
        }
    }

    private var enabledAreas: [MSHHealthWidgetArea] {
        MSHHealthWidgetArea.allCases.filter(isEnabled)
    }

    private func activity(for area: MSHHealthWidgetArea) -> [MSHRecentHealthActivity] {
        activity.filter { self.area(for: $0) == area }
    }

    var body: some View {
        VStack(spacing: MSHSpacing.small) {
            NavigationLink {
                MSHHealthWidgetDirectory()
            } label: {
                HStack(spacing: MSHSpacing.small) {
                    Image(systemName: "slider.horizontal.3")
                    Text("Edit widgets")
                    Spacer()
                    Image(systemName: "chevron.right")
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(MSHColor.accent)
                .padding(.horizontal, MSHSpacing.medium)
                .frame(height: 48)
                .background(MSHColor.surface)
                .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous)
                        .stroke(MSHColor.border, lineWidth: 1)
                }
            }
            .buttonStyle(.plain)

            if enabledAreas.isEmpty {
                VStack(spacing: MSHSpacing.small) {
                    Image(systemName: "rectangle.3.group")
                        .font(.title2)
                        .foregroundStyle(MSHColor.secondaryText)
                    Text("No widgets are currently shown.")
                        .font(MSHTypography.body)
                        .foregroundStyle(MSHColor.secondaryText)
                    Text("Use Edit widgets to add what matters to you.")
                        .font(.caption)
                        .foregroundStyle(MSHColor.secondaryText)
                }
                .frame(maxWidth: .infinity)
                .padding(MSHSpacing.large)
                .mshSurface()
            } else {
                ForEach(enabledAreas) { area in
                    let items = activity(for: area)
                    NavigationLink {
                        MSHHealthDataExploreView(title: area.title, icon: area.icon, activity: items)
                    } label: {
                        MSHHealthDataVisualizationCard(title: area.title, icon: area.icon, activity: items)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

private struct MSHHealthWidgetDirectory: View {
    @AppStorage("msh.healthWidgets.heart") private var showHeart = true
    @AppStorage("msh.healthWidgets.movement") private var showMovement = true
    @AppStorage("msh.healthWidgets.sleep") private var showSleep = true
    @AppStorage("msh.healthWidgets.body") private var showBody = true
    @AppStorage("msh.healthWidgets.other") private var showOther = false

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: MSHSpacing.large) {
                    VStack(alignment: .leading, spacing: MSHSpacing.small) {
                        Text("Widget Directory")
                            .font(MSHTypography.destinationTitle)
                            .foregroundStyle(MSHColor.primaryText)
                        Text("Only keep what matters to you.")
                            .font(MSHTypography.body)
                            .foregroundStyle(MSHColor.secondaryText)
                    }

                    VStack(spacing: 0) {
                        widgetRow(area: .heart, isOn: $showHeart)
                        Divider().overlay(MSHColor.border)
                        widgetRow(area: .movement, isOn: $showMovement)
                        Divider().overlay(MSHColor.border)
                        widgetRow(area: .sleep, isOn: $showSleep)
                        Divider().overlay(MSHColor.border)
                        widgetRow(area: .body, isOn: $showBody)
                        Divider().overlay(MSHColor.border)
                        widgetRow(area: .other, isOn: $showOther)
                    }
                    .padding(.horizontal, MSHSpacing.medium)
                    .background(MSHColor.surface)
                    .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous)
                            .stroke(MSHColor.border, lineWidth: 1)
                    }

                    Text("Turning a widget off only removes it from this dashboard. It does not delete any health data.")
                        .font(.footnote)
                        .foregroundStyle(MSHColor.secondaryText)
                }
                .padding(MSHSpacing.medium)
            }
        }
        .navigationTitle("Widgets")
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func widgetRow(area: MSHHealthWidgetArea, isOn: Binding<Bool>) -> some View {
        HStack(spacing: MSHSpacing.medium) {
            Image(systemName: area.icon)
                .font(.title3)
                .foregroundStyle(MSHColor.accent)
                .frame(width: 38, height: 38)
                .background(MSHColor.controlFill)
                .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                Text(area.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(MSHColor.primaryText)
                Text(area.description)
                    .font(.caption)
                    .foregroundStyle(MSHColor.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer()

            Toggle("", isOn: isOn)
                .labelsHidden()
                .tint(MSHColor.accent)
        }
        .padding(.vertical, MSHSpacing.medium)
    }
}

private struct MSHHealthDataVisualizationCard: View {
    let title: String
    let icon: String
    let activity: [MSHRecentHealthActivity]

    private var repeatedMetric: Bool {
        Set(activity.map { $0.title.lowercased() }).count == 1 && activity.count > 1
    }

    private var numericValues: [Double] {
        activity.compactMap { item in
            guard let detail = item.detail,
                  let first = detail.split(separator: " ").first else { return nil }
            return Double(first)
        }
    }

    private var latestUniqueMeasures: [MSHRecentHealthActivity] {
        var seen = Set<String>()
        return activity.filter { item in
            let key = item.title.lowercased()
            guard !seen.contains(key) else { return false }
            seen.insert(key)
            return true
        }.prefix(3).map { $0 }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.medium) {
            HStack {
                Label(title, systemImage: icon)
                    .font(MSHTypography.cardTitle)
                    .foregroundStyle(MSHColor.primaryText)
                Spacer()
                HStack(spacing: 4) {
                    Text("Explore")
                    Image(systemName: "chevron.right")
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(MSHColor.accent)
            }

            if activity.isEmpty {
                HStack(spacing: MSHSpacing.small) {
                    Image(systemName: "chart.line.uptrend.xyaxis")
                        .foregroundStyle(MSHColor.secondaryText)
                    Text("Ready when recent data is available")
                        .font(.subheadline)
                        .foregroundStyle(MSHColor.secondaryText)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, MSHSpacing.small)
            } else if repeatedMetric, numericValues.count > 1 {
                MSHMiniLineTrend(values: numericValues)
                    .frame(height: 72)

                HStack {
                    if let low = numericValues.min(), let high = numericValues.max() {
                        Text("Recent range \(formatted(low))–\(formatted(high))")
                            .font(.caption)
                            .foregroundStyle(MSHColor.secondaryText)
                    }
                    Spacer()
                    Text(activity.first?.detail ?? "")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(MSHColor.primaryText)
                }
            } else {
                HStack(spacing: MSHSpacing.small) {
                    ForEach(latestUniqueMeasures) { item in
                        VStack(alignment: .leading, spacing: 3) {
                            Text(item.detail ?? "Recorded")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(MSHColor.primaryText)
                                .lineLimit(1)
                            Text(item.title)
                                .font(.caption2)
                                .foregroundStyle(MSHColor.secondaryText)
                                .lineLimit(2)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(MSHSpacing.small)
                        .background(MSHColor.controlFill)
                        .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))
                    }
                }
            }
        }
        .padding(MSHSpacing.medium)
        .background(MSHColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous)
                .stroke(MSHColor.border, lineWidth: 1)
        }
        .accessibilityElement(children: .combine)
    }

    private func formatted(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(format: "%.1f", value)
    }
}

private struct MSHMiniLineTrend: View {
    let values: [Double]

    var body: some View {
        GeometryReader { proxy in
            let minimum = values.min() ?? 0
            let maximum = values.max() ?? minimum + 1
            let range = max(maximum - minimum, 1)
            let horizontalInset: CGFloat = 4
            let verticalInset: CGFloat = 8
            let width = max(proxy.size.width - (horizontalInset * 2), 1)
            let height = max(proxy.size.height - (verticalInset * 2), 1)
            let denominator = CGFloat(max(values.count - 1, 1))

            let points = values.enumerated().map { index, value in
                CGPoint(
                    x: horizontalInset + (CGFloat(index) / denominator) * width,
                    y: verticalInset + (1 - CGFloat((value - minimum) / range)) * height
                )
            }

            ZStack {
                Path { path in
                    guard let first = points.first else { return }
                    path.move(to: first)
                    for point in points.dropFirst() {
                        path.addLine(to: point)
                    }
                }
                .stroke(
                    MSHColor.accent,
                    style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round)
                )

                ForEach(Array(points.enumerated()), id: \.offset) { _, point in
                    Circle()
                        .fill(MSHColor.surface)
                        .overlay {
                            Circle().stroke(MSHColor.accent, lineWidth: 2)
                        }
                        .frame(width: 7, height: 7)
                        .position(point)
                }
            }
        }
        .accessibilityHidden(true)
    }
}

private struct MSHHealthDataExploreView: View {
    let title: String
    let icon: String
    let activity: [MSHRecentHealthActivity]

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: MSHSpacing.large) {
                    Label(title, systemImage: icon)
                        .font(MSHTypography.destinationTitle)
                        .foregroundStyle(MSHColor.primaryText)

                    Text("Recent measurements")
                        .font(.subheadline)
                        .foregroundStyle(MSHColor.secondaryText)

                    if activity.isEmpty {
                        VStack(spacing: MSHSpacing.small) {
                            Image(systemName: "chart.line.uptrend.xyaxis")
                                .font(.title2)
                                .foregroundStyle(MSHColor.secondaryText)
                            Text("No recent measurements to show yet.")
                                .font(MSHTypography.body)
                                .foregroundStyle(MSHColor.secondaryText)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(MSHSpacing.large)
                        .mshSurface()
                    } else {
                        VStack(spacing: 0) {
                            ForEach(Array(activity.enumerated()), id: \.element.id) { index, item in
                                HStack(spacing: MSHSpacing.medium) {
                                    Image(systemName: item.systemImage)
                                        .foregroundStyle(MSHColor.accent)
                                        .frame(width: 28)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(item.title)
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(MSHColor.primaryText)
                                        HStack(spacing: MSHSpacing.xSmall) {
                                            if let detail = item.detail { Text(detail) }
                                            Text(item.occurredAt, format: .relative(presentation: .named))
                                        }
                                        .font(.caption)
                                        .foregroundStyle(MSHColor.secondaryText)
                                    }
                                    Spacer()
                                }
                                .padding(.vertical, MSHSpacing.small)

                                if index < activity.count - 1 {
                                    Divider().overlay(MSHColor.border)
                                }
                            }
                        }
                        .padding(.horizontal, MSHSpacing.medium)
                        .background(MSHColor.surface)
                        .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous)
                                .stroke(MSHColor.border, lineWidth: 1)
                        }
                    }
                }
                .padding(MSHSpacing.medium)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct MSHComingUpCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.small) {
            Label("Coming up", systemImage: "calendar.badge.clock")
                .font(.title2.weight(.semibold))
                .foregroundStyle(MSHColor.primaryText)
            Text("Calendar and Continuity will bring relevant upcoming information into this space in a future stage.")
                .font(MSHTypography.body)
                .foregroundStyle(MSHColor.secondaryText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .mshSurface()
    }
}

private struct FlowLayout: Layout {
    let spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        arrange(proposal: proposal, subviews: subviews).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let arrangement = arrange(proposal: ProposedViewSize(width: bounds.width, height: bounds.height), subviews: subviews)
        for (index, point) in arrangement.points.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + point.x, y: bounds.minY + point.y), proposal: .unspecified)
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, points: [CGPoint]) {
        let width = proposal.width ?? .infinity
        var points: [CGPoint] = []
        var position = CGPoint.zero
        var lineHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if position.x > 0, position.x + size.width > width {
                position.x = 0
                position.y += lineHeight + spacing
                lineHeight = 0
            }
            points.append(position)
            position.x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
        return (CGSize(width: proposal.width ?? position.x, height: position.y + lineHeight), points)
    }
}
