# MSH Agent Runtime

This runtime removes the human-copy/paste step from routine MSH agent handoffs and now includes a gated engineering execution path for Selah.

## Architecture

- GitHub Issue: canonical task and shared conversation
- GitHub Actions: event/wake-up runtime
- OpenAI Responses API: specialist agent execution
- Issue comments: agent results and handoffs
- `agent:*` labels: current routing target
- `status:*` labels: current task state
- `needs:siea`: automation has reached a decision, credential/access request, or physical-device checkpoint that requires Siea
- `execution:approved`: explicit Product/runtime gate that permits Selah to create scoped repository changes and open a PR

## One-time repository setup

Create the GitHub Actions repository secret:

- `OPENAI_API_KEY`

Optional repository variable:

- `MSH_AGENT_MODEL` (defaults to `gpt-5.6-luna`)

No API keys belong in source control.

## Starting a task

Either add an `agent:<name>` label to an issue, use the workflow's manual dispatch, or comment:

`RUN AGENT: selah`

The runner reads the task, recent issue conversation, the repository working agreement, and a small set of task-relevant repository excerpts. It posts a structured result back to the issue.

When the agent returns `next_agent`, the runtime replaces the current routing label with the next agent's label. That label event starts the next agent automatically.

Example:

Nomy → Selah → Tessa → Selah → Nomy

## Engineering execution gate

Selah may create repository changes only when the task has the `execution:approved` label.

When that gate is present and repository context is sufficient, Selah may return complete replacement contents for a small set of scoped text files. The runtime then:

1. validates the file paths and payload size,
2. blocks changes to `.github/**`, `agent-runtime/**`, and likely credential/secret/token files,
3. creates a dedicated `agent/issue-...` branch,
4. commits and pushes the proposed changes,
5. opens a pull request against `main`,
6. stops before merge.

The agent runtime cannot merge its own work.

## CI-driven QA routing

For agent-created pull requests that run `iOS Native Integrity`:

- CI success routes the originating issue to `agent:tessa` with `status:review_requested`.
- CI failure routes the originating issue back to `agent:selah` with `status:changes_requested`.

This keeps CI as verification evidence rather than allowing an agent to self-certify success.

## Human boundary

Agents set `requires_human` only for a real Siea dependency such as:

- product/owner decision
- secret or credential
- access grant
- physical-device validation

The issue is then labeled `needs:siea`.

## Data boundary

This is an operations channel. Do not put member health data, member financial data, credentials, API keys, or other sensitive member content in agent-operation issues.
