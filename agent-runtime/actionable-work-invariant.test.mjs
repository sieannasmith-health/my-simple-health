import assert from 'node:assert/strict';
import test from 'node:test';
import { actionableWorkMustNotIdle } from './actionable-work-invariant.mjs';

const now = Date.parse('2026-09-10T23:00:00Z');

test('pending assigned work must dispatch', () => {
  assert.deepEqual(actionableWorkMustNotIdle({ status: 'PENDING', assigned_agent: 'selah' }, now), {
    violation: true, action: 'dispatch', reason: 'pending_owner_is_actionable'
  });
});

test('blocked machine-resolvable work without checkpoint must bootstrap recovery', () => {
  assert.equal(actionableWorkMustNotIdle({ status: 'ORCHESTRATION_BLOCKED', human_gate: null }, now).action, 'bootstrap_recovery');
});

test('eligible recovery checkpoint must redrive', () => {
  const result = actionableWorkMustNotIdle({ status: 'ORCHESTRATION_BLOCKED', human_gate: null, recovery: {
    resume_agent: 'selah', resume_stage: 'IMPLEMENTATION', not_before: '2026-09-10T22:59:00Z'
  } }, now);
  assert.equal(result.action, 'redrive');
  assert.equal(result.violation, true);
});

test('bounded cooldown is a legitimate wait', () => {
  const result = actionableWorkMustNotIdle({ status: 'ORCHESTRATION_BLOCKED', human_gate: null, recovery: {
    resume_agent: 'selah', resume_stage: 'IMPLEMENTATION', not_before: '2026-09-10T23:05:00Z'
  } }, now);
  assert.equal(result.violation, false);
  assert.equal(result.action, 'wait');
});

test('expired execution lease must recover', () => {
  assert.equal(actionableWorkMustNotIdle({ status: 'EXECUTING', execution: { lease_expires_at: '2026-09-10T22:00:00Z' } }, now).action, 'recover_lease');
});

test('genuine human gate may idle', () => {
  assert.equal(actionableWorkMustNotIdle({ status: 'PAUSED_FOR_SIEA', human_gate: { assignee: 'siea' } }, now).violation, false);
});

test('terminal state may idle', () => {
  assert.equal(actionableWorkMustNotIdle({ status: 'COMPLETED' }, now).violation, false);
});
