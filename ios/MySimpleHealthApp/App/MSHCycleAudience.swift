import Foundation

enum MSHCycleAudiencePreference: String, CaseIterable, Identifiable {
    case unspecified
    case woman
    case notForMe

    static let storageKey = "msh.profile.cycleAudience"

    var id: Self { self }

    var title: String {
        switch self {
        case .unspecified: "Not set"
        case .woman: "Woman"
        case .notForMe: "Not for me"
        }
    }

    var showsCycle: Bool {
        self == .woman
    }
}
