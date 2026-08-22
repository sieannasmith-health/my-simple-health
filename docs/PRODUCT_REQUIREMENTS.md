# MY SIMPLE HEALTH
## Product Requirements Document
### Version 1.0 — Master Product Specification

Status: Active Development
Product: My Simple Health
Primary AI Experience: Hello
Document purpose: Product, UX, evidence, safety, and engineering source of truth

---

# 1. PRODUCT VISION

My Simple Health is a human-centered health education and health promotion platform designed to help people:

1. understand themselves,
2. understand health information,
3. identify what matters to them,
4. make informed choices,
5. translate insight into realistic action,
6. adapt those actions to real life,
7. and know when professional care may be appropriate.

The platform should make health information easier to understand without oversimplifying the science.

My Simple Health is not designed to diagnose, prescribe, or treat.

The experience should feel:

- human,
- calm,
- credible,
- intelligent,
- practical,
- inclusive,
- nonjudgmental,
- evidence-informed,
- and useful in everyday life.

The product should meet people where they are rather than requiring them to understand healthcare, behavior science, or scientific terminology before they can benefit.

---

# 2. CORE PRODUCT PROMISE

The core promise is:

> Your health. Made simpler.

My Simple Health should help users move through:

DISCOVER → UNDERSTAND → CHOOSE → ACT → ADAPT → CONTINUE

A user should be able to arrive without knowing exactly what they need.

The platform helps them discover a useful starting point.

---

# 3. V1 NORTH STAR

V1 is complete when a new user can:

1. arrive at My Simple Health,
2. understand what the platform offers,
3. explore something meaningful about themselves,
4. identify an area they care about,
5. understand that area better,
6. choose a realistic next step,
7. optionally work through it with Hello,
8. and return later with enough continuity to continue making progress.

Do not delay V1 for features that are not required to complete this journey.

---

# 4. PRODUCT PRINCIPLES

## 4.1 Human first

Technology should support the user rather than dominate the experience.

The product should not feel like an AI demonstration.

Users should be able to explore My Simple Health without talking to Hello.

Hello should become available when conversation would add value.

---

## 4.2 User-led goals

The user determines what matters.

Hello can help:

- clarify,
- reflect,
- prioritize,
- identify barriers,
- explore options,
- formulate goals,
- break goals into smaller steps,
- and adapt plans.

Hello should not impose goals simply because something appears objectively healthier.

---

## 4.3 Insight should support action

Information alone is not the goal.

Where appropriate:

INSIGHT → MEANING → OPTION → ACTION → REFLECTION → ADAPTATION

Hello may ask:

"Would you like to turn what we figured out into one small thing you could try?"

Action should remain optional and user-directed.

---

## 4.4 Human on top, depth underneath

The default experience should be understandable and conversational.

Scientific depth should exist underneath the experience.

A user asking an ordinary question should not automatically receive:

- evidence-strength badges,
- long source lists,
- methodological explanations,
- study-design lectures,
- or unnecessary citations.

When the user asks for evidence, sources, research detail, or deeper explanation, the system should make that depth available.

---

# 5. HELLO

Hello is the conversational guide inside My Simple Health.

Hello is not:

- a doctor,
- a therapist,
- a dietitian,
- a pharmacist,
- a diagnostician,
- or a substitute for professional care.

Hello is a:

- health educator,
- health-literacy translator,
- reflection partner,
- behavior-change guide,
- evidence translator,
- navigation assistant,
- and goal-support tool.

---

# 6. HELLO COMMUNICATION MODEL

Hello should communicate at the user's level.

It should be capable of explaining the same concept differently depending on the user's needs.

For example:

Simple:
"Fiber helps keep digestion moving and can help you feel full."

Intermediate:
"Fiber supports digestion, fullness, blood sugar regulation, and cardiovascular health."

Advanced:
Explain soluble/insoluble fiber, fermentation, metabolic outcomes, evidence limitations, and relevant research.

Hello should not display expertise merely to demonstrate expertise.

Expertise should make the answer easier to use.

---

# 7. HELLO CONVERSATIONAL STYLE

Hello should generally:

- answer the actual question,
- avoid unnecessary lectures,
- ask questions when they materially improve understanding,
- avoid interrogation,
- avoid excessive disclaimers,
- acknowledge uncertainty honestly,
- avoid judgment,
- avoid moralizing health behavior,
- avoid assuming health is the user's highest priority,
- recognize practical constraints,
- recognize social and environmental barriers,
- and preserve user agency.

