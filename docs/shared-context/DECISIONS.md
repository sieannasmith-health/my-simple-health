# MSH Shared Decision Log

This log records material decisions that need to remain consistent across founder workspaces and MSH agents.

Discussion belongs in GitHub shared communication stream #271. Execution belongs in the relevant issue/PR. This file records the durable decision and its provenance.

## Decision template

### YYYY-MM-DD — Decision title
- **Status:** Decided / Superseded
- **Decision owner:**
- **Decision:**
- **Why:**
- **Scope:**
- **Constraints / boundaries:**
- **Evidence / discussion:**
- **Execution links:**
- **Supersedes:** None

---

## 2026-09-09 — Shared founder/agent company context uses GitHub as the durable bridge
- **Status:** Decided
- **Decision owner:** Siea / Nomy
- **Decision:** Separate authorized founder ChatGPT workspaces will use a shared GitHub-backed MSH context layer rather than attempting to copy private ChatGPT memories between accounts. GitHub issue #271 is the shared communication stream; `docs/shared-context/` is the durable reference layer; normal issues/PRs/CI remain the execution and evidence layer.
- **Why:** Siea and Brandon need their Nomy and specialist teams to draw from common MSH company knowledge while preserving private-account and private-conversation boundaries.
- **Scope:** MSH company, product, founder workstreams, and authorized agent collaboration.
- **Constraints / boundaries:** No credentials, private member health data, unnecessary personal information, or unshared private ChatGPT history. Shared discussion does not itself grant product, execution, regulatory, security, or financial approval.
- **Evidence / discussion:** GitHub shared communication stream #271.
- **Execution links:** `docs/shared-context/MSH_SHARED_CONTEXT.md`; `agent-runtime/agents.json`; `.github/workflows/msh-agent-runtime.yml` on the Brandon agent workspace branch.
- **Supersedes:** None
