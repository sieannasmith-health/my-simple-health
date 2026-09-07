# MSH Temporal Pilot Operator Runbook

## Purpose

This runbook is the operational recovery contract for the isolated #203 Temporal foundation pilot. Core MSH Objective 2 B.2 remains paused until the pilot passes the full acceptance gate.

## Source of truth

Temporal workflow execution state and Event History are authoritative for orchestration. GitHub remains the engineering workspace for issues, code, pull requests, CI, and evidence. GitHub labels/comments are not workflow state.

## Failure triage protocol

1. Identify the workflow ID, run ID, task queue, and current Workflow Execution status.
2. Inspect Workflow Event History before changing code or retrying anything.
3. Classify the failure as Workflow logic, Activity/application failure, timeout/retry exhaustion, worker/process loss, dependency/tool failure, cancellation, or an explicitly typed human gate.
4. Consult the official Temporal documentation/API contract for the observed behavior before patching Temporal behavior.
5. Change one bounded cause at a time and rerun the smallest relevant fault test.
6. Do not convert infrastructure, tool, test, worker, or malformed-result failures into a Siea gate.

## Inspect current state

Use Temporal UI or the Temporal CLI against the configured namespace to locate the Workflow Execution by workflow ID. Inspect its status and Event History. For the pilot, workflow IDs use the `msh-objective-<objectiveId>` convention unless a test-specific ID is used.

Useful CLI pattern:

```sh
temporal workflow describe --workflow-id <workflow-id> --namespace <namespace>
temporal workflow show --workflow-id <workflow-id> --namespace <namespace>
```

Confirm the task queue and worker are the expected pilot values before diagnosing an apparent stall.

## Retry and timeout failures

Activities use bounded retries. Inspect Activity Task failure/timeout events and retry attempt information in Event History. Do not manually create a second Workflow Execution merely to retry an Activity. If retries exhaust, preserve the failed execution as evidence, fix the underlying cause, and start/resume according to the tested MSH workflow contract.

## Worker crash or loss

A worker process loss is not a human gate. Restore a compatible worker on the same namespace/task queue. Temporal should resume outstanding work from durable history. The pilot has an integration test that hard-kills a worker and verifies replacement-worker recovery.

## Dependency or MCP/tool outage

Treat unavailable GitHub/MCP/tool dependencies as machine failures. Preserve the stable idempotency key for any retried external side effect. The pilot requires bounded retry and terminal machine failure after exhaustion. Never set `requireSieaApproval` because a dependency is unavailable.

## Malformed agent result

Malformed stage output is a non-retryable application failure (`MALFORMED_AGENT_RESULT:<stage>`). Inspect the failure cause in the client/Workflow history. Do not allow Workflow Task retry loops for malformed application output.

## Cancellation

Cancellation is explicit operator intent, not a crash. Cancel the Workflow Execution using Temporal UI/client/CLI and verify the execution reaches a canceled terminal state.

```sh
temporal workflow cancel --workflow-id <workflow-id> --namespace <namespace> --reason '<reason>'
```

The pilot's tested resume model starts a new execution with an explicit `resumeFromStage`. It does not pretend a canceled execution can be uncanceled. Before resuming, verify the last completed durable stage and external side-effect idempotency records.

## Typed Siea gate

A Siea gate is allowed only when the workflow was explicitly started with a legitimate Product-defined `requireSieaApproval` condition. The workflow waits durably before Tessa until the `sieaApprove` signal arrives. Infrastructure and software failures must never create this state.

Signal pattern:

```sh
temporal workflow signal --workflow-id <workflow-id> --namespace <namespace> --name sieaApprove
```

## Stop runaway execution

First determine whether the execution is safely cancellable or requires immediate termination. Prefer cancellation when Workflow cleanup/cancellation semantics should run. Use termination only when an execution must be stopped without allowing further Workflow code to execute. Record the reason and preserve history/evidence before destructive cleanup.

## Evidence required before Product acceptance

Preserve: workflow ID/run ID; relevant Event History/failure cause; CI run; tested fault condition; recovery result; produced GitHub artifact/PR; Tessa QA disposition; and Nomy terminal disposition.

## Rollback

The Temporal pilot is isolated from `agent-runtime/**` and Core B.2. If the pilot fails acceptance, do not route Core work through it. Keep Core B.2 paused, stop pilot workers/executions, preserve the branch/PR and Temporal histories as evidence, and return to Nomy for architecture reassessment. Do not reactivate the quarantined homemade GitHub issue state machine as the fallback orchestration engine.

## Acceptance boundary

The pilot is not production-ready merely because CI is green. Product acceptance requires the fault suite, reproducible locked dependencies, operator diagnostics, least-privilege GitHub/MCP boundary, real Nomy → Selah → implementation/PR → CI → Tessa → Nomy artifact flow, full unattended canary, Tessa QA, and Nomy acceptance.