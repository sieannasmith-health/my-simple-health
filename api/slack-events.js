import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const registry = require('../agent-runtime/agents.json');
const MAX_CLOCK_SKEW_SECONDS = 300;
const MAX_TEXT_LENGTH = 4000;
const MAX_RUNTIME_MS = 15000;
const MAX_RETRIES = 2;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const SENSITIVE = /\b(ssn|social security|diagnosis|medical record|patient|phi|protected health|prescription|medication list|lab result|medical history|date of birth|dob|insurance member)\b/i;
const MUTATION = /\b(merge|close|delete|deploy|release|publish|commit|push|write|edit|modify|change|create|approve|authorize)\b.{0,80}\b(issue|pr|pull request|github|repository|repo|production|durable|record|state)\b/i;

const agents = Object.values(registry).filter((value) => value && value.name && value.role);
const byName = new Map(agents.map((agent) => [agent.name.toLowerCase(), agent]));

function csv(value) {
  return new Set(String(value || '').split(',').map((item) => item.trim()).filter(Boolean));
}

export function verifySlackSignature({ body, timestamp, signature, secret, now = Date.now() }) {
  if (!body || !timestamp || !signature || !secret) return false;
  const seconds = Number(timestamp);
  if (!Number.isInteger(seconds) || Math.abs(Math.floor(now / 1000) - seconds) > MAX_CLOCK_SKEW_SECONDS) return false;
  const expected = `v0=${crypto.createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
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
  const key = match[1].trim().toLowerCase() === 'everyone' ? 'nomy' : match[1].trim().toLowerCase();
  const agent = byName.get(key);
  if (!agent) return { ok: false, reason: 'unknown_agent' };
  const prompt = match[2].trim();
  if (!prompt || prompt.length > MAX_TEXT_LENGTH) return { ok: false, reason: 'invalid_prompt' };
  return { ok: true, key, agent, prompt };
}

export function classifyFailure(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  if (RETRYABLE_STATUS.has(status) || error?.code === 'ETIMEDOUT' || error?.code === 'ECONNRESET') return { kind: 'transient', retry: true };
  return { kind: 'permanent', retry: false };
}

function audit(entry, sink) {
  sink?.({ ...entry, message_body: undefined });
}

async function withTimeout(promise, ms = MAX_RUNTIME_MS) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('runtime_timeout'), { code: 'ETIMEDOUT' })), ms); })]);
  } finally { clearTimeout(timer); }
}

async function dispatch(input, options) {
  if (options.runtime) return withTimeout(Promise.resolve(options.runtime(input)));
  const url = options.env.MSH_GOVERNED_RUNTIME_URL;
  if (!url) throw Object.assign(new Error('governed_runtime_not_configured'), { status: 503 });
  const response = await withTimeout(fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(options.env.MSH_GOVERNED_RUNTIME_TOKEN ? { authorization: `Bearer ${options.env.MSH_GOVERNED_RUNTIME_TOKEN}` } : {}) }, body: JSON.stringify({ correlation_id: input.correlation_id, agent: input.agent, prompt: input.prompt, source: 'slack' }) }));
  if (!response.ok) throw Object.assign(new Error(`runtime_${response.status}`), { status: response.status });
  const data = await response.json();
  if (data?.requires_human_gate || data?.durable_mutation) throw Object.assign(new Error('governance_boundary'), { status: 403 });
  return String(data?.response || data?.text || 'The governed runtime returned no response.');
}

async function claimIdempotency(id, options) {
  if (options.idempotencyStore) return options.idempotencyStore.claim(id);
  const url = options.env.MSH_SLACK_IDEMPOTENCY_STORE_URL;
  const token = options.env.MSH_SLACK_IDEMPOTENCY_STORE_TOKEN;
  if (!url || !token) throw Object.assign(new Error('durable_idempotency_not_configured'), { status: 503 });
  const response = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ key: id, ttl_seconds: 86400 }) });
  if (!response.ok) throw Object.assign(new Error('idempotency_store_unavailable'), { status: response.status });
  const result = await response.json();
  return result.claimed !== false && result.duplicate !== true;
}

async function publish(text, event, options) {
  if (options.publisher) return options.publisher({ text, thread: event.ts, channel: event.channel_id, correlation_id: event.event_id });
  const token = options.env.MSH_SLACK_BOT_TOKEN;
  if (!token) throw Object.assign(new Error('slack_bot_not_configured'), { status: 503 });
  const response = await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify({ channel: event.channel_id, thread_ts: event.ts, text }) });
  if (!response.ok) throw Object.assign(new Error(`slack_publish_${response.status}`), { status: response.status });
  const data = await response.json();
  if (!data.ok) throw Object.assign(new Error(`slack_publish_${data.error || 'failed'}`), { status: RETRYABLE_STATUS.has(response.status) ? response.status : 400 });
}

export async function handlePayload(payload, options = {}) {
  const env = options.env || process.env;
  const event = payload?.event;
  if (!event || event.type !== 'message' || event.subtype || !event.event_id) return { status: 200, body: { ignored: true } };
  const authorization = authorizeEvent({ ...event, team_id: payload.team_id }, env);
  if (!authorization.ok) return { status: 403, body: { denied: true, reason: authorization.reason } };
  const address = parseAddress(event.text);
  if (!address.ok || SENSITIVE.test(event.text) || MUTATION.test(event.text)) return { status: 400, body: { denied: true, reason: address.ok ? 'restricted_content' : address.reason } };
  let claimed;
  try { claimed = await claimIdempotency(payload.event_id, { ...options, env }); } catch (error) { audit({ action: 'deny', result: 'idempotency_unavailable', correlation_id: payload.event_id, channel: event.channel_id, agent: address.agent.name }, options.audit); return { status: 503, body: { denied: true, reason: 'idempotency_unavailable' } }; }
  if (!claimed) return { status: 200, body: { duplicate: true } };
  const input = { correlation_id: payload.event_id, agent: address.agent.name, role: address.agent.role, prompt: address.prompt };
  audit({ action: 'dispatch', result: 'permitted', correlation_id: payload.event_id, channel: event.channel_id, agent: address.agent.name }, options.audit);
  let response;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try { response = await dispatch(input, { ...options, env }); break; } catch (error) { if (!classifyFailure(error).retry || attempt === MAX_RETRIES) return { status: 502, body: { error: 'runtime_unavailable', correlation_id: payload.event_id } }; await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt)); }
  }
  const text = `*${address.agent.name} | ${address.agent.role}*\\n${response}`;
  try { await publish(text, event, { ...options, env }); } catch { return { status: 502, body: { error: 'reply_unavailable', correlation_id: payload.event_id } }; }
  return { status: 200, body: { accepted: true, correlation_id: payload.event_id } };
}

export default async function handler(req, res) {
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!verifySlackSignature({ body: raw, timestamp: req.headers['x-slack-request-timestamp'], signature: req.headers['x-slack-signature'], secret: process.env.MSH_SLACK_SIGNING_SECRET })) return res.status(401).json({ error: 'invalid_signature' });
  let payload; try { payload = JSON.parse(raw); } catch { return res.status(400).json({ error: 'invalid_json' }); }
  if (payload.type === 'url_verification') return res.status(200).json({ challenge: payload.challenge });
  const result = await handlePayload(payload); return res.status(result.status).json(result.body);
}
