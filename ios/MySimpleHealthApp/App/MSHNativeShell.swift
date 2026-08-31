import SwiftUI

enum MSHAppSection: String, CaseIterable, Identifiable {
    case myHealth
    case calendar
    case movement
    case track
    case tools

    var id: Self { self }

    var title: String {
        switch self {
        case .myHealth: "My Health"
        case .calendar: "Calendar"
        case .movement: "Movement"
        case .track: "Track"
        case .tools: "Tools"
        }
    }

    var systemImage: String {
        switch self {
        case .myHealth: "heart.text.square"
        case .calendar: "calendar"
        case .movement: "figure.walk.motion"
        case .track: "plus.circle"
        case .tools: "square.grid.2x2"
        }
    }

    var introduction: String {
        switch self {
        case .myHealth:
            "Your personal health picture will come together here."
        case .calendar:
            "A calm view of what is happening across your health over time."
        case .movement:
            "Movement, workouts, and activity context will live here."
        case .track:
            "A simple place to record experiences that matter to you."
        case .tools:
            "Personal tools and resources will be available here."
        }
    }
}

struct MSHAppShell: View {
    @State private var selection: MSHAppSection = .myHealth

    var body: some View {
        TabView(selection: $selection) {
            ForEach(MSHAppSection.allCases) { section in
                MSHSectionNavigation(section: section)
                    .tabItem {
                        Label(section.title, systemImage: section.systemImage)
                    }
                    .tag(section)
            }
        }
        .tint(MSHColor.accent)
        .toolbarBackground(MSHColor.surface, for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
    }
}

private struct MSHSectionNavigation: View {
    let section: MSHAppSection

    var body: some View {
        NavigationStack {
            MSHDestinationScreen(section: section)
                .navigationTitle(section.title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    if section == .myHealth {
                        ToolbarItem(placement: .topBarTrailing) {
                            NavigationLink {
                                MSHProfileSettingsScreen()
                            } label: {
                                Image(systemName: "person.crop.circle")
                                    .accessibilityLabel("Profile and Settings")
                            }
                        }
                    }
                }
        }
    }
}

private struct MSHDestinationScreen: View {
    let section: MSHAppSection

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: MSHSpacing.large) {
                    VStack(alignment: .leading, spacing: MSHSpacing.medium) {
                        Image(systemName: section.systemImage)
                            .font(.system(size: 30, weight: .medium))
                            .foregroundStyle(MSHColor.accent)
                            .frame(width: 56, height: 56)
                            .background(MSHColor.sage.opacity(0.18))
                            .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))

                        Text(section.title)
                            .font(MSHTypography.destinationTitle)
                            .foregroundStyle(MSHColor.primaryText)

                        Text(section.introduction)
                            .font(MSHTypography.body)
                            .foregroundStyle(MSHColor.secondaryText)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .mshSurface()

                    Text("This native space is ready for the next stage of the iPhone experience.")
                        .font(.footnote)
                        .foregroundStyle(MSHColor.secondaryText)
                        .padding(.horizontal, MSHSpacing.small)
                }
                .padding(MSHSpacing.medium)
            }
        }
    }
}

struct MSHProfileSettingsScreen: View {
    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: MSHSpacing.large) {
                    VStack(alignment: .leading, spacing: MSHSpacing.medium) {
                        Image(systemName: "person.crop.circle")
                            .font(.system(size: 30, weight: .medium))
                            .foregroundStyle(MSHColor.accent)

                        Text("Profile & Settings")
                            .font(MSHTypography.destinationTitle)
                            .foregroundStyle(MSHColor.primaryText)

                        Text("Your profile, preferences, privacy, and app settings will live here.")
                            .font(MSHTypography.body)
                            .foregroundStyle(MSHColor.secondaryText)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .mshSurface()
                }
                .padding(MSHSpacing.medium)
            }
        }
        .navigationTitle("Profile & Settings")
        .navigationBarTitleDisplayMode(.inline)
    }
}
