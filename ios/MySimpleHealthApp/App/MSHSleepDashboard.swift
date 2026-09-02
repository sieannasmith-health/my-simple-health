import Charts
import SwiftUI

struct MSHSleepDashboardView: View {
    let activity: [MSHRecentHealthActivity]

    @AppStorage("msh.displayName") private var displayName = ""
    @State private var range: SleepRange = .week
    @State private var showDetails = false

    private var sleepItems: [MSHRecentHealthActivity] {
        activity
            .filter { $0.area == .sleep && ($0.durationMinutes ?? 0) > 0 }
            .sorted { $0.occurredAt < $1.occurredAt }
    }

    private var nights: [SleepNight] {
        SleepNightBuilder.makeNights(from: sleepItems)
    }

    private var latestNight: SleepNight? { nights.last }

    private var visibleNights: [SleepNight] {
        Array(nights.suffix(range.nightCount))
    }

    var body: some View {
        ZStack {
            SleepPalette.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    header

                    if let night = latestNight {
                        latestNightHero(night)
                        stageTimeline(night)
                        stageBreakdown(night)
                        trendSection
                        detailsSection(night)
                    } else {
                        emptyState
                    }
                }
                .padding(.horizontal, 18)
                .padding(.top, 16)
                .padding(.bottom, 40)
            }
        }
        .navigationTitle("Sleep")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(SleepPalette.canvas, for: .navigationBar)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Rectangle()
                    .fill(SleepPalette.gold)
                    .frame(width: 28, height: 1)
                Text("SLEEP")
                    .font(.caption2.weight(.semibold))
                    .tracking(2.3)
                    .foregroundStyle(SleepPalette.gold)
            }

            Text("How was your sleep last night\(displayName.isEmpty ? "?" : ", \(displayName)?")")
                .font(.system(size: 31, weight: .medium, design: .serif))
                .foregroundStyle(SleepPalette.ink)
                .fixedSize(horizontal: false, vertical: true)

            Text("Your Apple Health sleep stages are gathered here as context, not a score.")
                .font(.subheadline)
                .foregroundStyle(SleepPalette.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder
    private func latestNightHero(_ night: SleepNight) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("LAST NIGHT")
                        .font(.caption2.weight(.semibold))
                        .tracking(1.5)
                        .foregroundStyle(SleepPalette.gold)
                    Text(night.totalAsleepText)
                        .font(.system(size: 46, weight: .medium, design: .serif))
                        .foregroundStyle(SleepPalette.ivory)
                    Text("asleep")
                        .font(.subheadline)
                        .foregroundStyle(SleepPalette.ivory.opacity(0.68))
                }

                Spacer()

                Image(systemName: "moon.stars.fill")
                    .font(.system(size: 26, weight: .medium))
                    .foregroundStyle(SleepPalette.gold)
                    .frame(width: 58, height: 58)
                    .background(SleepPalette.ivory.opacity(0.07))
                    .clipShape(Circle())
            }

            HStack(spacing: 0) {
                sleepTimeStat(title: "Fell asleep", value: night.startText)
                Divider()
                    .frame(height: 38)
                    .overlay(SleepPalette.ivory.opacity(0.15))
                sleepTimeStat(title: "Woke up", value: night.endText)
                Divider()
                    .frame(height: 38)
                    .overlay(SleepPalette.ivory.opacity(0.15))
                sleepTimeStat(title: "Awake", value: night.awakeText)
            }
        }
        .padding(22)
        .background(
            LinearGradient(
                colors: [SleepPalette.forest, SleepPalette.forestDeep],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(alignment: .bottomTrailing) {
            Image(systemName: "leaf")
                .font(.system(size: 92, weight: .ultraLight))
                .foregroundStyle(SleepPalette.gold.opacity(0.08))
                .padding(12)
        }
    }

    private func sleepTimeStat(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.caption2)
                .foregroundStyle(SleepPalette.ivory.opacity(0.62))
            Text(value)
                .font(.system(.subheadline, design: .serif, weight: .semibold))
                .foregroundStyle(SleepPalette.ivory)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 8)
    }

    @ViewBuilder
    private func stageTimeline(_ night: SleepNight) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeading("Your night", subtitle: "Sleep stages across the night")

            GeometryReader { proxy in
                let total = max(night.totalWindowMinutes, 1)
                HStack(spacing: 2) {
                    ForEach(night.segments) { segment in
                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                            .fill(segment.stage.color)
                            .frame(width: max(3, proxy.size.width * segment.minutes / total))
                            .accessibilityLabel("\(segment.stage.title), \(SleepFormat.duration(minutes: segment.minutes))")
                    }
                }
            }
            .frame(height: 42)

            HStack(spacing: 14) {
                ForEach(SleepStage.displayOrder) { stage in
                    HStack(spacing: 5) {
                        Circle()
                            .fill(stage.color)
                            .frame(width: 7, height: 7)
                        Text(stage.title)
                            .font(.caption2)
                            .foregroundStyle(SleepPalette.secondary)
                    }
                }
            }
        }
        .padding(20)
        .background(SleepPalette.paper)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(SleepPalette.hairline, lineWidth: 0.8)
        }
    }

    @ViewBuilder
    private func stageBreakdown(_ night: SleepNight) -> some View {
        let columns = [GridItem(.adaptive(minimum: 145), spacing: 12)]

        VStack(alignment: .leading, spacing: 14) {
            sectionHeading("Stages", subtitle: "How the night was distributed")

            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(SleepStage.displayOrder) { stage in
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Circle()
                                .fill(stage.color)
                                .frame(width: 9, height: 9)
                            Text(stage.title.uppercased())
                                .font(.caption2.weight(.semibold))
                                .tracking(1.1)
                                .foregroundStyle(SleepPalette.secondary)
                            Spacer()
                        }

                        Text(SleepFormat.duration(minutes: night.minutes(for: stage)))
                            .font(.system(size: 24, weight: .semibold, design: .serif))
                            .foregroundStyle(SleepPalette.ink)
                    }
                    .padding(16)
                    .background(stage.color.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 19, style: .continuous))
                }
            }
        }
    }

    private var trendSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .bottom) {
                sectionHeading("Sleep over time", subtitle: "Duration by night")
                Spacer()
            }

            sleepRangePicker

            if visibleNights.isEmpty {
                Text("More nights will appear here as Apple Health syncs them.")
                    .font(.subheadline)
                    .foregroundStyle(SleepPalette.secondary)
                    .padding(.vertical, 28)
            } else {
                Chart(visibleNights) { night in
                    BarMark(
                        x: .value("Night", night.date),
                        y: .value("Hours", night.totalAsleepMinutes / 60)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [SleepPalette.plum, SleepPalette.sage],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .cornerRadius(5)
                }
                .frame(height: 190)
                .chartYAxis {
                    AxisMarks(position: .leading, values: .automatic(desiredCount: 4)) { value in
                        AxisGridLine().foregroundStyle(SleepPalette.hairline.opacity(0.65))
                        AxisValueLabel {
                            if let hours = value.as(Double.self) {
                                Text("\(hours.formatted(.number.precision(.fractionLength(0...1))))h")
                                    .font(.caption2)
                                    .foregroundStyle(SleepPalette.secondary)
                            }
                        }
                    }
                }
                .chartXAxis {
                    AxisMarks(values: .automatic(desiredCount: range == .month ? 4 : 7)) { value in
                        AxisValueLabel {
                            if let date = value.as(Date.self) {
                                Text(range.axisLabel(date))
                                    .font(.caption2)
                                    .foregroundStyle(SleepPalette.secondary)
                            }
                        }
                    }
                }
            }
        }
        .padding(20)
        .background(SleepPalette.paper)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(SleepPalette.hairline, lineWidth: 0.8)
        }
    }

    private var sleepRangePicker: some View {
        HStack(spacing: 4) {
            ForEach(SleepRange.allCases) { item in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { range = item }
                } label: {
                    Text(item.rawValue)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(range == item ? SleepPalette.ivory : SleepPalette.secondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 34)
                        .background(range == item ? SleepPalette.forest : .clear)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(SleepPalette.canvas)
        .clipShape(Capsule())
        .overlay { Capsule().stroke(SleepPalette.hairline, lineWidth: 1) }
    }

    @ViewBuilder
    private func detailsSection(_ night: SleepNight) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { showDetails.toggle() }
            } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Apple Health details")
                            .font(.system(.headline, design: .serif))
                            .foregroundStyle(SleepPalette.ink)
                        Text("Individual sleep-stage intervals")
                            .font(.caption)
                            .foregroundStyle(SleepPalette.secondary)
                    }
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(SleepPalette.secondary)
                        .rotationEffect(.degrees(showDetails ? 180 : 0))
                }
                .padding(.vertical, 15)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if showDetails {
                Divider().overlay(SleepPalette.hairline)

                ForEach(Array(night.segments.enumerated()), id: \.element.id) { index, segment in
                    HStack(spacing: 12) {
                        Circle()
                            .fill(segment.stage.color)
                            .frame(width: 10, height: 10)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(segment.stage.title)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(SleepPalette.ink)
                            Text("\(segment.start.formatted(date: .omitted, time: .shortened)) – \(segment.end.formatted(date: .omitted, time: .shortened))")
                                .font(.caption)
                                .foregroundStyle(SleepPalette.secondary)
                        }
                        Spacer()
                        Text(SleepFormat.duration(minutes: segment.minutes))
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(SleepPalette.secondary)
                    }
                    .padding(.vertical, 11)

                    if index < night.segments.count - 1 {
                        Divider().overlay(SleepPalette.hairline.opacity(0.75))
                    }
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Image(systemName: "moon.stars")
                .font(.system(size: 36, weight: .light))
                .foregroundStyle(SleepPalette.plum)
            Text("Sleep will come together here")
                .font(.system(.title2, design: .serif, weight: .semibold))
                .foregroundStyle(SleepPalette.ink)
            Text("Once recent sleep stages arrive from Apple Health, MSH will organize them into nights instead of showing a wall of individual records.")
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(SleepPalette.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
    }

    private func sectionHeading(_ title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.system(.title3, design: .serif, weight: .semibold))
                .foregroundStyle(SleepPalette.ink)
            Text(subtitle)
                .font(.caption)
                .foregroundStyle(SleepPalette.secondary)
        }
    }
}

