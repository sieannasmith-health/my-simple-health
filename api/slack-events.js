import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.join(__dirname, '..', 'agent-runtime', 'agents.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const recentEvents = new Map();
const MAX_BODY_BYTES = 256 * 1024;
const MAX_TEXT_CHARS = 4000;
const MAX_RUNTIME_MS = 20_000;
const MAX_SLACK_MS = 10_000;

function csv(value, fallback = []) {
  const values = String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
  return values.length ? values : fallback;
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(a || '');
  const right = Buffer.from(b || '');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function verifySlackSignature({ body, timestamp, signature, secret, now = Date.now() }) {
  if (!secret || !timestamp || !signature || !body) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(now - seconds * 1000) > 5 * 60 * 1000) return false;
  const base = `v0:${timestamp}:${body}`;
  const expected = `v0=${crypto.createHmac('sha256', secret).update(base).digest('hex')}`;
  return timingSafeEqual(expected, signature);
}

function canonicalAgents() {
  return Object.entries(registry).filter(([key, value]) => key !== '_organization' && value?.name);
}

export function parseAddress(text) {
  const value = String(text || '').trim();
  const match = value.match(/^([^:\n]{1,80}):\s*([\s\S]+)$/);
  if (!match) return { ok: false, reason: 'missing_address' };
  const requested = match[1].trim().toLowerCase();
  const message = match[2].trim();
  if (!message || message.length > MAX_TEXT_CHARS) return { ok: false, reason: 'invalid_message' };
  if (requested === 'everyone') return { ok: true, key: 'nomy', text: message };
  const found = canonicalAgents().find(([key, value]) => key === requested || value.name.toLowerCase() === requested);
  return found ? { ok: true, key: found[0], text: message } : { ok: false, reason: 'unknown_agent' };
}

function containsRestrictedContent(text) {
  return /\b(ssn|social security|medical record|diagnosis|prescription|medication list|lab result|member health|patient|phi|protected health)\b/i.test(text);
}

function requestsDurableMutation(text) {
  return /\b(create|merge|close|delete|approve|deploy|release|modify|change|update)\b.{0,40}\b(issue|pr|pull request|github|product state|production|database|workflow|gate)\b/i.test(text);
}

function authConfig(env = process.env) {
  return {
    team: env.MSH_SLACK_TEAM_ID || '',
    channels: csv(env.MSH_SLACK_ALLOWED_CHANNELS, ['C0C0T9F3LUF']),
    users: csv(env.MSH_SLACK_ALLOWED_USERS),
  };
}

export function authorizeEvent(event, env = process.env) {
  const config = authConfig(env);
  if (!config.team || event.team_id !== config.team) return { ok: false, reason: 'workspace_denied' };
  if (!config.channels.includes(event.channel_id)) return { ok: false, reason: 'channel_denied' };
  if (!config.users.includes(event.user_id)) return { ok: false, reason: 'user_denied' };
  return { ok: true };
}

function correlationId(event) {
  const raw = `${event.event_id || 'unknown'}:${event.ts || ''}`;
  return `slack-${crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24)}`;
}

function audit(result, event, correlation, extra = {}) {
  // Deliberately excludes message bodies, tokens, and member content.
  console.info(JSON.stringify({
    type: 'slack_bridge_audit', result, event_id: event.event_id || null,
    correlation_id: correlation, agent: extra.agent || null,
    workspace: event.team_id || null, channel: event.channel_id || null,
    user: event.user_id || null, thread: event.thread_ts || event.ts || null,
    purpose: 'governed_agent_collaboration', timestamp: new Date().toISOString(),
    ...extra,
  }));
}

function remember(eventId, now = Date.now()) {
  if (!eventId) return false;
  for (const [key, expires] of recentEvents) if (expires <= now) recentEvents.delete(key);
  if (recentEvents.has(eventId)) return true;
  recentEvents.set(eventId, now + 10 * 60 * 1000);
  return false;
}

function withTimeout(promise, milliseconds, label) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}_timeout`)), milliseconds))]);
}

async function defaultRuntime({ agent, role, text, correlationId: id, env = process.env }) {
  const endpoint = env.MSH_GOVERNED_RUNTIME_URL;
  const apiKey = env.MSH_GOVERNED_RUNTIME_TOKEN;
  const payload = { agent, role, text, correlation_id: id, source: 'slack', durable_authority: 'github_langgraph' };
  if (endpoint) {
    const response = await withTimeout(fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) }, body: JSON.stringify(payload) }), MAX_RUNTIME_MS, 'runtime');
    if (!response.ok) throw new Error(`runtime_http_${response.status}`);
    const data = await response.json();
    return String(data.response || data.text || '').trim();
  }
  if (!env.OPENAI_API_KEY) throw new Error('runtime_not_configured');
  const model = env.OPENAI_MODEL || 'gpt-4o-mini';
  const response = await withTimeout(fetch(env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: JSON.stringify({ model, temperature: 0.2, max_tokens: 800, messages: [{ role: 'system', content: `You are the governed MSH agent ${agent}, role: ${role}. Answer helpfully and briefly. Slack is transport only. Do not mutate GitHub, product state, workflows, or gates. Do not request or retain sensitive health information.` }, { role: 'user', content: text }] }) }), MAX_RUNTIME_MS, 'model');
  if (!response.ok) throw new Error(`model_http_${response.status}`);
  const data = await response.json();
  return String(data.choices?.[0]?.message?.content || '').trim();
}

async function postReply({ channel, thread, text, env = process.env }) {
  if (!env.SLACK_BOT_TOKEN) throw new Error('slack_token_not_configured');
  const response = await withTimeout(fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${env.SLACK_BOT_TOKEN}` }, body: JSON.stringify({ channel, thread_ts: thread, text }) }), MAX_SLACK_MS, 'slack');
  if (!response.ok) throw new Error(`slack_http_${response.status}`);
  const data = await response.json();
  if (!data.ok) throw new Error(`slack_api_${data.error || 'unknown'}`);
  return data;
}

