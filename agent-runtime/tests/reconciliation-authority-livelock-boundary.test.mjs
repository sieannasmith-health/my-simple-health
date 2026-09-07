import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { historyAfterLatestMaintenanceGrant, hasLivelock } from '../livelock-policy.mjs';
import { deriveTransitionFromResult } from '../turn-transition.mjs';

function blockedTurn(agent = 'nomy') {
  return {
    stage: agent === 'selah' ? 'IMPLEMENTATION' : 'PRODUCT_COORDINATION',
    agent,
    status: 'COMPLETED',
    result_status: 'blocked',
    evidence: null
  };
}

{
  const history = [blockedTurn(), blockedTurn(), blockedTurn()];
  assert.equal(historyAfterLatestMaintenanceGrant(history).length, 3,
    'Legacy history without a maintenance marker must keep the full conservative lookback');
  assert.equal(hasLivelock({ history }, 3), true,
    'Legacy repeated blocked turns must still trip the circuit breaker');
}

{
  const history = [
    blockedTurn(),
    blockedTurn(),
    blockedTurn(),
    { event: 'RUNTIME_MAINTENANCE_GRANTED', at: '2026-09-07T04:23:11.438Z' },
    blockedTurn('selah')
  ];
  const scoped = historyAfterLatestMaintenanceGrant(history);
  assert.equal(scoped.length, 1, 'A fresh grant must cut off all older loop history');
  assert.equal(scoped[0].agent, 'selah');
  assert.equal(hasLivelock({ history }, 3), false,
    'One legitimate turn after a fresh grant must not inherit the old livelock');
}

{
  const history = [
    { event: 'RUNTIME_MAINTENANCE_GRANTED', at: '2026-09-07T01:00:00.000Z' },
    blockedTurn(),
    blockedTurn(),
    blockedTurn(),
    { event: 'RUNTIME_MAINTENANCE_GRANTED', at: '2026-09-07T04:23:11.438Z' },
    blockedTurn('selah')
  ];
  assert.deepEqual(historyAfterLatestMaintenanceGrant(history), [blockedTurn('selah')],
    'The latest maintenance marker, not the first marker, defines the active history window');
  assert.equal(hasLivelock({ history }, 3), false);
}

{
  const history = [blockedTurn(), blockedTurn(), blockedTurn(), { event: 'RUNTIME_MAINTENANCE_GRANTED' }];
  assert.deepEqual(historyAfterLatestMaintenanceGrant(history), [],
    'A grant as the newest history item establishes an empty fresh window');
  assert.equal(hasLivelock({ history }, 3), false,
    'A fresh maintenance boundary with no subsequent turns must pass preflight');
}

{
  const state = { assigned_agent: 'selah', current_stage: 'IMPLEMENTATION' };
  const transition = deriveTransitionFromResult({ status: 'blocked', next_agent: 'nomy', requires_human: false }, state);
  assert.equal(transition.assignedAgent, 'nomy', 'A legitimate structured Selah handoff to Nomy must be preserved');
  assert.equal(transition.nextStage, 'PRODUCT_COORDINATION');
  assert.equal(transition.runtimeStatus, 'PENDING');
}

{
  const state = { assigned_agent: 'selah', current_stage: 'IMPLEMENTATION' };
  const transition = deriveTransitionFromResult({ status: 'review_requested', next_agent: null, requires_human: false }, state);
  assert.equal(transition.assignedAgent, 'tessa', 'Review requests should deterministically route to QA without consulting labels');
  assert.equal(transition.nextStage, 'QA');
}

const reconcilerSource = await fs.readFile(new URL('../post-turn-reconciler.mjs', import.meta.url), 'utf8');
assert.equal(reconcilerSource.includes('deriveTransition(freshIssue, state)'), false,
  'Reconciler must not derive authoritative transitions from mutable issue labels');
assert.ok(reconcilerSource.includes('deriveTransitionFromResult(structuredWorkerResult, state)'),
  'Reconciler must consume the trusted structured worker result');
const persistIndex = reconcilerSource.indexOf('persistWithOptimisticGuard(freshIssue, nextState)');
const labelsIndex = reconcilerSource.indexOf('await reconcileLabels(transition)');
const dispatchIndex = reconcilerSource.indexOf('await dispatchEvaluator()');
assert.ok(persistIndex >= 0 && labelsIndex > persistIndex && dispatchIndex > labelsIndex,
  'Lifecycle order must be durable state persistence -> label projection -> evaluator ignition');

const runV3Source = await fs.readFile(new URL('../run-v3.mjs', import.meta.url), 'utf8');
assert.ok(runV3Source.includes("spawn(process.execPath, ['agent-runtime/state-hydrated-runner.mjs']"),
  'run-v3 must execute the bounded worker through structured stdout capture');
assert.ok(runV3Source.includes('await reconcileTurn(structuredWorkerResult)'),
  'run-v3 must pass the captured structured result directly into reconciliation');

console.log('reconciliation authority and livelock boundary regression tests passed');
