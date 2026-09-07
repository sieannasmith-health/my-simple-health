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
  const history = [blockedTurn(), blockedTurn(), blockedTurn(),
    { event: 'RUNTIME_MAINTENANCE_GRANTED', at: '2026-09-07T04:23:11.438Z' }, blockedTurn('selah')];
  assert.equal(historyAfterLatestMaintenanceGrant(history).length, 1);
  assert.equal(hasLivelock({ history }, 3), false);
}

{
  const history = [
    { event: 'RUNTIME_MAINTENANCE_GRANTED', at: '2026-09-07T01:00:00.000Z' },
    blockedTurn(), blockedTurn(), blockedTurn(),
    { event: 'RUNTIME_MAINTENANCE_GRANTED', at: '2026-09-07T04:23:11.438Z' },
    blockedTurn('selah')
  ];
  assert.deepEqual(historyAfterLatestMaintenanceGrant(history), [blockedTurn('selah')]);
  assert.equal(hasLivelock({ history }, 3), false);
}

{
  const history = [blockedTurn(), blockedTurn(), blockedTurn(), { event: 'RUNTIME_MAINTENANCE_GRANTED' }];
  assert.deepEqual(historyAfterLatestMaintenanceGrant(history), []);
  assert.equal(hasLivelock({ history }, 3), false);
}

for (const message of [
  'Waiting for human approval, please review this wording variant.',
  'Need authorization before I can continue.',
  'Execution is not currently approved.',
  'Completely unrelated presentation prose.'
]) {
  const state = { assigned_agent: 'selah', current_stage: 'IMPLEMENTATION' };
  const transition = deriveTransitionFromResult({
    status: 'blocked',
    reason_code: 'EXECUTION_APPROVAL_REQUIRED',
    requires_human: true,
    message,
    next_agent: null
  }, state);
  assert.equal(transition.runtimeStatus, 'PENDING', 'Execution approval is an operational Nomy handoff');
  assert.equal(transition.assignedAgent, 'nomy');
  assert.equal(transition.needsHuman, false, 'Missing execution approval must not create a Siea pause');
  assert.equal(transition.humanGate, null);
}

{
  const state = { assigned_agent: 'selah', current_stage: 'IMPLEMENTATION' };
  const transition = deriveTransitionFromResult({
    status: 'blocked',
    reason_code: 'PHYSICAL_DEVICE_ACTION',
    requires_human: false,
    human_request: 'Run the native test on the designated physical device.',
    message: 'Any arbitrary presentation wording must not alter typed escalation.'
  }, state);
  assert.equal(transition.runtimeStatus, 'PAUSED_FOR_SIEA');
  assert.equal(transition.assignedAgent, null);
  assert.equal(transition.needsHuman, true);
  assert.equal(transition.humanGate.reason_code, 'PHYSICAL_DEVICE_ACTION');
  assert.equal(transition.humanGate.action, 'Run the native test on the designated physical device.');
}

{
  const state = { assigned_agent: 'selah', current_stage: 'IMPLEMENTATION' };
  const transition = deriveTransitionFromResult({
    status: 'blocked',
    reason_code: 'HUMAN_APPROVAL_REQUIRED',
    requires_human: true,
    message: 'Generic human approval requested.'
  }, state);
  assert.equal(transition.runtimeStatus, 'PENDING', 'Generic human approval must not imply a Siea-only gate');
  assert.equal(transition.assignedAgent, 'nomy');
  assert.equal(transition.needsHuman, false);
  assert.equal(transition.humanGate, null);
}

{
  const state = { assigned_agent: 'selah', current_stage: 'IMPLEMENTATION' };
  const transition = deriveTransitionFromResult({
    status: 'blocked',
    reason_code: null,
    requires_human: true,
    message: 'I need human approval.'
  }, state);
  assert.equal(transition.runtimeStatus, 'PENDING', 'Untyped prose must never create a Siea pause');
  assert.equal(transition.assignedAgent, 'nomy');
  assert.equal(transition.needsHuman, false);
  assert.equal(transition.humanGate, null);
}

{
  const state = { assigned_agent: 'selah', current_stage: 'IMPLEMENTATION' };
  const transition = deriveTransitionFromResult({ status: 'blocked', next_agent: 'nomy', requires_human: false }, state);
  assert.equal(transition.assignedAgent, 'nomy');
  assert.equal(transition.nextStage, 'PRODUCT_COORDINATION');
  assert.equal(transition.runtimeStatus, 'PENDING');
}

{
  const state = { assigned_agent: 'selah', current_stage: 'IMPLEMENTATION' };
  const transition = deriveTransitionFromResult({ status: 'review_requested', next_agent: null, requires_human: false }, state);
  assert.equal(transition.assignedAgent, 'tessa');
  assert.equal(transition.nextStage, 'QA');
}

const reconcilerSource = await fs.readFile(new URL('../post-turn-reconciler.mjs', import.meta.url), 'utf8');
assert.equal(reconcilerSource.includes('deriveTransition(freshIssue, state)'), false);
assert.ok(reconcilerSource.includes('deriveTransitionFromResult(structuredWorkerResult, state)'));
const persistIndex = reconcilerSource.indexOf('persistWithOptimisticGuard(freshIssue, nextState)');
const labelsIndex = reconcilerSource.indexOf('await reconcileLabels(transition)');
const dispatchIndex = reconcilerSource.indexOf('await dispatchEvaluator()');
assert.ok(persistIndex >= 0 && labelsIndex > persistIndex && dispatchIndex > labelsIndex,
  'Lifecycle order must remain persistence -> label projection -> exactly-once evaluator ignition');

const runV3Source = await fs.readFile(new URL('../run-v3.mjs', import.meta.url), 'utf8');
assert.ok(runV3Source.includes("spawn(process.execPath, ['agent-runtime/state-hydrated-runner.mjs']"));
assert.ok(runV3Source.includes('await reconcileTurn(structuredWorkerResult)'));
assert.ok(runV3Source.includes('EXECUTION_APPROVAL_REQUIRED'));
assert.ok(runV3Source.includes('reason_code'));
assert.equal(runV3Source.includes("reason_code: 'HUMAN_APPROVAL_REQUIRED'"), false,
  'run-v3 must not manufacture a generic human reason code from requires_human');

const transitionSource = await fs.readFile(new URL('../turn-transition.mjs', import.meta.url), 'utf8');
assert.equal(transitionSource.includes("'HUMAN_APPROVAL_REQUIRED'"), false,
  'Generic human approval must not be a Siea-only transition reason');

console.log('reconciliation authority and livelock boundary regression tests passed');
