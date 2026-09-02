import Charts
import SwiftUI

@MainActor
final class MSHMyHealthViewModel: ObservableObject {
    enum LoadState: Equatable {
        case loading
        case loaded(MSHMyHealthSnapshot)
        case failed
    }

    // The on-device reader caps this per domain at 20. Keeping the request
    // aligned with that bound gives the dashboard enough points for useful
    // charts without turning My Health into an unbounded history decode.
    static let recentActivityLimit = 20

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
            "recentLimit=\(Self.recentActivityLimit) swiftCharts=true"
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
                "recentCount=\(snapshot.recentActivity.count) selectedAreaCount=\(snapshot.appleHealth.selectedAreas.count) swiftCharts=true"
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
    @State private var period: MSHHealthPeriod = .week
    @State private var selectedMetric: MSHMetricKind = .sleep

    init(viewModel: MSHMyHealthViewModel = MSHMyHealthViewModel()) {
        _viewModel = StateObject(wrappedValue: viewModel)
    }

    private var hasDisplayName: Bool {
        !displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        ZStack {
            MSHLuxuryPalette.canvas.ignoresSafeArea()

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
            VStack(alignment: .leading, spacing: 28) {
                editorialHeader

                switch viewModel.loadState {
                case .loading:
                    loadingContent
                case .loaded(let snapshot):
                    loadedContent(snapshot)
                case .failed:
                    failedContent
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)
            .padding(.bottom, 34)
        }
        .refreshable { await viewModel.reload() }
    }

    private var editorialHeader: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Rectangle()
                    .fill(MSHLuxuryPalette.antiqueGold)
                    .frame(width: 28, height: 1)
                Text("MY HEALTH")
                    .font(.caption2.weight(.semibold))
                    .tracking(2.4)
                    .foregroundStyle(MSHLuxuryPalette.antiqueGold)
            }

            Text("\(timeGreeting), \(displayName).")
                .font(.system(size: 36, weight: .medium, design: .serif))
                .foregroundStyle(MSHLuxuryPalette.ink)
                .minimumScaleFactor(0.78)

            Text("Your health, gathered quietly in one place.")
                .font(.system(size: 17, design: .serif))
                .foregroundStyle(MSHLuxuryPalette.secondaryInk)

            MSHPeriodPicker(selection: $period)
                .padding(.top, 4)
        }
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

    private func loadedContent(_ snapshot: MSHMyHealthSnapshot) -> some View {
        let metrics = MSHMetricKind.allCases.map {
            MSHMetricSeriesBuilder.make(
                kind: $0,
                activity: snapshot.recentActivity,
                period: period
            )
        }

        return VStack(alignment: .leading, spacing: 28) {
            MSHMetricGrid(
                metrics: metrics,
                activity: snapshot.recentActivity,
                selection: $selectedMetric
            )

            if let selected = metrics.first(where: { $0.kind == selectedMetric }) {
                MSHMetricDetailCard(metric: selected, period: period)
                    .id("\(selectedMetric.rawValue)-\(period.rawValue)")
            }

            MSHQuietDivider(title: "What’s connected")

            MSHConnectedHealthSummary(status: snapshot.appleHealth)

            MSHQuietDivider(title: "Continue your health")

            MSHHealthDoorways()

            MSHCalendarDoorway()
        }
        .animation(.easeInOut(duration: 0.24), value: selectedMetric)
        .animation(.easeInOut(duration: 0.24), value: period)
    }

    private var loadingContent: some View {
        VStack(spacing: 14) {
            ProgressView()
                .tint(MSHLuxuryPalette.forest)
            Text("Bringing your health into view…")
                .font(.system(.body, design: .serif))
                .foregroundStyle(MSHLuxuryPalette.secondaryInk)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 58)
        .accessibilityIdentifier("my-health-loading")
    }

    private var failedContent: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("My Health is temporarily unavailable")
                .font(.system(.title3, design: .serif, weight: .semibold))
                .foregroundStyle(MSHLuxuryPalette.ink)
            Text("Your information remains on this iPhone. Pull down to try again.")
                .font(.body)
                .foregroundStyle(MSHLuxuryPalette.secondaryInk)
        }
        .padding(20)
        .background(MSHLuxuryPalette.paper)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(MSHLuxuryPalette.hairline, lineWidth: 1)
        }
        .accessibilityIdentifier("my-health-error")
    }

    private var doorway: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 30) {
                Spacer(minLength: 44)

                VStack(alignment: .leading, spacing: 12) {
                    Text("MY HEALTH")
                        .font(.caption2.weight(.semibold))
                        .tracking(2.4)
                        .foregroundStyle(MSHLuxuryPalette.antiqueGold)
                    Text("Make this space yours.")
                        .font(.system(size: 38, weight: .medium, design: .serif))
                        .foregroundStyle(MSHLuxuryPalette.ink)
                    Text("What should we call you here?")
                        .font(.system(.title3, design: .serif))
                        .foregroundStyle(MSHLuxuryPalette.secondaryInk)
                }

                VStack(alignment: .leading, spacing: 18) {
                    TextField("Name or nickname", text: $pendingName)
                        .textInputAutocapitalization(.words)
                        .submitLabel(.done)
                        .padding(.horizontal, 16)
                        .frame(height: 54)
                        .background(MSHLuxuryPalette.paper)
                        .foregroundStyle(MSHLuxuryPalette.ink)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(MSHLuxuryPalette.hairline, lineWidth: 1)
                        }
                        .onSubmit { enterHome() }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Appearance")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(MSHLuxuryPalette.secondaryInk)
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
                            .foregroundStyle(MSHLuxuryPalette.ivory)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .background(MSHLuxuryPalette.forest)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(pendingName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .opacity(pendingName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.45 : 1)
                }

                Text("You can change your name or appearance later in Profile & Settings.")
                    .font(.footnote)
                    .foregroundStyle(MSHLuxuryPalette.secondaryInk)
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 40)
        }
    }

    private func enterHome() {
        let trimmed = pendingName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        displayName = trimmed
    }
}

