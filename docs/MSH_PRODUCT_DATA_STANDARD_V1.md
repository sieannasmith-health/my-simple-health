# My Simple Health Product Data Standard V1

Status: proposed repository-level governance standard for review
Version: `1.0.0-draft`
Applies to: My Simple Health product records, projections, integrations, and intelligence systems

## 1. Purpose and authority

This standard defines how My Simple Health represents, preserves, transforms, presents, and governs health-related product data. It is the repository-level source of truth for evidence integrity, privacy, durability, governance, auditability, authorship, provenance, information classification, record ownership, deletion, migrations, assessment identity, Calendar projection, AI boundaries, accessibility, third-party dependencies, and data minimization.

Product code, migrations, adapters, APIs, analytics, Calendar projections, and AI context builders must conform to this standard. A product convenience, visual design, model response, or legacy field must not override it.

This document does not select or implement a hosted backend. Local storage may remain in use during transition, but local persistence does not reduce the requirements defined here.

Normative terms `MUST`, `MUST NOT`, `SHOULD`, and `MAY` carry their usual standards meaning.

## 2. Governing principles

1. The person remains the primary authority on the meaning of their lived experience.
2. Observation, evidence, interpretation, intention, action, experience, learning, and confirmed change are distinct states. Systems may connect them but must not collapse them.
3. Scientific evidence may inform a person without determining personal meaning or action.
4. A score, pattern, correlation, or model output must not become an identity claim, diagnosis, goal, or confirmed change.
5. Source data must remain traceable through transformation, inference, and presentation.
6. Missing metadata is unknown, not permission to assume.
7. Records must be durable, inspectable, versioned, and migratable without erasing history.
8. Collection and exposure must be limited to what a defined product purpose requires.

The required chain is:

`source → transformation → inference → presentation`

Every durable result in that chain must retain enough metadata to explain where it came from and how it was produced.

## 3. Canonical product decisions

### 3.1 Canonical Health Landscape

`health-landscape.html` is the canonical Health Landscape experience for the current product.

Its assessment identity is:

- `instrumentId`: `health_landscape`
- `instrumentVersion`: the scientific/item-set version, currently represented as `HL-1`
- `experienceVersion`: the participant-facing experience version, currently represented as `HEALTH-LANDSCAPE-V1`

The exact stored version values must come from the implementation that generated the record; adapters must not rewrite older values to the latest version.

The Dimensions V2/internal Landscape implementation is paused. Its code and historical data structures must be preserved, but it must not:

- be merged into the canonical Health Landscape;
- be averaged, compared, or substituted as though it were an equivalent instrument;
- be exposed as another canonical Landscape doorway; or
- be deleted.

Dimensions records must retain their own stable `instrumentId`, `instrumentVersion`, and `experienceVersion`. Results from distinct instruments may coexist but must remain permanently distinguishable.

### 3.2 My Health as source architecture

My Health owns the person's structured product records. Calendar, Hello, analytics, and presentations read controlled projections from that shared record system. They must not create competing profiles or duplicate databases of personal meaning.

## 4. Three independent classification axes

`source`, `provenance`, and `informationClass` answer different questions and must be stored independently.

- **Source:** Where did the record enter the system?
- **Provenance:** Whose epistemic act does the claim represent?
- **Information class:** What kind of information is it?

No value on one axis may be inferred solely from a value on another.

### 4.1 Approved provenance values

| Value | Meaning |
| --- | --- |
| `USER_STATED` | The person directly entered, selected, or reported it. It is authoritative as a report of their experience, not independent clinical verification. |
| `USER_CONFIRMED` | The person explicitly confirmed or edited an interpretation or synthesis. Its earlier origin must remain in history/lineage. |
| `SYSTEM_OBSERVED` | The system made a bounded observation of stored events or application state without claiming personal meaning or causation. |
| `MODEL_INFERRED` | A model proposed a tentative interpretation. It remains unconfirmed unless the person explicitly confirms or edits it. |

A `MODEL_INFERRED` record must never be silently relabeled `USER_STATED`. Confirmation creates a new state or record with `USER_CONFIRMED` provenance while preserving the inference in lineage.

