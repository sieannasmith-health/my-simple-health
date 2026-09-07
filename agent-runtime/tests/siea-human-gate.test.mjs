import assert from 'node:assert/strict';
import { deriveTransitionFromResult } from '../turn-transition.mjs';

const state = {
  current_stage: 'IMPLEMENTATION',
  assigned_agent: 'selah',
  status: 'EXECUTING'
};

const genuineGate = deriveTransitionFromResult({
  status: 'blocked',
  next_agent: null,
  requires_human: true,
  human_request: 'Approve the manual native-test run on MSH-Mac.',
  message: 'Native execution is ready for Siea approval.'
}, state);

assert.equal(genuineGate.runtimeStatus, 'HUMAN_APPROVAL_REQUIRED');
assert.equal(genuineGate.assignedAgent, 'siea');
assert.equal(genuineGate.needsHuman, true);
assert.deepEqual(genuineGate.humanGate, {
  type: 'EXPLICIT_SIEA_REQUEST',
  action: 'Approve the manual native-test run on MSH-Mac.'
});

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

console.log('explicit Siea human gate regression tests passed');
