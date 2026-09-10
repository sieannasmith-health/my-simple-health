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

### Founder-supplied expense baseline

The current MSH Expense Ledger contains four recorded purchases. Dates and amounts below are treated as authoritative because they come from the Founder-maintained ledger; this management view does not alter the source ledger.

| Expense | Expense date | Recorded amount | Renewal / cost behavior | Newton classification |
| --- | --- | ---: | --- | --- |
| Squarespace Domain (MSH) | 2026-08-30 | $9.00 | Renews 2027-08-30 at $20.00 | Fixed operating burn |
| Squarespace Domain (MSH) | 2026-08-30 | $9.00 | Renews 2027-08-30 at $20.00 | Fixed operating burn |
| OpenAI API Billing | 2026-09-05 | $10.00 | Pay-As-You-Go | Variable member-serving / AI cost |
| Apple Developer Program | 2026-09-05 | $107.17 | Renews 2027-09-05 at $107.17 | Fixed operating burn |

**Recorded purchases to date:** $135.17  
**Known annual fixed renewals:** $147.17  
**Monthly equivalent of known annual fixed renewals:** approximately $12.26  
**Recorded variable AI/API spend:** $10.00

These figures describe only the Founder-supplied entries currently available. They are not a claim that all MSH expenses have been captured.

### Monthly Newton financial review

Report only values supported by current financial records.

| Metric | Current value | Source / note |
| --- | ---: | --- |
| Cash available | TBD | Requires authoritative cash balance |
| Known fixed recurring-cost equivalent | ~$12.26/month | Annualized from currently recorded fixed renewals only |
| Recorded variable AI/API/member-serving cost | $10.00 | Current OpenAI API ledger entry; not yet representative of normalized monthly production usage |
| Known annual fixed renewals | $147.17/year | Two domain renewals plus Apple Developer Program |
| Recorded purchases to date | $135.17 | Four Founder-supplied ledger entries |
| Estimated runway | **Not calculated** | Cash balance and representative burn are incomplete |

**Runway rule:** never manufacture a runway estimate from incomplete inputs. The current ~$12.26/month figure is a known-renewal equivalent, not a complete monthly burn rate.

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

Maintain this register for **material** dependencies only. Unknown information remains `TBD` until verified; vendor contractual or privacy terms must not be inferred from repository configuration.

### Repo-verified dependencies

| Dependency | Repo evidence | Capability supplied / current role | Criticality | Cost exposure | Data-use / privacy status | Switching / exit observation |
| --- | --- | --- | --- | --- | --- | --- |
| Apple / iOS / HealthKit ecosystem | iOS Xcode project and native MSH source are present in the repository | Native member app and Apple health-platform integration | High for current product strategy | Apple Developer Program ledger renewal: $107.17/year; other Apple-related costs TBD | Health-data authorization/governance requires Vera/Reese/Clara review | MSH is intentionally iOS-native today; product portability is a future strategic question, not a current requirement |
| GitHub | Repository, Issues/PRs, `.github/workflows`, and #281 command-center operating model | Source control, CI/workflows, operational coordination | High for development operations | TBD | Repository content/data handling terms TBD | Migration is possible in principle but workflow/automation coupling creates operational switching cost |
| OpenAI API | `.env.example` contains `OPENAI_API_KEY`; Founder ledger records OpenAI API Billing | AI/model API capability used by MSH components where configured | Potentially high as Simple/runtime usage grows | Pay-As-You-Go; $10.00 currently recorded | Retention/training/contractual terms **TBD and must be verified before sensitive production use** | Preserve model/provider optionality; no 24-hour hot-swap requirement adopted |
| Vercel | `vercel.json` configures Vite build and functions including `api/simple.js`, `api/notion.js`, `api/notion-records.js`, `api/verify-id-token.js`, and `api/agent/*` | Web/API/runtime deployment for configured services | Medium–High for current deployed runtime paths | TBD | Data-use and processing terms TBD; review required for sensitive flows | Runtime can theoretically move, but function/deployment configuration creates migration work |
| Firebase | `.firebaserc` declares default project `msh-health`; repository includes token-verification API path | Firebase project dependency; exact production services/use require technical verification | Potentially high if authentication/data services depend on it | TBD | Exact data handled and applicable terms TBD; Grant/Vera/Reese review as relevant | Exit effort depends on which Firebase services are actually in production; inventory still required |
| Notion | `.env.example` includes `NOTION_TOKEN` and `NOTION_DATABASE_ID`; repo contains Notion API/tool code | Existing documentation/bridge integration | Low–Medium strategically; #281 designates Notion secondary/optional for execution | TBD | Integration data scope/retention terms TBD | GitHub is operational source of truth; Notion should remain removable from day-to-day execution dependency |

### Dependency conclusions supported now

1. **Apple dependency is intentional and strategic**, not something MSH should eliminate merely for vendor neutrality. MSH should avoid unnecessary coupling outside the Apple capabilities that materially improve the native health experience.
2. **OpenAI/model dependency should remain abstractable enough to preserve future choice**, but current evidence does not justify building complex multi-provider routing infrastructure.
3. **GitHub is now an operationally critical dependency** because it carries repository, PR/CI, and command-center workflows; this is acceptable, but its importance should be recognized in continuity planning.
4. **Notion should not regain execution-critical status** because #281 explicitly made it secondary/optional.
5. **Vercel and Firebase require a deeper technical/service inventory** before Newton can quantify cost concentration, data exposure, or switching economics.

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

**Current evidence:** the ledger records $10.00 of OpenAI API billing. That is sufficient to establish that AI usage is already a variable-cost category, but not sufficient to estimate steady-state cost per member, conversation, or month.

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

The following remain intentionally unresolved until authoritative records or technical verification are available:

- current MSH cash available,
- complete recurring-expense inventory beyond the current Founder ledger entries,
- representative normalized monthly AI/API usage,
- OpenAI and other vendor contractual data-retention/training terms applicable to MSH,
- exact Firebase services and production data flows,
- exact Vercel production usage/cost profile,
- defensible runway.

These gaps are work items, not values to estimate without evidence.