private enum MSHHealthPeriod: String, CaseIterable, Identifiable {
    case day = "Day"
    case week = "Week"
    case month = "Month"

    var id: String { rawValue }

    var cutoff: Date {
        let calendar = Calendar.current
        switch self {
        case .day:
            return calendar.date(byAdding: .hour, value: -24, to: Date()) ?? Date.distantPast
        case .week:
            return calendar.date(byAdding: .day, value: -7, to: Date()) ?? Date.distantPast
        case .month:
            return calendar.date(byAdding: .day, value: -30, to: Date()) ?? Date.distantPast
        }
    }

    func bucket(_ date: Date) -> Date {
        let calendar = Calendar.current
        switch self {
        case .day:
            return calendar.dateInterval(of: .hour, for: date)?.start ?? date
        case .week, .month:
            return calendar.startOfDay(for: date)
        }
    }

    func axisLabel(for date: Date) -> String {
        let formatter = DateFormatter()
        switch self {
        case .day:
            formatter.dateFormat = "ha"
        case .week:
            formatter.dateFormat = "EEE"
        case .month:
            formatter.dateFormat = "MMM d"
        }
        return formatter.string(from: date)
    }
}

private struct MSHPeriodPicker: View {
    @Binding var selection: MSHHealthPeriod
    @Namespace private var selectionAnimation

    var body: some View {
        HStack(spacing: 4) {
            ForEach(MSHHealthPeriod.allCases) { period in
                Button {
                    withAnimation(.spring(response: 0.34, dampingFraction: 0.86)) {
                        selection = period
                    }
                } label: {
                    Text(period.rawValue)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(selection == period ? MSHLuxuryPalette.ivory : MSHLuxuryPalette.secondaryInk)
                        .frame(maxWidth: .infinity)
                        .frame(height: 34)
                        .background {
                            if selection == period {
                                Capsule()
                                    .fill(MSHLuxuryPalette.forest)
                                    .matchedGeometryEffect(id: "period-selection", in: selectionAnimation)
                            }
                        }
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selection == period ? .isSelected : [])
            }
        }
        .padding(4)
        .background(MSHLuxuryPalette.paper.opacity(0.88))
        .clipShape(Capsule())
        .overlay {
            Capsule().stroke(MSHLuxuryPalette.hairline, lineWidth: 1)
        }
        .frame(maxWidth: 360)
    }
}

private enum MSHMetricKind: String, CaseIterable, Identifiable {
    case sleep
    case heart
    case movement
    case body

    var id: String { rawValue }

    var title: String {
        switch self {
        case .sleep: "Sleep"
        case .heart: "Heart"
        case .movement: "Movement"
        case .body: "Body"
        }
    }

