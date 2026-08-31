# Apple Health Phase 1 architecture

## Outcome and boundary

Apple Health is a connected-health provider beneath the existing My Simple Health data contract. It is not a new dashboard, source of diagnosis, or browser integration. Phase 1 is read-only and foreground-only. The native iPhone container performs authorization and import; the website receives a temporary in-memory projection for My Health, Calendar, and Movement.

No HealthKit values, anchors, or authorization choices are written to `localStorage`, query strings, analytics, or browser logs. The native store uses iOS complete file protection. Cloud upload and background delivery are deliberately deferred until MSH has authenticated user ownership, server-side row isolation, explicit retention controls, and a reviewed privacy/security model.

## Audited foundation

- The production product is a framework-free HTML/CSS/JavaScript site with Node/Vercel handlers, not an iOS or hybrid app.
- Shared web state uses the `msh_data` local-storage model. There was no native target, HealthKit entitlement, account identity, Supabase schema, or migration system.
- The product data standard already defines source, provenance, information class, and Calendar projection boundaries. The integration extends that model instead of creating parallel product concepts.
- Existing Movement is represented as Calendar events with movement payloads. Imported workouts are projected into that same surface and remain distinguishable from user-planned movement.

## Data flow

1. The person opens Connections inside My Health and chooses Movement, Sleep, Heart activity, and/or Body measurements.
2. The website sends only the requested area names to the native `WKScriptMessageHandler`.
3. `AppleHealthKitProvider` requests read access with an empty write set.
4. Foreground sync runs anchored queries by sample type. HealthKit UUIDs provide idempotent source identity; deletion UUIDs remove imported records; anchors advance only after the record transaction succeeds.
5. Units are normalized to `count`, `m`, `kcal`, `s`, `beats/min`, or `kg`. Source revision, bundle ID, device, timestamps, timezone, and activity/stage metadata are retained.
6. Daily steps use `HKStatisticsCollectionQuery` cumulative statistics. They are not produced by adding overlapping samples. Sleep intervals remain canonical records; a dated session summary is derived with explicit aggregation metadata.
7. The encrypted-at-rest device file is projected across the bridge as canonical records. The browser validates and holds them in memory only.
8. Calendar and Movement consume provider-neutral projections; My Health shows a restrained connection and recency surface.

## Meaning and reasoning contract

Imported values are `provenance: IMPORTED` and `informationClass: RECORDED`. Source is always `apple_health`/`healthkit`. MSH may say, “Your recent Practice history shows…” only when the referenced record exists. It may offer, “One possibility is…” and ask, “Does that fit your experience?” It must never convert an imported pattern into a fact, infer sensitive identity or characteristics, diagnose, prescribe a Project, or treat capacity as compliance. User-stated choices and recorded experiences remain the strongest context. Preserve, Explore, Develop, Adapt, Save for Later, and Leave It Alone remain valid decisions.

## Permission, connection, and deletion semantics

- Authorization is progressive by information group and requested only after a person acts.
- A successful HealthKit authorization sheet means the request completed; iOS intentionally does not tell an app whether individual read types were denied. A no-data state is therefore neutral.
- Disconnect clears local sync state and anchors but leaves already imported records until the person selects Remove imported data.
- Remove imported data deletes Apple Health-derived records from the MSH device store. It does not alter Apple Health.
- Permissions themselves are managed in iOS Settings. MSH never claims to revoke them.
- Partial type failures are surfaced without discarding successful types or advancing failed checkpoints.

## Native project and validation

`ios/MySimpleHealthApp/project.yml` is an XcodeGen specification for a thin SwiftUI/WKWebView app. The HealthKit capability and read-purpose text are declared in the target files. The reusable Swift package separates provider-neutral sync/repository code from the HealthKit adapter.

This machine currently has Command Line Tools but not a complete matching Xcode/SDK installation. Swift test invocation is blocked before manifest compilation because its Swift compiler and macOS SDK patch versions differ. Before shipping, generate/open the Xcode project, select an Apple Development team, confirm the HealthKit capability, then validate on a physical iPhone with granted, partially granted, denied, changed, deleted, duplicate, timezone-boundary, interrupted, and resumed imports. HealthKit is not available in a normal web preview and meaningful sample testing requires an Apple platform environment.

## Deferred work

Background delivery, cloud synchronization, account-level deletion, server migrations, and multi-device reconciliation are out of Phase 1. They should not be added by silently widening the current local-only trust boundary.
