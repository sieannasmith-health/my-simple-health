# My Simple Health Feature Architecture

## Governing rule

My Simple Health supports many health capabilities, but it does not assume every capability belongs in every person's experience.

A person chooses which optional features are active in My Health. Identity, sex, gender, diagnosis, age, or another inferred characteristic must not silently enable or disable an optional feature.

Feature selection and Calendar visibility are separate concepts.

- **Feature enabled** means the capability belongs in this person's active My Health experience.
- **Feature removed** means the capability is no longer surfaced in the active experience. Existing history is preserved.
- **Calendar layer visible** means an enabled feature is currently shown in Calendar.
- **Delete data** is a separate, explicit destructive action and must never be implied by removing a feature.

## Foundational experiences

These are part of the My Health system itself rather than optional health-topic features:

- Landscape
- Horizon / Vision
- Path / Projects
- Practice
- Discovery / Learning
- Journey / Progress
- Calendar

They provide the structure through which a person understands and navigates their health. They are not treated as demographic-specific modules.

## Optional health features

Initial registry:

| Feature ID | User label | Calendar capable | Initial default |
| --- | --- | --- | --- |
| `movement` | Movement | Yes | Enabled |
| `cycle` | Cycle | Yes | Not automatically enabled for new users |
| `symptoms` | Body & symptoms | Yes | Enabled |
| `medications` | Medications | Yes | Enabled |
| `care` | Care & appointments | Yes | Enabled |
| `prevention` | Preventive care | Yes | Enabled |
| `life_context` | Life context | Yes | Enabled |
| `routines` | Routines | Yes | Enabled |

The registry must be extensible. Adding a future capability should not require redesigning Calendar or My Health navigation.

## Preference model

Conceptual persistent shape:

```js
settings: {
  features: {
    movement: { enabled: true },
    cycle: { enabled: false },
    symptoms: { enabled: true },
    medications: { enabled: true },
    care: { enabled: true },
    prevention: { enabled: true },
    life_context: { enabled: true },
    routines: { enabled: true }
  }
}
```

Calendar visibility remains separate:

```js
calendar: {
  settings: {
    layers: {
      movement: true,
      cycle: true,
      symptoms: true,
      medications: true,
      care: true,
      prevention: true,
      life_context: true,
      routines: true
    }
  }
}
```

A Calendar layer value does not enable a feature. Calendar must require both conditions:

```text
feature enabled AND calendar layer visible
```

## Feature registry contract

The application should expose one registry describing capabilities rather than scattering feature definitions through individual pages.

Conceptually:

```js
const FEATURE_REGISTRY = {
  movement: {
    label: 'Movement',
    description: 'Plan and reflect on movement in everyday life.',
    calendarLayer: 'movement'
  },
  cycle: {
    label: 'Cycle',
    description: 'Record menstrual-cycle information and optional estimates.',
    calendarLayer: 'cycle',
    sensitive: true
  }
};
```

The registry describes what exists. User preferences describe what is enabled.

## Customize My Health

MSH must provide a persistent customization surface, not only an onboarding choice.

Each optional feature shows one clear state:

- **Added** / selected
- **Not added** / unselected

The person can change these selections later because health needs and interests change over time.

Selection must not be framed as a medical recommendation or identity judgment.

Example:

```text
Customize My Health

[✓] Movement
[ ] Cycle
[✓] Body & symptoms
[✓] Medications
[✓] Care & appointments
[✓] Preventive care
[✓] Life context
[✓] Routines
```

## Removal behavior

When a person removes a feature:

1. Stop surfacing feature-specific tabs, actions, prompts, cards, summaries, and Calendar content.
2. Preserve previously recorded data.
3. Preserve provenance and timestamps.
4. Do not delete predictions/history merely because the UI feature is inactive.
5. Allow the person to re-add the feature later and regain access to their existing history.
6. Keep data deletion in a separate explicit flow.

For sensitive features such as Cycle, removing the feature must also stop it from appearing in cross-feature summaries or analysis unless a separately governed permission explicitly permits that use.

## Calendar contract

Calendar remains **health in time**. It does not own Movement, Cycle, medications, symptoms, care, or other health capabilities.

Calendar consumes dated information from enabled features.

Therefore:

- Cycle tab appears only when Cycle is enabled.
- Add cycle information appears only when Cycle is enabled.
- Cycle legend/predictions appear only when Cycle is enabled and its Calendar layer is visible.
- Movement actions appear only when Movement is enabled.
- A disabled feature cannot be reactivated merely by checking a Calendar visibility control.
- Calendar layer controls should list only enabled, Calendar-capable features.

## Migration rule

Existing prototype users may already have Cycle records because Cycle was previously hard-wired on.

Migration must preserve those records. Existing Cycle data may be used to infer an enabled state only for legacy migration, not as a general identity inference rule.

For a fresh user with no prior preference and no Cycle history, Cycle should not be automatically enabled.

## Supabase-ready direction

The local prototype can store feature preferences inside the existing MSH state now. The model should map cleanly later to a user preference record or feature-preference table in Supabase.

Do not store feature-enabled state on individual health events. Events remain health records; feature selection is a user-level interface preference.

Conceptual future relational model:

```text
user_feature_preferences
- user_id
- feature_id
- enabled
- enabled_at
- disabled_at
- updated_at
```

The exact Supabase schema should be decided with the broader MSH data model rather than created opportunistically from this feature.

## Implementation sequence

1. Add centralized feature registry.
2. Add normalized `settings.features` preferences to shared storage.
3. Migrate legacy state without deleting data.
4. Add reusable helpers such as `isFeatureEnabled()` and `setFeatureEnabled()`.
5. Add Customize My Health selection UI.
6. Make Calendar consume feature state.
7. Remove unconditional Cycle UI from Calendar.
8. Apply the same gating pattern to other surfaces as they are audited.
9. Test remove → hidden → re-add → history restored.
10. Test that Calendar visibility never changes global feature selection.

## Non-negotiable product boundary

**Availability is not assignment.**

MSH may make a health capability available without deciding that the capability belongs to a particular person. The person controls the composition of their My Health experience.