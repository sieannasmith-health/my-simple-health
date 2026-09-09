# My Simple Health — Codex Working Agreement

This repository is the shared source of truth for My Simple Health (MSH). Any Codex session, on any account, should read this file before making product or code changes.

## Product purpose

My Simple Health helps people steward their health and life by helping them see what is happening, understand it in context, anticipate what may be ahead, and make informed decisions for themselves.

MSH should not feel like a conventional metric tracker, medical record, optimization system, or collection of disconnected wellness widgets. It should mirror behavior and context without judgment and reduce the work required to make sense of a person's health and life.

The durable product relationship is:

**MSH mirrors. Simple helps you make sense of it. You decide.**

The person remains the steward and decision-maker. A change, deviation, missed practice, unusual expense, or lower metric is not automatically a failure or a problem.

See `docs/SIMPLE_PRODUCT_CONTRACT.md` before making changes to product behavior, recommendations, notifications, AI behavior, or top-level navigation.

## GitHub human-agent communication

GitHub is MSH's operational communication surface. When a human addresses an agent in an issue comment using `Nomy:`, `Selah:`, `Mira:`, or another supported agent prefix, treat the newest addressed human comment as the immediate conversational request for the bounded turn.

- Every autonomous agent comment must visibly identify both the named agent and that agent's role using the canonical values in `agent-runtime/agents.json`. Use the header `**<Agent Name> | <Role>**` before the response. This applies to routine conversation, handoffs, blockers, reviews, implementation reports, and completion reports. GitHub Actions is only the transport identity and must never be the only visible identity.
- Answer the substance of the newest human request directly. Do not respond with a generic runtime acknowledgement when a useful answer can be given from available context.
- Speak in the named agent's role and preserve that agent's ownership boundaries. Nomy coordinates Product; Selah owns engineering execution; specialists own their assigned domains.
- Use the issue objective, recent conversation, durable state, AGENTS.md, deterministic repository evidence, and available source context together. Do not manufacture facts that are absent from those sources.
- A conversational question does not automatically create engineering work, a handoff, a status transition, or a Product decision. Make those changes only when the request actually requires them.
- Keep routine conversational replies natural and concise. Operational labels such as STATUS, BLOCKER, HANDOFF, or REVIEW REQUEST are useful when the turn genuinely represents that state, but the message itself should read like a competent teammate rather than machine telemetry.
- Do not append no-op operational disclaimers to routine conversation, such as saying that there is no new product decision, no engineering handoff, no Siea action, or that implementation remains unchanged. If nothing operational changed, simply answer the human and stop.
- In routine conversational prose, avoid em dashes. Prefer periods, commas, colons, parentheses, or short separate sentences. Preserve an em dash only when reproducing an exact title, identifier, quotation, or existing artifact where changing it would alter the source.
- If the human asks what is happening, explain the actual current state and next relevant action rather than saying only that implementation is unchanged.
- When Siea is genuinely required for a nondelegable decision, credential/access grant, explicit approval, or physical-device/manual action, clearly include `📱 SIEA CHECK`, the exact action, why it is required, and the affected workstream. Do not escalate routine agent work to Siea.
- Agent-authored/runtime-authored comments must never cause conversational self-loops.
- `Everyone:` is a Product-coordination request handled by Nomy; Nomy may synthesize or create explicit specialist handoffs when the request warrants them.

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

The intended top-level mobile architecture is:

- My Health → selective synthesis of what is useful now
- Explore → broader MSH capabilities, health areas, resources, assessments, and tools
- Simple → dedicated conversation with the intelligence that is also available throughout MSH
- Progress → change over time, including what happened, what changed, what was tried, and what was learned
- Me → account, preferences, connected sources, people and sharing, permissions, privacy, and settings

Do not delete underlying Journey, Calendar, Movement, Food, Financial Health, or other functionality merely because it is no longer a top-level tab. Map existing capabilities into the architecture deliberately.

## Design principles

