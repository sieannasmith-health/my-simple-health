# MSH Temporal Foundation Pilot

Issue: #203

This directory is an isolated replacement pilot for the quarantined legacy MSH orchestration runtime. It must not depend on the legacy GitHub issue state machine for execution or authority.

## Architecture

- Temporal owns durable workflow execution, workflow state, retries, timeouts, cancellation, recovery, and concurrency.
- MSH owns Product sequencing, agent roles, QA/evidence gates, typed Siea gates, permissions, governance, and workflow rules.
- MCP provides least-privilege tool access to GitHub, repository, CI, and other approved tools.
- A2A is reserved for boundaries where agents are genuinely independent runtimes/services.
- GitHub remains the engineering system of record for issues, code, branches, pull requests, CI, reviews, and evidence. GitHub comments and labels are not the durable orchestration engine.

## First acceptance path

Nomy -> Selah -> repository/tool access -> implementation artifact/PR -> CI -> Tessa -> Nomy -> terminal disposition.

## Required fault tests

1. Worker crash and restart recovery.
2. Timeout and deterministic retry.
3. Duplicate-execution protection and idempotency.
4. MCP/tool dependency unavailable.
5. Malformed agent result.
6. Cancellation and resume/recovery behavior.
7. Deliberately typed Siea gate.
8. Infrastructure failures never become a false Siea gate.

## Migration gate

Core Objective 2 B.2 remains paused. The legacy runtime remains quarantined. No Core objective may depend on this pilot until the full unattended canary, fault tests, Tessa QA, Nomy Product acceptance, diagnostics runbook, and rollback proof pass.

## Operator runbook requirement

The pilot is not complete until an operator can inspect workflow state and history, identify why execution failed or blocked, retry, cancel, recover/resume, inspect artifacts/evidence, stop runaway work, and roll back the pilot without modifying orchestration internals.