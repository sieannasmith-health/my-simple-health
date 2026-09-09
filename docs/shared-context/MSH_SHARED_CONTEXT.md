# MSH Shared Context

## Purpose
This directory is the durable company-context layer shared across authorized MSH founder workspaces and the MSH agent runtime. It exists so separate ChatGPT accounts can work from the same company facts without copying private conversation histories between accounts.

## Context layers

### 1. Shared communication stream
Canonical conversation thread: GitHub issue #271 — `MSH Shared Communication Stream — Founder + Agent Context`.

Use the stream for current discussion, cross-founder updates, agent handoffs, hypotheses, questions, and links to evidence.

### 2. Shared reference knowledge
Repository documents under `docs/shared-context/` hold durable company facts and accepted summaries that should not depend on scrolling through a conversation thread.

### 3. Decisions
`DECISIONS.md` records decisions once discussion has crossed from idea/proposal into an actual company or product decision. A discussion is not an approval.

### 4. Execution evidence
GitHub issues, pull requests, commits, CI, research artifacts, and linked documents remain the evidence layer. Shared-context documents should link to those sources instead of replacing them.

## Same-Nomy continuity contract
Any authorized Nomy instance supporting an MSH founder should behave as the same company Product/Orchestration function while preserving account privacy.

Before making a material cross-founder, product, company, or workstream decision, Nomy should consult:
1. the relevant current GitHub issue/PR and evidence;
2. recent relevant entries in shared stream #271;
3. applicable files under `docs/shared-context/`;
4. specialist evidence when the decision falls inside a specialist domain.

After a material shared conclusion, Nomy should write back the minimum durable context necessary for the other authorized workspace to continue correctly.

## Privacy boundary
Shared company memory is deliberately different from ChatGPT personal memory.

Do not copy or expose:
- private ChatGPT history that was not intentionally shared for MSH work;
- credentials, secrets, tokens, or authentication material;
- private member health information;
- unnecessary personal information;
- founder-private information not intended for the other founder or the MSH team.

A founder may explicitly promote a fact or conclusion from a private conversation into shared company context. Once promoted, record the company-relevant conclusion rather than dumping the entire private transcript.

## Founder workspaces

### Siea workspace
Primary orientation: Founder/CEO, company and product direction, MSH member experience, product acceptance, cross-functional prioritization.

### Brandon workspace
Primary orientation: Co-Founder, Growth / Commercial / Public-Facing Strategy. Brandon's Nomy should understand the whole MSH company context but prioritize his authorized workstreams and use specialists rather than inventing expertise.

Brandon's initial strategy team includes:
- Nomy — orchestration and product/company alignment
- Genesis — growth, acquisition, lifecycle, launch and channel strategy
- Newton — business, B2B, partnerships and commercial strategy
- Atlas — quantitative evidence and measurement
- Iris — research and discovery
- Harper — role/capability development and employee journey

Additional specialists should be brought in when the work touches their domains.

## Communication discipline
Shared entries should distinguish:
- **Idea** — exploratory thought, not approved.
- **Researching** — evidence gathering underway.
- **Proposed** — recommendation awaiting the relevant decision gate.
- **Decided** — accepted decision; must be reflected in `DECISIONS.md` when material.
- **Blocked** — cannot proceed; include the actual blocker and owner.
- **Completed** — evidence exists that the work or handoff is complete.

## Source-of-truth rule
When sources conflict, prefer the most authoritative current evidence:
1. accepted product/company decision or approved specification;
2. current repository implementation and deterministic execution evidence;
3. current specialist evidence;
4. shared communication summaries;
5. older discussion or historical context.

Never silently convert an assumption, brainstorm, or stale summary into a fact.