export async function handlePayload(payload, { env = process.env, runtime = defaultRuntime, publisher = postReply } = {}) {
  if (!payload || payload.type !== 'event_callback' || payload.event?.type !== 'message') return { status: 200, body: { ok: true } };
  const event = payload.event;
  const id = correlationId({ ...event, event_id: payload.event_id });
  if (event.bot_id || event.subtype || remember(payload.event_id)) return { status: 200, body: { ok: true, duplicate: true } };
  const auth = authorizeEvent({ ...event, team_id: payload.team_id }, env);
  if (!auth.ok) { audit('denied', event, id, { reason: auth.reason }); return { status: 403, body: { ok: false } }; }
  const addressed = parseAddress(event.text);
  if (!addressed.ok || containsRestrictedContent(addressed.text) || requestsDurableMutation(addressed.text)) {
    const reason = !addressed.ok ? addressed.reason : containsRestrictedContent(addressed.text) ? 'restricted_content' : 'durable_mutation_denied';
    audit('denied', event, id, { reason });
    return { status: 200, body: { ok: true, denied: true } };
  }
  const agent = registry[addressed.key];
  try {
    const response = await runtime({ agent: agent.name, role: agent.role, text: addressed.text, correlationId: id, env });
    if (!response) throw new Error('empty_runtime_response');
    const attributed = `*${agent.name} | ${agent.role}*\n${response}`;
    await publisher({ channel: event.channel, thread: event.thread_ts || event.ts, text: attributed, env });
    audit('permitted', event, id, { agent: addressed.key, result: 'replied' });
    return { status: 200, body: { ok: true, correlation_id: id } };
  } catch (error) {
    audit('failed', event, id, { agent: addressed.key, error: String(error.message).slice(0, 120), retryable: /timeout|_http_5|rate|temporar/i.test(error.message) });
    return { status: 503, body: { ok: false, retryable: true, correlation_id: id } };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) return res.status(413).json({ ok: false });
  const valid = verifySlackSignature({ body, timestamp: req.headers['x-slack-request-timestamp'], signature: req.headers['x-slack-signature'], secret: process.env.SLACK_SIGNING_SECRET });
  if (!valid) return res.status(401).json({ ok: false });
  let payload;
  try { payload = JSON.parse(body); } catch { return res.status(400).json({ ok: false }); }
  if (payload.type === 'url_verification') return res.status(200).json({ challenge: payload.challenge });
  const result = await handlePayload(payload);
  return res.status(result.status).json(result.body);
}