    var icon: String {
        switch self {
        case .sleep: "moon.stars.fill"
        case .heart: "heart.fill"
        case .movement: "figure.walk.motion"
        case .body: "scalemass"
        }
    }

    var area: MSHHealthArea {
        switch self {
        case .sleep: .sleep
        case .heart: .heartActivity
        case .movement: .movement
        case .body: .bodyMeasurements
        }
    }

    var accent: Color {
        switch self {
        case .sleep: MSHLuxuryPalette.plum
        case .heart: MSHLuxuryPalette.wine
        case .movement: MSHLuxuryPalette.sage
        case .body: MSHLuxuryPalette.antiqueGold
        }
    }

    var aggregation: MSHMetricAggregation {
        switch self {
        case .sleep, .movement: .sum
        case .heart: .average
        case .body: .latest
        }
    }
}

private enum MSHMetricAggregation {
    case sum
    case average
    case latest
}

private struct MSHChartPoint: Identifiable, Equatable {
    let date: Date
    let value: Double
    var id: Date { date }
}

private struct MSHMetricSeries: Identifiable, Equatable {
    let kind: MSHMetricKind
    let headline: String
    let descriptor: String
    let unit: String
    let points: [MSHChartPoint]
    let latestDate: Date?

    var id: MSHMetricKind { kind }
    var hasData: Bool { !points.isEmpty }
}

private enum MSHMetricSeriesBuilder {
    static func make(
        kind: MSHMetricKind,
        activity: [MSHRecentHealthActivity],
        period: MSHHealthPeriod
    ) -> MSHMetricSeries {
        let areaItems = activity
            .filter { $0.area == kind.area && $0.occurredAt >= period.cutoff }
            .sorted { $0.occurredAt < $1.occurredAt }

        switch kind {
        case .sleep:
            return sleepSeries(items: areaItems, period: period)
        case .heart:
            return numericSeries(
                kind: kind,
                items: preferredHeartItems(areaItems),
                period: period,
                fallbackDescriptor: "Recent heart-rate measurements"
            )
        case .movement:
            return numericSeries(
                kind: kind,
                items: preferredMovementItems(areaItems),
                period: period,
                fallbackDescriptor: "Recent movement measurements"
            )
        case .body:
            return numericSeries(
                kind: kind,
                items: areaItems.filter { $0.numericValue != nil },
                period: period,
                fallbackDescriptor: "Recent body measurements"
            )
        }
    }

    private static func preferredHeartItems(_ items: [MSHRecentHealthActivity]) -> [MSHRecentHealthActivity] {
        let resting = items.filter { $0.title.localizedCaseInsensitiveContains("Resting") && $0.numericValue != nil }
        if !resting.isEmpty { return resting }
        return items.filter { $0.title.localizedCaseInsensitiveContains("Heart rate") && $0.numericValue != nil }
    }

    private static func preferredMovementItems(_ items: [MSHRecentHealthActivity]) -> [MSHRecentHealthActivity] {
        let priorityTerms = ["Steps", "Active energy", "Exercise time", "Walking + running distance", "Cycling distance", "Swimming distance"]
        for term in priorityTerms {
            let matches = items.filter { $0.title == term && $0.numericValue != nil }
            if !matches.isEmpty { return matches }
        }
        return items.filter { $0.numericValue != nil }
    }

    private static func numericSeries(
        kind: MSHMetricKind,
        items: [MSHRecentHealthActivity],
        period: MSHHealthPeriod,
        fallbackDescriptor: String
    ) -> MSHMetricSeries {
        guard !items.isEmpty else {
            return MSHMetricSeries(
                kind: kind,
                headline: "—",
                descriptor: "Ready when Apple Health has recent data",
                unit: "",
                points: [],
                latestDate: nil
            )
        }

        var buckets: [Date: [(date: Date, value: Double)]] = [:]
        for item in items {
            guard let value = item.numericValue else { continue }
            buckets[period.bucket(item.occurredAt), default: []].append((item.occurredAt, value))
        }

        let points = buckets.keys.sorted().compactMap { date -> MSHChartPoint? in
            guard let values = buckets[date], !values.isEmpty else { return nil }
            let value: Double
            switch kind.aggregation {
            case .sum:
                value = values.reduce(0) { $0 + $1.value }
            case .average:
                value = values.reduce(0) { $0 + $1.value } / Double(values.count)
            case .latest:
                value = values.max(by: { $0.date < $1.date })?.value ?? values.last?.value ?? 0
            }
            return MSHChartPoint(date: date, value: value)
        }

        let latest = items.max(by: { $0.occurredAt < $1.occurredAt })
        let unit = latest?.unit ?? ""
        let latestValue = latest?.numericValue
        let headline = latestValue.map { format($0, unit: unit) } ?? "—"
        let metricName = latest?.title ?? fallbackDescriptor

        return MSHMetricSeries(
            kind: kind,
            headline: headline,
            descriptor: metricName,
            unit: unit,
            points: points,
            latestDate: latest?.occurredAt
        )
    }

