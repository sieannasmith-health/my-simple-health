# MSH Autonomous Runtime Acceptance Gate

Issue: #203
PR: #219

The autonomous runtime is **not accepted** until the real execution path completes without manual GitHub coordination.

## Required unattended canary

1. Nomy objective enters Temporal.
2. Temporal invokes real MCP-backed GitHub Activities.
3. Selah stage reads the objective from GitHub and performs one bounded, idempotent repository side effect on a dedicated canary branch/artifact.
4. GitHub CI runs against that artifact.
5. Tessa stage reads the real CI/result evidence and records a real QA disposition.
6. Nomy acceptance consumes that evidence and records the terminal disposition.
7. The full evidence chain is inspectable in Temporal history and GitHub.

## Mandatory failure proof

Deliberately fail the MCP/GitHub dependency during the canary and verify:
- bounded retry occurs;
- stable idempotency is preserved;
- no duplicate external side effect is created;
- the failure never becomes a Siea gate;
- after dependency recovery, Temporal resumes and completes the same workflow correctly.

## Current implementation

`src/activities.ts` now includes the approved real MCP-backed path behind `MSH_REAL_MCP_CANARY=1`. The normal isolated contract tests retain deterministic fallback evidence, while the live canary exercises the real Temporal → MCP → GitHub → Tessa → Nomy path.

`test/real-mcp-recovery.integration.test.mjs` exercises the production MCP stdio client/server boundary with a persisted GitHub HTTP test backend. The first Selah attempt deliberately points to an unavailable MCP server process; Temporal retries the same Activity with the same idempotency key, the dependency is restored, and the same workflow must reach Tessa PASS and Nomy ACCEPTED. The persisted backend asserts exactly one branch creation, one repository-file write, and one pull-request creation across recovery.

## Product gate

Core Objective 2 B.2 remains paused until:
- real canary passes;
- failure/recovery proof passes;
- Tessa gives final QA disposition;
- Nomy accepts;
- operator recovery/runbook evidence is preserved.

A green unit/contract CI run alone does not satisfy this gate.
