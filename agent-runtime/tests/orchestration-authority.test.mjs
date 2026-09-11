import assert from 'node:assert/strict';
import {
  createOrchestrationFetchGuard,
  shouldSuppressWorkerWrite
} from '../langgraph-worker-bridge.mjs';

const baseEnv = {
  GITHUB_REPOSITORY: 'sieannasmith-health/my-simple-health',
  ISSUE_NUMBER: '12'
};

assert.equal(
  shouldSuppressWorkerWrite({
    url: 'https://api.github.com/repos/sieannasmith-health/my-simple-health/issues/12',
    method: 'PATCH',
    env: { ...baseEnv, MSH_ORCHESTRATION_OWNER: 'langgraph' }
  }),
  true,
  'LangGraph-owned worker must suppress current issue mutation.'
);

assert.equal(
  shouldSuppressWorkerWrite({
    url: 'https://api.github.com/repos/sieannasmith-health/my-simple-health/issues/12/comments',
    method: 'POST',
    env: { ...baseEnv, MSH_ORCHESTRATION_OWNER: 'langgraph' }
  }),
  true,
  'LangGraph-owned worker must suppress current issue comment publication.'
);

assert.equal(
  shouldSuppressWorkerWrite({
    url: 'https://api.github.com/repos/sieannasmith-health/my-simple-health/issues/12/labels/agent%3Aselah',
    method: 'DELETE',
    env: { ...baseEnv, MSH_ORCHESTRATION_OWNER: 'langgraph' }
  }),
  true,
  'LangGraph-owned worker must suppress current issue label mutation.'
);

assert.equal(
  shouldSuppressWorkerWrite({
    url: 'https://api.github.com/repos/sieannasmith-health/my-simple-health/issues/123',
    method: 'PATCH',
    env: { ...baseEnv, MSH_ORCHESTRATION_OWNER: 'langgraph' }
  }),
  false,
  'Issue 12 authority guard must not collide with issue 123.'
);

assert.equal(
  shouldSuppressWorkerWrite({
    url: 'https://api.github.com/repos/sieannasmith-health/my-simple-health/issues/12',
    method: 'PATCH',
    env: baseEnv
  }),
  false,
  'Ordinary Node runtime writes must pass through when LangGraph ownership is absent.'
);

assert.equal(
  shouldSuppressWorkerWrite({
    url: 'https://api.github.com/repos/sieannasmith-health/my-simple-health/pulls',
    method: 'POST',
    env: { ...baseEnv, MSH_ORCHESTRATION_OWNER: 'langgraph' }
  }),
  false,
  'Bounded implementation PR creation must remain allowed under LangGraph ownership.'
);

assert.equal(
  shouldSuppressWorkerWrite({
    url: 'https://api.openai.com/v1/responses',
    method: 'POST',
    env: { ...baseEnv, MSH_ORCHESTRATION_OWNER: 'langgraph' }
  }),
  false,
  'Bounded specialist model execution must remain allowed under LangGraph ownership.'
);

const calls = [];
const logs = [];
const fakeResponse = new Response('{"ok":true}', { status: 201, headers: { 'content-type': 'application/json' } });
const fakeFetch = async (input, init = {}) => {
  calls.push({ input, init });
  return fakeResponse;
};

const guarded = createOrchestrationFetchGuard({
  realFetch: fakeFetch,
  env: { ...baseEnv, MSH_ORCHESTRATION_OWNER: 'langgraph' },
  writeLog: message => logs.push(message)
});

const suppressed = await guarded(
  'https://api.github.com/repos/sieannasmith-health/my-simple-health/issues/12/comments',
  { method: 'POST', body: '{"body":"duplicate orchestration"}' }
);
assert.equal(suppressed.status, 200);
assert.equal(calls.length, 0, 'Suppressed orchestration writes must not reach real fetch.');
assert.equal(logs.length, 1, 'Suppressed orchestration writes must emit one authority diagnostic.');

const prResponse = await guarded(
  'https://api.github.com/repos/sieannasmith-health/my-simple-health/pulls',
  { method: 'POST', body: '{"head":"agent/test"}' }
);
assert.equal(prResponse, fakeResponse);
assert.equal(calls.length, 1, 'PR creation must pass through to real fetch.');

const ordinaryCalls = [];
const ordinaryGuard = createOrchestrationFetchGuard({
  realFetch: async (input, init = {}) => {
    ordinaryCalls.push({ input, init });
    return fakeResponse;
  },
  env: baseEnv,
  writeLog: () => {
    throw new Error('Ordinary Node path must not log suppression.');
  }
});
await ordinaryGuard(
  'https://api.github.com/repos/sieannasmith-health/my-simple-health/issues/12',
  { method: 'PATCH', body: '{"state":"open"}' }
);
assert.equal(ordinaryCalls.length, 1, 'Ordinary Node issue writes must pass through unchanged.');

console.log('Single-orchestrator behavioral regression passed.');
