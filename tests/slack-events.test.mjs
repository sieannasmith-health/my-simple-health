import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { authorizeEvent, canonicalAgents, handlePayload, parseAddress, verifySlackSignature } from '../api/slack-events.js';

const env = { MSH_SLACK_TEAM_ID: 'T1', MSH_SLACK_ALLOWED_CHANNELS: 'C0C0T9F3LUF', MSH_SLACK_ALLOWED_USERS: 'U_SIEA,U_BRANDON' };
const realEvent = (text = 'Iris: summarize the research plan', user = 'U_SIEA') => ({
  event_id: crypto.randomUUID(),
  team_id: 'T1',
  event: { type: 'message', user, channel: 'C0C0T9F3LUF', ts: '123.456', text }
});
const memoryStore = () => {
  const claims = new Map();
  return {
    async claim(key) {
      if (claims.has(key)) return { claimed: false, claimToken: null };
      const claimToken = crypto.randomUUID();
      claims.set(key, claimToken);
      return { claimed: true, claimToken };
    },
    async release(key, claimToken) {
      if (claims.get(key) !== claimToken) return false;
      claims.delete(key);
      return true;
    }
  };
};

const quiet = async (fn) => {
  const original = console.info;
  console.info = () => {};
  try { return await fn(); } finally { console.info = original; }
};

test('verifies Slack HMAC and rejects stale or invalid signatures', () => {
  const body = '{}';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = `v0=${crypto.createHmac('sha256', 'secret').update(`v0:${timestamp}:${body}`).digest('hex')}`;
  assert.equal(verifySlackSignature({ body, timestamp, signature, secret: 'secret' }), true);
  assert.equal(verifySlackSignature({ body, timestamp: '1', signature, secret: 'secret' }), false);
  assert.equal(verifySlackSignature({ body, timestamp, signature: 'v0=bad', secret: 'secret' }), false);
});

test('canonical registry parity and Everyone routing are exhaustive', () => {
  const agents = canonicalAgents();
  assert.ok(Object.keys(agents).length > 0);
  for (const [key, value] of Object.entries(agents)) {
    const parsed = parseAddress(`${value.name}: hello`);
    assert.equal(parsed.ok, true, key);
    assert.equal(parsed.key, key);
    assert.equal(parsed.agent.name, value.name);
    assert.equal(parsed.agent.role, value.role);
  }
  assert.equal(parseAddress('Everyone: coordinate').key, 'nomy');
  assert.equal(parseAddress('Unknown: hello').ok, false);
  assert.equal(parseAddress('no prefix').reason, 'missing_address');
});

test('enforces real Slack team, channel, and user allowlists', () => {
  assert.equal(authorizeEvent({ team_id: 'T1', channel: 'C0C0T9F3LUF', user: 'U_SIEA' }, env).ok, true);
  assert.equal(authorizeEvent({ team_id: 'T1', channel: 'C0C0T9F3LUF', user: 'U_BRANDON' }, env).ok, true);
  assert.equal(authorizeEvent({ team_id: 'T2', channel: 'C0C0T9F3LUF', user: 'U_SIEA' }, env).ok, false);
  assert.equal(authorizeEvent({ team_id: 'T1', channel: 'C_BAD', user: 'U_SIEA' }, env).ok, false);
  assert.equal(authorizeEvent({ team_id: 'T1', channel: 'C0C0T9F3LUF', user: 'U_BAD' }, env).ok, false);
});

test('accepts actual Slack Events API envelope for Siea and Brandon', async () => {
  for (const user of ['U_SIEA', 'U_BRANDON']) {
    const calls = [];
    const result = await quiet(() => handlePayload(realEvent('Iris: summarize the research plan', user), {
      env,
      idempotency: memoryStore(),
      runtime: async (input) => { calls.push(input); return 'A concise answer.'; },
      publisher: async (input) => { calls.push(input); }
    }));
    assert.equal(result.status, 200);
    assert.equal(calls[0].agent, 'Iris');
    assert.equal(calls[0].role, canonicalAgents().iris.role);
    assert.equal(calls[0].source, 'slack');
    assert.equal(calls[0].governed, true);
    assert.equal(calls[1].thread, '123.456');
    assert.match(calls[1].text, /^\*Iris \| Research & Insights\*/);
  }
});

test('rejects malformed events before runtime dispatch', async () => {
  const malformed = { event_id: 'x', team_id: 'T1', event: { type: 'message', user: 'U_SIEA', channel: 'C0C0T9F3LUF', text: 'Iris: hello' } };
  const result = await handlePayload(malformed, { env, runtime: async () => { throw new Error('must not run'); } });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'malformed_event');
});

