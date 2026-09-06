# MSH Agent Runtime

This runtime removes the human-copy/paste step from routine MSH agent handoffs.

## Architecture

- GitHub Issue: canonical task and shared conversation
- GitHub Actions: event/wake-up runtime
- OpenAI Responses API: specialist agent execution
- Issue comments: agent results and handoffs
- `agent:*` labels: current routing target
- `status:*` labels: current task state
- `needs:siea`: automation has reached a decision, credential/access request, or physical-device checkpoint that requires Siea

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

## Human boundary

Agents set `requires_human` only for a real Siea dependency such as:

- product/owner decision
- secret or credential
- access grant
- physical-device validation

The issue is then labeled `needs:siea`.

## Data boundary

This is an operations channel. Do not put member health data, member financial data, credentials, API keys, or other sensitive member content in agent-operation issues.
