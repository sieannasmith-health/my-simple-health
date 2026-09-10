# Newton — MSH Business Operating Baseline

**Owner:** Newton — Business Strategy & Finance  
**Status:** Proposed operating control for Nomy review  
**Last updated:** 2026-09-10

## Purpose

Provide a lightweight business/finance operating layer for My Simple Health without expanding Product scope. This baseline converts the useful near-term controls identified in the Founder-supplied *AI Operational Strategy Manual & Corporate Protocols* into MSH-specific governance.

The source manual is reference material, not MSH policy. Its fixed capital-allocation percentages, mandatory 24-hour provider switching, member-facing token pricing, automatic production-data training flywheels, and long-term reserved-compute commitments are not adopted here.

## 1. Financial management model

MSH management reporting should classify spending into four categories while preserving the underlying accounting record and historical amounts.

| Cost class | Definition | Examples / treatment |
| --- | --- | --- |
| Fixed operating burn | Recurring baseline costs that exist independent of member usage | recurring software, baseline hosting, developer/company services, employees/contractors where applicable |
| Variable member-serving cost | Costs that scale materially with member/product usage | AI inference, usage-based APIs, variable storage/processing |
| Development / investment | Spend used to create or validate capabilities rather than serve current production usage | engineering, evaluation infrastructure, specialized model/data work |
| Strategic / one-time | Non-routine spend supporting company capability or risk control | legal, security reviews, research, specialized integration/setup |

### Monthly Newton financial review

Report only values supported by current financial records.

| Metric | Current value | Source / note |
| --- | ---: | --- |
| Cash available | TBD | Requires authoritative cash balance |
| Fixed monthly burn | TBD | Calculate from classified recurring expenses |
| Variable AI/API/member-serving cost | TBD | Requires usage/cost records |
| Committed recurring expenses | TBD | Calculate from expense ledger/contracts |
| Material one-time spend this month | TBD | Calculate from expense ledger |
| Estimated runway | **Not calculated** | Do not calculate until cash and representative burn inputs are available |

**Runway rule:** never manufacture a runway estimate from incomplete inputs.

## 2. Build-vs-integrate decision gate

Use this review for material new infrastructure, AI/model providers, platform services, or capabilities. Product scope remains Nomy's decision; engineering feasibility remains Selah's responsibility.

### Decision record

- **Capability:**
- **Decision owner:**
- **Product objective served:**
- **Options:** Build / Integrate / Defer / Avoid

| Factor | Build | Integrate | Notes |
| --- | --- | --- | --- |
| Up-front implementation cost | | | |
| Recurring / usage cost | | | |
| Maintenance burden | | | |
| Switching / lock-in cost | | | |
| Privacy / data-use exposure | | | |
| Security exposure | | | |
| Reliability / failure exposure | | | |
| Portability / exit path | | | |
| Strategic differentiation | | | |

### Default principle

> Integrate mature commodity capability where doing so is trustworthy and economically sound; own the MSH-specific systems that create durable member value.

Integration is not automatically cheaper. Evaluate total lifecycle cost and dependency risk, not implementation speed alone.

## 3. AI & infrastructure dependency register

Maintain this register for **material** dependencies only. Unknown information must remain `TBD` until verified; do not infer vendor contractual terms.

| Dependency | Capability supplied | Criticality | Pricing / cost exposure | Data retention / training terms | Switching constraints | Known fallback / exit path | Verification status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Apple platform / HealthKit | Native iOS platform and member-authorized health-data access | High | TBD | Governed by Apple/platform terms and MSH permissions; detailed review belongs to Vera/Reese | iOS health experience is strategically Apple-dependent | Product-level portability TBD | Known dependency; commercial/privacy details require specialist review |
| GitHub | Source control, issues/PRs, CI/operational command-center path | High for development operations | TBD | TBD | Repository/workflow migration cost exists | Standard repository export/migration mechanisms; exact plan TBD | Known dependency; contract/cost details TBD |
| AI / foundation-model provider(s) | Underlying model capability for Simple/runtime where applicable | Potentially high | TBD | **Must be verified before sensitive production use** | Avoid unnecessary vendor-specific coupling | Preserve architectural optionality; no mandatory hot-swap SLA adopted | Provider inventory/terms TBD |
| Production backend / data platform | Application backend, persistence and/or service infrastructure | High when production member data depends on it | TBD | Requires Vera/Grant/Reese review as applicable | Data/schema/service coupling may increase switching cost | Exit/export plan TBD | Exact production dependency inventory TBD |
| Deployment / hosting platform | Web/API/runtime deployment where applicable | Medium–High | TBD | TBD | Runtime/deployment coupling TBD | Alternative hosting technically possible; effort TBD | Exact production role/cost TBD |

### Vendor review minimum

Before a material dependency is approved for sensitive production use, capture:

1. What capability MSH is buying/renting.
2. Current and scaling pricing model.
3. What member/company data leaves MSH and why.
4. Retention, training, secondary-use, and deletion terms.
5. Security and regulatory implications.
6. Operational criticality and outage impact.
7. Switching constraints and realistic exit path.

## 4. AI unit-economics measurement

MSH should understand AI economics internally before exposing any usage-based pricing to members.

Track when production usage exists:

- inference cost per Simple conversation,
- inference cost per active member per month,
- non-model API cost per active member,
- variable storage/processing cost per active member,
- usage distribution (median and high-usage members),
- gross-margin scenarios under candidate subscription prices.

**Current pricing posture:** no member-facing token/credit pricing is adopted by this baseline.

## 5. Strategic infrastructure MSH should own

Subject to Nomy sequencing, MSH-specific evaluation should be treated as proprietary strategic infrastructure. Evaluation should eventually measure behaviors that matter to MSH rather than merely relying on foundation-model benchmark quality.

Candidate evaluation dimensions include health-context fidelity, provenance preservation, correction handling, conversational continuity, uncertainty behavior, unsupported inference, member-intent understanding, privacy boundaries, and appropriate use of Personal Health Model context.

Relevant specialist review: Sage, Tessa, Clara, Vera, and Reese where regulatory implications apply.

## 6. Controls deliberately deferred or rejected

MSH does **not** currently adopt:

- fixed capital-allocation percentages from the source manual,
- member-facing AI/token credit pricing,
- outcomes-based consumer pricing,
- automatic use of production health data or Simple conversations for model training,
- mandatory 24-hour foundation-model hot swapping,
- multi-year reserved-compute commitments,
- artificial customer switching costs as a competitive moat.

## 7. Operating cadence

**Monthly — Newton**
- update financial classifications and burn view from authoritative records;
- identify material changes in recurring or variable cost;
- update runway only when inputs support it;
- review material vendor/dependency changes.

**When a material dependency is proposed — Newton + relevant specialists**
- run the build-vs-integrate gate;
- obtain privacy/security/regulatory review where applicable;
- return recommendation to Nomy.

**When Product scope is implicated — Nomy**
- approve, defer, reject, or sequence the recommendation;
- route approved engineering implementation to Selah.

## 8. Immediate information gaps

The following remain intentionally unresolved until authoritative records are available:

- current MSH cash available,
- representative monthly fixed burn,
- current variable AI/API spend,
- complete recurring commitments,
- exact AI/model provider inventory and contractual data-use terms,
- exact production backend/hosting dependency inventory and current cost,
- defensible runway.

These gaps are work items, not values to estimate without evidence.
