import Foundation
import SwiftUI

/// Stable route metadata retained for notification compatibility and migration tests.
/// Native app tabs do not render these HTML destinations or create web views.
enum MSHFeatureDestination: String, CaseIterable, Identifiable {
    case myHealth
    case calendar
    case movementPlan
    case movementLibrary
    case cycle
    case medications
    case landscape
    case selfInsight
    case explore
    case horizon
    case path
    case practice
    case discovery
    case journey
    case healthStory
    case food
    case financialHealth

    var id: Self { self }

    var title: String {
        switch self {
        case .myHealth: "My Health"
        case .calendar: "Calendar"
        case .movementPlan: "Plan Movement"
        case .movementLibrary: "Movement Library & Workouts"
        case .cycle: "Cycle"
        case .medications: "Medication Continuity"
        case .landscape: "Landscape"
        case .selfInsight: "Self-Insight"
        case .explore: "Explore"
        case .horizon: "Horizon"
        case .path: "Path"
        case .practice: "Practice"
        case .discovery: "Discovery"
        case .journey: "Journey"
        case .healthStory: "My Health Story"
        case .food: "Food"
        case .financialHealth: "Financial Health"
        }
    }

    var path: String {
        switch self {
        case .myHealth: "my-health.html"
        case .calendar, .movementPlan, .cycle: "calendar.html"
        case .movementLibrary: "movement-library.html"
        case .medications: "medications.html"
        case .landscape: "health-landscape.html"
        case .selfInsight: "assessments.html"
        case .explore: "my-health.html"
        case .horizon: "my-vision.html"
        case .path: "my-project.html"
        case .practice: "my-practice.html"
        case .discovery: "my-learning.html"
        case .journey: "my-progress.html"
        case .healthStory: "my-health-story.html"
        case .food: "my-food.html"
        case .financialHealth: "financial-health.html"
        }
    }

    var query: String? {
        switch self {
        case .movementPlan: "view=movement"
        case .cycle: "view=cycle"
        case .explore: "view=explore"
        default: nil
        }
    }

    var nativeSystemImage: String {
        switch self {
        case .myHealth: "heart.text.square"
        case .calendar: "calendar"
        case .movementPlan: "calendar.badge.plus"
        case .movementLibrary: "figure.run"
        case .cycle: "drop.circle.fill"
        case .medications: "pills.fill"
        case .landscape: "map"
        case .selfInsight: "sparkles.rectangle.stack"
        case .explore: "safari"
        case .horizon: "sun.horizon.fill"
        case .path: "point.topleft.down.to.point.bottomright.curvepath"
        case .practice: "leaf.fill"
        case .discovery: "lightbulb.fill"
        case .journey: "clock.arrow.circlepath"
        case .healthStory: "book.pages"
        case .food: "fork.knife"
        case .financialHealth: "chart.pie.fill"
        }
    }
}

/// Temporary source-compatibility shim for screens that still reference the old
/// feature-screen type name. Despite the historical name, this view is 100% SwiftUI:
/// it does not import WebKit, construct a URL, or load HTML/CSS/JavaScript.
struct MSHWebFeatureScreen: View {
    let destination: MSHFeatureDestination

    var body: some View {
        Group {
            if destination == .myHealth {
                MSHConnectedHealthSourcesView()
            } else {
                MSHNativeLegacyDestinationScreen(destination: destination)
            }
        }
        .accessibilityIdentifier("native-legacy-feature-\(destination.rawValue)")
    }
}

private struct MSHNativeLegacyDestinationScreen: View {
    let destination: MSHFeatureDestination

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: MSHSpacing.large) {
                    Image(systemName: destination.nativeSystemImage)
                        .font(.system(.largeTitle, design: .default, weight: .semibold))
                        .foregroundStyle(MSHColor.accent)
                        .frame(width: 64, height: 64)
                        .background(MSHColor.controlFill)
                        .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))

                    Text(destination.title)
                        .font(MSHTypography.destinationTitle)
                        .foregroundStyle(MSHColor.primaryText)

                    Text("This capability now opens as a native SwiftUI surface. Its website route is kept only as migration metadata and is never rendered inside the app.")
                        .font(MSHTypography.body)
                        .foregroundStyle(MSHColor.secondaryText)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(MSHSpacing.large)
            }
        }
        .navigationTitle(destination.title)
        .navigationBarTitleDisplayMode(.inline)
    }
}