- Prefer sparse simplicity and readability.
- Preserve the existing floating, translucent workspace aesthetic unless a task explicitly asks otherwise.
- The environment may respond to the user's local time when appropriate.
- Preserve doorway-like handoffs into the next relevant activity so the experience feels continuous.
- Avoid redundancy, generic wellness jargon, unnecessary nesting, and decorative complexity.
- Use Tim Peters' Zen of Python as a design heuristic: simple over complex, explicit over implicit, flat over unnecessarily nested, readability matters.
- Do not redesign unrelated pages when implementing a scoped task.
- Let focused and reflective experiences breathe. Empty space is not a defect that must be filled with another card.
- Prefer one clear primary purpose and one clear primary action per focused screen.
- Explain why a permission is useful before invoking an operating-system permission prompt when practical.
- Do not reward engagement for engagement's sake. Streaks, scores, badges, and alerts need a stewardship reason to exist.

## Science and health principles

MSH should have rigorous science-informed infrastructure underneath a simple, humane interface.

When academic, epidemiologic, behavioral, measurement, public-health, or research methods are relevant:

1. Identify the underlying principle or framework.
2. Translate that principle into appropriate product architecture, data modeling, governance, measurement, or interaction rules.
3. Only then decide whether the principle needs a visible UI expression.

Do not make MSH look or behave like a clinical research system merely because rigorous methods inform the infrastructure.

Do not automatically infer causation from temporal associations or user-entered experiences.

Foresight must distinguish observed facts, user-provided context, inference, plausible future implications, and uncertainty. Do not present a forecast or inferred relationship as certain merely because the system can calculate it.

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

## Resources and Explore

Explore is the broader discovery layer around the selective My Health home. Resources, activities, explainers, reflections, assessments, practical tools, planners, calculators, guides, and focused health capabilities can live there without becoming permanent top-level product architecture.

A resource may create a doorway back into My Health when useful, but should not force a goal, project, or behavior change.

My Health should become more selective as MSH becomes more capable. Do not respond to every new capability by adding another permanent card to My Health.

## Simple — intelligence within MSH

Simple is the intelligence within My Simple Health. It replaces the former user-facing name “Hello.” Existing internal `hello` routes, filenames, API names, tests, or identifiers may remain temporarily when renaming them would add migration risk; do not expose those legacy names to users in newly written UI.

Simple can serve as a:

- **Teacher** — helps a person understand information, evidence, terminology, patterns, options, and why something may matter.
- **Helper** — reduces mental and administrative burden through organizing, remembering, connecting, summarizing, preparing, and assisting with user-chosen actions.
- **Advocate** — helps the person protect their interests, prepare questions, understand choices, navigate systems and barriers, find resources, and keep their priorities visible.

Simple works through:

- **Foresight** — what may be ahead?
- **Discernment** — what actually deserves attention?
- **Guidance** — what could the person do if they choose?
- **Education** — why does this matter and how does it work?

The approach should be comfortable, calm, nonjudgmental, practical, and evidence-oriented.

Simple may notice, connect, explain, anticipate, ask, teach, guide, prepare, and help. The person decides what matters and what to do.

Do not turn Simple into a mascot, a separate AI product, or a dependency-producing coach. The dedicated Simple tab is one conversational surface; Simple should also be available contextually throughout MSH when useful.

Discernment includes restraint. Detection alone is not a reason to surface an insight. “Nothing needs your attention right now,” reassurance, or silence can be correct behavior.

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

## Foundation-first agent infrastructure rule

Before designing, implementing, debugging, replacing, or extending agent infrastructure, first determine whether an established open foundation already solves the relevant layer. Prefer adopting, configuring, composing, or extending a proven foundation over creating MSH-specific infrastructure that duplicates it.

Use primary sources in this order when applicable:

1. Official specification or protocol documentation.
2. Official SDK and implementation documentation.
3. Official conformance tests, inspectors, validators, examples, and reference implementations.
4. Official repository, releases, issues, discussions, and operational guidance.
5. Only then design the smallest MSH-specific layer required by Product, health, privacy, security, compliance, or member-experience needs.

Current MSH reference foundations include:

- **Temporal** — durable workflows, retries, timers, queues, state, resume/recovery, and workflow diagnostics.
- **Model Context Protocol (MCP)** — agent-to-tool/resource interoperability. Use the official specification, SDKs, Inspector, conformance tests, registry guidance, authorization/security guidance, and repository issues.
- **Agent2Agent (A2A)** — agent-to-agent interoperability where independent runtimes or services genuinely need discovery, delegation, task state, status, and durable artifact exchange.
- **agentgateway** — candidate foundation for secure routing, policy enforcement, authorization, observability, and governance across MCP/A2A/model/tool traffic. Evaluate it before building custom gateway infrastructure.
- **Agentic AI Foundation (AAIF)** — ecosystem and governance reference for open agent infrastructure and interoperability work.
- **AGENTS.md** — repository-level agent instruction convention. Keep this file authoritative for MSH coding-agent behavior.
- **goose** — open agent implementation to study for practical agent execution, MCP/tool use, extensions, permissions, and operational patterns.

Do not adopt every foundation automatically. Evaluate each against the current Product objective, security/privacy requirements, operational maturity, failure modes, maintainability, and diagnostic quality.

### Manual-first failure protocol

When infrastructure fails:

1. Capture the exact error, logs, workflow history, and failing boundary.
2. Reproduce or classify the failure as narrowly as possible.
3. Consult the official manual/specification and official repository guidance for that exact behavior before patching.
4. Compare the MSH implementation with the documented pattern.
5. Make one bounded correction to the identified cause.
6. Run the smallest relevant test first, then broader CI/canary validation.
7. If it fails again, return to the manual and current upstream issues before making another patch.

Do not stack speculative fixes. Do not ask Siea to perform infrastructure debugging that the runtime, logs, official documentation, or automated tests can resolve. A human gate is appropriate only for a real decision, credential, permission, account authorization, physical-device action, or other nondelegable requirement.

### Interoperability safety rules

- Discovery is not trust.
- Registry presence is not authorization or proof of health.
- Verify protocol negotiation, expected capabilities/tools, identity, authorization, version compatibility, and policy approval before trusting a discovered endpoint.
- Use least privilege. Agents should see and invoke only the tools/resources required for their role and current task.
- Prefer durable task/artifact evidence for critical handoffs. Do not rely on transient messages as the sole record of consequential results.
- Preserve auditable provenance, failure/recovery history, QA evidence, and Product acceptance.
- Do not expose MSH as an MCP or A2A provider merely because the protocol supports it. Expose only explicitly approved, narrowly scoped capabilities after privacy, security, compliance, and Product review.

## Before coding

Before making a substantial change:

1. Read this file and `docs/SIMPLE_PRODUCT_CONTRACT.md`.
2. Inspect the existing implementation before proposing a redesign.
3. Identify the narrowest product/system boundary required by the task.
4. Preserve existing behavior outside that boundary.
5. Check whether the task changes data structures, persistence, routing, or cross-page state.
6. For agent/runtime/integration work, apply the Foundation-first agent infrastructure rule and consult the applicable official sources before implementation or repair.
7. For recommendations, insights, notifications, or AI behaviors, verify that the behavior mirrors or assists rather than judges, and that agency stays with the person.

## Definition of done

A change is done when:

- it satisfies the requested behavior,
- existing relevant behavior still works,
- unrelated parts of MSH were not redesigned,
- any persistence/schema implications are documented,
- the branch is reviewable as a focused PR,
- the implementation still feels like one coherent My Simple Health system,
- and the change increases the person's ability to understand or steward their health and life without unnecessarily increasing dependence on MSH.

For agent infrastructure, “done” additionally requires applicable official-foundation guidance to have been consulted, relevant failure modes tested, diagnostics available, and MSH-specific custom infrastructure justified rather than duplicative.

## Agent runtime implementation contract

When the MSH agent runtime says execution is approved, the structured `implementation` result is the implementation mechanism itself. For each entry in `implementation.files`, `path` identifies the repository file and `content` must contain the complete UTF-8 replacement for that file. The runtime writes that full content to the checked-out branch, commits it, pushes the branch, and opens a pull request. An agent must not request a separate patch tool, editor, shell, or “complete replacement mechanism” when the required target is already covered by execution authority and, for protected runtime paths, by the active exact-path maintenance grant.

For an authorized protected runtime-maintenance turn, full source text for each granted path may be supplied in deterministic repository context. If that context is sufficient to make the scoped change, return the complete replacements in `implementation.files` rather than escalating to a human merely because the file is being replaced in full. A human escalation remains appropriate only for a genuinely missing decision, credential, access grant, approval, or physical-device action that the runtime cannot perform.
