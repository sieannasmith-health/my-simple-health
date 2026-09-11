import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const registryPath = path.join(process.cwd(), 'agent-runtime', 'agents.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const agents = new Map(Object.entries(registry).filter(([key]) => key !== '_organization').map(([key, value]) => [key, value]));
const memoryKeys = new Map();
const MAX_AGE_SECONDS = 300;
const MAX_TEXT_LENGTH = 4000;

function csv(value) {
  return new Set(String(value || '').split(',').map((item) => item.trim()).filter(Boolean));
}

function constantTimeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function verifySlackSignature({ body, timestamp, signature, secret, now = Date.now() }) {
  const seconds = Number(timestamp);
  if (!secret || !body || !Number.isInteger(seconds)) return false;
  if (Math.abs(Math.floor(now / 1000) - seconds) > MAX_AGE_SECONDS) return false;
  const expected = `v0=${crypto.createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')}`;
  return constantTimeEqual(expected, signature);
}

export function authorizeEvent(event, env = process.env) {
  const team = env.MSH_SLACK_TEAM_ID;
  const channels = csv(env.MSH_SLACK_ALLOWED_CHANNELS);
  const users = csv(env.MSH_SLACK_ALLOWED_USERS);
  if (!team || !channels.size || !users.size) return { ok: false, reason: 'authorization_not_configured' };
  if (event?.team_id !== team) return { ok: false, reason: 'workspace_denied' };
  if (!channels.has(event.channel_id)) return { ok: false, reason: 'channel_denied' };
  if (!users.has(event.user_id)) return { ok: false, reason: 'user_denied' };
  return { ok: true };
}

export function parseAddress(text) {
  if (typeof text !== 'string') return { ok: false, reason: 'malformed_text' };
  const match = text.match(/^\\s*([^:]{1,80})\\s*:\\s*([\\s\\S]+?)\\s*$/);
  if (!match) return { ok: false, reason: 'missing_address' };
  const label = match[1].trim().toLowerCase();
  const key = label === 'everyone' ? 'nomy' : label;
  const agent = agents.get(key);
  if (!agent) return { ok: false, reason: 'unknown_agent' };
  const prompt = match[2].trim();
  if (!prompt || prompt.length > MAX_TEXT_LENGTH) return { ok: false, reason: 'invalid_prompt' };
  return { ok: true, key, agent, prompt };
}

function sensitive(text) {
  const value = String(text || '');
  return /(\\bdiagnos(?:is|ed)\\b|\\bmedical record\\b|\\bpatient\\b|\\bhealth information\\b|\\bphi\\b|\\bssn\\b|\\bsocial security\\b|\\bmember health\\b|\\bprescription\\b|\\bmedication list\\b|\\bdate of birth\\b)/i.test(value)
    || /\\b(?:\\d{3}-\\d{2}-\\d{4}|\\d{10,}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,})\\b/i.test(value);
}

function durableMutation(text) {
  return /\\b(?:merge|close|delete|approve|deploy|release|create|modify|mutate|write)\\b.{0,50}\\b(?:github|issue|pull request|repository|production|database|workflow|product state)\\b/i.test(text)
    || /\\b(?:github|issue|pull request|repository|production|database|workflow|product state)\\b.{0,50}\\b(?:merge|close|delete|approve|deploy|release|create|modify|mutate|write)\\b/i.test(text);
}

function eventId(payload) {
  return payload?.event_id || `${payload?.team_id || ''}:${payload?.event?.channel || payload?.event?.channel_id || ''}:${payload?.event?.ts || ''}`;
}

function auditRecord({ correlationId, event, agent, result, reason }) {
  return { correlation_id: correlationId, event_id: eventId(event), workspace: event.team_id, channel: event.channel_id, user: event.user_id, agent: agent || null, purpose: 'slack_agent_request', result, reason: reason || null, timestamp: new Date().toISOString() };
}

export function classifyFailure(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  if (status === 408 || status === 409 || status === 425 || status === 429 || status >= 500 || error?.code === 'ETIMEDOUT') return { kind: 'transient', retryable: true };
  return { kind: 'permanent', retryable: false };
}

function productionStore(env) {
  const url = env.MSH_SLACK_IDEMPOTENCY_URL;
  const token = env.MSH_SLACK_IDEMPOTENCY_TOKEN;
  if (!url || !token) return null;
  return {
    async claim(key, ttlSeconds = 86400) {
      const response = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ key, ttl_seconds: ttlSeconds, operation: 'claim' }) });
      if (response.status === 409) return false;
      if (!response.ok) throw Object.assign(new Error('idempotency store unavailable'), { status: response.status });
      return true;
    }
  };
}

function memoryStore() {
  return { async claim(key) { if (memoryKeys.has(key)) return false; memoryKeys.set(key, Date.now()); return true; } };
}

