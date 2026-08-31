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
        } else {
            // Existing device health state is remembered, but it no longer
            // bypasses onboarding. Account identity and onboarding are now
            // explicit gates before a person enters the MSH app shell.
            state = MSHOnboardingState(
                migratedExistingUser: existingUserDetector()
            )
            persist()
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
