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

    init(viewModel: MSHMyHealthViewModel = MSHMyHealthViewModel()) {
        _viewModel = StateObject(wrappedValue: viewModel)
    }

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: MSHSpacing.xLarge) {
                    header

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
        .task { await viewModel.loadIfNeeded() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.small) {
            Text("My Health")
                .font(MSHTypography.destinationTitle)
                .foregroundStyle(MSHColor.primaryText)
            Text("Your current picture, brought together gently and privately on this iPhone.")
                .font(MSHTypography.body)
                .foregroundStyle(MSHColor.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
            MSHAppleHealthStatusCard(status: snapshot.appleHealth)

            MSHSection(title: "Health areas", subtitle: "The areas you choose to bring into My Health.") {
                VStack(spacing: MSHSpacing.small) {
                    ForEach(snapshot.areaCards) { card in
                        MSHHealthAreaCard(model: card)
                    }
                }
            }

            MSHSection(title: "Recent health activity", subtitle: "A small, recent view—not your full history.") {
                MSHRecentHealthActivityList(activity: snapshot.recentActivity)
            }

            MSHComingUpCard()
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
                    .background(MSHColor.sage.opacity(0.16))
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
                            .background(MSHColor.sage.opacity(0.14))
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
                .background(MSHColor.sage.opacity(model.isSelected ? 0.16 : 0.08))
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

private struct MSHRecentHealthActivityList: View {
    let activity: [MSHRecentHealthActivity]

    var body: some View {
        VStack(spacing: 0) {
            if activity.isEmpty {
                VStack(spacing: MSHSpacing.small) {
                    Image(systemName: "clock")
                        .font(.title2)
                        .foregroundStyle(MSHColor.secondaryText)
                    Text("No recent Apple Health activity to show yet.")
                        .font(MSHTypography.body)
                        .foregroundStyle(MSHColor.secondaryText)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(MSHSpacing.large)
                .accessibilityIdentifier("recent-health-activity-empty")
            } else {
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
                .padding(.horizontal, MSHSpacing.medium)
            }
        }
        .background(MSHColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous)
                .stroke(MSHColor.border, lineWidth: 1)
        }
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