### 4.2 Approved information classes

| Value | Meaning | Example |
| --- | --- | --- |
| `RECORDED` | A directly entered or imported occurrence/measurement with an attributable source. | A period start entered by the user. |
| `PERSONAL_OBSERVATION` | A bounded statement about the person's recorded history, without causal or diagnostic interpretation. | Cramps were recorded on the first two days in four of five recorded cycles. |
| `ESTIMATED` | A non-confirmed approximation derived from incomplete or indirect inputs. | An estimated cycle phase. |
| `PREDICTED` | A forward-looking calculated expectation. | A predicted period date. |
| `GENERAL_EDUCATION` | Population-level or general educational information not asserted as personal truth. | A description of luteal-phase physiology. |
| `SYSTEM_DERIVED` | A deterministic transformation or calculation that is not itself a directly recorded fact. | A cycle length calculated from two recorded starts. |

`PERSONAL_OBSERVATION` and `SYSTEM_DERIVED` commonly use `SYSTEM_OBSERVED` provenance. `ESTIMATED` or `PREDICTED` values may use `SYSTEM_OBSERVED` when deterministic or `MODEL_INFERRED` when model-generated. These are examples, not automatic mappings.

### 4.3 Authorship

The system must preserve who authored original text and who subsequently edited, confirmed, transformed, or summarized it. User-authored content must remain recoverable in its original form. A cleaned display string, generated summary, or translation must not overwrite the original.

Where multiple actors are possible, an audit event should include an `actorType` (`USER`, `SYSTEM`, `MODEL`, or authorized operator), an actor identifier when available, timestamp, action, and reason.

## 5. Canonical health-record envelope

Every canonical record must use a shared, versioned envelope with a typed payload.

```json
{
  "id": "stable-record-id",
  "ownerId": null,
  "recordType": "assessment.result",
  "eventStart": "2026-08-29T14:00:00.000Z",
  "eventEnd": null,
  "createdAt": "2026-08-29T14:01:00.000Z",
  "updatedAt": "2026-08-29T14:01:00.000Z",
  "source": {
    "kind": "INSTRUMENT",
    "system": "MSH",
    "channel": "WEB",
    "externalId": null
  },
  "provenance": "USER_STATED",
  "informationClass": "RECORDED",
  "schemaVersion": "1.0.0",
  "context": null,
  "lifecycleStatus": "ACTIVE",
  "deletedAt": null,
  "payload": {
    "payloadType": "assessment.result",
    "payloadVersion": "1.0.0",
    "instrumentId": "health_landscape",
    "instrumentVersion": "HL-1",
    "experienceVersion": "HEALTH-LANDSCAPE-V1"
  },
  "lineage": null
}
```

### 5.1 Envelope rules

- `id` MUST be stable, unique, and never reused.
- `ownerId` identifies the data owner. It MAY be `null` during the local-only transition, but production multi-user storage must require an owner before synchronization.
- `recordType` MUST be a registered, namespaced type with a documented payload schema.
- `eventStart` represents when the event or observation applies, not when it was entered.
- `eventEnd` is optional and must not be fabricated for instantaneous or open-ended events.
- `createdAt` and `updatedAt` are immutable creation time and latest mutation time respectively.
- `source` MUST identify the origin sufficiently for audit and adapter selection. Source kinds are controlled but extensible; unknown kinds must not be coerced.
- `provenance` and `informationClass` MUST use approved values and remain independent.
- `schemaVersion` versions the envelope contract.
- `context` MAY contain purpose-limited, typed contextual metadata. It must not become an ungoverned dumping ground.
- `lifecycleStatus` MUST be one of `ACTIVE`, `AMENDED`, `SUPERSEDED`, or `DELETED` in V1.
- `deletedAt` MUST be present when status is `DELETED` and otherwise be `null`.
- `payload` MUST declare `payloadType` and `payloadVersion` and validate against the registered schema for `recordType`.
- `lineage` is required for generated or derived records and otherwise may be `null`.

