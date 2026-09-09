import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { parseAgentTarget, verifyNotionSignature, extractPlainText, isIntegrationAuthored } from '../agent-runtime/notion-bridge.mjs';

const agents = { nomy: {}, selah: {}, mira: {}, iris: {} };

test('routes explicit agent prefix case-insensitively', () => {
  assert.equal(parseAgentTarget('Selah: check this blocker', agents), 'selah');
  assert.equal(parseAgentTarget('@Mira: review this flow', agents), 'mira');
});

test('falls back to Nomy when routing is absent or unknown', () => {
  assert.equal(parseAgentTarget('Can someone review this?', agents), 'nomy');
  assert.equal(parseAgentTarget('UnknownAgent: hello', agents), 'nomy');
});

test('verifies Notion webhook HMAC signature', () => {
  const raw = JSON.stringify({ type: 'comment.created', entity: { id: 'abc' } });
  const token = 'verification-secret';
  const signature = `sha256=${crypto.createHmac('sha256', token).update(raw).digest('hex')}`;
  assert.equal(verifyNotionSignature(raw, signature, token), true);
  assert.equal(verifyNotionSignature(raw + 'x', signature, token), false);
});

test('extracts comment text and detects integration-authored comments', () => {
  const comment = { created_by: { id: 'bot-id' }, rich_text: [{ plain_text: 'Selah: ' }, { plain_text: 'hello' }] };
  assert.equal(extractPlainText(comment), 'Selah: hello');
  assert.equal(isIntegrationAuthored(comment, 'bot-id'), true);
  assert.equal(isIntegrationAuthored(comment, 'human-id'), false);
});