async function claim(store, key, env) {
  if (store) return store.claim(key);
  if (env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production') {
    throw Object.assign(new Error('durable idempotency store is required'), { status: 503 });
  }
  return memoryStore().claim(key);
}

async function defaultRuntime({ agent, prompt, correlationId, env }) {
  const endpoint = env.MSH_GOVERNED_RUNTIME_URL;
  const key = env.OPENAI_API_KEY || env.MSH_OPENAI_API_KEY;
  if (!endpoint && !key) throw Object.assign(new Error('governed runtime is not configured'), { status: 503 });
  const url = endpoint || 'https://api.openai.com/v1/chat/completions';
  const headers = { 'content-type': 'application/json' };
  if (key) headers.authorization = `Bearer ${key}`;
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ model: env.MSH_OPENAI_MODEL || 'gpt-4o-mini', messages: [{ role: 'system', content: `You are ${agent.name}, ${agent.role}. Respond only to the bounded request. Do not mutate durable state. Correlation: ${correlationId}` }, { role: 'user', content: prompt }], temperature: 0.2, max_tokens: 700 }) });
  if (!response.ok) throw Object.assign(new Error('runtime request failed'), { status: response.status });
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || 'The agent returned no response.';
}

async function defaultPublisher({ text, channel, thread, env }) {
  if (!env.MSH_SLACK_BOT_TOKEN) throw Object.assign(new Error('Slack bot token is not configured'), { status: 503 });
  const response = await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { authorization: `Bearer ${env.MSH_SLACK_BOT_TOKEN}`, 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify({ channel, thread_ts: thread, text }) });
  if (!response.ok) throw Object.assign(new Error('Slack publish failed'), { status: response.status });
  const data = await response.json();
  if (!data.ok) throw Object.assign(new Error('Slack publish rejected'), { status: data.error === 'ratelimited' ? 429 : 400 });
  return data;
}

export async function handlePayload(payload, options = {}) {
  const env = options.env || process.env;
  const event = payload?.event;
  if (!payload || payload.type === 'url_verification') return { status: 200, body: { challenge: payload?.challenge } };
  if (payload.type !== 'event_callback' || !event || event.type !== 'message' || event.subtype || event.bot_id) return { status: 400, body: { denied: true, reason: 'malformed_event' } };
  const auth = authorizeEvent({ team_id: payload.team_id, channel_id: event.channel_id || event.channel, user_id: event.user_id }, env);
  if (!auth.ok) return { status: 403, body: { denied: true, reason: auth.reason }, audit: auditRecord({ correlationId: eventId(payload), event: { ...payload, channel_id: event.channel_id || event.channel, user_id: event.user_id }, result: 'denied', reason: auth.reason }) };
  const address = parseAddress(event.text);
  if (!address.ok || sensitive(event.text) || durableMutation(event.text)) return { status: 400, body: { denied: true, reason: address.ok ? (sensitive(event.text) ? 'sensitive_content' : 'durable_mutation') : address.reason } };
  const correlationId = `slack-${eventId(payload)}`;
  try {
    const claimed = await claim(options.store || productionStore(env), eventId(payload), env);
    if (!claimed) return { status: 200, body: { duplicate: true, correlation_id: correlationId } };
    const response = await (options.runtime || defaultRuntime)({ agent: address.agent, agentKey: address.key, prompt: address.prompt, correlationId, event, env });
    const text = `*${address.agent.name} | ${address.agent.role}*\\n${String(response).slice(0, 6000)}`;
    await (options.publisher || defaultPublisher)({ text, channel: event.channel_id || event.channel, thread: event.thread_ts || event.ts, correlationId, env });
    return { status: 200, body: { accepted: true, correlation_id: correlationId, agent: address.key }, audit: auditRecord({ correlationId, event: { ...payload, channel_id: event.channel_id || event.channel, user_id: event.user_id }, agent: address.agent.name, result: 'completed' }) };
  } catch (error) {
    const failure = classifyFailure(error);
    return { status: failure.retryable ? 503 : 500, body: { denied: true, reason: failure.kind === 'transient' ? 'transient_failure' : 'processing_failure', correlation_id: correlationId }, audit: auditRecord({ correlationId, event: { ...payload, channel_id: event.channel_id || event.channel, user_id: event.user_id }, agent: address.agent.name, result: 'failed', reason: failure.kind }) };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  if (!verifySlackSignature({ body, timestamp: req.headers['x-slack-request-timestamp'], signature: req.headers['x-slack-signature'], secret: process.env.MSH_SLACK_SIGNING_SECRET })) return res.status(401).json({ error: 'invalid_signature' });
  let payload;
  try { payload = JSON.parse(body); } catch { return res.status(400).json({ error: 'invalid_json' }); }
  const result = await handlePayload(payload);
  return res.status(result.status).json(result.body);
}
