# MSH Agent Interoperability — Gate 2

## Purpose

Gate 2 turns the named MSH workforce into a private, discoverable, permissioned registry without claiming that every registered worker already has an autonomous runtime.

## Foundation-first decisions

The design was checked against the current official foundations before implementation.

### A2A

Current released A2A specification: **1.0.0**.

Relevant foundation concepts adopted:
- Agent Cards describe identity, capabilities/skills, interaction requirements, and security requirements.
- Curated/private registries are a valid discovery mechanism.
- Discovery does not itself grant authorization.
- Authorization should follow least privilege.

MSH decision for Gate 2:
- use an internal Agent-Card-inspired metadata contract and curated registry;
- do **not** expose the 17 internal MSH workers as A2A servers;
- `a2aExposure` remains `none` until Product approves a genuinely independent runtime/service boundary.

Official references:
- https://a2a-protocol.org/v1.0.0/
- https://github.com/a2aproject/A2A/blob/main/docs/specification.md

### MCP

Relevant authorization/security concepts adopted:
- least-privilege tool access;
- resource/tool authorization is separate from discovery;
- credentials remain outside workflow state;
- STDIO MCP retrieves credentials from the worker environment rather than embedding authorization material in protocol messages.

MSH decision for Gate 2:
- preserve the existing narrow GitHub MCP boundary;
- enforce an agent-to-tool RBAC map before MCP tool calls;
- no merge, repository administration, secrets administration, ruleset changes, approvals, or destructive repository operations are added.

Official reference:
- https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization

## Registry state model

`active`
: The worker has a currently proven execution path on the accepted Temporal/MCP foundation and may receive only its explicitly allowed tools.

`registered`
: The worker is discoverable by stable identity and capability, but has no live MCP tool authority yet. Registration is not proof of runtime health, trust, or authorization.

Gate 2 bootstrap active workers:
- Nomy
- Selah
- Tessa

The remaining 14 workers are registered with zero live MCP permissions until a later onboarding gate proves their execution contract.

## RBAC bootstrap

### Nomy
Read-only:
- `github_read_issue`
- `github_read_repository_file`
- `github_read_checks`

### Selah
Bounded engineering tools:
- all Nomy read tools
- `github_create_branch`
- `github_write_repository_file`
- `github_open_pull_request`

### Tessa
Read-only:
- `github_read_issue`
- `github_read_repository_file`
- `github_read_checks`

Tessa no longer calls `github_open_pull_request` to verify an existing PR. QA consumes durable Selah PR evidence and independently reads CI status.

### Registered specialists
No live MCP tools until their runtime/onboarding gate is accepted.

## Fail-closed rule

A tool request not present in the active worker's card fails with:

`AGENT_TOOL_FORBIDDEN:<agent-id>:<tool-name>`

This is an authorization/policy failure. It is not a Siea gate and must not be bypassed by granting broader tools to make a workflow pass.

## Activation rule for additional workers

A registered worker may move to `active` only when all of the following are true:
1. stable metadata card and bounded capabilities are accepted;
2. minimum necessary tool permissions are explicitly defined;
3. the worker has an actual Temporal/internal execution path or an approved independent-runtime boundary;
4. tests prove allowed actions and forbidden actions;
5. failures do not create false Siea gates;
6. Tessa QA and Nomy Product acceptance pass.

Changing `status` alone is never sufficient evidence of onboarding.
