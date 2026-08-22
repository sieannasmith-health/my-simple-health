# My Simple Health Engineering Operating Contract

This file applies to the entire repository. The detailed product source of truth is [`docs/PRODUCT_REQUIREMENTS.md`](docs/PRODUCT_REQUIREMENTS.md). Read the PRD when a task affects product behavior, health or safety, evidence, user context, privacy, accessibility, or release scope. This file contains the recurring rules for repository work.

## Product north star

My Simple Health helps people discover, understand, choose, act, adapt, and continue. The product should make credible health information easier to use while preserving user agency.

- Put the person before the technology. The experience must not feel like an AI demonstration.
- Let users receive value without using Hello or creating an account.
- Keep goals and actions user-led, optional, realistic, and adaptable.
- Prefer the smallest change that safely advances the V1 journey.
- Preserve the established calm, credible, warm visual identity unless redesign is explicitly approved.

## Health and safety invariants

Current-message routing priority is:

1. emergency or crisis safety;
2. individualized clinical scope;
3. conversational or relational intent;
4. remaining medical context;
5. research or general education.

- Conversation history, profile data, Wellness Wheel context, coaching, or evidence must never override current-message emergency or crisis classification.
- Emergency and crisis responses must remain outside normal generation, evidence display, and visit-prep flows.
- Do not weaken emergency detection, crisis detection, medication boundaries, diagnosis boundaries, clinical routing, or care navigation during unrelated work.
- Internal route labels such as RED, YELLOW, and GREEN must never be shown to users.
- Health-safety changes require explicit scope, representative regression tests, and review.

## Hello boundaries

Hello is a health educator, evidence translator, reflection partner, behavior-change guide, navigation assistant, and goal-support tool. It is not a clinician or substitute for professional care.

Hello may explain health concepts, conditions, medications, prevention, nutrition, movement, sleep, wellbeing, research, and healthcare navigation generally. It must not tell an individual:

- that they have or do not have a diagnosis;
- which prescription medication they should take or stop;
- what dose they should use or how to change prescribed treatment;
- that individualized medical care is unnecessary.

When individualized judgment is requested, maintain the boundary while remaining useful through general education, terminology, care navigation, visit preparation, or questions for a professional.

## Evidence invariants

- `evidenceAvailable` means relevant evidence exists internally.
- `showEvidence` means the user explicitly requested evidence or source detail.
- If `showEvidence !== true`, render only Hello's conversational response. Populated evidence fields must not open the evidence UI.
- If `showEvidence === true`, safely render the available evidence strength, known findings, unknowns, limitations, and sources.
- Never render model-generated raw HTML. Use safe DOM text APIs and permit only validated HTTP(S) source URLs.
- Evidence must be relevant to the actual question and reasonably applicable. Do not force tangential studies into an answer.
- Changes to PubMed queries, ranking, relevance filtering, synthesis, evidence strength, applicability, or source selection require explicit approval and representative regression tests.

## Wellness Wheel and context invariants

The Wellness Wheel is subjective self-reflection, not a clinical assessment. Its eight dimensions are Physical, Emotional, Social, Occupational, Financial, Environmental, Intellectual, and Spiritual Wellness.

- Scores are integer self-ratings from 1–10, not diagnoses, screening results, disease risk, severity, dysfunction, or objective health ratings.
- Physical Wellness must not be interpreted as a measurement of sleep, nutrition, movement, energy, fitness, or another single topic.
- Ask Hello may receive only the validated `wellnessContext` contract defined in the PRD.
- Never send Guided Reflection narratives, visit-prep answers, unrelated browser storage, or arbitrary profile properties as Wellness context.
- Use Wellness context conservatively. It may acknowledge a chosen area but must not infer disease or clinical risk.

## Conversation and request lifecycle

- Ask history is in-memory only for V1 and must not persist across browser sessions.
- Send at most the previous 10 validated `user` or `assistant` turns, with at most 1,500 characters per turn. Keep the current message separate and do not duplicate it.
- Exclude Guided Reflection and visit-prep responses from Ask history.
- Only one Ask request may control the active conversation. Clearing or switching modes must invalidate pending responses, history mutations, evidence, care UI, and loading UI.
- Mode changes must exit visit prep and invalidate delayed callbacks from the prior mode.

## Change-scope discipline

- Follow: inspect → plan → implement the approved scope → test → inspect the diff → report → wait.
- Do not perform drive-by cleanup, broad refactors, framework migrations, URL renames, visual redesigns, or speculative features.
- Do not alter health/safety behavior, prompts, evidence behavior, user context, or public URLs as part of unrelated work.
- Preserve user changes and unrelated dirty-worktree changes.
- Do not delete or rename files because they appear unused without verifying all references and obtaining approval when scope is unclear.
- Keep server-only evidence and provider logic inside the API/server architecture.

## Testing expectations

Match testing depth to the change. Every meaningful Hello change should include the relevant subset of:

- JavaScript syntax checks for API modules;
- the Hello inline-JavaScript syntax check;
- import-graph checks;
- `git diff --check` and final diff inspection;
- first-turn and contextual conversation tests;
- history ordering, validation, cap, reset, and cancellation tests;
- Wellness validation, sanitization, absence, and nonclinical-use tests;
- Green/general, Yellow/medical-context, and Red/individualized-boundary tests;
- emergency and crisis precedence tests with adversarial history/profile context;
- evidence hidden/shown, missing-field, hostile-content, and invalid-URL tests;
- care-navigation, visit-prep completion, safe rendering, and mode-cancellation tests.

Use mocks extensively. Before public release, also require controlled live browser, deployed API, representative provider/PubMed, mobile-device, and real-user validation. Never use real personal health information in tests.

## Mobile and accessibility expectations

- Treat mobile behavior and WCAG 2.2 AA as product requirements, not final cleanup.
- Preserve keyboard access, visible focus, semantic HTML, meaningful labels, sufficient contrast, readable text, usable tap targets, and appropriate ARIA.
- Validate common phone widths, tablet, and desktop for public UI changes.
- Avoid horizontal overflow, overlapping or hidden controls, inaccessible navigation, and motion that ignores reduced-motion preferences.

## Authorization boundaries

Read, plan, implement, commit, push, and deploy are separate authorizations.

- Inspection or planning does not authorize file changes.
- Implementation does not authorize committing.
- Committing does not authorize pushing.
- Pushing does not authorize deployment.
- Never commit, push, merge, deploy, or modify production without explicit authorization for that exact action.

## Known technical debt — do not fix opportunistically

Track these deliberately and leave them untouched unless the task explicitly includes them:

- contextual pronouns are not yet resolved through the research-routing pipeline;
- client and server duplicate the Wellness dimension allowlist;
- Ask has no client timeout for long requests;
- the global stylesheet has repeated selectors;
- header, footer, navigation, and search implementations are repeated;
- substantial CSS and JavaScript remain inline;
- some links and assets are missing or broken;
- Resources, Assessments, and onboarding are incomplete;
- forms are not yet connected to an approved backend;
- legal and informational pages are incomplete;
- Durable rate limiting is implemented for the main Hello endpoint.
- Public paid diagnostic endpoints have been removed and replaced with non-deployed automated tests.

Do not expand a targeted task to address these items.

## Completion and handoff

Before declaring an implementation complete:

1. confirm only approved files and behavior changed;
2. run relevant syntax, import, functional, regression, and diff checks;
3. report exact files changed and tests performed;
4. disclose unresolved risks and mocked-versus-live test limitations;
5. stop before the next roadmap item and wait for approval.
