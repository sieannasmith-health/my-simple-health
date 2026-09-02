#if os(iOS)
import Foundation
import HealthKit
import MSHHealthCore

#if DEBUG
private func mshProviderDiagnostic(_ event: String, _ details: String = "") {
    let suffix = details.isEmpty ? "" : " \(details)"
    print("[MSHHealthDiagnostic] component=provider event=\(event)\(suffix)")
}
#else
private func mshProviderDiagnostic(_ event: String, _ details: String = "") {}
#endif

public final class AppleHealthKitProvider: @unchecked Sendable, HealthDataProvider {
    public let provider = HealthProvider.appleHealth
    private let store: HKHealthStore
    private let calendar: Calendar
    private static let anchoredQueryLimit = 750

    public init(store: HKHealthStore = HKHealthStore(), calendar: Calendar = .autoupdatingCurrent) {
        self.store = store
        self.calendar = calendar
    }

    public func availability() -> HealthProviderAvailability {
        HKHealthStore.isHealthDataAvailable() ? .available : .unavailable
    }

    public func requestAuthorization(for areas: Set<HealthDataArea>) async -> HealthAuthorizationResult {
        guard availability() == .available else {
            return HealthAuthorizationResult(outcome: .failed, requestedAreas: areas, message: "Apple Health is not available on this device.")
        }
        let readTypes = Set<HKObjectType>(Self.descriptors.filter { areas.contains($0.area) }.map { $0.sampleType })
        do {
            // Phase 1 is read-only. A completed request does not imply that any
            // particular read permission was granted; HealthKit intentionally
            // does not disclose that status to apps.
            try await store.requestAuthorization(toShare: [], read: readTypes)
            return HealthAuthorizationResult(outcome: .completed, requestedAreas: areas)
        } catch {
            return HealthAuthorizationResult(outcome: .failed, requestedAreas: areas, message: "Apple Health authorization could not be completed.")
        }
    }

