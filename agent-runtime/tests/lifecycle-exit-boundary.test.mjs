import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { HumanGateSignal, normalizeHumanGate } from '../human-gate-normalizer.mjs';

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; },
    async text() { return JSON.stringify(payload); }
  };
}

function makeFetch({ labels, latestComment }) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith('/issues/189')) {
      return jsonResponse({ labels: labels.map(name => ({ name })) });
    }
    if (url.endsWith('/issues/189/comments?per_page=100')) {
      return jsonResponse([{ body: latestComment }]);
    }
    if (url.endsWith('/issues/189/labels') && options.method === 'PUT') {
      return jsonResponse([]);
    }
    if (url.endsWith('/issues/189/comments') && options.method === 'POST') {
      return jsonResponse({ id: 1 }, 201);
    }
    throw new Error(`Unexpected request: ${options.method || 'GET'} ${url}`);
  };
  return { fetchImpl, calls };
}

{
  const { fetchImpl, calls } = makeFetch({
    labels: ['agent:nomy', 'status:blocked'],
    latestComment: 'Routine coordination block. No human escalation.'
  });

  const signal = await normalizeHumanGate({
    token: 'test-token',
    repository: 'owner/repo',
    issueNumber: 189,
    fetchImpl
  });

  assert.equal(signal, HumanGateSignal.NO_OP);
  assert.equal(calls.length, 2, 'NO_OP must not perform mutation requests');
}

{
  const { fetchImpl, calls } = makeFetch({
    labels: ['needs:siea', 'status:blocked', 'agent:selah'],
    latestComment: 'Execution is not approved. Approve an execution run.'
  });

  const signal = await normalizeHumanGate({
    token: 'test-token',
    repository: 'owner/repo',
    issueNumber: 189,
    fetchImpl
  });

  assert.equal(signal, HumanGateSignal.NORMALIZED);
  const mutationCalls = calls.filter(call => ['PUT', 'POST'].includes(call.options.method));
  assert.equal(mutationCalls.length, 2, 'Normalization must update labels and post its audit comment');
}

const helperSource = await fs.readFile(new URL('../human-gate-normalizer.mjs', import.meta.url), 'utf8');
assert.equal(helperSource.includes('process.exit('), false, 'Nested normalizer must never terminate the runtime process');

const orchestratorSource = await fs.readFile(new URL('../run-v3.mjs', import.meta.url), 'utf8');
const workerIndex = orchestratorSource.indexOf("state-hydrated-runner.mjs");
const normalizeIndex = orchestratorSource.indexOf('await normalizeHumanGate()');
const reconcileIndex = orchestratorSource.indexOf("post-turn-reconciler.mjs");
assert.ok(workerIndex >= 0 && normalizeIndex > workerIndex && reconcileIndex > normalizeIndex,
  'Runtime must execute worker, await normalization, then execute reconciliation');

const reconcilerSource = await fs.readFile(new URL('../post-turn-reconciler.mjs', import.meta.url), 'utf8');
const statePersistIndex = reconcilerSource.indexOf('persistWithOptimisticGuard');
const labelReconcileIndex = reconcilerSource.lastIndexOf('await reconcileLabels(transition)');
const pendingGuardIndex = reconcilerSource.indexOf("nextState.status === 'PENDING'");
const evaluatorDispatchIndex = reconcilerSource.lastIndexOf('await dispatchEvaluator()');
assert.ok(statePersistIndex >= 0 && labelReconcileIndex > statePersistIndex,
  'Post-turn reconciliation must persist authoritative state before visible labels');
assert.ok(pendingGuardIndex > labelReconcileIndex && evaluatorDispatchIndex > pendingGuardIndex,
  'A reconciled PENDING state must explicitly dispatch the state evaluator after label reconciliation');
assert.ok(reconcilerSource.includes("'msh-agent-state-evaluator.yml'"),
  'Explicit ignition must target the deployed MSH State Evaluator workflow');
assert.ok(reconcilerSource.includes("inputs: { issue_number: String(issueNumber) }"),
  'Explicit ignition must preserve the evaluator workflow single-input contract');

console.log('lifecycle exit-boundary regression tests passed');
