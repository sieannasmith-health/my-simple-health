import FirebaseFirestore
import Foundation

struct MSHOnboardingAccountCompletion: Equatable, Sendable {
    let completed: Bool
    let completedAt: Date?
}

protocol MSHOnboardingAccountContinuityRepository: Sendable {
    func completion(for memberID: MSHMemberID) async throws -> MSHOnboardingAccountCompletion?
    func persistCompletion(for memberID: MSHMemberID, completedAt: Date) async throws
}

enum MSHOnboardingContinuityError: Error, Equatable {
    case invalidRecord
}

actor MSHFirestoreOnboardingAccountContinuityRepository: MSHOnboardingAccountContinuityRepository {
    static let recordID = "onboarding-completion-v1"
    static let recordType = "onboarding_completion"

    private let database: Firestore

    init(database: Firestore = Firestore.firestore()) {
        self.database = database
    }

    func completion(for memberID: MSHMemberID) async throws -> MSHOnboardingAccountCompletion? {
        let snapshot = try await document(for: memberID).getDocument()
        guard snapshot.exists else { return nil }
        guard let data = snapshot.data(), Self.isValid(data, memberID: memberID) else {
            throw MSHOnboardingContinuityError.invalidRecord
        }

        guard let completed = data["completed"] as? Bool else {
            throw MSHOnboardingContinuityError.invalidRecord
        }
        let completedAt = (data["completedAt"] as? Timestamp)?.dateValue()
        return MSHOnboardingAccountCompletion(completed: completed, completedAt: completedAt)
    }

    func persistCompletion(for memberID: MSHMemberID, completedAt: Date) async throws {
        let reference = document(for: memberID)
        let snapshot = try await reference.getDocument()

        if snapshot.exists {
            guard let data = snapshot.data(), Self.isValid(data, memberID: memberID) else {
                throw MSHOnboardingContinuityError.invalidRecord
            }
            if data["completed"] as? Bool == true { return }

            try await reference.updateData([
                "completed": true,
                "completedAt": Timestamp(date: completedAt),
                "updatedAt": Timestamp(date: completedAt)
            ])
            return
        }

        let timestamp = Timestamp(date: completedAt)
        try await reference.setData([
            "recordID": Self.recordID,
            "ownerID": memberID.rawValue,
            "domain": MSHCoreDomain.onboarding.rawValue,
            "recordType": Self.recordType,
            "schemaVersion": MSHCoreRecordEnvelope.schemaVersion,
            "provenance": MSHCoreProvenance.userConfirmed.rawValue,
            "authority": MSHCoreAuthority.member.rawValue,
            "lifecycleStatus": MSHCoreLifecycleStatus.active.rawValue,
            "sourceRecordIDs": [],
            "createdAt": timestamp,
            "updatedAt": timestamp,
            "completed": true,
            "completedAt": timestamp
        ])
    }

    private func document(for memberID: MSHMemberID) -> DocumentReference {
        database.document(
            MSHCoreMemberNamespace.recordPath(Self.recordID, memberID: memberID)
        )
    }

    private static func isValid(_ data: [String: Any], memberID: MSHMemberID) -> Bool {
        guard data["recordID"] as? String == Self.recordID,
              data["ownerID"] as? String == memberID.rawValue,
              data["domain"] as? String == MSHCoreDomain.onboarding.rawValue,
              data["recordType"] as? String == Self.recordType,
              data["schemaVersion"] as? String == MSHCoreRecordEnvelope.schemaVersion,
              data["provenance"] as? String == MSHCoreProvenance.userConfirmed.rawValue,
              data["authority"] as? String == MSHCoreAuthority.member.rawValue,
              data["lifecycleStatus"] as? String != MSHCoreLifecycleStatus.deleted.rawValue else {
            return false
        }
        return true
    }
}