    public func sync(_ request: HealthSyncRequest) async throws -> HealthSyncBatch {
        guard availability() == .available else { throw AppleHealthKitError.unavailable }
        mshProviderDiagnostic("sync_start", "areas=\(request.areas.map(\.rawValue).sorted().joined(separator: ",")) checkpointCount=\(request.checkpoints.count) firstSync=\(request.lastSuccessfulSyncAt == nil)")
        var records: [HealthRecord] = []
        var deleted = Set<String>()
        var checkpoints = request.checkpoints
        var failures: [String] = []
        var requiresContinuation = false
        var announcedAreas = Set<HealthDataArea>()
        var mappedRecordCounts: [HealthDataArea: Int] = [:]

        for descriptor in Self.descriptors where request.areas.contains(descriptor.area) {
            if announcedAreas.insert(descriptor.area).inserted {
                mshProviderDiagnostic("category_queries_start", "area=\(descriptor.area.rawValue)")
            }
            do {
                mshProviderDiagnostic("query_execute_start", "area=\(descriptor.area.rawValue) key=\(descriptor.key) healthKitType=\(descriptor.sampleType.identifier) hasCheckpoint=\(request.checkpoints[descriptor.key] != nil)")
                let result = try await anchoredSamples(
                    for: descriptor.sampleType,
                    checkpoint: request.checkpoints[descriptor.key],
                    initialLookbackDays: Self.initialLookbackDays(for: descriptor.area)
                )
                mshProviderDiagnostic("query_execute_complete", "area=\(descriptor.area.rawValue) key=\(descriptor.key) sampleCount=\(result.samples.count) deletedCount=\(result.deleted.count) hasCheckpoint=\(result.checkpoint != nil)")
                if result.samples.count >= Self.anchoredQueryLimit || result.deleted.count >= Self.anchoredQueryLimit {
                    requiresContinuation = true
                }
                mshProviderDiagnostic("mapping_start", "area=\(descriptor.area.rawValue) key=\(descriptor.key) sampleCount=\(result.samples.count)")
                let mapped = result.samples.compactMap { normalize($0, descriptor: descriptor) }
                mshProviderDiagnostic("mapping_complete", "area=\(descriptor.area.rawValue) key=\(descriptor.key) mappedCount=\(mapped.count)")
                records.append(contentsOf: mapped)
                mappedRecordCounts[descriptor.area, default: 0] += mapped.count
                deleted.formUnion(result.deleted.map { $0.uuid.uuidString })
                if let checkpoint = result.checkpoint {
                    mshProviderDiagnostic("checkpoint_write_start", "area=\(descriptor.area.rawValue) key=\(descriptor.key) byteCount=\(checkpoint.count)")
                    checkpoints[descriptor.key] = checkpoint
                    mshProviderDiagnostic("checkpoint_write_complete", "area=\(descriptor.area.rawValue) key=\(descriptor.key)")
                }
            } catch {
                let nsError = error as NSError
                mshProviderDiagnostic("query_error", "area=\(descriptor.area.rawValue) key=\(descriptor.key) healthKitType=\(descriptor.sampleType.identifier) swiftType=\(String(reflecting: type(of: error))) domain=\(nsError.domain) code=\(nsError.code) description=\(nsError.localizedDescription)")
                failures.append(descriptor.key)
            }
        }

        if request.areas.contains(.movement) {
            for descriptor in Self.dailyMovementDescriptors {
                do {
                    mshProviderDiagnostic("daily_query_execute_start", "area=movement key=\(descriptor.key) healthKitType=\(descriptor.quantityType.identifier)")
                    let summaries = try await dailySummaries(for: descriptor, since: request.lastSuccessfulSyncAt)
                    records.append(contentsOf: summaries)
                    mappedRecordCounts[.movement, default: 0] += summaries.count
                    mshProviderDiagnostic("daily_query_execute_complete", "area=movement key=\(descriptor.key)")
                } catch {
                    let nsError = error as NSError
                    mshProviderDiagnostic("daily_query_error", "area=movement key=\(descriptor.key) healthKitType=\(descriptor.quantityType.identifier) swiftType=\(String(reflecting: type(of: error))) domain=\(nsError.domain) code=\(nsError.code) description=\(nsError.localizedDescription)")
                    failures.append("\(descriptor.key).daily_summary")
                }
            }
        }
        if request.areas.contains(.sleep) {
            mshProviderDiagnostic("sleep_session_mapping_start")
            let sessions = derivedSleepSessions(from: records.filter { $0.recordType == .sleepInterval })
            records.append(contentsOf: sessions)
            mappedRecordCounts[.sleep, default: 0] += sessions.count
            mshProviderDiagnostic("sleep_session_mapping_complete")
        }
        for area in request.areas.sorted(by: { $0.rawValue < $1.rawValue }) {
            mshProviderDiagnostic("category_complete", "area=\(area.rawValue) recordCount=\(mappedRecordCounts[area, default: 0])")
        }
        mshProviderDiagnostic("sync_complete", "recordCount=\(records.count) deletedCount=\(deleted.count) checkpointCount=\(checkpoints.count) failureCount=\(failures.count) requiresContinuation=\(requiresContinuation)")
        return HealthSyncBatch(
            records: records,
            deletedSourceRecordIDs: deleted,
            checkpoints: checkpoints,
            partialFailures: failures,
            requiresContinuation: requiresContinuation
        )
    }

    public func disconnect() async { /* HealthKit permissions are managed by iOS Settings. */ }

    private struct Descriptor {
        let key: String
        let area: HealthDataArea
        let sampleType: HKSampleType
        let recordType: HealthRecordType
        let domain: HealthDomain
        let unit: HKUnit?
        let canonicalUnit: String?
    }

    private static func initialLookbackDays(for area: HealthDataArea) -> Int {
        switch area {
        case .movement, .sleep:
            return 90
        case .heartActivity:
            return 30
        case .bodyMeasurements:
            return 3650
        }
    }

