import assert from 'node:assert/strict';
import { AgentGraphTransitionError, resolveAgentEdge } from './agent-graph.mjs';
import { deriveTransitionFromResult } from './turn-transition.mjs';

const completed = (nextAgent, message = 'Turn complete.') => ({
  status: 'completed',
  next_agent: nextAgent,
  reason_code: null,
  requires_human: false,
  human_request: null,
  message
});

{
  const transition = deriveTransitionFromResult(
    completed('nomy', 'Next handoff: Nomy'),
    { assigned_agent: 'mira', current_stage: 'INITIAL_TRIAGE' }
  );
  assert.equal(transition.runtimeStatus, 'PENDING');
  assert.equal(transition.assignedAgent, 'nomy');
  assert.deepEqual(transition.graphTransition, { from: 'mira', to: 'nomy', source: 'explicit' });
}

{
  // Prose cannot route work. Without structured next_agent, this is terminal.
  const transition = deriveTransitionFromResult(
    completed(null, 'Next handoff: Nomy'),
    { assigned_agent: 'mira', current_stage: 'INITIAL_TRIAGE' }
  );
  assert.equal(transition.runtimeStatus, 'COMPLETED');
  assert.equal(transition.assignedAgent, null);
}

{
  const transition = deriveTransitionFromResult(
    { ...completed(null), status: 'review_requested' },
    { assigned_agent: 'selah', current_stage: 'IMPLEMENTATION' }
  );
  assert.equal(transition.runtimeStatus, 'PENDING');
  assert.equal(transition.assignedAgent, 'tessa');
}

{
  const transition = deriveTransitionFromResult(
    { ...completed(null), status: 'changes_requested' },
    { assigned_agent: 'tessa', current_stage: 'QA' }
  );
  assert.equal(transition.runtimeStatus, 'PENDING');
  assert.equal(transition.assignedAgent, 'tessa');
}

{
  assert.throws(
    () => resolveAgentEdge(completed('selah'), { assigned_agent: 'mira' }),
    AgentGraphTransitionError
  );
}

{
  assert.throws(
    () => resolveAgentEdge(completed('selah'), { assigned_agent: 'selah' }),
    AgentGraphTransitionError
  );
}

console.log('agent graph tests passed');
