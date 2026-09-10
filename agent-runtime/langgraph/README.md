# MSH Agent OS LangGraph migration

This directory is the bounded migration seam from the custom orchestration controller to LangGraph.

## Manufacturer-manual semantics

The implementation follows LangGraph's documented low-level orchestration model: explicit graph state, nodes and conditional edges, durable execution/checkpointing, retry policies, interrupts for genuine human-in-the-loop pauses, and resumable execution. The migration also adopts AWS's evaluator-reflect-refine and redrive principles for recovery.

## Dual-loop architecture

### Execution recovery

`EXECUTE -> EVALUATE_RUNTIME -> CLASSIFY_FAILURE -> RECOVER -> EXECUTE`

Machine-resolvable failures remain inside the graph. A circuit breaker is a recovery signal, not a terminal parking state. State records the failed stage/agent, reason, recovery owner, resume point, retry/redrive budgets, completed branches, and evidence version.

### Quality refinement

`IMPLEMENT -> TESSA_EVALUATE -> REFINE -> IMPLEMENT -> TESSA_EVALUATE`

A QA failure routes to the responsible remediation owner and returns to Tessa until acceptance or a bounded terminal condition.

## Human gates

Only genuinely nondelegable input should pause execution. Production wiring must replace the scaffold's terminal human-gate node with LangGraph `interrupt()` plus a durable production checkpointer so execution resumes on the same thread after input.

## Migration gates

1. Keep the current GitHub/Node runtime live while LangGraph runs in shadow mode.
2. Adapt existing typed knowledge events into `AgentOSState`; do not rebuild organizational truth from model prose.
3. Use `objective_id`/`correlation_id` as the durable thread identity.
4. Replace `InMemorySaver` with a production durable checkpointer before cutover.
5. Add deterministic adapters for existing agent execution, fan-out/join, GitHub writes, CI evidence, and Tessa QA.
6. Prove transient retry, dependency assistance, QA repair, checkpoint resume, successful-branch preservation, human interrupt/resume, idempotency, and max-redrive protection.
7. Shadow-run #318 against the existing controller and compare state transitions/evidence.
8. Cut over only after Tessa conformance passes; retain rollback to the current controller for the first production window.

`ORCHESTRATION_BLOCKED` is not a LangGraph terminal state. During migration it should be translated into a typed failure/recovery classification and routed through the recovery loop.