private enum SleepRange: String, CaseIterable, Identifiable {
    case week = "Week"
    case month = "Month"

    var id: String { rawValue }
    var nightCount: Int { self == .week ? 7 : 30 }

    func axisLabel(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = self == .week ? "EEE" : "MMM d"
        return formatter.string(from: date)
    }
}

private enum SleepStage: String, Identifiable {
    case awake
    case rem
    case core
    case deep
    case asleep

    var id: String { rawValue }

    static let displayOrder: [SleepStage] = [.awake, .rem, .core, .deep]

    var title: String {
        switch self {
        case .awake: "Awake"
        case .rem: "REM"
        case .core: "Core"
        case .deep: "Deep"
        case .asleep: "Asleep"
        }
    }

    var color: Color {
        switch self {
        case .awake: SleepPalette.wine
        case .rem: SleepPalette.plum.opacity(0.72)
        case .core: SleepPalette.sage
        case .deep: SleepPalette.forest
        case .asleep: SleepPalette.gold
        }
    }

    static func parse(_ value: String?) -> SleepStage {
        let stage = (value ?? "").lowercased().replacingOccurrences(of: "_", with: "")
        if stage.contains("awake") { return .awake }
        if stage.contains("rem") { return .rem }
        if stage.contains("core") { return .core }
        if stage.contains("deep") { return .deep }
        return .asleep
    }
}