    private static func sleepSeries(
        items: [MSHRecentHealthActivity],
        period: MSHHealthPeriod
    ) -> MSHMetricSeries {
        let asleep = items.filter { item in
            guard let minutes = item.durationMinutes, minutes > 0 else { return false }
            let stage = (item.sleepStage ?? "").lowercased()
            return !stage.contains("awake") && !stage.contains("inbed") && !stage.contains("in_bed")
        }

        guard !asleep.isEmpty else {
            return MSHMetricSeries(
                kind: .sleep,
                headline: "—",
                descriptor: "Ready when Apple Health has recent sleep",
                unit: "h",
                points: [],
                latestDate: nil
            )
        }

        var buckets: [Date: Double] = [:]
        for item in asleep {
            guard let minutes = item.durationMinutes else { continue }
            let day = Calendar.current.startOfDay(for: item.occurredAt)
            buckets[day, default: 0] += minutes / 60
        }

        let points = buckets.keys.sorted().map {
            MSHChartPoint(date: $0, value: buckets[$0] ?? 0)
        }
        let latestPoint = points.last
        let headline = latestPoint.map { durationString(hours: $0.value) } ?? "—"

        return MSHMetricSeries(
            kind: .sleep,
            headline: headline,
            descriptor: "Most recent sleep represented in this view",
            unit: "h",
            points: points,
            latestDate: asleep.map(\.occurredAt).max()
        )
    }

    static func format(_ value: Double, unit: String) -> String {
        let number: String
        if abs(value) >= 1000 {
            number = value.formatted(.number.precision(.fractionLength(0)))
        } else if value.rounded() == value {
            number = String(Int(value))
        } else {
            number = value.formatted(.number.precision(.fractionLength(1)))
        }
        return unit.isEmpty ? number : "\(number) \(unit)"
    }

    static func durationString(hours: Double) -> String {
        let totalMinutes = max(0, Int((hours * 60).rounded()))
        let h = totalMinutes / 60
        let m = totalMinutes % 60
        if h == 0 { return "\(m)m" }
        return "\(h)h \(m)m"
    }
}

private struct MSHMetricGrid: View {
    let metrics: [MSHMetricSeries]
    let activity: [MSHRecentHealthActivity]
    @Binding var selection: MSHMetricKind

    private let columns = [
        GridItem(.adaptive(minimum: 150, maximum: 240), spacing: 12)
    ]

    var body: some View {
        LazyVGrid(columns: columns, spacing: 12) {
            ForEach(metrics) { metric in
                if metric.kind == .sleep {
                    NavigationLink {
                        MSHSleepDashboardView(activity: activity)
                    } label: {
                        MSHMetricTile(metric: metric, isSelected: selection == metric.kind)
                    }
                    .buttonStyle(MSHMetricTileButtonStyle())
                    .accessibilityLabel("Open Sleep dashboard, \(metric.headline)")
                } else {
                    Button {
                        selection = metric.kind
                    } label: {
                        MSHMetricTile(metric: metric, isSelected: selection == metric.kind)
                    }
                    .buttonStyle(MSHMetricTileButtonStyle())
                    .accessibilityLabel("\(metric.kind.title), \(metric.headline)")
                    .accessibilityValue(selection == metric.kind ? "Selected" : "")
                }
            }
        }
    }
}

