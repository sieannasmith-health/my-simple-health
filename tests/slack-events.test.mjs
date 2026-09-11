import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { authorizeEvent, handlePayload, parseAddress, verifySlackSignature } from '../api/slack-events.js';

const env = { MSH_SLACK_TEAM_ID: 'T1', MSH_SLACK_ALLOWED_CHANNELS: 'C0C0T9F3LUF', MSH_SLACK_ALLOWED_USERS: 'U_SIEA,U_BRANDON' };
const event = (text = 'Iris: summarize the research plan') => ({ event_id: crypto.randomUUID(), team_id: 'T1', event: { type: 'message', user_id: 'U_SIEA', channel_id: 'C0C0T9F3LUF', channel: 'C0C0T9F3LUF', ts: '123.456', text } });

test('verifies Slack HMAC and rejects stale signatures', () => {
  const body = '{}'; const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = `v0=${crypto.createHmac('sha256', 'secret').update(`v0:${timestamp}:${body}`).digest('hex')}`;
  assert.equal(verifySlackSignature({ body, timestamp, signature, secret: 'secret' }), true);
  assert.equal(verifySlackSignature({ body, timestamp: '1', signature, secret: 'secret' }), false);
});

test('parses canonical agents and Everyone without fan-out', () => {
  assert.deepEqual(parseAddress('Iris: hello').key, 'iris');
  assert.deepEqual(parseAddress('Everyone: coordinate').key, 'nomy');
  assert.equal(parseAddress('Unknown: hello').ok, false);
});

test('enforces workspace, channel, and user allowlists', () => {
  assert.equal(authorizeEvent({ team_id: 'T1', channel_id: 'C0C0T9F3LUF', user_id: 'U_SIEA' }, env).ok, true);
  assert.equal(authorizeEvent({ team_id: 'T2', channel_id: 'C0C0T9F3LUF', user_id: 'U_SIEA' }, env).ok, false);
  assert.equal(authorizeEvent({ team_id: 'T1', channel_id: 'C0C0T9F3LUF', user_id: 'U_BAD' }, env).ok, false);
});

test('denies restricted content and durable mutation', async () => {
  const denied = await handlePayload(event('Iris: here is my diagnosis'), { env, runtime: async () => { throw new Error('must not run'); } });
  assert.equal(denied.body.denied, true);
  const mutation = await handlePayload(event('Nomy: merge the GitHub pull request'), { env, runtime: async () => { throw new Error('must not run'); } });
  assert.equal(mutation.body.denied, true);
});

test('dispatches once and publishes attributed thread reply', async () => {
  const calls = []; const item = event('Iris: summarize the research plan');
  const result = await handlePayload(item, { env, runtime: async (input) => { calls.push(input); return 'A concise answer.'; }, publisher: async (input) => { calls.push(input); } });
  assert.equal(result.status, 200); assert.equal(calls[0].agent, 'Iris'); assert.match(calls[1].text, /^\*Iris \| Research & Insights\*/); assert.equal(calls[1].thread, '123.456');
  const duplicate = await handlePayload(item, { env, runtime: async () => 'should not run', publisher: async () => {} });
  assert.equal(duplicate.body.duplicate, true);
});
