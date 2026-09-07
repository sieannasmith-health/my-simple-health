import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { HumanGateSignal, normalizeHumanGate } from '../human-gate-normalizer.mjs';

function response(payload, status = 200) { return { ok: status >= 200 && status < 300, status, async json() { return payload; }, async text() { return JSON.stringify(payload); } }; }
function fakeFetch(labels, comment) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith('/issues/195')) return response({ labels: labels.map(name => ({ name })) });
    if (url.endsWith('/issues/195/comments?per_page=100')) return response([{ body: comment }]);
    if (url.endsWith('/issues/195/labels') && options.method === 'PUT') return response([]);
    if (url.endsWith('/issues/195/comments') && options.method === 'POST') return response({ id: 1 }, 201);
    throw new Error(`Unexpected request: ${options.method || 'GET'} ${url}`);
  };
  return { fetchImpl, calls };
}

for (const wording of ['Any prose is acceptable.', 'A completely different explanation.', 'No execution wording is present.']) {
  const { fetchImpl, calls } = fakeFetch(
    ['agent:selah', 'status:blocked', 'needs:siea'],
    `${wording} <!-- MSH_RESULT {"reason_code":"EXECUTION_APPROVAL_REQUIRED"} -->`
  );
  assert.equal(await normalizeHumanGate({ token: 'test', repository: 'owner/repo', issueNumber: 195, fetchImpl }), HumanGateSignal.NORMALIZED);
  assert.equal(calls.filter(call => ['PUT', 'POST'].includes(call.options.method)).length, 2);
}

{
  const { fetchImpl, calls } = fakeFetch(
    ['agent:selah', 'status:blocked'],
    'Physical-device approval is required. <!-- MSH_RESULT {"reason_code":"HUMAN_APPROVAL_REQUIRED"} -->'
  );
  assert.equal(await normalizeHumanGate({ token: 'test', repository: 'owner/repo', issueNumber: 195, fetchImpl }), HumanGateSignal.NO_OP);
  assert.equal(calls.length, 2);
}

const source = await fs.readFile(new URL('../human-gate-normalizer.mjs', import.meta.url), 'utf8');
assert.equal(source.includes('process.exit('), false);
const reconciler = await fs.readFile(new URL('../post-turn-reconciler.mjs', import.meta.url), 'utf8');
assert.ok(reconciler.includes('persistWithOptimisticGuard'));
assert.ok(reconciler.includes("nextState.status === 'PENDING'"));
assert.ok(reconciler.includes('dispatchEvaluator'));
console.log('lifecycle exit-boundary regression tests passed');
