# My Simple Health Spiritual Tool Architecture

## Product role

Spiritual is an optional, user-defined tool inside **Tools**. It exists to help a person organize and practice the spiritual or reflective sources, traditions, and practices they choose. MSH must not assume a religion, worldview, sacred text, or spiritual practice for the user.

The experience follows the broader MSH principle: **simple on the surface, extensible underneath**.

## Tools placement

```text
Tools
- Landscape
- Self-Insight
- Horizon
- Path
- Practice
- Discovery
- Journey
- Food
- Financial Health
- Spiritual
```

User-facing description:

> Build a spiritual practice around the sources and traditions that matter to you.

Spiritual is optional and can be added, removed from the active experience, and re-added later without deleting existing history.

## Spiritual profile

The setup model must be user-defined rather than hard-coded to one religion.

```text
Spiritual profile
- Tradition / worldview (optional, user-defined)
- Sources
- Preferred edition / translation
- Practices
- Themes
- Frequency
- Reminder preferences
- Smart-layer preferences
```

Example source choices may include Bible, Quran, Torah and related texts, Buddhist texts, Hindu texts, Daoist texts, other supported sources, no specific tradition, or a custom source. These are examples, not identity assignments.

## Source connector architecture

MSH should not create religion-specific retrieval functions such as `getBibleVerse()` as the core architecture. Use a generic source connector contract so supported content providers can be added without redesigning the feature.

Conceptual model:

```text
SpiritualSource
- id
- user_id
- source_type
- tradition_label
- title
- edition_or_translation
- provider
- provider_source_id
- connection_type
- attribution_requirements
- enabled
- created_at
- updated_at
```

Possible connection types:

- licensed API / content provider
- user-connected provider
- user-provided source material where permitted
- manual passage or citation

A connector is responsible for retrieval, source identifiers, edition/translation metadata, licensing/attribution requirements, and provenance.

## Practices

Built-in starting points can include:

- Read
- Meditate
- Prayer
- Reflection
- Gratitude
- Journaling
- Saved passages
- Custom practice

The user may enable only the practices they want.

Conceptual model:

```text
SpiritualPractice
- id
- user_id
- name
- practice_type
- source_ids[]
- cadence
- reminder_preferences
- smart_layer_enabled
- enabled
```

## Meditate

Meditate is a reusable practice, not a Bible-only feature.

For a Bible-configured profile, the intended flow is:

```text
Selected Bible source + translation
        ↓
Retrieve actual Scripture from approved source
        ↓
Preserve passage reference + source metadata
        ↓
MSH Smart Layer receives the retrieved passage
        ↓
Generate Scripture-grounded affirmation / reflection
        ↓
Present source and generated content as distinct layers
```

A user's configuration may include:

```text
Source: Bible
Translation: user-selected
Theme: user-selected or open
Practice: Meditate
Include: Scripture / affirmation / reflection / prayer
Length: short / standard / deep
Frequency: user-selected
Reminder: optional
```

The same Meditate structure can work with another source chosen by another user.

## Provenance boundary

This is non-negotiable.

MSH must always distinguish among:

1. **Source text**: retrieved or user-supplied sacred/spiritual text with source, citation/reference, edition/translation, and provider where applicable.
2. **MSH-generated content**: affirmation, devotional, reflection, prompt, summary, or other smart-layer output.
3. **User-created content**: prayer, journal entry, note, reflection, highlight, or saved thought.

Generated text must never be visually or structurally represented as sacred/source text.

The smart layer must not invent a quotation and attribute it to a sacred text. When source text is required, retrieve it first from the selected source connector and ground the generated response in that retrieved content.

## Smart-layer boundary

OpenAI or another future reasoning service sits after source retrieval.

```text
User spiritual preferences
        +
Relevant selected source
        +
Retrieved passage/source content
        +
Relevant user-authored context, only when permitted
        ↓
MSH backend smart layer
        ↓
Structured generated output
        ↓
MSH Spiritual interface
```

The client must not hold secret API keys. Smart-layer requests should go through the authenticated MSH backend.

Only the minimum relevant context should be sent for a generation request. The user's entire profile or health history should not be attached automatically.

## Calendar and notifications

Spiritual practices may optionally participate in Calendar and notifications, but the user controls this independently.

Examples:

- morning reading
- Meditate reminder
- revisit today's passage
- prayer or reflection time
- custom spiritual practice

A reminder is an execution layer, not the spiritual framework itself.

## Privacy

Spiritual data should be treated as sensitive personal context.

Requirements:

- optional feature
- explicit user configuration
- no inferred tradition or belief
- no cross-feature use without a governed permission/purpose
- preserve source provenance
- allow history to remain private to Spiritual unless the user intentionally connects it elsewhere
- removal from Tools must not silently delete spiritual history

## Initial native implementation

The first native version should be deliberately small:

1. Add **Spiritual** to the Tools surface.
2. Open a native Spiritual landing/setup screen.
3. Allow the user to define tradition/worldview optionally.
4. Allow selection or creation of spiritual sources.
5. Allow preferred edition/translation metadata.
6. Allow practices including Read, Meditate, Prayer, Reflection, Gratitude, Journaling, and Custom.
7. Persist preferences locally using the existing app state pattern until the broader account/backend model is ready.
8. Add a source-connector interface, but do not hard-code or fake content retrieval before a real provider is connected.
9. Keep Bible, Quran, Daoist, and other source integrations modular.
10. Keep generated smart-layer content disabled until the authenticated backend/OpenAI layer is available.

## Future source integration

Before connecting a content provider, verify:

- API availability
- licensing and redistribution terms
- supported translations/editions
- attribution requirements
- storage/cache limits
- rate limits and pricing
- whether user authentication is required

Do not scrape copyrighted sacred-text editions to bypass provider terms.

## Product boundary

**MSH provides the structure. The person defines what belongs inside their spiritual life.**

For one user the experience may be deeply Bible-centered. For another it may use the Quran, Daoist texts, another source, personal reflection only, or remain disabled entirely. The framework must be capable without making the user's choice for them.
