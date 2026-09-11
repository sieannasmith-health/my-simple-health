import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { authorizeEvent, classifyFailure, handlePayload, parseAddress, verifySlackSignature } from '../api/slack-events.js';
import registry from '../agent-runtime/agents.json' with { type: 'json' };

const env = { MSH_SLACK_TEAM_ID: 'T1', MSH_SLACK_ALLOWED_CHANNELS: 'C0C0T9F3LUF', MSH_SLACK_ALLOWED_USERS: 'U_SIEA,U_BRANDON', NODE_ENV: 'test' };
const event = (text = 'Iris: summarize the research plan', user_id = 'U_SIEA') => ({ event_id: crypto.randomUUID(), team_id: 'T1', event: { type: 'message', user_id, channel_id: 'C0C0T9F3LUF', ts: '123.456', text } });
const store = () => { const keys = new Set(); return { async claim(key) { if (keys.has(key)) return false; keys.add(key); return true; } }; };

test('verifies valid, stale, malformed, and tampered Slack signatures', () => {
  const body = '{}'; const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = `v0=${crypto.createHmac('sha256', 'secret').update(`v0:${timestamp}:${body}`).digest('hex')}`;
  assert.equal(verifySlackSignature({ body, timestamp, signature, secret: 'secret' }), true);
  assert.equal(verifySlackSignature({ body, timestamp: '1', signature, secret: 'secret' }), false);
  assert.equal(verifySlackSignature({ body, timestamp, signature: signature.replace(/.$/, '0'), secret: 'secret' }), false);
  assert.equal(verifySlackSignature({ body, timestamp: 'x', signature, secret: 'secret' }), false);
});

test('covers every registered agent and Everyone routing', () => {
  for (const [key, agent] of Object.entries(registry)) if (key !== '_organization') { const parsed = parseAddress(`${agent.name}: hello`); assert.equal(parsed.ok, true); assert.equal(parsed.key, key); }
  assert.equal(parseAddress('Everyone: coordinate').key, 'nomy');
  assert.equal(parseAddress('Unknown: hello').ok, false);
  assert.equal(parseAddress('Iris hello').ok, false);
  assert.equal(parseAddress('Iris:').ok, false);
});

test('enforces workspace, channel, and both allowlisted identities', () => {
  for (const user_id of ['U_SIEA', 'U_BRANDON']) assert.equal(authorizeEvent({ team_id: 'T1', channel_id: 'C0C0T9F3LUF', user_id }, env).ok, true);
  assert.equal(authorizeEvent({ team_id: 'T2', channel_id: 'C0C0T9F3LUF', user_id: 'U_SIEA' }, env).ok, false);
  assert.equal(authorizeEvent({ team_id: 'T1', channel_id: 'C_OTHER', user_id: 'U_SIEA' }, env).ok, false);
  assert.equal(authorizeEvent({ team_id: 'T1', channel_id: 'C0C0T9F3LUF', user_id: 'U_BAD' }, env).ok, false);
});

test('fails closed for sensitive content and durable mutation', async () => {
  for (const text of ['Iris: here is my diagnosis', 'Iris: my SSN is 123-45-6789', 'Nomy: merge the GitHub pull request']) {
    let called = false;
    const result = await handlePayload(event(text), { env, store: store(), runtime: async () => { called = true; } });
    assert.equal(result.body.denied, true); assert.equal(called, false);
  }
});

test('dispatches once, preserves correlation/thread, and redacts audit content', async () => {
  const calls = []; const item = event();
  const result = await handlePayload(item, { env, store: store(), runtime: async (input) => { calls.push(input); return 'A concise answer.'; }, publisher: async (input) => calls.push(input) });
  assert.equal(result.status, 200); assert.equal(calls[0].agent.name, 'Iris'); assert.match(calls[1].text, /^\\*Iris \\| Research & Insights\\*/); assert.equal(calls[1].thread, '123.456'); assert.equal(calls[1].correlationId, result.body.correlation_id); assert.equal(JSON.stringify(result.audit).includes(item.event.text), false);
  const duplicate = await handlePayload(item, { env, store: store(), runtime: async () => 'should run only with a different store', publisher: async () => {} });
  assert.equal(duplicate.body.accepted, true);
});

test('durable store suppresses duplicate retries', async () => {
  const shared = store(); const item = event();
  await handlePayload(item, { env, store: shared, runtime: async () => 'ok', publisher: async () => {} });
  const duplicate = await handlePayload(item, { env, store: shared, runtime: async () => { throw new Error('must not run'); }, publisher: async () => {} });
  assert.equal(duplicate.body.duplicate, true);
});

test('classifies transient and permanent failures', () => {
  assert.equal(classifyFailure({ status: 429 }).retryable, true);
  assert.equal(classifyFailure({ status: 503 }).kind, 'transient');
  assert.equal(classifyFailure({ status: 400 }).retryable, false);
});

test('rejects malformed callbacks', async () => {
  assert.equal((await handlePayload({ type: 'event_callback', team_id: 'T1', event: null }, { env })).status, 400);
  assert.equal((await handlePayload({ type: 'url_verification', challenge: 'ok' }, { env })).body.challenge, 'ok');
});
