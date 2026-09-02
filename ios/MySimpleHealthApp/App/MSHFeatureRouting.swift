import Foundation

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
}
