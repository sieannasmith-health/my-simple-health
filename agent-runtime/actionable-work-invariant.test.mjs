import assert from 'node:assert/strict';
import { actionableWorkMustNotIdle, assertActionableWorkDoesNotIdle, ACTIONABLE_WORK_MUST_NOT_IDLE } from './actionable-work-invariant.mjs';

const now = Date.parse('2026-09-10T22:00:00Z');
assert.equal(actionableWorkMustNotIdle({ status: 'PENDING', assigned_agent: 'selah' }, now).action, 'dispatch');
assert.equal(actionableWorkMustNotIdle({ status: 'ORCHESTRATION_BLOCKED', human_gate: null, recovery: null }, now).action, 'bootstrap_recovery');
assert.equal(actionableWorkMustNotIdle({ status: 'ORCHESTRATION_BLOCKED', human_gate: null, recovery: { resume_agent: 'selah', resume_stage: 'IMPLEMENTATION', not_before: '2026-09-10T21:59:00Z' } }, now).action, 'redrive');
assert.equal(actionableWorkMustNotIdle({ status: 'PAUSED_FOR_SIEA', human_gate: { assignee: 'siea' } }, now).violation, false);
assert.equal(actionableWorkMustNotIdle({ status: 'COMPLETED' }, now).violation, false);
assert.throws(() => assertActionableWorkDoesNotIdle({ status: 'PENDING', assigned_agent: 'tessa' }, now), error => error.code === ACTIONABLE_WORK_MUST_NOT_IDLE && error.requiredAction === 'dispatch');
console.log('ACTIONABLE_WORK_MUST_NOT_IDLE invariant tests passed.');