private struct SleepSegment: Identifiable {
    let id: String
    let start: Date
    let end: Date
    let minutes: Double
    let stage: SleepStage
}

private struct SleepNight: Identifiable {
    let date: Date
    let segments: [SleepSegment]

    var id: Date { date }

    var start: Date { segments.first?.start ?? date }
    var end: Date { segments.last?.end ?? date }

    var totalWindowMinutes: Double {
        max(0, end.timeIntervalSince(start) / 60)
    }

    var totalAsleepMinutes: Double {
        segments
            .filter { $0.stage != .awake }
            .reduce(0) { $0 + $1.minutes }
    }

    var totalAsleepText: String { SleepFormat.duration(minutes: totalAsleepMinutes) }
    var awakeText: String { SleepFormat.duration(minutes: minutes(for: .awake)) }
    var startText: String { start.formatted(date: .omitted, time: .shortened) }
    var endText: String { end.formatted(date: .omitted, time: .shortened) }

    func minutes(for stage: SleepStage) -> Double {
        segments.filter { $0.stage == stage }.reduce(0) { $0 + $1.minutes }
    }
}

private enum SleepNightBuilder {
    static func makeNights(from items: [MSHRecentHealthActivity]) -> [SleepNight] {
        var grouped: [Date: [SleepSegment]] = [:]
        let calendar = Calendar.current

        for item in items {
            guard let minutes = item.durationMinutes, minutes > 0 else { continue }
            let start = item.occurredAt
            let end = start.addingTimeInterval(minutes * 60)
            let stage = SleepStage.parse(item.sleepStage)

            var components = calendar.dateComponents([.year, .month, .day], from: start)
            if calendar.component(.hour, from: start) < 12,
               let prior = calendar.date(byAdding: .day, value: -1, to: start) {
                components = calendar.dateComponents([.year, .month, .day], from: prior)
            }
            let nightDate = calendar.date(from: components) ?? calendar.startOfDay(for: start)

            grouped[nightDate, default: []].append(
                SleepSegment(
                    id: item.id,
                    start: start,
                    end: end,
                    minutes: minutes,
                    stage: stage
                )
            )
        }

        return grouped.keys.sorted().map { date in
            SleepNight(
                date: date,
                segments: grouped[date, default: []].sorted { $0.start < $1.start }
            )
        }
    }
}

