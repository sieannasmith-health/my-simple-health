#ifndef MSH_HEALTH_PROCESSING_H
#define MSH_HEALTH_PROCESSING_H

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct MSHTimeInterval {
    double start;
    double end;
} MSHTimeInterval;

/// Returns the total duration covered by the supplied intervals after sorting,
/// discarding invalid intervals, and merging overlaps. The input is never mutated.
double msh_covered_duration(const MSHTimeInterval *intervals, size_t count);

#ifdef __cplusplus
}
#endif

#endif