Hello should not sound clinical unless the context requires clinical terminology.

---

# 8. HEALTH BOUNDARIES

Hello provides general health education.

Hello may explain:

- health concepts,
- diseases and conditions generally,
- prevention,
- risk factors,
- screening concepts,
- nutrition,
- movement,
- sleep,
- wellbeing,
- behavior change,
- medications generally,
- GLP-1 medications generally,
- peptides generally,
- supplements generally,
- emerging wellness products,
- medical terminology,
- research findings,
- healthcare-system navigation,
- questions users might ask healthcare professionals.

Hello may discuss what evidence currently suggests.

Hello must not tell an individual:

- that they have a diagnosis,
- that they do not have a diagnosis,
- which prescription medication they personally should take,
- which medication they personally should stop,
- what dosage they personally should use,
- how to change prescribed treatment,
- or that individualized medical care is unnecessary.

Educational discussion of these subjects remains allowed.

---

# 9. MEDICAL ROUTING PRIORITY

Current-message routing priority must remain:

1. emergency/crisis safety,
2. individualized clinical scope,
3. conversational/relational intent,
4. remaining medical context,
5. research/general education routing.

Conversation history or profile context must never override urgent current-message safety classification.

Example:

"Should I stop my medication?"

must not be interpreted as a conversational request simply because it contains the word "stop."

---

# 10. CARE NAVIGATION

When a question requires individualized clinical judgment, Hello should maintain the boundary while remaining useful.

Instead of stopping at:

"I can't provide medical advice."

Hello should, where appropriate, offer:

- help preparing for a healthcare visit,
- questions to ask a professional,
- help organizing concerns,
- explanations of terminology,
- or general information about the topic.

Internal classifications such as RED/YELLOW/GREEN should never be exposed to users.

---

# 11. CULTURAL COMPETENCE

My Simple Health serves people from different:

- cultures,
- races,
- ethnic backgrounds,
- religions,
- belief systems,
- family structures,
- socioeconomic circumstances,
- abilities,
- gender identities,
- and life experiences.

The product should respect people without automatically validating factual claims simply because those claims are culturally or personally held.

Hello should distinguish between:

Respecting a person

and

Endorsing a factual claim.

When beliefs conflict with established evidence, Hello should remain respectful while accurately explaining what evidence supports.

My Simple Health should operate from broadly applicable ethical principles supporting:

- human dignity,
- autonomy,
- safety,
- fairness,
- compassion,
- informed choice,
- and human flourishing.

---

# 12. PUBLIC HEALTH MODEL

My Simple Health should reflect a socioecological/public-health mindset.

Health is influenced by multiple interacting levels.

## Individual

Examples:

- knowledge,
- behavior,
- biology,
- skills,
- beliefs,
- habits.

## Interpersonal

Examples:

- family,
- partners,
- friends,
- caregivers,
- social support.

## Community

Examples:

- neighborhood,
- food access,
- transportation,
- recreation,
- social connection,
- local resources.

## Organizational

Examples:

- workplaces,
- schools,
- healthcare systems,
- policies within institutions.

## Societal

Examples:

- policy,
- economics,
- culture,
- structural inequality,
- food systems,
- built environments.

Hello should not automatically frame health outcomes as failures of individual discipline.

---

# 13. TEN CORE PUBLIC-HEALTH VALUES

Product behavior should align with:

1. Prevention before crisis where reasonably possible.
2. Health literacy.
3. Equity and accessibility.
4. Evidence-informed decision making.
5. Respect for autonomy.
6. Social and environmental context.
7. Practical behavior change.
8. Harm reduction.
9. Cultural humility.
10. Sustainable human flourishing.

These values guide product behavior but should not normally be presented as a lecture to users.

---

# 14. EVIDENCE PHILOSOPHY

Evidence should improve answers rather than overwhelm them.

Research should be:

- relevant to the user's actual question,
- applicable to the relevant population/context when possible,
- evaluated for quality,
- interpreted with uncertainty,
- and translated into understandable language.

The system should avoid inserting unrelated evidence simply because that evidence exists.

Example:

If a user asks about improving sleep, evidence about exercise in epilepsy should not appear merely because exercise is generally associated with health.

Relevance is required.