Dates must use ISO 8601 with an explicit offset or UTC `Z`. Date-only health events must retain date precision and the timezone used for interpretation rather than inventing a precise instant.

### 5.2 Typed payload registry

Each `recordType` must have a registry entry defining:

- payload schema and version;
- required and optional fields;
- permitted information classes and provenance values;
- source adapters;
- sensitivity level and authorized purposes;
- validation and missingness rules;
- migration path;
- Calendar projection eligibility; and
- AI context eligibility.

UI labels and current page structure are presentation concerns and must not substitute for stable record semantics.

## 6. Generated and derived record lineage

Every generated, transformed, summarized, estimated, predicted, or inferred record must include:

```json
{
  "sourceRecordIds": ["source-id-1"],
  "method": "cycle-length-calculation",
  "methodVersion": "1.0.0",
  "model": null,
  "modelVersion": null,
  "generatedAt": "2026-08-29T14:02:00.000Z",
  "uncertainty": {
    "kind": "DESCRIPTIVE",
    "value": null,
    "note": "Calculated from two recorded period starts"
  },
  "supersedes": null,
  "supersededBy": null
}
```

Lineage rules:

1. `sourceRecordIds` must refer to immutable record identities, including records later superseded or deleted.
2. `method` and `methodVersion` must be deterministic identifiers, not prose-only descriptions.
3. Model-generated records must include provider/model identity in `model` and the exact deployed version or snapshot in `modelVersion` where available.
4. Uncertainty must be represented according to the method's actual capability. Unknown uncertainty must be stated as unknown, not omitted to imply certainty.
5. Recalculation creates a new version or record and links `supersedes`/`supersededBy`; it must not rewrite the prior generated result in place.
6. A presentation-only projection need not become a durable record. If it is saved, used in a decision, or presented later as historical knowledge, it must meet the full lineage contract.

## 7. Missingness and validation

Missing, skipped, not applicable, not sure, unavailable, and not collected are distinct states when the instrument or payload supports them. Zero, false, and an empty string must not be used as generic missing values.

Invalid or unclassifiable records must be quarantined for migration/diagnostic review. They may be displayed only as explicitly unclassified legacy data when safe; they must not be promoted into analytics, Calendar facts, AI context, or confirmed summaries.

## 8. Assessment and instrument identity

Every assessment response, result, and summary must preserve:

- `instrumentId` — stable identity of the measurement instrument;
- `instrumentVersion` — scientific construct, item, response-scale, and scoring version; and
- `experienceVersion` — participant-facing flow, wording, ordering, and interaction version.

Additional recommended fields include `administrationId`, `itemId`, `constructId`, `timeframe`, `responseValue`, `responseScale`, `missingness`, and scoring method/version.

Rules:

1. Instrument identity is immutable after record creation.
2. Results from different instruments must not be silently averaged, compared, substituted, or merged.
3. A UI redesign that changes participant interpretation must increment `experienceVersion` even if scoring is unchanged.
4. Item, construct, response scale, or scoring changes require an `instrumentVersion` change.
5. Historical records retain the version under which they were collected.
6. Cross-version comparison requires an explicitly reviewed comparability method and lineage; absence of such a method means no comparison claim.

## 9. Calendar projection rules

Calendar is a time-based projection of canonical records, not an independent source of truth. It answers what was happening around a time while preserving the source record and its classification.

### 9.1 Classification gate

Calendar MUST NEVER default absent information metadata to `RECORDED`.

A Calendar item may receive classification only from:

1. explicit valid metadata on the canonical source record; or
2. a deterministic, registered typed source adapter whose mapping is covered by tests.

If neither establishes classification, the item must not be promoted as a recorded fact. It must be excluded from factual Calendar surfaces or clearly quarantined as unclassified legacy data.

### 9.2 Projection integrity