test('denies restricted content and durable mutation', async () => {
  const denied = await quiet(() => handlePayload(realEvent('Iris: here is my diagnosis'), { env, idempotency: memoryStore(), runtime: async () => { throw new Error('must not run'); } }));
  assert.equal(denied.body.reason, 'restricted_content');
  const mutation = await quiet(() => handlePayload(realEvent('Nomy: merge the GitHub pull request'), { env, idempotency: memoryStore(), runtime: async () => { throw new Error('must not run'); } }));
  assert.equal(mutation.body.reason, 'durable_mutation_denied');
});

test('production fails closed without durable idempotency storage', async () => {
  const result = await quiet(() => handlePayload(realEvent(), {
    env: { ...env, NODE_ENV: 'production' },
    runtime: async () => 'must not run',
    publisher: async () => {}
  }));
  assert.equal(result.status, 503);
  assert.equal(result.body.error, 'idempotency_unavailable');
});

test('duplicate event is claimed once and does not dispatch twice', async () => {
  const item = realEvent();
  const store = memoryStore();
  let runtimeCalls = 0;
  const first = await quiet(() => handlePayload(item, { env, idempotency: store, runtime: async () => { runtimeCalls++; return 'ok'; }, publisher: async () => {} }));
  const second = await quiet(() => handlePayload(item, { env, idempotency: store, runtime: async () => { runtimeCalls++; return 'bad'; }, publisher: async () => {} }));
  assert.equal(first.status, 200);
  assert.equal(second.body.duplicate, true);
  assert.equal(runtimeCalls, 1);
});

test('default production runtime fails closed when governed runtime is not configured', async () => {
  const result = await quiet(() => handlePayload(realEvent(), {
    env: { ...env, NODE_ENV: 'production' },
    idempotency: memoryStore(),
    publisher: async () => {}
  }));
  assert.equal(result.status, 200);
  assert.equal(result.body.error, 'runtime_failure');
  assert.equal(result.body.retryable, false);
});

test('transient runtime failure returns non-2xx for Slack retry without leaking body into audit', async () => {
  const secretText = 'ordinary non-sensitive request';
  const result = await quiet(() => handlePayload(realEvent(`Iris: ${secretText}`), {
    env,
    idempotency: memoryStore(),
    runtime: async () => { throw Object.assign(new Error('network unavailable'), { transient: true }); },
    publisher: async () => {}
  }));
  assert.equal(result.status, 503);
  assert.equal(result.body.retryable, true);
  assert.equal(JSON.stringify(result.audit).includes(secretText), false);
});

test('transient failure releases owned claim so same Slack event can retry', async () => {
  const item = realEvent();
  const store = memoryStore();
  let calls = 0;
  const first = await quiet(() => handlePayload(item, {
    env,
    idempotency: store,
    runtime: async () => { calls++; throw Object.assign(new Error('temporary network failure'), { transient: true }); },
    publisher: async () => {}
  }));
  const second = await quiet(() => handlePayload(item, {
    env,
    idempotency: store,
    runtime: async () => { calls++; return 'recovered'; },
    publisher: async () => {}
  }));
  assert.equal(first.status, 503);
  assert.equal(second.status, 200);
  assert.equal(second.body.accepted, true);
  assert.equal(calls, 2);
});

test('stale owner cannot release a newer claim', async () => {
  const item = realEvent();
  let currentToken = 'token-b';
  const store = {
    async claim() { return { claimed: true, claimToken: 'token-a' }; },
    async release(_key, claimToken) { return claimToken === currentToken; }
  };
  const result = await quiet(() => handlePayload(item, {
    env,
    idempotency: store,
    runtime: async () => { throw Object.assign(new Error('temporary network failure'), { transient: true }); },
    publisher: async () => {}
  }));
  assert.equal(result.status, 200);
  assert.equal(result.body.error, 'stale_claim_owner');
  assert.equal(currentToken, 'token-b');
});

test('release outage fails closed and does not assume retry is safe', async () => {
  const item = realEvent();
  const store = {
    async claim() { return { claimed: true, claimToken: 'token-a' }; },
    async release() { throw new Error('redis unavailable'); }
  };
  const result = await quiet(() => handlePayload(item, {
    env,
    idempotency: store,
    runtime: async () => { throw Object.assign(new Error('temporary network failure'), { transient: true }); },
    publisher: async () => {}
  }));
  assert.equal(result.status, 503);
  assert.equal(result.body.error, 'idempotency_release_uncertain');
  assert.equal(result.body.retryable, false);
});