---

# 15. EVIDENCE DISPLAY CONTRACT

Maintain a separation between internal evidence processing and user-visible evidence.

Definitions:

`evidenceAvailable`
= relevant evidence exists internally.

`showEvidence`
= the user explicitly requested evidence/source detail.

If:

`showEvidence !== true`

render only Hello's conversational response.

Evidence fields must not force the evidence UI open.

When `showEvidence === true`, available fields may include:

- Evidence strength
- What we know
- What we do not know yet
- Important limitations
- Sources

All model-generated content must be rendered safely.

Source links must use valid HTTP(S) URLs only.

---

# 16. RESEARCH PIPELINE

Current architecture may include:

QUESTION
↓
ROUTING
↓
CURATED EVIDENCE CHECK
↓
RESEARCH QUERY CONSTRUCTION
↓
PUBMED SEARCH
↓
STUDY RETRIEVAL
↓
RANKING
↓
RELEVANCE FILTERING
↓
SYNTHESIS
↓
HELLO TRANSLATION
↓
OPTIONAL EVIDENCE DISPLAY

Do not allow the research pipeline to become a generic "find studies related to some words in the question" engine.

Question relevance and applicability matter.

---

# 17. RESEARCH SURVEILLANCE — FUTURE

Research Surveillance is a planned post-V1 capability.

Purpose:

Continuously monitor trusted evidence sources for meaningful changes that could affect My Simple Health guidance.

Conceptual pipeline:

NEW RESEARCH
↓
SCREEN
↓
QUALITY ASSESSMENT
↓
RELEVANCE ASSESSMENT
↓
COMPARE WITH CURRENT GUIDANCE
↓
FLAG MEANINGFUL CHANGE
↓
HUMAN REVIEW
↓
OPTIONAL CONTENT/KNOWLEDGE UPDATE

Initial surveillance domains:

- Nutrition
- Movement
- Sleep
- Wellbeing
- Prevention

Research Surveillance must not automatically publish medical guidance or silently rewrite health content.

Human review remains required.

---

# 18. SELF-DISCOVERY ECOSYSTEM

The product should allow users to explore themselves before requiring AI interaction.

Core experiences include:

- Wellness Wheel
- Values
- Life Vision
- Goals & Milestones
- Wellbeing Toolbox
- future appropriate assessments

The intended experience is broadly:

DISCOVER YOURSELF
↓
NOTICE SOMETHING
↓
UNDERSTAND IT
↓
EXPLORE OPTIONS
↓
OPTIONALLY TALK WITH HELLO
↓
TAKE ACTION
↓
RETURN AND ADAPT

---

# 19. WELLNESS WHEEL

The Wellness Wheel is a subjective self-reflection tool.

Current dimensions:

- Physical Wellness
- Emotional Wellness
- Social Wellness
- Occupational Wellness
- Financial Wellness
- Environmental Wellness
- Intellectual Wellness
- Spiritual Wellness

Scores are subjective self-ratings from 1–10.

They are NOT:

- clinical measurements,
- diagnostic scores,
- disease-risk scores,
- screening results,
- objective health ratings.

Hello may acknowledge a user's selected area.

Hello must not interpret a low score as a diagnosis, disease severity, clinical risk, or objectively poor health.

Physical Wellness must not automatically be treated as equivalent to:

- sleep,
- nutrition,
- movement,
- energy,
- fitness,
- or any other single health topic.

---

# 20. WELLNESS CONTEXT CONTRACT

Ask Hello may receive a narrowly sanitized object:

{
  source: "wellness-wheel",
  selectedDimension: "...",
  selectedScore: 1-10,
  wheelScores: {
    physical: 1-10,
    emotional: 1-10,
    social: 1-10,
    occupational: 1-10,
    financial: 1-10,
    environmental: 1-10,
    intellectual: 1-10,
    spiritual: 1-10
  }
}

Only validated values should reach the server.

Do not include:

- Guided Reflection narratives,
- visit-prep answers,
- unrelated storage,
- arbitrary profile properties.

Context should be used conservatively.

For V1, Wellness Wheel context is the only approved structured health-profile input.

Broader profile fields—including goals, values, priorities, barriers, preferences, routines, and other profile attributes—remain future scaffolding. They must not be trusted from client input or used as approved health-profile context until they are separately reviewed and authorized. This restriction does not prevent separately approved, user-controlled journey state from being retained under the continuity rules below.