private enum SleepFormat {
    static func duration(minutes: Double) -> String {
        let total = max(0, Int(minutes.rounded()))
        let hours = total / 60
        let mins = total % 60
        if hours == 0 { return "\(mins)m" }
        if mins == 0 { return "\(hours)h" }
        return "\(hours)h \(mins)m"
    }
}

private enum SleepPalette {
    static let forest = Color(red: 23 / 255, green: 61 / 255, blue: 43 / 255)
    static let forestDeep = Color(red: 12 / 255, green: 37 / 255, blue: 26 / 255)
    static let sage = Color(red: 125 / 255, green: 148 / 255, blue: 96 / 255)
    static let canvas = Color(red: 247 / 255, green: 243 / 255, blue: 234 / 255)
    static let paper = Color(red: 252 / 255, green: 249 / 255, blue: 242 / 255)
    static let ivory = Color(red: 249 / 255, green: 246 / 255, blue: 236 / 255)
    static let ink = Color(red: 37 / 255, green: 40 / 255, blue: 34 / 255)
    static let secondary = Color(red: 82 / 255, green: 84 / 255, blue: 75 / 255)
    static let hairline = Color(red: 216 / 255, green: 211 / 255, blue: 199 / 255)
    static let wine = Color(red: 132 / 255, green: 61 / 255, blue: 68 / 255)
    static let plum = Color(red: 102 / 255, green: 78 / 255, blue: 104 / 255)
    static let gold = Color(red: 154 / 255, green: 126 / 255, blue: 73 / 255)
}
