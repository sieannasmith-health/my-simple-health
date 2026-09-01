# iPhone Integration Audit

This audit describes the committed implementation available to the five-tab iPhone shell on `feature/ios-full-integration-audit`. “Integrated” means that the native route is explicit, the destination file and its data path were traced, and automated native/web tests cover the route contract. It does not substitute for a signed-in or physical-device acceptance test.

## Integration decisions

| Feature | Committed implementation found | Native destination | Data source | Before | Change in this pass | After | Remaining dependency or blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| My Health | Native dashboard plus `my-health.html` | My Health tab; native HealthKit cards; web capability routes | Metadata-only `FileHealthStore` state and bounded `SQLiteHealthRecordStore` reads; canonical MSH web state | Native dashboard existed, but health cards and status were mostly informational | Made HealthKit status, health-area cards, capabilities, and Calendar handoff interactive | Integrated: native dashboard with bounded data and deliberate web workspaces | Physical-device acceptance with real HealthKit data |
| Apple Health / HealthKit | Native bridge, coordinator, provider, metadata file, incremental SQLite records | My Health status and health-area cards; embedded My Health management workspace | HealthKit via `mshHealth`; device-local metadata and SQLite records | Integrated, with status card not opening its management surface | Added a native management route without changing permissions, bridge, schema, or persistence | Integrated native device capability | HealthKit data requires a physical iPhone; simulator validates compilation only |
| Movement | Native doorway, Calendar movement plan, Movement Library, native bounded HealthKit summaries | Movement tab and My Health Movement card | Shared Calendar state, Movement Library state, bounded SQLite HealthKit reads | Reachable | Clarified real destinations and linked native My Health Movement records | Integrated | YouTube account/API runtime depends on the deployed web configuration and sign-in |
| Movement Library, saved workouts, favorites, YouTube playlists | `movement-library.html` and existing library/YouTube scripts | Movement tab → Movement Library & Workouts | Existing web library/browser state and YouTube integration | Reachable but native wording obscured the breadth of the workspace | Made the combined destination explicit | Integrated as existing responsive web workspace | Live OAuth/API acceptance remains environment-dependent |
| Calendar | `calendar.html` and existing bounded HealthKit projection | Calendar tab and My Health “Coming up” | Canonical Calendar events plus Movement, medication, cycle, practices/projects, and bounded HealthKit records | Reachable | Replaced the future placeholder with an active Calendar handoff and current shared-layer description | Integrated shared time layer | Physical-device/web acceptance for current user data |
| Medication Continuity | `medications.html` and `msh-medication-continuity.js` | My Health capabilities and Tools | Canonical MSH medication state; writes planned refill review actions into the shared Calendar | Implemented but not reachable from native shell | Added My Health and Tools routes | Integrated existing web workspace | Outreach remains review-only; no automatic sending |
| Cycle | Existing Calendar cycle view and canonical cycle records | My Health capabilities and Tools → `calendar.html?view=cycle` | Canonical Calendar/cycle state | Implemented but not reachable from native shell | Added explicit cycle route | Integrated in shared Calendar | No separate native cycle implementation is needed for this pass |
| Food / My Food | `my-food.html` | Tools | Existing canonical web state | Reachable | Preserved | Integrated as existing web workspace | None found in route audit |
| Financial Health | `financial-health.html` | Tools | Existing canonical web state | Reachable | Preserved | Integrated as existing web workspace | None found in route audit |
| Self-Insight | `assessments.html` | My Health capabilities, Track, and Tools | Existing assessment records in canonical MSH state | Reachable only through Tools | Added context-appropriate My Health and Track entry points | Integrated existing web workspace | Personal interpretation remains constrained to recorded/confirmed information |
| Personal Health Patterns | `health-patterns-preview.html` and preview script | None | Hard-coded/synthetic demonstration data | File existed but was not a production data experience | Explicitly excluded from native destinations | Not ready to expose | Requires a real-data product implementation; preview must not masquerade as personal health information |
| My Health Story | `my-health-story.html`, compiler, and My Health web entry | Track primary destination and My Health capabilities | Read-only synthesis of canonical Landscape, Vision, Project, Practice, reflection, Calendar, and Progress records; explicit notes remain provenance-labelled | Web feature existed but was absent from native shell | Added canonical web and native routes; made it Track’s primary synthesis surface | Integrated existing web workspace | Runtime acceptance with a populated personal journey |
| Track | No single native screen; real Story, Landscape, Self-Insight, Journey, and Calendar implementations existed | Track tab | The existing canonical records behind those workspaces | Placeholder native screen | Replaced placeholder with a restrained cross-domain doorway; no synthetic conclusions | Integrated navigation and product role | Rich native synthesis awaits a supported real-data model; no diagnosis or causal claims are generated |
| Explore | Existing My Health Explore view | Tools | Canonical My Health directory/state | Web route existed but was absent from native Tools | Added native route and correct tab classification | Integrated existing web workspace | None found in route audit |
| Landscape | `health-landscape.html` | Track and Tools | Canonical Landscape records | Reachable through Tools | Added Track entry point | Integrated existing web workspace | None found in route audit |
| Horizon, Path, Practice, Discovery, Journey | Existing journey web workspaces | Tools; Journey also in Track | Canonical MSH journey state | Reachable through Tools | Preserved; added Journey to Track synthesis | Integrated existing web workspaces | None found in route audit |
| Guiding Principle / Spiritual architecture | `SPIRITUAL_TOOL_ARCHITECTURE.md` | None | Specification only | Not implemented | Explicitly excluded | Architecture only; not ready to expose | Requires a real implementation and product approval |
| Meditate | Native meditation screen | Tools | Native transient session state | Reachable | Preserved | Integrated native tool | None found in route audit |
| Notifications | Native `UserNotifications` service, deterministic IDs, generic web bridge, deep-link router | Native service; routes into matching tab/web destination | iOS notification center and route payload | Integrated | Extended route classification for new integrated destinations only | Integrated native device capability | Firing/open behavior requires physical-device acceptance |
| Onboarding | Native onboarding state and screens | App launch before shell | Native preferences | Implemented; migration fix was present as uncommitted source work | Preserved and validated | Integrated | Fresh-install and existing-user behavior are covered by native tests |
| Authentication / account | Native Supabase auth gate | App root | Supabase session | Integrated | Preserved | Integrated | Release runtime needs valid environment configuration/network |
| Profile / Settings | Native profile/settings screen | My Health toolbar | Native profile, appearance, account/sharing services | Integrated | Preserved | Integrated | Signed-in sharing controls require an authenticated account |
| Body measurements | Existing HealthKit record type and native health-area card | My Health | Bounded SQLite HealthKit records | Visible but card was not interactive | Linked to bounded native record detail | Integrated native read-only summary | Values require authorized device data |
| Sharing | Native relationship/grant and summary-sharing surfaces | Profile & Settings | Supabase relationships/grants; intentionally excludes raw HealthKit history | Integrated | Preserved | Integrated | Requires authenticated accounts and backend availability |