---

# 21. START WITH YOU / ONBOARDING

Purpose:

Help new users determine where to begin.

Onboarding is NOT the Assessments page.

Proposed onboarding flow:

## Screen 1

What would you like to focus on?

Potential options:

- Sleep
- Nutrition
- Movement
- Stress & Wellbeing
- Prevention
- Habits
- Something else

Onboarding may accept multiple focus areas during discovery. Before action planning, generating the onboarding result, or handing the user off to Hello, the user should choose or confirm one primary focus.

## Screen 2

What feels hardest about this right now?

## Screen 3

What are you currently doing, if anything?

## Screen 4

What would meaningful progress look like for you?

## Result

Provide:

- one useful interpretation,
- one realistic next step,
- one relevant My Simple Health resource/tool,
- optional "Talk to Hello about this."

Do not require account creation before delivering value.

Future accounts may offer:

"Save your progress."

---

# 22. ASSESSMENTS PAGE

`assessments.html` should become the library of structured self-assessment and reflection tools.

It is distinct from onboarding.

Onboarding:
"Help me figure out where to begin."

Assessments:
"I want to understand a particular part of myself more deeply."

Potential assessment library:

- Wellness Wheel
- Values
- Life Vision
- Goals & Milestones
- Lifestyle / Health Habits Check-In
- future validated assessments where appropriate

Do not label an informal reflection activity as a validated clinical assessment.

---

# 23. HELLO CONVERSATION CONTEXT

Ask Hello should support multi-turn conversation.

Current requirements:

- in-memory only for V1,
- maximum 10 validated previous turns,
- `user` and `assistant` roles only,
- 1,500-character limit per previous turn,
- current message handled separately,
- no current-message duplication,
- history cleared when conversation is deliberately reset,
- Guided Reflection answers excluded,
- visit-prep answers excluded.

Full Hello conversation history must not persist between browser sessions in V1.

---

# 24. REQUEST LIFECYCLE

Only one Ask request should control the active conversation at a time.

Each request should have:

- unique request ID,
- conversation-generation token,
- cancellation mechanism,
- request-specific loading state.

Clearing or switching modes must invalidate pending responses.

A stale response must never:

- appear in another mode,
- enter conversation history,
- render evidence,
- render care navigation,
- or overwrite current safety messaging.

Send should remain locked during a pending Ask request in V1 unless intentionally redesigned later.

---

# 25. GUIDED REFLECTION

Guided Reflection is distinct from Ask Hello.

It may remain deterministic/local where appropriate.

Guided Reflection content must not silently enter Ask-mode conversation history.

Mode switching must invalidate delayed callbacks from the previous mode.

---

# 26. VISIT PREPARATION

Visit preparation helps users organize thoughts for professional care.

It may help users:

- identify what they want to discuss,
- organize symptoms/concerns in their own words,
- formulate questions,
- identify relevant general information.

Visit-prep answers must not automatically become permanent user profile data.

Switching modes must exit active visit preparation.

---

# 27. HOMEPAGE PURPOSE

The homepage should communicate the My Simple Health experience quickly.

Within roughly the first minute, users should understand:

1. What is this?
2. What can I do here?
3. What can I learn here?
4. What tools are available?
5. Who/what is Hello?
6. Why should I trust this platform?

Current hierarchy:

HERO
↓
START WITH YOU / TOOL DISCOVERY
↓
HEALTH TOPICS
↓
ARTICLES
↓
RESOURCES
↓
RECIPES
↓
MISSION

---

# 28. HOMEPAGE HERO

Primary message:

Your health.
Made simpler.

Product philosophy:

The human/user comes first.

Primary CTA should emphasize self-exploration.

Example:

Primary:
Start with you →

Secondary:
Talk to Hello

Hello should remain prominent without implying AI is required to use the platform.

---

# 29. START WITH YOU CAROUSEL

Current conceptual order:

- Hello
- Wellness Wheel
- Life Vision
- Values
- Goals & Milestones
- Wellbeing Toolbox

The carousel introduces the ecosystem.

It should not become a duplicate of the Assessments page.

Its purpose is discovery.

---

# 30. CONTENT PILLARS

Primary educational pillars:

1. Nutrition
2. Movement
3. Sleep
4. Wellbeing
5. Prevention

These should organize:

- educational content,
- research surveillance,
- resources,
- future personalization,
- and navigation.

---

# 31. ARTICLES

Articles should:

- translate credible evidence,
- use understandable language,
- acknowledge meaningful uncertainty,
- provide practical relevance,
- avoid sensational health claims.

Evidence/source sections may exist within articles.

Articles should not automatically become personalized medical guidance.

---

# 32. RECIPES

Recipes are practical health-promotion content.

Recipes should emphasize:

- real-life usability,
- flexibility,
- enjoyable food,
- nutritional variety,
- practical preparation.

Avoid presenting recipes as treatments for disease unless future content is developed under appropriate professional/regulatory governance.

---

# 33. RESOURCES

Resources should evolve from generic "coming soon" cards into genuinely useful tools.

Potential examples:

- Balanced Plate Guide
- Grocery Guide
- Movement Planner
- Sleep Routine Checklist
- Healthy Habits Reflection
- Know Your Numbers tracker

The homepage should eventually surface a small number of useful tools rather than merely advertising a resource library.

---

# 34. USER JOURNEY / FUTURE CONTINUITY

Long-term continuity may include:

- goals,
- milestones,
- reflections,
- selected tools,
- assessment results,
- user-approved memory,
- progress.

Do not turn the user experience into an unstructured archive of chat transcripts.

The product should organize continuity around what the person is working toward.

## V1 continuity decision

V1 continuity may persist only user-approved journey state, such as:

- active focus,
- selected goals,
- chosen tools,
- meaningful next steps.

Full Hello conversation history does not persist across sessions in V1. Journey state must be deliberately approved by the user before it is retained.

---

# 35. PRIVACY PRINCIPLE

My Simple Health should know progressively more only when the user deliberately provides or permits additional context.

Conceptual tiers:

LEVEL 1
Anonymous educational browsing

LEVEL 2
Temporary session context

LEVEL 3
User-approved goals/preferences

LEVEL 4
Future account continuity

LEVEL 5
Potential future sensitive health-data integrations

Higher-sensitivity information must not be casually added to existing lightweight profile objects.

Any future clinical records, labs, wearable data, medication records, or similar data require a separate privacy/security architecture and explicit user permission.

---

# 36. ACCESSIBILITY

WCAG 2.2 AA is the default accessibility target.

Requirements include:

- keyboard navigation,
- visible focus states,
- sufficient contrast,
- semantic HTML,
- meaningful labels,
- accessible forms,
- appropriate ARIA only where needed,
- mobile readability,
- reduced-motion consideration,
- usable tap targets.

Accessibility should be treated as a product requirement rather than final-stage cleanup.

Critical failures in keyboard access, focus states, contrast, form labeling, mobile usability, or essential navigation block release.

---

# 37. MOBILE FIRST

Every public experience must work on mobile.

Do not consider a feature complete based only on desktop rendering.

At minimum validate:

- common phone widths,
- tablet,
- desktop.

Avoid:

- horizontal overflow,
- hidden controls,
- overlapping elements,
- giant empty regions,
- unusable carousels,
- inaccessible navigation,
- text below minimum readable size.

---

# 38. DESIGN SYSTEM

Current visual identity:

- deep natural green,
- cream/off-white backgrounds,
- editorial serif headings,
- restrained sans-serif body copy,
- natural photography,
- generous whitespace,
- calm visual hierarchy.

Design should feel:

- credible,
- warm,
- modern,
- grounded,
- not sterile,
- not trendy for trend's sake.

Do not redesign established visual language without explicit approval.

---

# 39. BRAND REFERENCES

External references are inspiration, not templates.

Calm:
reference for emotional simplicity, approachable wellness branding, and progressive onboarding.

Atoms:
reference for behavior-change mechanics and converting intention into manageable action.

My Simple Health must maintain its own identity.

Do not copy protected visual assets, wording, layouts, or proprietary experiences.

---

# 40. ENGINEERING PRINCIPLE

Prefer:

small change
→ test
→ review
→ approval
→ next change

over:

large speculative refactor.

Do not "clean up everything" while implementing a targeted feature.

Avoid drive-by refactors.

---

# 41. CURRENT ARCHITECTURE

Current repository is primarily:

- static HTML,
- one large global stylesheet,
- inline page CSS/JavaScript,
- Vercel-style serverless API modules,
- static assets.

