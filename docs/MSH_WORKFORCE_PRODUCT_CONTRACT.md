# MSH Workforce v0.1 Product Contract

Issue: #255

## Purpose

MSH Workforce is the employee-side operating system for an AI-native My Simple Health workforce. It organizes onboarding, asynchronous objectives, AI execution, human-in-the-loop work, milestones, and role growth in one experience.

## Governing principle

> MSH does not use AI to make humans work faster at unnecessary tasks. AI performs automatable work so humans can concentrate on judgment, accountability, creativity, relationships, approvals, and actions that genuinely require a person.

The employee is accountable for their workstream without being required to manually reproduce work an authorized AI worker can perform.

## First campaign: onboarding

Onboarding is not a separate product. It is the employee's first Workforce campaign. The same task, milestone, evidence, and progress model continues into everyday work after onboarding.

## Execution types

Every Workforce task MUST declare one execution type:

- `ai` — an authorized AI worker can execute independently within its existing permissions.
- `review` — AI prepares the work; a human reviews the result.
- `collaborative` — meaningful human and AI contribution is expected.
- `human_action` — the task contains an action that must be performed personally or physically by the human.
- `approval` — the work may be prepared by AI, but a human with the required authority must approve or decide.

The UI must not imply that a human performed work completed by AI.

## Task states

v0.1 supports:

- `queued`
- `ai_working`
- `ready_for_human`
- `in_progress`
- `blocked`
- `completed`

A future runtime adapter may map these states to durable MSH agent runtime / Temporal states. v0.1 does not mutate those systems.

## v0.1 employee record

```js
{
  id,
  name,
  role,
  department,
  level,
  xp,
  nextLevelXp,
  streakLabel,
  onboardingProgress
}
```

`streakLabel` is contribution-oriented and MUST NOT imply attendance surveillance or hours worked.

## v0.1 task record

```js
{
  id,
  title,
  description,
  campaign,
  executionType,
  state,
  xp,
  agent,
  dueLabel,
  evidence,
  actionLabel
}
```

## v0.1 AI worker record

```js
{
  id,
  name,
  specialty,
  state,
  assignment
}
```

## v0.1 milestone record

```js
{
  id,
  title,
  description,
  earned,
  threshold
}
```

Milestones represent demonstrated competency, contribution, responsibility, or verified accomplishment. They are not rewards for simply staying online.

## Human attention contract

The primary Workforce surface should answer, in this order:

1. What actually needs me?
2. What is AI handling for me?
3. What finished since I last looked?
4. What progress did that create?

Human-required work must be visually and semantically distinguishable from AI-only activity.

## Gamification rules

Gamification is allowed to make progress legible and motivating, not to manufacture busywork.

Allowed:

- XP for verified contribution or competency
- role levels
- campaigns and missions
- meaningful achievements
- progress toward qualification or mastery
- celebrations for completed outcomes

Not allowed in v0.1:

- punitive leaderboards
- hours-online scoring
- keystroke/activity surveillance
- rewards for unnecessary manual repetition
- opaque automated employee performance ratings

## Privacy and data boundary

v0.1 contains no member health data. Seeded employee/work data may be stored in browser local storage for interaction testing. Production employee identity, RBAC, audit, privacy, retention, and backend schema require separate review before implementation.

## Integration boundary

The first interface is intentionally adapter-ready but runtime-independent. Later phases may read authorized status from:

- MSH agent runtime
- Temporal workflows
- GitHub execution evidence
- Supabase workforce records
- MSH HQ knowledge

No new agent permissions or production mutation authority are created by v0.1.

## Product ownership

- Nomy — product objective, sequencing, acceptance
- Harper — employee journey, onboarding, role-development requirements
- Mira — employee UX, accessibility, gamification presentation
- Selah — architecture and implementation
- Tessa — acceptance/regression evidence

## v0.1 acceptance

The slice is acceptable when an employee can open Workforce and immediately understand:

- their role and progression,
- the work that requires them,
- the work AI is handling,
- the status of supporting AI workers,
- onboarding/everyday missions,
- milestones already earned and next milestones,
- and can complete an eligible seeded human task with local persistence and an XP/progress update.
