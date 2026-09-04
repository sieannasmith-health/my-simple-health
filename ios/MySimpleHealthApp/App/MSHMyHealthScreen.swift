import Charts
import SwiftUI

@MainActor
final class MSHMyHealthViewModel: ObservableObject {
    enum LoadState: Equatable {
        case loading
        case loaded(MSHMyHealthSnapshot)
        case failed
    }

    static let recentActivityLimit = 20

    @Published private(set) var loadState: LoadState = .loading
    private let dataSource: any MSHMyHealthDataLoading
    private var hasLoaded = false

    init(dataSource: any MSHMyHealthDataLoading) {
        self.dataSource = dataSource
    }

    convenience init() {
        self.init(dataSource: MSHMyHealthDataSource.live())
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

    init(viewModel: MSHMyHealthViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel)
    }

    init() {
        _viewModel = StateObject(wrappedValue: MSHMyHealthViewModel())
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

    private var doorway: some View {
        VStack(alignment: .leading, spacing: 24) {
            Spacer()

            Text("MY HEALTH")
                .font(.caption.weight(.semibold))
                .tracking(2.4)
                .foregroundStyle(MSHLuxuryPalette.gold)

            Text("Make this space yours.")
                .font(.system(size: 38, weight: .medium, design: .serif))
                .foregroundStyle(MSHLuxuryPalette.ink)

            Text("What should My Simple Health call you?")
                .font(.system(size: 18, design: .serif))
                .foregroundStyle(MSHLuxuryPalette.secondary)

            TextField("First name", text: $pendingName)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .font(.system(.title3, design: .serif))
                .padding(.vertical, 14)
                .overlay(alignment: .bottom) {
                    Rectangle().fill(MSHLuxuryPalette.hairline).frame(height: 1)
                }

            Button("Continue") {
                let trimmed = pendingName.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmed.isEmpty else { return }
                displayName = trimmed
            }
            .buttonStyle(.borderedProminent)
            .tint(MSHLuxuryPalette.forest)
            .disabled(pendingName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

            Spacer()
        }
        .padding(28)
    }

    private var homeContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                header

                switch viewModel.loadState {
                case .loading:
                    ProgressView("Gathering your health context…")
                        .frame(maxWidth: .infinity, alignment: .leading)
                case .failed:
                    failedState
                case .loaded(let snapshot):
                    loadedContent(snapshot)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 36)
        }
        .refreshable { await viewModel.reload() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("MY HEALTH")
                .font(.caption2.weight(.semibold))
                .tracking(2.2)
                .foregroundStyle(MSHLuxuryPalette.gold)
            Text("Your health, in context.")
                .font(.system(size: 36, weight: .medium, design: .serif))
                .foregroundStyle(MSHLuxuryPalette.ink)
            Text("Look across recent Apple Health information without turning your life into a scorecard.")
                .font(.system(.body, design: .serif))
                .foregroundStyle(MSHLuxuryPalette.secondary)
        }
    }

