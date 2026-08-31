import Foundation

enum MSHOnboardingPermissionChoice: String, Codable, Equatable {
    case notAsked
    case requested
    case allowed
    case declined
    case notNow
}

enum MSHOnboardingStartingPoint: String, Codable, CaseIterable, Identifiable {
    case wholeHealth
    case movement
    case cycle
    case medications
    case explore

    var id: Self { self }

    var title: String {
        switch self {
        case .wholeHealth: "My whole health"
        case .movement: "Movement"
        case .cycle: "Cycle"
        case .medications: "Medications"
        case .explore: "Just explore"
        }
    }
}

struct MSHOnboardingState: Codable, Equatable {
    static let currentSchemaVersion = 1

    var schemaVersion = currentSchemaVersion
    var started = false
    var completed = false
    var appleHealthChoice = MSHOnboardingPermissionChoice.notAsked
    var notificationChoice = MSHOnboardingPermissionChoice.notAsked
    var startingPoint: MSHOnboardingStartingPoint?
    var migratedExistingUser = false
}

@MainActor
final class MSHOnboardingStore: ObservableObject {
    static let storageKey = "org.mysimplehealth.onboarding.v1"

    @Published private(set) var state: MSHOnboardingState

    private let defaults: UserDefaults
    private let existingUserDetector: () -> Bool

    init(
        defaults: UserDefaults = .standard,
        existingUserDetector: @escaping () -> Bool = MSHExistingUserDetector.hasExistingNativeHealthState
    ) {
        self.defaults = defaults
        self.existingUserDetector = existingUserDetector

        if let data = defaults.data(forKey: Self.storageKey),
           let decoded = try? JSONDecoder().decode(MSHOnboardingState.self, from: data) {
            state = decoded
        } else if existingUserDetector() {
            // A person who already used the native HealthKit app should not be
            // forced through newly introduced onboarding. This migration does
            // not inspect, rewrite, or remove any health records.
            state = MSHOnboardingState(
                started: true,
                completed: true,
                migratedExistingUser: true
            )
            persist()
        } else {
            state = MSHOnboardingState()
        }
    }

    var shouldPresentOnboarding: Bool { !state.completed }

    func markStarted() {
        guard !state.started else { return }
        state.started = true
        persist()
    }

    func setAppleHealthChoice(_ choice: MSHOnboardingPermissionChoice) {
        state.appleHealthChoice = choice
        persist()
    }

    func setNotificationChoice(_ choice: MSHOnboardingPermissionChoice) {
        state.notificationChoice = choice
        persist()
    }

    func setStartingPoint(_ startingPoint: MSHOnboardingStartingPoint) {
        state.startingPoint = startingPoint
        persist()
    }

    func complete() {
        state.started = true
        state.completed = true
        persist()
    }

    // These methods are the stable state hooks a future Settings surface can
    // use without replaying the full onboarding flow.
    func prepareAppleHealthChoiceForSettingsReview() {
        state.appleHealthChoice = .notAsked
        persist()
    }

    func prepareNotificationChoiceForSettingsReview() {
        state.notificationChoice = .notAsked
        persist()
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(state) else { return }
        defaults.set(data, forKey: Self.storageKey)
    }
}

enum MSHExistingUserDetector {
    static func hasExistingNativeHealthState() -> Bool {
        guard let applicationSupport = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first else { return false }

        let directory = applicationSupport
            .appendingPathComponent("MySimpleHealth", isDirectory: true)
            .appendingPathComponent("ConnectedHealth", isDirectory: true)
        var isDirectory = ObjCBool(false)
        return FileManager.default.fileExists(
            atPath: directory.path,
            isDirectory: &isDirectory
        ) && isDirectory.boolValue
    }
}