## Shared-state and boundary findings

- Web workspaces loaded in `MSHWebView` use the existing shared website data store and canonical `MSHStorage` records; this pass did not create a second Calendar, medication, movement, or journey store.
- Device capabilities remain native: HealthKit stays device-local behind `mshHealth`, while local notifications stay behind the generic notification bridge.
- My Health’s status card reads metadata only. Recent native activity remains a bounded SQLite query and is grouped by the explicit `MSHHealthArea` produced by the model mapper.
- The legacy Hello route remains unmounted by the private application shell and is not a native feature destination.
- The Personal Health Patterns preview and Spiritual/Guiding Principle specification are not surfaced.

## Route map

| Native responsibility | Route |
| --- | --- |
| My Health management | `my-health.html` |
| Explore | `my-health.html?view=explore` |
| Calendar | `calendar.html` |
| Movement planning | `calendar.html?view=movement` |
| Cycle | `calendar.html?view=cycle` |
| Movement Library / YouTube | `movement-library.html` |
| Medication Continuity | `medications.html` |
| My Health Story | `my-health-story.html` |
| Landscape | `health-landscape.html` |
| Self-Insight | `assessments.html` |
| Horizon / Path / Practice / Discovery / Journey | `my-vision.html`, `my-project.html`, `my-practice.html`, `my-learning.html`, `my-progress.html` |
| Food / Financial Health | `my-food.html`, `financial-health.html` |

## Validation scope

- Five-tab order and all native route identities are asserted by `MSHNativeShellTests`.
- My Health metadata-only and bounded-activity mapping are asserted by `MSHMyHealthTests`.
- Notification routing, deterministic replacement/cancellation, and bridge behavior are covered by the native notification tests.
- HealthKit sync/checkpoint behavior is covered by the HealthKit Swift package tests.
- Canonical web routes and shared private navigation are covered by the Node web suite.
- A final physical-device pass is still required before claiming real HealthKit data, notification delivery, OAuth, or signed-in sharing acceptance.
