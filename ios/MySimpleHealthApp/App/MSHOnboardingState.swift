import Foundation

// Existing onboarding choices remain device/OS state and are intentionally not account Core data.
enum MSHOnboardingPermissionChoice: String, Codable, Equatable {
    case notAsked, requested, allowed, declined, notNow
}

enum MSHOnboardingStartingPoint: String, Codable, CaseIterable, Identifiable {
    case wholeHealth, movement, cycle, medications, explore
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
    static let currentSchemaVersion = 2
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

    init(defaults: UserDefaults = .standard,
         existingUserDetector: @escaping () -> Bool = MSHExistingUserDetector.hasExistingNativeHealthState) {
        self.defaults = defaults; self.existingUserDetector = existingUserDetector
        if let data = defaults.data(forKey: Self.storageKey), var decoded = try? JSONDecoder().decode(MSHOnboardingState.self, from: data) {
            if decoded.schemaVersion < MSHOnboardingState.currentSchemaVersion { decoded.schemaVersion = MSHOnboardingState.currentSchemaVersion }
            state = decoded; persist()
        } else {
            let existing = existingUserDetector()
            state = MSHOnboardingState(completed: existing, migratedExistingUser: existing); persist()
        }
    }

    var shouldPresentOnboarding: Bool { !state.completed }
    func markStarted() { guard !state.started else { return }; state.started = true; persist() }
    func setAppleHealthChoice(_ choice: MSHOnboardingPermissionChoice) { state.appleHealthChoice = choice; persist() }
    func setNotificationChoice(_ choice: MSHOnboardingPermissionChoice) { state.notificationChoice = choice; persist() }
    func setStartingPoint(_ startingPoint: MSHOnboardingStartingPoint) { state.startingPoint = startingPoint; persist() }
    func complete() { state.started = true; state.completed = true; persist() }
    func prepareAppleHealthChoiceForSettingsReview() { state.appleHealthChoice = .notAsked; persist() }
    func prepareNotificationChoiceForSettingsReview() { state.notificationChoice = .notAsked; persist() }

    /// Restores only completion, and only from the repository bound to the active UID.
    func restoreAccountCompletion(using service: MSHOnboardingContinuityService, memberID: MSHMemberID) async throws {
        guard !state.completed, let record = try await service.restore(for: memberID), record.completed else { return }
        state.started = true; state.completed = true; persist()
    }

    /// Migration is deliberately non-destructive: local completion is retained if the
    /// account write fails, allowing a later retry without replaying onboarding.
    func migrateAccountCompletion(using service: MSHOnboardingContinuityService, memberID: MSHMemberID) async throws {
        try await service.migrateIfNeeded(ownerID: memberID, localCompleted: state.completed)
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(state) else { return }
        defaults.set(data, forKey: Self.storageKey)
    }
}

@MainActor
enum MSHOnboardingStoreFactory {
#if DEBUG
    static let freshOnboardingTestArgument = "-MSHFreshOnboardingTest"
    static let resetFreshOnboardingTestArgument = "-MSHResetFreshOnboardingTest"
    static let freshOnboardingTestSuiteName = "org.mysimplehealth.onboarding.fresh-test"
#endif
    static func make(arguments: [String] = ProcessInfo.processInfo.arguments) -> MSHOnboardingStore {
#if DEBUG
        if arguments.contains(freshOnboardingTestArgument), let defaults = UserDefaults(suiteName: freshOnboardingTestSuiteName) {
            if arguments.contains(resetFreshOnboardingTestArgument) { defaults.removePersistentDomain(forName: freshOnboardingTestSuiteName) }
            return MSHOnboardingStore(defaults: defaults, existingUserDetector: { false })
        }
#endif
        return MSHOnboardingStore()
    }
}

enum MSHExistingUserDetector {
    static func hasExistingNativeHealthState() -> Bool {
        guard let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return false }
        let directory = applicationSupport.appendingPathComponent("MySimpleHealth", isDirectory: true).appendingPathComponent("ConnectedHealth", isDirectory: true)
        var isDirectory = ObjCBool(false)
        return FileManager.default.fileExists(atPath: directory.path, isDirectory: &isDirectory) && isDirectory.boolValue
    }
}