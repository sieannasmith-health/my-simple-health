import SwiftUI

@MainActor
struct MSHMyHealthHomeScreen: View {
    @StateObject private var viewModel: MSHMyHealthViewModel
    @EnvironmentObject private var authStore: MSHAuthStore
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
        .task {
            seedDisplayNameIfNeeded()
            await viewModel.loadIfNeeded()
        }
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

            Text(greetingLine)
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

    @ViewBuilder
    private func interpretedContent(_ snapshot: MSHMyHealthSnapshot) -> some View {
        let sleep = summary(for: .sleep, in: snapshot.recentActivity)
        let movement = summary(for: .movement, in: snapshot.recentActivity)
        let heart = summary(for: .heartActivity, in: snapshot.recentActivity)

        VStack(alignment: .leading, spacing: 28) {
            if !snapshot.appleHealth.isConnected {
                MSHAppleHealthProgressiveSetupCard {
                    await viewModel.reload()
                }
            }

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
                            .foregroundStyle(MSHHomePalette.ivory.opacity(0.78))
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
                            .foregroundStyle(MSHColor.accent)
                            .frame(width: 42, height: 42)
                            .background(MSHColor.accent.opacity(0.10))
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
            ProgressView().tint(MSHColor.accent)
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

private struct MSHAppleHealthProgressiveSetupCard: View {
    @AppStorage("msh.appleHealth.progressiveSetup.dismissed") private var isDismissed = false
    @State private var isWorking = false
    @State private var errorMessage: String?

    let onConnected: @MainActor () async -> Void

    var body: some View {
        if !isDismissed {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top, spacing: 14) {
                    Image(systemName: "heart.text.square")
                        .font(.system(size: 19, weight: .semibold))
                        .foregroundStyle(MSHHomePalette.wine)
                        .frame(width: 42, height: 42)
                        .background(MSHHomePalette.wine.opacity(0.10))
                        .clipShape(Circle())

                    VStack(alignment: .leading, spacing: 5) {
                        Text("Bring in Apple Health when you’re ready")
                            .font(.system(.headline, design: .serif))
                            .foregroundStyle(MSHHomePalette.ink)
                        Text("MSH works without it. Connecting can add movement, sleep, heart, and body context to My Health. You choose what Apple Health shares.")
                            .font(.subheadline)
                            .foregroundStyle(MSHHomePalette.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                HStack(spacing: 12) {
                    Button {
                        connect()
                    } label: {
                        HStack(spacing: 8) {
                            if isWorking { ProgressView().tint(MSHHomePalette.ivory) }
                            Text(isWorking ? "Connecting…" : "Connect Apple Health")
                        }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(MSHHomePalette.ivory)
                        .frame(maxWidth: .infinity, minHeight: 46)
                        .background(MSHHomePalette.forest)
                        .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(isWorking)
                    .accessibilityIdentifier("apple-health-progressive-connect")

                    Button("Not now") {
                        isDismissed = true
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(MSHHomePalette.secondary)
                    .frame(minHeight: 46)
                    .disabled(isWorking)
                    .accessibilityIdentifier("apple-health-progressive-dismiss")
                }
            }
            .padding(18)
            .background(MSHColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(MSHHomePalette.hairline, lineWidth: 1)
            }
            .alert("Apple Health couldn’t connect", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "Please try again when you’re ready.")
            }
        }
    }

    private func connect() {
        guard !isWorking else { return }
        isWorking = true
        Task { @MainActor in
            do {
                let result = try await MSHAppleHealthRuntime.connectForProgressiveSetup()
                if result.outcome == .completed {
                    isDismissed = true
                    await onConnected()
                }
                isWorking = false
            } catch {
                isWorking = false
                errorMessage = error.localizedDescription
            }
        }
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
                .background(accent.opacity(0.13))
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
    static let ink = MSHColor.primaryText
    static let secondary = MSHColor.secondaryText
    static let hairline = MSHColor.border
    static let wine = Color(red: 170 / 255, green: 82 / 255, blue: 91 / 255)
    static let plum = Color(red: 132 / 255, green: 102 / 255, blue: 136 / 255)
    static let gold = Color(red: 174 / 255, green: 144 / 255, blue: 86 / 255)
}
