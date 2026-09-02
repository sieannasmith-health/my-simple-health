import SwiftUI

@MainActor
struct MSHMyHealthHomeScreen: View {
    @StateObject private var viewModel: MSHMyHealthViewModel
    @AppStorage("msh.displayName") private var displayName = ""

    init(viewModel: MSHMyHealthViewModel = MSHMyHealthViewModel()) {
        _viewModel = StateObject(wrappedValue: viewModel)
    }

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 30) {
                    header

                    switch viewModel.loadState {
                    case .loading:
                        loading
                    case .loaded(let snapshot):
                        interpretedContent(snapshot)
                    case .failed:
                        failed
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 36)
            }
            .refreshable { await viewModel.reload() }
        }
        .task { await viewModel.loadIfNeeded() }
        .accessibilityIdentifier("my-health-home")
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Rectangle()
                    .fill(MSHHomePalette.gold)
                    .frame(width: 28, height: 1)
                Text("MY HEALTH")
                    .font(.caption2.weight(.semibold))
                    .tracking(2.4)
                    .foregroundStyle(MSHHomePalette.gold)
            }

            Text("\(greeting), \(displayName.isEmpty ? "there" : displayName).")
                .font(.system(size: 37, weight: .medium, design: .serif))
                .foregroundStyle(MSHHomePalette.ink)
                .minimumScaleFactor(0.78)

            Text("Here’s what matters today.")
                .font(.system(size: 18, design: .serif))
                .foregroundStyle(MSHHomePalette.secondary)
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

    @ViewBuilder
    private func interpretedContent(_ snapshot: MSHMyHealthSnapshot) -> some View {
        let sleep = summary(for: .sleep, in: snapshot.recentActivity)
        let movement = summary(for: .movement, in: snapshot.recentActivity)
        let heart = summary(for: .heartActivity, in: snapshot.recentActivity)

        VStack(alignment: .leading, spacing: 28) {
            VStack(alignment: .leading, spacing: 0) {
                MSHHomeSummaryRow(
                    title: "Sleep",
                    value: sleep.value,
                    context: sleep.context,
                    icon: "moon.stars.fill",
                    accent: MSHHomePalette.plum
                )

                divider

                MSHHomeSummaryRow(
                    title: "Movement",
                    value: movement.value,
                    context: movement.context,
                    icon: "figure.walk.motion",
                    accent: MSHHomePalette.sage
                )

                divider

                MSHHomeSummaryRow(
                    title: "Heart",
                    value: heart.value,
                    context: heart.context,
                    icon: "heart.fill",
                    accent: MSHHomePalette.wine
                )
            }

            NavigationLink {
                MSHImmediateDestination(title: "Explore Your Health") {
                    MSHMyHealthScreen(viewModel: viewModel)
                }
            } label: {
                HStack(spacing: 14) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("EXPLORE YOUR HEALTH")
                            .font(.caption2.weight(.semibold))
                            .tracking(1.7)
                            .foregroundStyle(MSHHomePalette.gold)
                        Text("See the data behind your health")
                            .font(.system(.title3, design: .serif, weight: .semibold))
                            .foregroundStyle(MSHHomePalette.ivory)
                        Text("Open Day, Week, and Month charts, Apple Health measurements, Sleep, Heart, Movement, and Body details.")
                            .font(.caption)
                            .foregroundStyle(MSHHomePalette.ivory.opacity(0.72))
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    Spacer(minLength: 10)

                    Image(systemName: "chart.xyaxis.line")
                        .font(.title2)
                        .foregroundStyle(MSHHomePalette.gold)
                }
                .padding(20)
                .background(
                    LinearGradient(
                        colors: [MSHHomePalette.forest, MSHHomePalette.forestDeep],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: 25, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("explore-your-health")

            VStack(alignment: .leading, spacing: 10) {
                Text("TODAY")
                    .font(.caption2.weight(.semibold))
                    .tracking(1.7)
                    .foregroundStyle(MSHHomePalette.gold)

                NavigationLink {
                    MSHWebFeatureScreen(destination: .calendar)
                } label: {
                    HStack(spacing: 15) {
                        Image(systemName: "calendar")
                            .font(.title3)
                            .foregroundStyle(MSHHomePalette.forest)
                            .frame(width: 42, height: 42)
                            .background(MSHHomePalette.forest.opacity(0.08))
                            .clipShape(Circle())

                        VStack(alignment: .leading, spacing: 3) {
                            Text("What’s coming up")
                                .font(.system(.headline, design: .serif))
                                .foregroundStyle(MSHHomePalette.ink)
                            Text("Calendar owns appointments, planned movement, medication actions, cycle events, and other dated health activity.")
                                .font(.caption)
                                .foregroundStyle(MSHHomePalette.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        Spacer(minLength: 6)
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(MSHHomePalette.secondary)
                    }
                    .padding(.vertical, 8)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }

            Text("My Health interprets. Detailed measurements stay one level deeper so your first screen remains about understanding, not monitoring.")
                .font(.footnote)
                .foregroundStyle(MSHHomePalette.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var divider: some View {
        Rectangle()
            .fill(MSHHomePalette.hairline)
            .frame(height: 1)
            .padding(.leading, 50)
    }

    private var loading: some View {
        HStack(spacing: 12) {
            ProgressView().tint(MSHHomePalette.forest)
            Text("Gathering today’s context…")
                .font(.system(.body, design: .serif))
                .foregroundStyle(MSHHomePalette.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 24)
    }

    private var failed: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Your health overview is temporarily unavailable")
                .font(.system(.headline, design: .serif))
                .foregroundStyle(MSHHomePalette.ink)
            Text("Pull down to try again. Your records remain on this iPhone.")
                .font(.subheadline)
                .foregroundStyle(MSHHomePalette.secondary)
        }
        .padding(.vertical, 14)
    }

    private func summary(
        for area: MSHHealthArea,
        in activity: [MSHRecentHealthActivity]
    ) -> (value: String, context: String) {
        let items = activity
            .filter { $0.area == area }
            .sorted { $0.occurredAt > $1.occurredAt }

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
            let minutes = asleep
                .filter { sleepNightAnchor(for: $0.occurredAt) == latestNight }
                .compactMap(\.durationMinutes)
                .reduce(0, +)
            return (
                duration(minutes: minutes),
                "Your recent sleep is here as context. Open the deeper view when you want the stages and trend."
            )

        case .movement:
            return (
                displayValue(latest),
                "Your latest movement measurement is available without turning the home screen into a performance score."
            )

        case .heartActivity:
            return (
                displayValue(latest),
                "This is your latest heart context. The full range and trend live in Explore Your Health."
            )

        case .bodyMeasurements:
            return (displayValue(latest), "Recent body context is available in the deeper data view.")
        }
    }

    private func sleepNightAnchor(for date: Date) -> Date {
        let calendar = Calendar.current
        let hour = calendar.component(.hour, from: date)
        let shifted = hour < 12
            ? (calendar.date(byAdding: .day, value: -1, to: date) ?? date)
            : date
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

private struct MSHHomeSummaryRow: View {
    let title: String
    let value: String
    let context: String
    let icon: String
    let accent: Color

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(accent)
                .frame(width: 36, height: 36)
                .background(accent.opacity(0.09))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .firstTextBaseline) {
                    Text(title)
                        .font(.system(.headline, design: .serif))
                        .foregroundStyle(MSHHomePalette.ink)
                    Spacer()
                    Text(value)
                        .font(.system(.subheadline, design: .serif, weight: .semibold))
                        .foregroundStyle(MSHHomePalette.ink)
                        .multilineTextAlignment(.trailing)
                }

                Text(context)
                    .font(.caption)
                    .foregroundStyle(MSHHomePalette.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 15)
    }
}

private enum MSHHomePalette {
    static let forest = Color(red: 23 / 255, green: 61 / 255, blue: 43 / 255)
    static let forestDeep = Color(red: 12 / 255, green: 37 / 255, blue: 26 / 255)
    static let sage = Color(red: 125 / 255, green: 148 / 255, blue: 96 / 255)
    static let ivory = Color(red: 249 / 255, green: 246 / 255, blue: 236 / 255)
    static let ink = Color(red: 37 / 255, green: 40 / 255, blue: 34 / 255)
    static let secondary = Color(red: 82 / 255, green: 84 / 255, blue: 75 / 255)
    static let hairline = Color(red: 216 / 255, green: 211 / 255, blue: 199 / 255)
    static let wine = Color(red: 132 / 255, green: 61 / 255, blue: 68 / 255)
    static let plum = Color(red: 102 / 255, green: 78 / 255, blue: 104 / 255)
    static let gold = Color(red: 154 / 255, green: 126 / 255, blue: 73 / 255)
}