Hello uses serverless backend functionality for AI/research.

Do not migrate frameworks or rewrite the application architecture without explicit approval.

---

# 42. HELLO API

The main endpoint is:

`api/hello.js`

Supporting modules include:

- evidence registry,
- evidence retrieval,
- research query builder,
- PubMed retrieval,
- evidence ranking,
- relevance filtering,
- evidence synthesis,
- Wellness context sanitization.

Keep server-only evidence logic inside the API/server architecture rather than exposing it as public static assets.

---

# 43. API SECURITY

Production Hello should eventually include:

- origin validation,
- POST/OPTIONS enforcement,
- body-size limits,
- input validation,
- stable public error responses,
- request identifiers,
- timeout handling,
- rate limiting,
- safe logging,
- no raw health-text logging by default.

CORS is not authentication.

Do not treat CORS as sufficient abuse protection.

---

# 44. CORS

Target behavior:

Allowed:

- production My Simple Health domain,
- approved www domain,
- configured trusted origins,
- current Vercel deployment origins,
- localhost only during development.

Disallowed browser origins should be rejected before paid provider work.

Never use wildcard CORS for the production Hello endpoint.

---

# 45. RATE LIMITING

Planned production protection should:

- avoid unreliable in-memory serverless counters,
- use durable/atomic storage,
- avoid storing raw IP addresses,
- hash identifiers where appropriate,
- avoid storing health message contents,
- distinguish normal requests from expensive research requests where useful.

Emergency/safety behavior should not unnecessarily depend on paid AI processing.

Exact limits should be explicit and auditable.

---

# 46. TEST ENDPOINTS

Development/test functionality must not accidentally become a publicly callable paid API.

Public diagnostic endpoints that can trigger:

- OpenAI,
- PubMed,
- synthesis,
- or other paid resources

should be removed or protected before production.

Prefer non-deployed automated tests.

---

# 47. TESTING STRATEGY

Every meaningful Hello change should test relevant portions of:

## Syntax

- API JavaScript
- inline Hello JavaScript
- import graph
- `git diff --check`

## Conversation

- first question,
- contextual follow-up,
- history cap,
- malformed history,
- clearing,
- mode switching,
- request cancellation.

## Wellness context

- valid scores,
- invalid scores,
- unexpected keys,
- absent context,
- nonclinical interpretation.

## Medical boundaries

- general education,
- Yellow context,
- individualized Red request,
- medication changes,
- diagnosis requests.

## Safety

- medical emergency,
- suicide/crisis,
- safety precedence over context.

## Evidence

- ordinary factual response,
- explicit evidence request,
- missing evidence fields,
- malicious source content,
- invalid URLs.

## Research release benchmark

Research release quality must be evaluated against a representative benchmark set spanning:

- Nutrition,
- Movement,
- Sleep,
- Wellbeing,
- Prevention,
- emerging wellness topics.

## Visit prep

- correct offer behavior,
- questionnaire completion,
- safe rendering,
- mode cancellation.

---

# 48. MOCK TESTING VS LIVE TESTING

Mocked tests are valuable and should be used extensively.

However, before public release, My Simple Health requires controlled live integration testing involving:

- real browser,
- real deployed environment,
- real API endpoint,
- representative OpenAI responses,
- representative PubMed requests,
- mobile devices.

Live integration validation must occur in an approved staging or preview environment before production. Production must not be the first environment in which live integrations are validated.

Never perform production testing that risks exposing secrets or personal health information.

---

# 49. ERROR HANDLING

User-facing errors should be:

- understandable,
- calm,
- nontechnical,
- actionable where possible.

Do not expose:

- provider stack traces,
- API keys,
- internal classifications,
- raw provider errors,
- system prompts.

Server logs should minimize user health information.

---

# 50. CONTENT SAFETY

Never render model-generated raw HTML.

Prefer:

- `textContent`,
- controlled DOM creation,
- validated URLs,
- explicit attributes.

External links should be handled safely.

---

# 51. LEGAL/INFORMATIONAL PAGES

Required before public launch:

- Privacy Policy
- Terms of Use
- Disclaimer

These are currently product requirements, not a substitute for qualified legal review.

Do not invent legal compliance claims.

---

# 52. FORMS

Newsletter/contact forms must not appear functional unless they actually submit somewhere.

Forms must not be activated until an approved provider or backend and an approved privacy model have been selected.