- Projections must retain `recordId`, `recordType`, time precision/timezone, `source`, `provenance`, `informationClass`, lifecycle status, and applicable lineage.
- Projecting a record must not mutate or duplicate its canonical source.
- `RECORDED`, `PERSONAL_OBSERVATION`, `ESTIMATED`, and `PREDICTED` states must be distinguishable in semantics available to all users, not color alone.
- Predictions may be recalculated or replaced without altering recorded history.
- Deleted records must not appear in ordinary Calendar views; tombstones remain available to authorized audit/migration processes.
- Calendar filtering or visual grouping must not imply causation, improvement, adherence, or personal meaning.
- Temporal proximity may be shown descriptively. A causal or associative claim requires an approved analytic method, sufficient data, uncertainty, and lineage.

## 10. Evidence integrity

General education and personal records must remain distinct. Evidence content should retain citation/source identifiers, publication and review dates, evidence version, relevant population, limitations, and author/editorial review where applicable.

Population findings must not be presented as facts about an individual. Statistical association must not be described as causation. A personal observation derived from recorded history must state its observation window, number of included records/cycles where relevant, missing-data limitations, and source lineage.

Evidence updates create new versions; they must not silently rewrite the basis of a previously stored personal decision or generated statement.

## 11. AI and inference boundaries

1. AI reads only purpose-authorized, sanitized context from canonical records.
2. AI context must preserve record identity, provenance, information class, and relevance boundaries.
3. A model output is `MODEL_INFERRED` unless it is solely a faithful rendering of a differently classified source and the rendering relationship remains explicit.
4. Model inference must use tentative language and must not become a user fact, diagnosis, goal, Project, Practice, reminder, or lifecycle change without the appropriate controlled action and explicit user decision.
5. User confirmation produces `USER_CONFIRMED` provenance while retaining the model-generated source in lineage.
6. Prompts, conversation summaries, and vector stores must not become a competing personal health record or hidden AI memory system.
7. Model and prompt/method versions used for durable outputs must be auditable.
8. Safety interventions and tool actions must remain separate from conversational prose and must be logged without exposing unnecessary sensitive content.
9. When data is absent, ambiguous, unauthorized, or unclassifiable, the model must not fill the gap with assumed personal facts.

## 12. Privacy, ownership, and purpose limitation

Health and reproductive-health records are sensitive. The person owns their personal record; the product is a custodian and processor subject to disclosed purposes and controls.

- Access must be scoped by owner and purpose, with least privilege.
- Permission for one surface (for example Cycle Calendar) does not automatically permit use by Workspace, Hello, analytics, or export.
- Sensitive categories require explicit, independently revocable permissions where product use crosses contexts.
- Authentication and row-level authorization will be mandatory before multi-user backend synchronization.
- Data must be encrypted in transit and at rest in any future hosted system.
- Logs, error reports, analytics, and support tooling must redact personal content and secrets by default.
- Production data must not be used for model training, demonstrations, or development fixtures without explicit, informed authorization and an approved governance path.
- Export must preserve meaning, timestamps, classifications, provenance, versions, and deletion status where appropriate.
- The local-only transition and its loss/device-sharing risks must be disclosed rather than represented as durable secure cloud storage.

## 13. Data minimization

Collect the smallest amount of data needed for a defined user benefit. Every collected field and every cross-surface exposure must have a documented purpose, retention expectation, sensitivity classification, and deletion behavior.

Do not collect data merely because it may become useful. Do not duplicate canonical records for display convenience. Derived caches must be reproducible, bounded, and disposable. Free text should not be copied into analytics or third-party telemetry.

## 14. Durability, lifecycle, and deletion

Canonical records must survive refresh, application updates, schema migrations, and presentation changes without semantic loss.

- Amendments preserve the original and identify what changed, by whom, when, and why.
- Supersession links old and new records without erasing either.
- User deletion sets `lifecycleStatus: DELETED` and `deletedAt`, removes the record from normal product use, and initiates the applicable retention/deletion process.
- Hard deletion may occur after the declared recovery, legal, and backup-retention period. Tombstone metadata should retain only what is necessary to prevent resurrection and prove deletion.
- Derived descendants of corrected/deleted sources must be invalidated, recalculated, superseded, or removed from presentation. Their audit lineage must not falsely imply the source remains active.
- Backup restoration must reapply later deletions and tombstones.

