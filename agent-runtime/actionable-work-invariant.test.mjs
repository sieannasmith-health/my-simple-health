import assert from 'node:assert/strict';
import { actionableWorkMustNotIdle, assertActionableWorkDoesNotIdle, decideActionableWork, ACTIONABLE_WORK_MUST_NOT_IDLE } from './actionable-work-invariant.mjs';

const now = Date.parse('2026-09-10T22:00:00Z');

assert.deepEqual(decideActionableWork({ status: 'PENDING', assigned_agent: 'selah' }, now), {
  action: 'dispatch', reason: 'pending_owner_is_actionable'
});
assert.deepEqual(decideActionableWork({ status: 'ORCHESTRATION_BLOCKED', human_gate: null, recovery: null }, now), {
  action: 'bootstrap_recovery', reason: 'blocked_without_recovery_checkpoint'
});
assert.deepEqual(decideActionableWork({ status: 'ORCHESTRATION_BLOCKED', human_gate: null, redrive_count: 0, max_redrives: 2, recovery: {
  resume_agent: 'selah', resume_stage: 'IMPLEMENTATION', not_before: '2026-09-10T21:59:00Z'
} }, now), { action: 'redrive', reason: 'recovery_checkpoint_is_actionable' });
assert.deepEqual(decideActionableWork({ status: 'ORCHESTRATION_BLOCKED', human_gate: null, redrive_count: 0, max_redrives: 2, recovery: {
  resume_agent: 'selah', resume_stage: 'IMPLEMENTATION', not_before: '2026-09-10T22:05:00Z'
} }, now), { action: 'wait', reason: 'bounded_redrive_cooldown' });
assert.deepEqual(decideActionableWork({ status: 'ORCHESTRATION_BLOCKED', human_gate: null, redrive_count: 2, max_redrives: 2, recovery: {
  resume_agent: 'selah', resume_stage: 'IMPLEMENTATION', not_before: '2026-09-10T21:59:00Z'
} }, now), { action: 'none', reason: 'redrive_budget_exhausted' });
assert.deepEqual(decideActionableWork({ status: 'EXECUTING', execution: { lease_expires_at: '2026-09-10T21:00:00Z' } }, now), {
  action: 'recover_lease', reason: 'execution_lease_expired'
});
assert.deepEqual(decideActionableWork({ status: 'EXECUTING', execution: { lease_expires_at: '2026-09-10T23:00:00Z' } }, now), {
  action: 'wait', reason: 'active_execution_lease'
});
assert.deepEqual(decideActionableWork({ status: 'PAUSED_FOR_SIEA', human_gate: { assignee: 'siea' } }, now), {
  action: 'wait', reason: 'human_gate'
});
assert.deepEqual(decideActionableWork({ status: 'COMPLETED' }, now), {
  action: 'none', reason: 'terminal'
});
assert.equal(actionableWorkMustNotIdle({ status: 'PENDING', assigned_agent: 'tessa' }, now).violation, true);
assert.throws(() => assertActionableWorkDoesNotIdle({ status: 'PENDING', assigned_agent: 'tessa' }, now), error =>
  error.code === ACTIONABLE_WORK_MUST_NOT_IDLE && error.requiredAction === 'dispatch'
);

console.log('ACTIONABLE_WORK_MUST_NOT_IDLE invariant conformance tests passed.');
