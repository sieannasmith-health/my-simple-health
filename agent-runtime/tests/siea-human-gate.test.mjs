import assert from 'node:assert/strict';
import { deriveTransitionFromResult } from '../turn-transition.mjs';

const state = {
  current_stage: 'IMPLEMENTATION',
  assigned_agent: 'selah',
  status: 'EXECUTING'
};

const genuineGate = deriveTransitionFromResult({
  status: 'blocked',
  next_agent: 'tessa',
  requires_human: true,
  human_request: 'Approve the manual native-test run on MSH-Mac.',
  message: 'Native execution is ready for Siea approval.'
}, state);

assert.equal(genuineGate.runtimeStatus, 'PAUSED_FOR_SIEA');
assert.equal(genuineGate.assignedAgent, null);
assert.equal(genuineGate.needsHuman, true);
assert.equal(genuineGate.humanGate.assignee, 'siea');
assert.equal(genuineGate.humanGate.type, 'EXPLICIT_SIEA_REQUEST');
assert.equal(genuineGate.humanGate.action, 'Approve the manual native-test run on MSH-Mac.');
assert.equal(genuineGate.humanGate.resume_agent, 'tessa');
assert.equal(genuineGate.humanGate.resume_stage, 'QA');
assert.ok(genuineGate.humanGate.requested_at);

const ordinaryBlocked = deriveTransitionFromResult({
  status: 'blocked',
  next_agent: null,
  requires_human: false,
  human_request: null,
  message: 'Repository evidence is incomplete.'
}, state);

assert.equal(ordinaryBlocked.runtimeStatus, 'PENDING');
assert.equal(ordinaryBlocked.assignedAgent, 'nomy');
assert.equal(ordinaryBlocked.needsHuman, false);
assert.equal(ordinaryBlocked.humanGate, null);

console.log('paused Siea human gate regression tests passed');
