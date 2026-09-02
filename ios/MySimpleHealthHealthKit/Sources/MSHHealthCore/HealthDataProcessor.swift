import Foundation
import MSHHealthProcessing

/// Swift-facing boundary for computational health-data work.
///
/// App and domain code should depend on this API rather than on the native
/// implementation directly. That keeps HealthRecord and higher-level product
/// logic Swift-first while allowing expensive, reusable transforms to move into
/// the C++ engine when profiling shows a durable benefit.
public enum HealthDataProcessor {
    /// Calculates the union duration of record intervals. Invalid or open-ended
    /// records are ignored and overlapping time is counted only once.
    public static func coveredDuration(of records: [HealthRecord]) -> TimeInterval {
        coveredDuration(
            intervals: records.compactMap { record in
                guard let end = record.eventEnd else { return nil }
                return HealthTimeInterval(start: record.eventStart, end: end)
            }
        )
    }

    /// Calculates total covered time across arbitrary intervals, merging overlap.
    public static func coveredDuration(intervals: [HealthTimeInterval]) -> TimeInterval {
        guard !intervals.isEmpty else { return 0 }

        let nativeIntervals = intervals.map {
            MSHTimeInterval(start: $0.start.timeIntervalSince1970, end: $0.end.timeIntervalSince1970)
        }

        return nativeIntervals.withUnsafeBufferPointer { buffer in
            msh_covered_duration(buffer.baseAddress, buffer.count)
        }
    }
}

public struct HealthTimeInterval: Equatable, Sendable {
    public let start: Date
    public let end: Date

    public init(start: Date, end: Date) {
        self.start = start
        self.end = end
    }
}