    private var failedState: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Your health information is temporarily unavailable.")
                .font(.system(.headline, design: .serif))
            Button("Try again") { Task { await viewModel.reload() } }
        }
    }

    @ViewBuilder
    private func loadedContent(_ snapshot: MSHMyHealthSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 24) {
            periodPicker
            metricPicker
            chart(for: selectedMetric, snapshot: snapshot)
            areaCards(snapshot)
            recentActivity(snapshot)
        }
    }

    private var periodPicker: some View {
        Picker("Period", selection: $period) {
            ForEach(MSHHealthPeriod.allCases) { value in
                Text(value.title).tag(value)
            }
        }
        .pickerStyle(.segmented)
    }

    private var metricPicker: some View {
        Picker("Metric", selection: $selectedMetric) {
            ForEach(MSHMetricKind.allCases) { metric in
                Text(metric.title).tag(metric)
            }
        }
        .pickerStyle(.menu)
    }

    @ViewBuilder
    private func chart(for metric: MSHMetricKind, snapshot: MSHMyHealthSnapshot) -> some View {
        let points = chartPoints(metric: metric, snapshot: snapshot)
        VStack(alignment: .leading, spacing: 12) {
            Text(metric.title)
                .font(.system(.title2, design: .serif, weight: .semibold))
            if points.isEmpty {
                Text("No recent chartable data.")
                    .foregroundStyle(MSHLuxuryPalette.secondary)
                    .padding(.vertical, 24)
            } else {
                Chart(points) { point in
                    LineMark(x: .value("Date", point.date), y: .value(metric.title, point.value))
                    PointMark(x: .value("Date", point.date), y: .value(metric.title, point.value))
                }
                .frame(height: 220)
            }
        }
    }

    private func areaCards(_ snapshot: MSHMyHealthSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Connected areas")
                .font(.system(.title2, design: .serif, weight: .semibold))
            ForEach(snapshot.areaCards) { card in
                HStack(spacing: 12) {
                    Image(systemName: card.area.systemImage)
                        .frame(width: 30)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(card.area.title).font(.headline)
                        Text(card.stateDescription).font(.caption).foregroundStyle(MSHLuxuryPalette.secondary)
                    }
                    Spacer()
                }
                .padding(.vertical, 8)
            }
        }
    }

    private func recentActivity(_ snapshot: MSHMyHealthSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent activity")
                .font(.system(.title2, design: .serif, weight: .semibold))
            ForEach(snapshot.recentActivity.prefix(12)) { item in
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: item.systemImage).frame(width: 28)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.title).font(.headline)
                        if let detail = item.detail { Text(detail).font(.subheadline) }
                        Text(item.occurredAt, style: .date).font(.caption).foregroundStyle(MSHLuxuryPalette.secondary)
                    }
                    Spacer()
                }
                .padding(.vertical, 5)
            }
        }
    }

    private func chartPoints(metric: MSHMetricKind, snapshot: MSHMyHealthSnapshot) -> [MSHChartPoint] {
        let cutoff = Calendar.current.date(byAdding: .day, value: -period.days, to: Date()) ?? .distantPast
        return snapshot.recentActivity.compactMap { item in
            guard item.occurredAt >= cutoff, metric.includes(item), let value = metric.value(item) else { return nil }
            return MSHChartPoint(date: item.occurredAt, value: value)
        }.sorted { $0.date < $1.date }
    }
}

private enum MSHHealthPeriod: String, CaseIterable, Identifiable {
    case day, week, month
    var id: Self { self }
    var title: String { rawValue.capitalized }
    var days: Int {
        switch self { case .day: 1; case .week: 7; case .month: 30 }
    }
}

private enum MSHMetricKind: String, CaseIterable, Identifiable {
    case sleep, movement, heart, body
    var id: Self { self }
    var title: String { rawValue.capitalized }
    func includes(_ item: MSHRecentHealthActivity) -> Bool {
        switch self {
        case .sleep: item.area == .sleep
        case .movement: item.area == .movement
        case .heart: item.area == .heartActivity
        case .body: item.area == .bodyMeasurements
        }
    }
    func value(_ item: MSHRecentHealthActivity) -> Double? {
        if self == .sleep { return item.durationMinutes }
        return item.numericValue
    }
}

private struct MSHChartPoint: Identifiable {
    let id = UUID()
    let date: Date
    let value: Double
}

private enum MSHLuxuryPalette {
    static let canvas = Color(red: 248 / 255, green: 247 / 255, blue: 243 / 255)
    static let ink = MSHColor.primaryText
    static let secondary = MSHColor.secondaryText
    static let hairline = MSHColor.border
    static let forest = Color(red: 23 / 255, green: 61 / 255, blue: 43 / 255)
    static let gold = Color(red: 174 / 255, green: 144 / 255, blue: 86 / 255)
}
