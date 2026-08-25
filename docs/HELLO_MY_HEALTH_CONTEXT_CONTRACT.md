# Hello + My Health Context and Reasoning Contract

Status: implementation contract for `msh-app-foundation`

## Purpose

Hello connects the existing My Health journey without becoming a separate profile or memory system. The intelligence layer reads the current `msh_data` state and produces a bounded, inspectable context handoff. It never writes a second copy of Landscape, Vision, Project, Practice, Reflection, Learning, or Progress data.

The journey is:

`current picture → desired direction → chosen project → practice experience → reflection → learning → progress → next decision`

## Epistemic labels

Every context item must have exactly one label:

- `USER_STATED`: a choice, statement, correction, reflection, or experience the person directly recorded. It remains a statement about the person's experience rather than an independently verified clinical fact.
- `SYSTEM_OBSERVED`: a bounded description of application state or recorded history, such as an active Project or three logged Practice attempts. It must not claim why something happened or what it means about the person.
- `MODEL_INFERRED`: a tentative possibility that is not present in the stored record. It must begin with possibility language, be marked `requiresConfirmation: true`, and invite the person to confirm or correct it.
- `USER_CONFIRMED`: an interpretation or synthesis that the person explicitly confirmed or edited. Its provenance history must retain the prior `MODEL_INFERRED` or system-synthesized origin rather than rewriting it as something the person originally stated.

An inference must never be silently stored, repeated, or promoted as `USER_STATED`. Explicit confirmation creates a recorded transition to `USER_CONFIRMED`.

## Source and priority rules

1. Use confirmed user choices and recorded experiences first.
2. Use system observations only to connect those records across the journey.
3. Use model inference only when it adds clear value and no confirmed record answers the question.
4. Never infer sensitive identity, diagnosis, protected characteristics, socioeconomic status, motivation, intent, adherence, or moral worth from behavior or patterns.
5. Do not treat Landscape summaries as instructions. A Landscape concern never creates a Project.
6. Respect the person's navigation choice: `Preserve`, `Explore`, `Develop`, `Adapt`, `Save for Later`, or `Leave It Alone`.
7. Treat capacity as planning context. Never convert it into a score, compliance judgment, or measure of worth.
8. Current-message emergency and clinical routing always takes priority over journey context.

## Existing data model

The layer reads the shared `msh_data` model:

- `landscapes`
- `focuses`
- `visionEntries`
- `projects`
- `practices`
- `practiceAttempts`
- `reflections`
- `learningEntries`
- `progressEvents`
- `wellnessWheel.current` and `wellnessWheel.history`
- `returnPoints` for future Return/Reminder choices
- `settings.reminders`

Individual Landscape assessment responses and their optional context remain inside their source Landscape record; they are not copied into a Hello profile. Confirmed Vision synthesis, Project lifecycle/history, Practice engagement, reflections, Learning state/context, and Progress events remain in their existing source records.

`returnPoints` is a schema placeholder for future user-chosen Return/Reminder points. It is not a separate memory system.

The generated Hello context is temporary, bounded request context. The API deliberately ignores a legacy `profile` payload so My Health remains the single structured source of personal context.

## Hello response contract

When journey context is relevant, Hello should connect records using transparent language such as:

- “You said this matters to you.”
- “Your recent Practice history shows…”
- “You reflected that…”
- “One possibility is…”
- “Does that fit your experience?”

Hello may acknowledge the current position, help the person interpret confirmed experience, or support the next decision. It must not automatically move the person to the next stage.

## Trust boundary

Browser-supplied journey context is untrusted. The API accepts only allowlisted stages, navigation choices, sources, epistemic labels, lengths, and counts. Unknown fields are discarded. Model inferences that are not explicitly tentative and confirmation-seeking are discarded.