## 15. Migration standard

Every migration must be versioned, idempotent, testable, observable, and recoverable.

A migration plan must include:

- source and target schema versions;
- field-by-field mapping;
- typed adapter and classification rules;
- preservation of IDs, timestamps, authorship, instrument identity, provenance, and history;
- missing/unclassifiable-data handling;
- dry-run counts and validation results;
- rollback or protected checkpoint;
- post-migration reconciliation; and
- explicit exclusions.

Migrations must not default unknown classifications, silently upgrade instrument versions, merge different instruments, or overwrite legacy data. Unclassifiable records go to a reviewable quarantine state.

## 16. Third-party dependencies

Each dependency that can access, transform, transmit, render, or store health-related information must have a reviewed register entry covering purpose, data accessed, network behavior, processor/subprocessor role, retention, security posture, privacy terms, license, pinned version, update policy, failure behavior, and removal path.

Third-party scripts must not receive personal health content by default. New external transmission requires explicit architecture and privacy review. Secrets must remain server-side and must never be embedded in browser code, committed files, logs, or screenshots.

## 17. Accessibility and equivalent meaning

Data classification and uncertainty must be understandable without relying only on color, position, animation, sound, or visual polish. Recorded, observed, estimated, predicted, and educational content require accessible text semantics.

All record-driven experiences must support keyboard use, visible focus, meaningful headings/labels, screen-reader status announcements where state changes, sufficient contrast, text scaling, touch targets, reduced motion, and readable fallbacks when advanced visual effects are unavailable.

Accessibility preferences are presentation settings, not health facts. Assistive-technology use must not be inferred into personal meaning or exposed as health context.

## 18. Governance, audit, and change control

Changes to this standard, enum semantics, canonical instrument identity, payload schemas, adapters, or AI promotion rules require:

1. a documented rationale and affected-record inventory;
2. privacy, evidence, accessibility, and migration impact review;
3. backward-compatibility and regression tests;
4. an explicit standard/schema version change when semantics change; and
5. named approval recorded in repository history.

Audit events must be append-only and sufficient to reconstruct material record creation, amendment, confirmation, transformation, supersession, access-controlled action, and deletion without retaining unnecessary sensitive prose.

An implementation is nonconforming if it can present an unclassified value as recorded fact, lose instrument identity, erase inference lineage after confirmation, duplicate the canonical personal record, or make health meaning depend on inaccessible presentation behavior.

## 19. V1 implementation checklist

- [ ] Create the canonical envelope and typed payload validators.
- [ ] Establish a versioned `recordType`/payload registry.
- [ ] Inventory existing local records and map each to a typed adapter.
- [ ] Preserve `health_landscape` as the canonical Health Landscape instrument identity.
- [ ] Preserve Dimensions V2 under its distinct identity without exposing or merging it.
- [ ] Require `instrumentId`, `instrumentVersion`, and `experienceVersion` on all assessment records.
- [ ] Keep `source`, `provenance`, and `informationClass` as independent fields.
- [ ] Add complete lineage to generated, derived, estimated, predicted, and model-inferred records.
- [ ] Reject/quarantine missing or invalid classifications; never default them to `RECORDED`.
- [ ] Register and test deterministic Calendar source adapters.
- [ ] Verify Calendar projections never mutate or duplicate canonical history.
- [ ] Add migration dry-run, rollback/checkpoint, and reconciliation tooling.
- [ ] Add ownership and purpose-scoped authorization before backend synchronization.
- [ ] Add deletion/tombstone propagation tests, including derived descendants and backups.
- [ ] Sanitize AI context while preserving provenance, information class, relevance, and lineage.
- [ ] Add evidence metadata and versioning for educational content.
- [ ] Create the third-party dependency/data-access register.
- [ ] Test accessibility of classification, uncertainty, and state changes without color or motion.
- [ ] Document retention, export, recovery, and local-transition limitations.
- [ ] Add conformance tests that fail on instrument conflation, provenance promotion, unknown classification, history mutation, and unauthorized cross-context exposure.