private struct MSHMetricTile: View {
    let metric: MSHMetricSeries
    let isSelected: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack {
                Image(systemName: metric.kind.icon)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(metric.kind.accent)
                    .frame(width: 32, height: 32)
                    .background(metric.kind.accent.opacity(0.10))
                    .clipShape(Circle())
                Spacer()
                if isSelected {
                    Circle()
                        .fill(MSHLuxuryPalette.antiqueGold)
                        .frame(width: 6, height: 6)
                }
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(metric.kind.title.uppercased())
                    .font(.caption2.weight(.semibold))
                    .tracking(1.2)
                    .foregroundStyle(MSHLuxuryPalette.secondaryInk)
                Text(metric.headline)
                    .font(.system(size: 23, weight: .semibold, design: .serif))
                    .foregroundStyle(MSHLuxuryPalette.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }

            if metric.hasData {
                MSHMiniChart(metric: metric)
                    .frame(height: 48)
            } else {
                HStack(spacing: 6) {
                    Rectangle()
                        .fill(MSHLuxuryPalette.hairline)
                        .frame(height: 1)
                    Text("No recent data")
                        .font(.caption2)
                        .foregroundStyle(MSHLuxuryPalette.secondaryInk)
                }
                .frame(height: 48)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 150, alignment: .leading)
        .padding(16)
        .background(
            LinearGradient(
                colors: [MSHLuxuryPalette.paper, metric.kind.accent.opacity(isSelected ? 0.07 : 0.025)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(isSelected ? metric.kind.accent.opacity(0.38) : MSHLuxuryPalette.hairline, lineWidth: isSelected ? 1.2 : 0.8)
        }
        .shadow(color: MSHLuxuryPalette.forest.opacity(0.035), radius: 18, y: 8)
    }
}

private struct MSHMetricTileButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
            .opacity(configuration.isPressed ? 0.92 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

private struct MSHMiniChart: View {
    let metric: MSHMetricSeries

    var body: some View {
        Chart(metric.points) { point in
            if metric.kind == .sleep || metric.kind == .movement {
                BarMark(
                    x: .value("Time", point.date),
                    y: .value("Value", point.value)
                )
                .foregroundStyle(metric.kind.accent.gradient)
                .cornerRadius(3)
            } else {
                LineMark(
                    x: .value("Time", point.date),
                    y: .value("Value", point.value)
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(metric.kind.accent)
                .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
            }
        }
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .chartLegend(.hidden)
        .accessibilityHidden(true)
    }
}

private struct MSHMetricDetailCard: View {
    let metric: MSHMetricSeries
    let period: MSHHealthPeriod
    @State private var selectedDate: Date?

    private var selectedPoint: MSHChartPoint? {
        guard let selectedDate else { return nil }
        return metric.points.min(by: {
            abs($0.date.timeIntervalSince(selectedDate)) < abs($1.date.timeIntervalSince(selectedDate))
        })
    }

    private var displayHeadline: String {
        guard let point = selectedPoint else { return metric.headline }
        if metric.kind == .sleep {
            return MSHMetricSeriesBuilder.durationString(hours: point.value)
        }
        return MSHMetricSeriesBuilder.format(point.value, unit: metric.unit)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: metric.kind.icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(metric.kind.accent)
                    .frame(width: 42, height: 42)
                    .background(metric.kind.accent.opacity(0.09))
                    .clipShape(Circle())

                VStack(alignment: .leading, spacing: 4) {
                    Text(metric.kind.title)
                        .font(.system(.title2, design: .serif, weight: .semibold))
                        .foregroundStyle(MSHLuxuryPalette.ink)
                    Text(metric.descriptor)
                        .font(.caption)
                        .foregroundStyle(MSHLuxuryPalette.secondaryInk)
                }
                Spacer()
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(displayHeadline)
                    .font(.system(size: 36, weight: .medium, design: .serif))
                    .foregroundStyle(MSHLuxuryPalette.ink)
                    .contentTransition(.numericText())

                if let point = selectedPoint {
                    Text(point.date, format: .dateTime.month(.abbreviated).day().hour().minute())
                        .font(.caption)
                        .foregroundStyle(MSHLuxuryPalette.secondaryInk)
                } else if let date = metric.latestDate {
                    Text("Latest record · \(date.formatted(.relative(presentation: .named)))")
                        .font(.caption)
                        .foregroundStyle(MSHLuxuryPalette.secondaryInk)
                }
            }

            if metric.hasData {
                Chart {
                    ForEach(metric.points) { point in
                        if metric.kind == .sleep || metric.kind == .movement {
                            BarMark(
                                x: .value("Time", point.date),
                                y: .value("Value", point.value)
                            )
                            .foregroundStyle(metric.kind.accent.gradient)
                            .cornerRadius(4)
                        } else {
                            AreaMark(
                                x: .value("Time", point.date),
                                y: .value("Value", point.value)
                            )
                            .interpolationMethod(.catmullRom)
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [metric.kind.accent.opacity(0.20), metric.kind.accent.opacity(0.01)],
                                    startPoint: .top,
                                    endPoint: .bottom
                                )
                            )

                            LineMark(
                                x: .value("Time", point.date),
                                y: .value("Value", point.value)
                            )
                            .interpolationMethod(.catmullRom)
                            .foregroundStyle(metric.kind.accent)
                            .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
                        }
                    }

                    if let selectedPoint {
                        RuleMark(x: .value("Selected", selectedPoint.date))
                            .foregroundStyle(MSHLuxuryPalette.antiqueGold.opacity(0.7))
                            .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 4]))

                        PointMark(
                            x: .value("Selected", selectedPoint.date),
                            y: .value("Selected value", selectedPoint.value)
                        )
                        .foregroundStyle(metric.kind.accent)
                        .symbolSize(42)
                    }
                }
                .frame(height: 210)
                .chartXAxis {
                    AxisMarks(values: .automatic(desiredCount: period == .month ? 4 : 5)) { value in
                        AxisGridLine().foregroundStyle(MSHLuxuryPalette.hairline.opacity(0.55))
                        AxisTick().foregroundStyle(MSHLuxuryPalette.hairline)
                        AxisValueLabel {
                            if let date = value.as(Date.self) {
                                Text(period.axisLabel(for: date))
                                    .font(.caption2)
                                    .foregroundStyle(MSHLuxuryPalette.secondaryInk)
                            }
                        }
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .leading, values: .automatic(desiredCount: 4)) { value in
                        AxisGridLine().foregroundStyle(MSHLuxuryPalette.hairline.opacity(0.55))
                        AxisValueLabel {
                            if let number = value.as(Double.self) {
                                Text(number.formatted(.number.precision(.fractionLength(0...1))))
                                    .font(.caption2)
                                    .foregroundStyle(MSHLuxuryPalette.secondaryInk)
                            }
                        }
                    }
                }
                .chartXSelection(value: $selectedDate)
                .sensoryFeedback(.selection, trigger: selectedPoint?.id)