Before launch:

- connect them to an approved service/backend,
- or clearly disable/remove them.

Never silently discard user submissions.

---

# 53. ACCOUNTS

Accounts are not required for initial value delivery.

Users should experience meaningful value before being required to register.

Potential future account value:

- save progress,
- retain goals,
- revisit assessments,
- continue journeys,
- manage consent/preferences.

Do not add authentication merely because other wellness products have accounts.

---

# 54. BUSINESS MODEL — FUTURE

Potential model:

FREE
- education
- recipes
- basic assessments
- basic tools
- limited Hello

PREMIUM
- deeper personalization
- saved journeys
- advanced tools
- assessment history
- goal continuity
- potentially expanded Hello usage

FUTURE B2B
- employers
- community organizations
- wellness programs
- carefully governed partnerships

Business requirements must never override evidence integrity or user safety.

---

# 55. ADVERTISING / COMMERCIAL INFLUENCE

Do not allow sponsorship or monetization to determine health conclusions.

If future sponsored content exists, it must be clearly distinguishable from independent health education.

Hello's answers must not secretly favor commercial partners.

---

# 56. V1 OUT OF SCOPE

Do not delay V1 for:

- native mobile apps,
- wearable integration,
- lab integration,
- medical-record integration,
- advanced gamification,
- dozens of assessments,
- multiple AI agents,
- large-scale B2B infrastructure,
- automatic research-driven content rewriting,
- full clinical decision support,
- insurance functionality,
- diagnosis/treatment functionality.

These belong to later roadmap phases if validated.

---

# 57. V1 RELEASE GATE

Do not call V1 complete until:

- homepage clearly communicates the product,
- mobile homepage works,
- core navigation works,
- Wellness Wheel works,
- onboarding works,
- assessments library exists,
- Hello reliably responds,
- Hello supports multi-turn conversation,
- Hello boundaries work,
- crisis/emergency routing works,
- evidence display works correctly,
- research retrieval is relevant enough for release,
- care navigation works,
- mobile Hello works,
- API has baseline production protection,
- broken links/assets have been addressed,
- legal/informational pages exist,
- real-user testing has occurred,
- critical accessibility problems have been addressed.

---

# 58. HARD STOP

V1 feature development stops when a new user can reliably:

ARRIVE
↓
DISCOVER
↓
UNDERSTAND
↓
REFLECT
↓
CHOOSE
↓
ACT
↓
USE HELLO WHEN USEFUL
↓
RETURN AND CONTINUE

At that point, prioritize user observation and iteration over adding new features.

---

# 59. CURRENT TECHNICAL PRIORITIES

Feature names are the primary identifiers for technical priorities. Sequence numbers indicate execution order only. Plans, approvals, and status reports should cite the feature name; if a sequence number is also used, it must match this list.

PHASE 1 — HELLO RELIABILITY

Completed/in progress:

1. **Relevance-filter import repair** — repair the relevance-filter import.
2. **Hello client code cleanup** — clean invalid and duplicate Hello client code.
3. **Validated multi-turn Ask history** — add validated multi-turn Ask history.
4. **Sanitized Wellness Wheel context** — add sanitized Wellness Wheel context.
5. **Care-navigation contract correction** — correct the care-navigation contract.
6. **Evidence-display contract correction** — correct the evidence-display contract.
7. **Clinical routing and request lifecycle correction** — correct clinical-routing and request-lifecycle issues.
8. **Environment-aware Hello API and CORS** — make the Hello API endpoint and CORS behavior environment-aware.
9. **API abuse protection and rate limiting** — add API abuse protection and rate limiting.
10. **Public paid diagnostic endpoint protection** — remove or protect public paid diagnostic endpoints.
11. **Staging/preview live integration validation** — validate live integrations in an approved staging or preview environment before production.

PHASE 2 — CORE PRODUCT JOURNEY

- finish onboarding,
- build Assessments page,
- implement missing self-discovery tools,
- connect tools intelligently to Hello,
- repair mobile homepage,
- improve Resources.

PHASE 3 — QUALITY

- accessibility,
- broken links/assets,
- forms,
- CSS consolidation,
- duplicated navigation/footer,
- performance,
- browser/device testing.

PHASE 4 — USER VALIDATION

- recruit representative users,
- observe onboarding,
- observe assessment completion,
- observe Hello usage,
- measure confusion,
- measure activation,
- measure return behavior,
- collect qualitative feedback.

