# My Simple Health — Codex Working Agreement

This repository is the shared source of truth for My Simple Health (MSH). Any Codex session, on any account, should read this file before making product or code changes.

## Product purpose

My Simple Health is a health education and health promotion platform designed to help people understand their health as a coherent whole. It should support science-based self-exploration, practical health understanding, and continuity across a person's experiences over time.

MSH should not feel like a conventional metric tracker, medical record, or collection of disconnected wellness widgets.

## Core experience model

Use the following conceptual map when deciding where functionality belongs:

- Landscape → What does my health look like?
- Horizon → Where am I trying to go?
- Path → What am I working on?
- Practice → What am I doing?
- Discovery → What am I learning?
- Journey → How have I changed?
- Calendar → What is happening when?

These are parts of one system. Preserve continuity between them rather than designing isolated modules.

## Design principles

- Prefer sparse simplicity and readability.
- Preserve the existing floating, translucent workspace aesthetic unless a task explicitly asks otherwise.
- The environment may respond to the user's local time when appropriate.
- Preserve doorway-like handoffs into the next relevant activity so the experience feels continuous.
- Avoid redundancy, generic wellness jargon, unnecessary nesting, and decorative complexity.
- Use Tim Peters' Zen of Python as a design heuristic: simple over complex, explicit over implicit, flat over unnecessarily nested, readability matters.
- Do not redesign unrelated pages when implementing a scoped task.

## Science and health principles

MSH should have rigorous science-informed infrastructure underneath a simple, humane interface.

When academic, epidemiologic, behavioral, measurement, public-health, or research methods are relevant:

1. Identify the underlying principle or framework.
2. Translate that principle into appropriate product architecture, data modeling, governance, measurement, or interaction rules.
3. Only then decide whether the principle needs a visible UI expression.

Do not make MSH look or behave like a clinical research system merely because rigorous methods inform the infrastructure.

Do not automatically infer causation from temporal associations or user-entered experiences.

## Calendar

Calendar already exists. Treat it as an existing architecture, not a blank-slate feature.

Calendar = health in time.

Menstrual health, movement, appointments, symptoms, medications, preventive care, life context, practices, and other dated health events may appear as layers within Calendar. No single layer should become the reason Calendar exists.

## Movement and workout planning

Movement is one Calendar layer. Workout planning is one capability within Movement.

A useful workflow is:

Plan → Access → Experience → Reflect → Context

For example: save a YouTube workout or custom routine → schedule it → open it from Calendar → start → finish → record RPE and optional reflection.

Do not rebuild Calendar to add Movement functionality.

## Resources

Resources is the expanding toolbox surrounding the core My Health system. Activities, explainers, reflections, assessments, practical tools, planners, calculators, and guides can live there without becoming permanent top-level product architecture.

A resource may create a doorway back into My Health when useful, but should not force a goal, project, or behavior change.

## AI / companion behavior

Do not make a mascot or physical companion being a current product dependency. A small companion may be revisited later as a delight layer, but it is not a current priority.

Avoid building core product architecture around an AI coach unless a task explicitly restores that priority.

## Collaboration rules

Multiple Codex sessions may work on this repository in parallel.

- Never use `main` as a working branch.
- Create one branch per task.
- Use descriptive branch names such as `feature/calendar-workouts`, `fix/mobile-spacing`, or `chore/data-model`.
- Keep each branch scoped to one coherent task.
- Do not make opportunistic unrelated refactors.
- Pull or rebase from `main` before starting substantial work and again before opening a PR when practical.
- Open a pull request for review before merging into `main`.
- In the PR description, state what changed, what was intentionally left unchanged, and any data/schema implications.
- If two tasks touch the same files or system boundary, coordinate before both agents make large edits.

## Data and Supabase

Supabase may be used for persistent application data, but schema changes must be intentional and coordinated.

- Do not create tables opportunistically feature by feature without considering the broader MSH information architecture.
- Prefer a coherent relational model over duplicated feature-specific data.
- Treat authentication, row-level security, privacy, longitudinal consistency, variable definitions, and data provenance as first-class concerns.
- Schema migrations should be explicit and reviewable.
- Never commit secrets, service-role keys, private API keys, passwords, or production credentials.

## Before coding

Before making a substantial change:

1. Read this file.
2. Inspect the existing implementation before proposing a redesign.
3. Identify the narrowest product/system boundary required by the task.
4. Preserve existing behavior outside that boundary.
5. Check whether the task changes data structures, persistence, routing, or cross-page state.

## Definition of done

A change is done when:

- it satisfies the requested behavior,
- existing relevant behavior still works,
- unrelated parts of MSH were not redesigned,
- any persistence/schema implications are documented,
- the branch is reviewable as a focused PR,
- and the implementation still feels like one coherent My Simple Health system.