                HStack {
                    Text("Slide across the chart to explore")
                        .font(.caption)
                        .foregroundStyle(MSHLuxuryPalette.secondaryInk)
                    Spacer()
                    if selectedDate != nil {
                        Button("Done") { selectedDate = nil }
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(metric.kind.accent)
                            .buttonStyle(.plain)
                    }
                }
            } else {
                VStack(spacing: 10) {
                    Image(systemName: "waveform.path.ecg")
                        .font(.title2)
                        .foregroundStyle(metric.kind.accent.opacity(0.65))
                    Text("No recent \(metric.kind.title.lowercased()) data is available in this time view yet.")
                        .font(.subheadline)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(MSHLuxuryPalette.secondaryInk)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 38)
            }

            Text("Apple Health data is shown as context, not a score. Your experience still matters alongside the numbers.")
                .font(.footnote)
                .foregroundStyle(MSHLuxuryPalette.secondaryInk)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 2)
        }
        .padding(20)
        .background(MSHLuxuryPalette.paper)
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .stroke(MSHLuxuryPalette.hairline, lineWidth: 0.8)
        }
        .shadow(color: MSHLuxuryPalette.forest.opacity(0.045), radius: 24, y: 10)
    }
}

private struct MSHQuietDivider: View {
    let title: String

    var body: some View {
        HStack(spacing: 12) {
            Text(title.uppercased())
                .font(.caption2.weight(.semibold))
                .tracking(1.8)
                .foregroundStyle(MSHLuxuryPalette.secondaryInk)
            Rectangle()
                .fill(MSHLuxuryPalette.hairline)
                .frame(height: 1)
        }
    }
}

private struct MSHConnectedHealthSummary: View {
    let status: MSHAppleHealthStatus

