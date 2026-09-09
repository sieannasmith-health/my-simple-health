import assert from 'node:assert/strict';
import { deriveTransitionFromResult } from './turn-transition.mjs';

const baseState = {
  assigned_agent: 'mira',
  current_stage: 'INITIAL_TRIAGE'
};

{
  const transition = deriveTransitionFromResult({
    status: 'completed',
    next_agent: 'nomy',
    reason_code: null,
    requires_human: false,
    human_request: null,
    message: 'UX handoff complete.'
  }, baseState);

  assert.equal(transition.runtimeStatus, 'PENDING');
  assert.equal(transition.assignedAgent, 'nomy');
  assert.equal(transition.nextStage, 'PRODUCT_COORDINATION');
}

{
  const transition = deriveTransitionFromResult({
    status: 'completed',
    next_agent: null,
    reason_code: null,
    requires_human: false,
    human_request: null,
    message: 'Objective fully complete.'
  }, baseState);

  assert.equal(transition.runtimeStatus, 'COMPLETED');
  assert.equal(transition.assignedAgent, null);
}

console.log('chain-reaction transition tests passed');