    private static var descriptors: [Descriptor] {
        var values: [Descriptor] = [
            Descriptor(key: "workouts", area: .movement, sampleType: HKObjectType.workoutType(), recordType: .workout, domain: .movement, unit: nil, canonicalUnit: nil)
        ]
        func quantity(_ identifier: HKQuantityTypeIdentifier, _ key: String, _ area: HealthDataArea, _ type: HealthRecordType, _ domain: HealthDomain, _ unit: HKUnit, _ canonical: String) {
            if let sampleType = HKObjectType.quantityType(forIdentifier: identifier) {
                values.append(Descriptor(key: key, area: area, sampleType: sampleType, recordType: type, domain: domain, unit: unit, canonicalUnit: canonical))
            }
        }
        quantity(.stepCount, "steps", .movement, .stepSample, .movement, .count(), "count")
        quantity(.activeEnergyBurned, "active_energy", .movement, .activeEnergy, .movement, .kilocalorie(), "kcal")
        quantity(.appleExerciseTime, "exercise_time", .movement, .exerciseTime, .movement, .second(), "s")
        quantity(.distanceWalkingRunning, "distance_walking_running", .movement, .distanceWalkingRunning, .movement, .meter(), "m")
        quantity(.distanceCycling, "distance_cycling", .movement, .distanceCycling, .movement, .meter(), "m")
        quantity(.distanceSwimming, "distance_swimming", .movement, .distanceSwimming, .movement, .meter(), "m")
        quantity(.heartRate, "heart_rate", .heartActivity, .heartRate, .cardio, HKUnit.count().unitDivided(by: .minute()), "beats/min")
        quantity(.restingHeartRate, "resting_heart_rate", .heartActivity, .restingHeartRate, .cardio, HKUnit.count().unitDivided(by: .minute()), "beats/min")
        quantity(.bodyMass, "body_mass", .bodyMeasurements, .bodyMass, .body, .gramUnit(with: .kilo), "kg")
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            values.append(Descriptor(key: "sleep", area: .sleep, sampleType: sleep, recordType: .sleepInterval, domain: .sleep, unit: nil, canonicalUnit: nil))
        }
        return values
    }

    private func normalize(_ sample: HKSample, descriptor: Descriptor) -> HealthRecord? {
        var value: Double?
        var metadata: [String: String] = [:]
        let recordType = descriptor.recordType
        if let quantity = sample as? HKQuantitySample, let unit = descriptor.unit {
            value = quantity.quantity.doubleValue(for: unit)
        } else if let workout = sample as? HKWorkout {
            metadata["activityType"] = String(workout.workoutActivityType.rawValue)
            metadata["activityName"] = Self.workoutName(workout.workoutActivityType)
            metadata["durationSeconds"] = String(workout.duration)
            if let energy = Self.workoutSum(workout, identifier: .activeEnergyBurned, unit: .kilocalorie()) {
                metadata["activeEnergyKcal"] = String(energy)
            }
            if let distanceIdentifier = Self.distanceIdentifier(for: workout.workoutActivityType),
               let distance = Self.workoutSum(workout, identifier: distanceIdentifier, unit: .meter()) {
                metadata["distanceMeters"] = String(distance)
            }
        } else if let sleep = sample as? HKCategorySample {
            metadata["sleepValue"] = String(sleep.value)
            metadata["sleepStage"] = Self.sleepStage(sleep.value)
        } else { return nil }

        let source = sample.sourceRevision.source
        return HealthRecordFactory.imported(
            sourceRecordID: sample.uuid.uuidString,
            domain: descriptor.domain,
            recordType: recordType,
            value: value,
            unit: descriptor.canonicalUnit,
            start: sample.startDate,
            end: sample.endDate,
            timezone: .autoupdatingCurrent,
            sourceName: source.name,
            sourceBundleIdentifier: source.bundleIdentifier,
            sourceVersion: sample.sourceRevision.version,
            sourceDevice: sample.device?.name,
            metadata: metadata
        )
    }

    private struct AnchoredResult { let samples: [HKSample]; let deleted: [HKDeletedObject]; let checkpoint: Data? }
    private func anchoredSamples(for type: HKSampleType, checkpoint: Data?, initialLookbackDays: Int?) async throws -> AnchoredResult {
        let anchor = checkpoint.flatMap { try? NSKeyedUnarchiver.unarchivedObject(ofClass: HKQueryAnchor.self, from: $0) }
        let predicate = anchor == nil ? initialLookbackDays.map {
            HKQuery.predicateForSamples(withStart: calendar.date(byAdding: .day, value: -$0, to: Date()), end: nil)
        } : nil
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKAnchoredObjectQuery(type: type, predicate: predicate, anchor: anchor, limit: Self.anchoredQueryLimit) { _, samples, deleted, newAnchor, error in
                mshProviderDiagnostic("query_callback_enter", "healthKitType=\(type.identifier)")
                if let error {
                    let nsError = error as NSError
                    mshProviderDiagnostic("query_callback_error", "healthKitType=\(type.identifier) swiftType=\(String(reflecting: Swift.type(of: error))) domain=\(nsError.domain) code=\(nsError.code) description=\(nsError.localizedDescription)")
                    continuation.resume(throwing: error)
                    return
                }
                let sampleCount = samples?.count ?? 0
                let deletedCount = deleted?.count ?? 0
                mshProviderDiagnostic("query_callback_results", "healthKitType=\(type.identifier) sampleCount=\(sampleCount) deletedCount=\(deletedCount) limit=\(Self.anchoredQueryLimit)")
                if sampleCount >= Self.anchoredQueryLimit || deletedCount >= Self.anchoredQueryLimit {
                    mshProviderDiagnostic("query_batch_bounded", "healthKitType=\(type.identifier) sampleCount=\(sampleCount) deletedCount=\(deletedCount) nextSyncContinuesFromCheckpoint=true")
                }
                let data = newAnchor.flatMap { try? NSKeyedArchiver.archivedData(withRootObject: $0, requiringSecureCoding: true) }
                mshProviderDiagnostic("query_callback_checkpoint_archived", "healthKitType=\(type.identifier) hasCheckpoint=\(data != nil) byteCount=\(data?.count ?? 0)")
                continuation.resume(returning: AnchoredResult(samples: samples ?? [], deleted: deleted ?? [], checkpoint: data))
            }
            mshProviderDiagnostic("query_store_execute", "healthKitType=\(type.identifier) limit=\(Self.anchoredQueryLimit) firstQuery=\(anchor == nil) lookbackDays=\(initialLookbackDays ?? 0)")
            store.execute(query)
        }
    }

    private struct DailyMovementDescriptor {
        let key: String
        let quantityType: HKQuantityType
        let recordType: HealthRecordType
        let unit: HKUnit
        let canonicalUnit: String
        let sourceIDPrefix: String
    }

    private static var dailyMovementDescriptors: [DailyMovementDescriptor] {
        func descriptor(
            _ identifier: HKQuantityTypeIdentifier,
            key: String,
            recordType: HealthRecordType,
            unit: HKUnit,
            canonicalUnit: String,
            sourceIDPrefix: String
        ) -> DailyMovementDescriptor? {
            guard let quantityType = HKObjectType.quantityType(forIdentifier: identifier) else { return nil }
            return DailyMovementDescriptor(
                key: key,
                quantityType: quantityType,
                recordType: recordType,
                unit: unit,
                canonicalUnit: canonicalUnit,
                sourceIDPrefix: sourceIDPrefix
            )
        }
        return [
            descriptor(.stepCount, key: "steps", recordType: .stepDailySummary, unit: .count(), canonicalUnit: "count", sourceIDPrefix: "daily-steps"),
            descriptor(.activeEnergyBurned, key: "active_energy", recordType: .activeEnergy, unit: .kilocalorie(), canonicalUnit: "kcal", sourceIDPrefix: "daily-active-energy"),
            descriptor(.appleExerciseTime, key: "exercise_time", recordType: .exerciseTime, unit: .second(), canonicalUnit: "s", sourceIDPrefix: "daily-exercise-time"),
            descriptor(.distanceWalkingRunning, key: "distance_walking_running", recordType: .distanceWalkingRunning, unit: .meter(), canonicalUnit: "m", sourceIDPrefix: "daily-distance-walking-running")
        ].compactMap { $0 }
    }

    private func dailySummaries(for descriptor: DailyMovementDescriptor, since lastSync: Date?) async throws -> [HealthRecord] {
        let now = Date()
        let fallback = calendar.date(byAdding: .day, value: -90, to: calendar.startOfDay(for: now))!
        let start = calendar.startOfDay(for: lastSync ?? fallback)
        var interval = DateComponents(); interval.day = 1
        let predicate = HKQuery.predicateForSamples(withStart: start, end: now)
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsCollectionQuery(quantityType: descriptor.quantityType, quantitySamplePredicate: predicate, options: .cumulativeSum, anchorDate: start, intervalComponents: interval)
            query.initialResultsHandler = { _, collection, error in
                mshProviderDiagnostic("daily_query_callback_enter", "healthKitType=\(descriptor.quantityType.identifier)")
                if let error {
                    let nsError = error as NSError
                    mshProviderDiagnostic("daily_query_callback_error", "healthKitType=\(descriptor.quantityType.identifier) swiftType=\(String(reflecting: Swift.type(of: error))) domain=\(nsError.domain) code=\(nsError.code) description=\(nsError.localizedDescription)")
                    continuation.resume(throwing: error)
                    return
                }
                var results: [HealthRecord] = []
                mshProviderDiagnostic("daily_mapping_start", "healthKitType=\(descriptor.quantityType.identifier)")
                collection?.enumerateStatistics(from: start, to: now) { statistics, _ in
                    guard let quantity = statistics.sumQuantity() else { return }
                    let key = Self.dayKey(statistics.startDate, calendar: self.calendar)
                    results.append(HealthRecordFactory.imported(
                        sourceRecordID: "\(descriptor.sourceIDPrefix):\(key)",
                        domain: .movement,
                        recordType: descriptor.recordType,
                        value: quantity.doubleValue(for: descriptor.unit),
                        unit: descriptor.canonicalUnit,
                        start: statistics.startDate,
                        end: statistics.endDate,
                        timezone: .autoupdatingCurrent,
                        sourceName: "Apple Health",
                        sourceBundleIdentifier: "com.apple.Health",
                        metadata: ["aggregation":"HealthKit cumulativeSum", "summary":"daily", "day":key]
                    ))
                }
                mshProviderDiagnostic("daily_mapping_complete", "healthKitType=\(descriptor.quantityType.identifier) mappedCount=\(results.count)")
                continuation.resume(returning: results)
            }
            mshProviderDiagnostic("daily_query_store_execute", "healthKitType=\(descriptor.quantityType.identifier)")
            store.execute(query)
        }
    }

    private func derivedSleepSessions(from intervals: [HealthRecord]) -> [HealthRecord] {
        let asleep = intervals.filter { $0.metadata["sleepStage"] != "awake" && $0.metadata["sleepStage"] != "in_bed" }
        let grouped = Dictionary(grouping: asleep) { calendar.startOfDay(for: $0.eventStart) }
        return grouped.compactMap { day, samples in
            guard let start = samples.map(\.eventStart).min(), let end = samples.compactMap(\.eventEnd).max() else { return nil }
            let key = Self.dayKey(day, calendar: calendar)
            return HealthRecordFactory.imported(sourceRecordID: "sleep-session:\(key)", domain: .sleep, recordType: .sleepSession, value: end.timeIntervalSince(start), unit: "s", start: start, end: end, timezone: .autoupdatingCurrent, sourceName: "Apple Health", sourceBundleIdentifier: "com.apple.Health", metadata: ["aggregation":"derived from recorded HealthKit sleep intervals","intervalCount":String(samples.count)])
        }
    }

    private static func dayKey(_ date: Date, calendar: Calendar) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }
    private static func workoutSum(_ workout: HKWorkout, identifier: HKQuantityTypeIdentifier, unit: HKUnit) -> Double? {
        guard let type = HKObjectType.quantityType(forIdentifier: identifier) else { return nil }
        return workout.statistics(for: type)?.sumQuantity()?.doubleValue(for: unit)
    }
    private static func distanceIdentifier(for type: HKWorkoutActivityType) -> HKQuantityTypeIdentifier? {
        switch type {
        case .walking, .running, .hiking:
            return .distanceWalkingRunning
        case .cycling:
            return .distanceCycling
        case .swimming:
            return .distanceSwimming
        default:
            return nil
        }
    }
    private static func workoutName(_ type: HKWorkoutActivityType) -> String { switch type { case .walking:return "Walk"; case .running:return "Run"; case .cycling:return "Cycling"; case .swimming:return "Swimming"; case .traditionalStrengthTraining,.functionalStrengthTraining:return "Strength training"; case .yoga:return "Yoga"; default:return "Workout" } }
    private static func sleepStage(_ value: Int) -> String { switch value { case HKCategoryValueSleepAnalysis.inBed.rawValue:return "in_bed"; case HKCategoryValueSleepAnalysis.asleepCore.rawValue:return "core"; case HKCategoryValueSleepAnalysis.asleepDeep.rawValue:return "deep"; case HKCategoryValueSleepAnalysis.asleepREM.rawValue:return "rem"; case HKCategoryValueSleepAnalysis.awake.rawValue:return "awake"; default:return "asleep_unspecified" } }
}

public enum AppleHealthKitError: Error { case unavailable }
#else
import Foundation
import MSHHealthCore

public struct AppleHealthKitProvider: HealthDataProvider {
    public let provider = HealthProvider.appleHealth
    public init() {}
    public func availability() -> HealthProviderAvailability { .unavailable }
    public func requestAuthorization(for areas: Set<HealthDataArea>) async -> HealthAuthorizationResult { HealthAuthorizationResult(outcome:.failed, requestedAreas:areas, message:"Apple Health requires iOS.") }
    public func sync(_ request: HealthSyncRequest) async throws -> HealthSyncBatch { HealthSyncBatch(records:[], partialFailures:["Apple Health requires iOS."]) }
    public func disconnect() async {}
}
#endif