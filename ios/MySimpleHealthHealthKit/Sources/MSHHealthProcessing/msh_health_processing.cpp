#include "msh_health_processing.h"

#include <algorithm>
#include <vector>

namespace {
struct Interval {
    double start;
    double end;
};
}

double msh_covered_duration(const MSHTimeInterval *intervals, size_t count) {
    if (intervals == nullptr || count == 0) {
        return 0.0;
    }

    std::vector<Interval> valid;
    valid.reserve(count);

    for (size_t index = 0; index < count; ++index) {
        const auto &interval = intervals[index];
        if (interval.end > interval.start) {
            valid.push_back({interval.start, interval.end});
        }
    }

    if (valid.empty()) {
        return 0.0;
    }

    std::sort(valid.begin(), valid.end(), [](const Interval &lhs, const Interval &rhs) {
        if (lhs.start == rhs.start) {
            return lhs.end < rhs.end;
        }
        return lhs.start < rhs.start;
    });

    double total = 0.0;
    double mergedStart = valid.front().start;
    double mergedEnd = valid.front().end;

    for (size_t index = 1; index < valid.size(); ++index) {
        const auto &current = valid[index];
        if (current.start <= mergedEnd) {
            mergedEnd = std::max(mergedEnd, current.end);
        } else {
            total += mergedEnd - mergedStart;
            mergedStart = current.start;
            mergedEnd = current.end;
        }
    }

    total += mergedEnd - mergedStart;
    return total;
}