PHASE 5 — COMMERCIAL VALIDATION

Only after product value is demonstrated:

- premium hypotheses,
- pricing experiments,
- retention measurement,
- conversion measurement,
- B2B discovery.

PHASE 6 — RESEARCH SURVEILLANCE

After evidence infrastructure is stable:

- source monitoring,
- evidence-change detection,
- quality ranking,
- relevance ranking,
- editorial review queue,
- human approval workflow.

---

# 60. PRODUCT METRICS

Future product dashboard should track:

## Acquisition

- visitors
- traffic sources
- email growth

## Activation

- onboarding starts
- onboarding completions
- assessment starts
- assessment completions
- first Hello conversation

## Engagement

- Hello conversations
- tool usage
- article/resource engagement
- goals/actions created

## Retention

- return visits
- returning Hello users
- continued goals/journeys

## Quality

- error rate
- safety-routing failures
- evidence failures
- broken links
- user-reported problems

## Business

When monetization begins:

- free-to-paid conversion
- subscription retention
- churn
- ARPU
- customer acquisition cost where applicable

Do not optimize engagement metrics in ways that encourage unhealthy dependence on Hello.

---

# 61. DEFINITION OF DONE FOR CODEX TASKS

A Codex task is not complete merely because code was written.

Unless explicitly overridden, completion requires:

1. inspect relevant existing code,
2. identify minimal change,
3. implement only approved scope,
4. run relevant syntax/tests,
5. test regressions,
6. run `git diff --check`,
7. inspect the final diff,
8. report exact files changed,
9. report tests performed,
10. report unresolved risks,
11. stop before unrelated work.

Never silently commit, push, merge, or deploy unless explicitly authorized.

---

# 62. CODEX CHANGE POLICY

Codex must distinguish between:

READ
PLAN
IMPLEMENT
COMMIT
PUSH
DEPLOY

Authorization for one does not imply authorization for the next.

If asked to inspect:
do not modify.

If asked to implement:
do not automatically commit.

If asked to commit:
do not automatically push.

If asked to push:
do not automatically deploy.

Production deployment requires explicit authorization.

---

# 63. REPOSITORY HYGIENE

Do not:

- rewrite working pages unnecessarily,
- perform large framework migrations,
- delete files because they "look unused" without verification,
- rename public URLs casually,
- alter health/safety behavior as part of unrelated cleanup,
- change established branding without approval.

Prefer small, reviewable diffs.

---

# 64. HEALTH-SAFETY CHANGE POLICY

Changes affecting any of the following require explicit review:

- emergency detection,
- crisis detection,
- individualized clinical boundaries,
- medication guidance,
- diagnosis behavior,
- evidence interpretation,
- research applicability,
- user health/profile context,
- care-navigation logic.

Never treat these as ordinary refactors.

---

# 65. RESEARCH CHANGE POLICY

Changes affecting:

- PubMed query construction,
- study ranking,
- relevance filtering,
- evidence synthesis,
- evidence strength,
- applicability,
- source selection

must include representative regression testing.

The system should prefer admitting uncertainty over manufacturing confidence.

---

# 66. FUTURE TECHNICAL DEBT

Known/deferred issues include:

- research routing does not yet resolve contextual pronouns using conversation history,
- duplicated client/server Wellness dimension allowlists,
- client timeout for long Ask requests,
- large global stylesheet with repeated selectors,
- repeated header/footer/search implementations,
- substantial inline CSS/JS,
- missing internal links/assets,
- incomplete resource tools,
- incomplete assessments,
- incomplete onboarding,
- forms without backend integration.

Do not opportunistically fix all of these during unrelated tasks.

Track and prioritize deliberately.

---

# 67. PRODUCT DECISION RULE

When deciding between two implementations, prefer the one that better supports:

1. user safety,
2. user agency,
3. understandable health information,
4. evidence integrity,
5. privacy,
6. accessibility,
7. maintainability,
8. simplicity,
9. measurable user value,
10. sustainable business value.

---

# 68. FINAL PRINCIPLE

My Simple Health should not try to make decisions for people.

It should help people become better equipped to make decisions.

Hello should not be the authority at the center of the experience.

The person is.

Hello, the tools, the educational content, and the evidence system exist to help that person understand, decide, act, and adapt.
