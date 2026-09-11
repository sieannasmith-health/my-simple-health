import assert from 'node:assert/strict';
import { resolveAgentEdge, AgentGraphTransitionError } from '../agent-graph.mjs';
import { deriveTransitionFromResult } from '../turn-transition.mjs';

const nomyState = {
  assigned_agent: 'nomy',
  current_stage: 'PRODUCT_COORDINATION'
};

const statusDefault = resolveAgentEdge(
  { status: 'ready_for_product', next_agent: null },
  nomyState
);
assert.equal(statusDefault.toAgent, null);
assert.equal(statusDefault.terminalCandidate, true);
assert.equal(statusDefault.source, 'status_default_terminal');

const transition = deriveTransitionFromResult(
  { status: 'ready_for_product', next_agent: null, reason_code: null },
  nomyState
);
assert.equal(transition.runtimeStatus, 'COMPLETED');
assert.equal(transition.assignedAgent, null);
assert.equal(transition.publicStatus, 'completed');
assert.equal(transition.needsHuman, false);
assert.equal(transition.humanGate, null);

const tessaToNomy = resolveAgentEdge(
  { status: 'ready_for_product', next_agent: null },
  { assigned_agent: 'tessa', current_stage: 'QA' }
);
assert.equal(tessaToNomy.toAgent, 'nomy');
assert.equal(tessaToNomy.source, 'status_default');

assert.throws(
  () => resolveAgentEdge(
    { status: 'ready_for_product', next_agent: 'nomy' },
    nomyState
  ),
  error => error instanceof AgentGraphTransitionError && /Self-handoff/.test(error.message)
);

console.log('Nomy ready-for-product terminal reconciliation passed');
