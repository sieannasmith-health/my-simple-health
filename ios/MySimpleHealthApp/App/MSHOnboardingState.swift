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
    static let accountStorageKeyPrefix = "org.mysimplehealth.onboarding.account.v1"
    static let legacyClaimedOwnerKey = "org.mysimplehealth.onboarding.v1.claimed-owner"
    static let legacyDeclinedOwnerKeyPrefix = "org.mysimplehealth.onboarding.v1.declined-owner"

    @Published private(set) var state: MSHOnboardingState

    private let defaults: UserDefaults
    private let existingUserDetector: () -> Bool
    private let memberID: MSHMemberID?
    private let persistenceKey: String

    init(
        defaults: UserDefaults = .standard,
        existingUserDetector: @escaping () -> Bool = MSHExistingUserDetector.hasExistingNativeHealthState,
        memberID: MSHMemberID? = nil
    ) {
        self.defaults = defaults
        self.existingUserDetector = existingUserDetector
        self.memberID = memberID
        self.persistenceKey = memberID.map(Self.accountStorageKey(for:)) ?? Self.storageKey

        if let data = defaults.data(forKey: persistenceKey),
           var decoded = try? JSONDecoder().decode(MSHOnboardingState.self, from: data) {
            Self.upgradeIfNeeded(&decoded)
            state = decoded
            persist()
            return
        }

        if memberID != nil {
            // Authenticated account state starts fresh unless that exact UID already has
            // account-scoped state or canonical Firestore completion. Ambiguous legacy
            // device state must never silently authorize whichever account signs in first.
            state = MSHOnboardingState()
            persist()
            return
        }

        let isExistingUser = existingUserDetector()
        state = MSHOnboardingState(
            completed: isExistingUser,
            migratedExistingUser: isExistingUser
        )
        persist()
    }

    var shouldPresentOnboarding: Bool { !state.completed }

    var hasUnclaimedLegacyCompletion: Bool {
        guard let memberID,
              !state.completed,
              !isLegacyDeclined(for: memberID),
              Self.canClaimLegacyState(for: memberID, defaults: defaults),
              let data = defaults.data(forKey: Self.storageKey),
              var legacyState = try? JSONDecoder().decode(MSHOnboardingState.self, from: data) else {
            return false
        }
        Self.upgradeIfNeeded(&legacyState)
        return legacyState.completed
    }

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

    func restoreAccountCompletion() {
        guard !state.completed else { return }
        state.started = true
        state.completed = true
        persist()
    }

    @discardableResult
    func claimLegacyCompletionForCurrentAccount() -> Bool {
        guard let memberID,
              hasUnclaimedLegacyCompletion,
              let data = defaults.data(forKey: Self.storageKey),
              var legacyState = try? JSONDecoder().decode(MSHOnboardingState.self, from: data) else {
            return false
        }

        Self.upgradeIfNeeded(&legacyState)
        guard legacyState.completed else { return false }

        // This assignment happens only after an explicit member confirmation in the UI.
        state = legacyState
        defaults.set(memberID.rawValue, forKey: Self.legacyClaimedOwnerKey)
        defaults.removeObject(forKey: Self.legacyDeclinedOwnerKey(for: memberID))
        persist()
        return true
    }

    func declineLegacyCompletionForCurrentAccount() {
        guard let memberID else { return }
        defaults.set(true, forKey: Self.legacyDeclinedOwnerKey(for: memberID))
    }

    func prepareAppleHealthChoiceForSettingsReview() {
        state.appleHealthChoice = .notAsked
        persist()
    }

    func prepareNotificationChoiceForSettingsReview() {
        state.notificationChoice = .notAsked
        persist()
    }

    static func accountStorageKey(for memberID: MSHMemberID) -> String {
        "\(accountStorageKeyPrefix).\(memberID.rawValue)"
    }

    static func legacyDeclinedOwnerKey(for memberID: MSHMemberID) -> String {
        "\(legacyDeclinedOwnerKeyPrefix).\(memberID.rawValue)"
    }

    private func isLegacyDeclined(for memberID: MSHMemberID) -> Bool {
        defaults.bool(forKey: Self.legacyDeclinedOwnerKey(for: memberID))
    }

    private static func canClaimLegacyState(for memberID: MSHMemberID, defaults: UserDefaults) -> Bool {
        guard let claimedOwner = defaults.string(forKey: legacyClaimedOwnerKey) else { return true }
        return claimedOwner == memberID.rawValue
    }

    private static func upgradeIfNeeded(_ state: inout MSHOnboardingState) {
        if state.schemaVersion < MSHOnboardingState.currentSchemaVersion {
            state.schemaVersion = MSHOnboardingState.currentSchemaVersion
        }
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(state) else { return }
        defaults.set(data, forKey: persistenceKey)
    }
}

@MainActor
enum MSHOnboardingStoreFactory {
#if DEBUG
    static let freshOnboardingTestArgument = "-MSHFreshOnboardingTest"
    static let resetFreshOnboardingTestArgument = "-MSHResetFreshOnboardingTest"
    static let freshOnboardingTestSuiteName = "org.mysimplehealth.onboarding.fresh-test"
#endif

    static func make(
        arguments: [String] = ProcessInfo.processInfo.arguments,
        memberID: MSHMemberID? = nil
    ) -> MSHOnboardingStore {
#if DEBUG
        if arguments.contains(freshOnboardingTestArgument),
           let defaults = UserDefaults(suiteName: freshOnboardingTestSuiteName) {
            if arguments.contains(resetFreshOnboardingTestArgument) {
                defaults.removePersistentDomain(forName: freshOnboardingTestSuiteName)
            }
            return MSHOnboardingStore(
                defaults: defaults,
                existingUserDetector: { false }
            )
        }
#endif
        return MSHOnboardingStore(memberID: memberID)
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