    var body: some View {
        NavigationLink {
            MSHWebFeatureScreen(destination: .myHealth)
        } label: {
            HStack(spacing: 16) {
                Image(systemName: "heart.text.square")
                    .font(.title3)
                    .foregroundStyle(MSHLuxuryPalette.forest)
                    .frame(width: 44, height: 44)
                    .background(MSHLuxuryPalette.forest.opacity(0.07))
                    .clipShape(Circle())

                VStack(alignment: .leading, spacing: 3) {
                    Text("Apple Health")
                        .font(.system(.headline, design: .serif))
                        .foregroundStyle(MSHLuxuryPalette.ink)
                    Text(status.isConnected ? "Connected · \(status.selectedAreas.count) areas" : "Not connected")
                        .font(.caption)
                        .foregroundStyle(MSHLuxuryPalette.secondaryInk)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 3) {
                    if let date = status.lastSuccessfulSyncAt {
                        Text(date, format: .relative(presentation: .named))
                            .font(.caption2)
                            .foregroundStyle(MSHLuxuryPalette.secondaryInk)
                    }
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(MSHLuxuryPalette.forest)
                }
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("apple-health-status-card")
    }
}

private struct MSHHealthDoorways: View {
    private let destinations: [(MSHFeatureDestination, String, String)] = [
        (.cycle, "Cycle", "circle.dotted.circle"),
        (.medications, "Medications", "pills"),
        (.selfInsight, "Self Insight", "sparkles.rectangle.stack"),
        (.healthStory, "My Health Story", "book.pages")
    ]

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(destinations.enumerated()), id: \.offset) { index, item in
                NavigationLink {
                    MSHWebFeatureScreen(destination: item.0)
                } label: {
                    HStack(spacing: 14) {
                        Image(systemName: item.2)
                            .foregroundStyle(MSHLuxuryPalette.forest)
                            .frame(width: 30)
                        Text(item.1)
                            .font(.system(.body, design: .serif, weight: .medium))
                            .foregroundStyle(MSHLuxuryPalette.ink)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(MSHLuxuryPalette.secondaryInk)
                    }
                    .padding(.vertical, 15)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                if index < destinations.count - 1 {
                    Divider().overlay(MSHLuxuryPalette.hairline)
                }
            }
        }
    }
}

private struct MSHCalendarDoorway: View {
    var body: some View {
        NavigationLink {
            MSHWebFeatureScreen(destination: .calendar)
        } label: {
            HStack(alignment: .center, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("COMING UP")
                        .font(.caption2.weight(.semibold))
                        .tracking(1.5)
                        .foregroundStyle(MSHLuxuryPalette.antiqueGold)
                    Text("See what your health has next.")
                        .font(.system(.title3, design: .serif, weight: .semibold))
                        .foregroundStyle(MSHLuxuryPalette.ivory)
                    Text("Calendar brings planned movement, medication continuity, appointments, cycle events, and other dated health actions together.")
                        .font(.caption)
                        .foregroundStyle(MSHLuxuryPalette.ivory.opacity(0.72))
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                Image(systemName: "calendar")
                    .font(.title2)
                    .foregroundStyle(MSHLuxuryPalette.antiqueGold)
            }
            .padding(20)
            .background(
                LinearGradient(
                    colors: [MSHLuxuryPalette.forest, MSHLuxuryPalette.forestDeep],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(alignment: .bottomTrailing) {
                Image(systemName: "leaf")
                    .font(.system(size: 72, weight: .ultraLight))
                    .foregroundStyle(MSHLuxuryPalette.antiqueGold.opacity(0.08))
                    .padding(10)
            }
        }
        .buttonStyle(.plain)
    }
}

private enum MSHLuxuryPalette {
    static let forest = Color(red: 23 / 255, green: 61 / 255, blue: 43 / 255)
    static let forestDeep = Color(red: 12 / 255, green: 37 / 255, blue: 26 / 255)
    static let sage = Color(red: 125 / 255, green: 148 / 255, blue: 96 / 255)
    static let canvas = Color(red: 247 / 255, green: 243 / 255, blue: 234 / 255)
    static let paper = Color(red: 252 / 255, green: 249 / 255, blue: 242 / 255)
    static let ivory = Color(red: 249 / 255, green: 246 / 255, blue: 236 / 255)
    static let ink = Color(red: 37 / 255, green: 40 / 255, blue: 34 / 255)
    static let secondaryInk = Color(red: 82 / 255, green: 84 / 255, blue: 75 / 255)
    static let hairline = Color(red: 216 / 255, green: 211 / 255, blue: 199 / 255)
    static let wine = Color(red: 132 / 255, green: 61 / 255, blue: 68 / 255)
    static let plum = Color(red: 102 / 255, green: 78 / 255, blue: 104 / 255)
    static let antiqueGold = Color(red: 154 / 255, green: 126 / 255, blue: 73 / 255)
}
