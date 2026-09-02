# Native Migration Agenda

This document defines how My Simple Health should move from mixed web/native implementation toward a coherent native iOS product without accidentally treating temporary migration scaffolding as the final MSH experience.

## Core rule

**Preserve the current user experience during migration unless a task explicitly asks for a UX/UI redesign.**

The native migration is an architecture and capability migration first. Solid-color screens, dense text layouts, temporary cards, and other basic native views may exist as implementation scaffolding while a feature is being moved. They are not the target product design and should not be polished into a new visual direction by default.

Do not translate HTML/CSS screens into SwiftUI line-for-line and call that the finished native experience. The finished native product should receive a deliberate MSH UX/UI pass after the underlying feature behavior and data architecture are stable.

## Migration order for a feature

Move each capability vertically through the stack:

1. Define or confirm the canonical domain/data model.
2. Move persistence and service boundaries behind a stable repository/service interface.
3. Move reusable processing and interpretation out of view code.
4. Implement the native Swift capability.
5. Preserve existing user-facing behavior and information hierarchy as closely as practical during the migration.
6. Add focused unit/integration coverage.
7. Validate the feature on a physical iPhone.
8. Retire the obsolete web/WKWebView route only after the native path is confirmed.
9. Perform the final MSH-native experience design pass separately.

## What belongs in the final design pass

The final design pass may introduce or refine:

- Apple-native materials and Liquid Glass where they genuinely help interaction and hierarchy
- MSH editorial composition and whitespace
- visual storytelling, imagery, and meaningful graphics
- interactive health data and charts
- motion and transitions
- contextual controls and bottom sheets
- progressive disclosure instead of dense explanatory text
- accessible contrast, typography, touch targets, Dynamic Type, and reduced-motion behavior

Use Apple-native interaction patterns while preserving MSH's own identity. Do not make the product glass everywhere simply because the platform supports it.

## Design-system direction

Shared native components should live in a reusable design-system layer rather than being recreated feature by feature. Feature screens should remain feature-owned.

A representative target structure is:

```text
MySimpleHealthApp/
├── DesignSystem/
│   ├── Theme/
│   ├── Components/
│   └── Motion/
├── Features/
│   ├── MyHealth/
│   ├── Calendar/
│   ├── Movement/
│   ├── Track/
│   └── Tools/
├── Navigation/
├── Domain/
│   ├── Models/
│   ├── Repositories/
│   └── Services/
├── Data/
│   ├── HealthKit/
│   ├── Persistence/
│   ├── Firebase/
│   └── API/
└── NativeEngine/
    ├── Cpp/
    └── Bridge/
```

This is a direction, not a mandate to rename or move the whole repository at once. Refactor toward it only when a scoped migration task makes the change useful.

## C++ boundary

Keep the app Swift-first. C++ belongs only where it creates durable data-layer benefit, such as large health-data batch processing, time-series aggregation, deduplication, repeated statistical transforms, or future signal-processing work. Navigation, forms, calendars, ordinary networking, and most product/business logic should remain in Swift.

## Definition of migration-complete

A feature is not considered fully migrated merely because a SwiftUI screen exists. It is migration-complete when:

- the intended capability is native,
- the canonical data path is clear,
- relevant tests pass,
- the physical iPhone experience is validated,
- obsolete web routing is removed or intentionally retained and documented,
- and no temporary scaffolding is being mistaken for the final MSH UX/UI.

A feature may be **architecture-complete but design-pending**. That state is expected and should be labeled explicitly rather than triggering an unplanned redesign during migration.
