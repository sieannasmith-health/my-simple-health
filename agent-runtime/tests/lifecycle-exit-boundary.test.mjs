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

function makeFetch(labels) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith('/issues/189')) return jsonResponse({ labels: labels.map(name => ({ name })) });
    if (url.endsWith('/issues/189/comments?per_page=100')) return jsonResponse([{ body: 'presentation can be arbitrary' }]);
    if (url.endsWith('/issues/189/labels') && options.method === 'PUT') return jsonResponse([]);
    if (url.endsWith('/issues/189/comments') && options.method === 'POST') return jsonResponse({ id: 1 }, 201);
    throw new Error(`Unexpected request: ${options.method || 'GET'} ${url}`);
  };
  return { fetchImpl, calls };
}

{
  const { fetchImpl, calls } = makeFetch(['agent:nomy', 'status:blocked']);
  const signal = await normalizeHumanGate({
    token: 'test-token', repository: 'owner/repo', issueNumber: 189,
    structuredResult: { reason_code: 'EXECUTION_APPROVAL_REQUIRED', message: 'variant one' }, fetchImpl
  });
  assert.equal(signal, HumanGateSignal.NORMALIZED);
  assert.equal(calls.filter(call => ['PUT', 'POST'].includes(call.options.method)).length, 2);
}

{
  const { fetchImpl, calls } = makeFetch(['agent:nomy', 'status:blocked']);
  const signal = await normalizeHumanGate({
    token: 'test-token', repository: 'owner/repo', issueNumber: 189,
    structuredResult: { reason_code: 'EXECUTION_APPROVAL_REQUIRED', message: 'variant two' }, fetchImpl
  });
  assert.equal(signal, HumanGateSignal.NORMALIZED);
  assert.equal(calls.filter(call => ['PUT', 'POST'].includes(call.options.method)).length, 2);
}

{
  const { fetchImpl, calls } = makeFetch(['needs:siea', 'status:blocked', 'agent:selah']);
  const signal = await normalizeHumanGate({
    token: 'test-token', repository: 'owner/repo', issueNumber: 189,
    structuredResult: { reason_code: 'HUMAN_APPROVAL_REQUIRED', message: 'physical device check' }, fetchImpl
  });
  assert.equal(signal, HumanGateSignal.NO_OP);
  assert.equal(calls.length, 2, 'human-only gates must remain untouched');
}

const helperSource = await fs.readFile(new URL('../human-gate-normalizer.mjs', import.meta.url), 'utf8');
assert.equal(helperSource.includes('process.exit('), false);
assert.doesNotMatch(helperSource, /latestComment/);

const policySource = await fs.readFile(new URL('../orchestration-policy.mjs', import.meta.url), 'utf8');
assert.doesNotMatch(policySource, /executionApprovalLanguage|mentionsExecutionApproval|latestComment/);

console.log('structured lifecycle exit-boundary regression tests passed');
