import crypto from 'node:crypto';

const AGENTS = Object.freeze({
  nomy: { name: 'Nomy', role: 'Product Coordination' },
  selah: { name: 'Selah', role: 'Software Engineering' },
  sage: { name: 'Sage', role: 'Research & Evidence' },
  clara: { name: 'Clara', role: 'Clinical & Health' },
  mira: { name: 'Mira', role: 'Member Experience' },
  eden: { name: 'Eden', role: 'Design' },
  vera: { name: 'Vera', role: 'Privacy' },
  aiden: { name: 'Aiden', role: 'Security' },
  ellis: { name: 'Ellis', role: 'Operations' },
  genesis: { name: 'Genesis', role: 'Product Strategy' },
  newton: { name: 'Newton', role: 'Data & Analytics' },
  harper: { name: 'Harper', role: 'Communications' },
  june: { name: 'June', role: 'Member Support' },
  atlas: { name: 'Atlas', role: 'Architecture' },
  reese: { name: 'Reese', role: 'QA' },
  iris: { name: 'Iris', role: 'Research & Insights' },
  tessa: { name: 'Tessa', role: 'Quality Engineering' }
});

const transient = /(?:timeout|temporar(?:y|ily)|rate.?limit|\b429\b|\b5\d\d\b|network|unavailable|econnreset)/i;
const restricted = /\b(?:diagnos(?:is|ed)|medical record|patient|phi|protected health|social security|ssn|credit card|password|secret|token|api key)\b/i;
const mutation = /\b(?:merge|close|delete|deploy|approve|revoke|change permissions?|create durable|modify github|edit product state)\b/i;
const addressPattern = /^\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(\S[\s\S]*)$/;

function list(env, key) {
  return new Set(String(env[key] || '').split(',').map((v) => v.trim()).filter(Boolean));
}

function eventData(payload) {
  const event = payload?.event || payload || {};
  return {
    id: payload?.event_id || event.event_id,
    team: payload?.team_id || event.team_id,
    user: event.user_id || event.user,
    channel: event.channel_id || event.channel,
    ts: event.ts,
    text: event.text,
    type: event.type
  };
}

export function verifySlackSignature({ body, timestamp, signature, secret, now = Date.now() }) {
  if (!body || !timestamp || !signature || !secret) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Math.floor(now / 1000) - seconds) > 300) return false;
  const base = `v0:${timestamp}:${body}`;
  const expected = `v0=${crypto.createHmac('sha256', secret).update(base).digest('hex')}`;
  const a = Buffer.from(String(signature));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function parseAddress(text) {
  const match = String(text || '').match(addressPattern);
  if (!match) return { ok: false, reason: 'missing_address' };
  const requested = match[1].toLowerCase();
  const key = requested === 'everyone' ? 'nomy' : requested;
  const agent = AGENTS[key];
  if (!agent) return { ok: false, reason: 'unknown_agent' };
  return { ok: true, key, agent, prompt: match[2] };
}

export function authorizeEvent(input, env = process.env) {
  const data = eventData({ event: input });
  const teams = list(env, 'MSH_SLACK_TEAM_ID');
  const channels = list(env, 'MSH_SLACK_ALLOWED_CHANNELS');
  const users = list(env, 'MSH_SLACK_ALLOWED_USERS');
  const ok = teams.has(data.team) && channels.has(data.channel) && users.has(data.user);
  return { ok, reason: ok ? null : 'not_allowlisted', data };
}

function auditRecord(data, result, agent) {
  return {
    event_id: data.id || null,
    workspace: data.team || null,
    channel: data.channel || null,
    user: data.user || null,
    thread: data.ts || null,
    agent: agent || null,
    purpose: 'governed Slack collaboration',
    result,
    timestamp: new Date().toISOString()
  };
}

function defaultStore(env) {
  const memory = new Set();
  if (env.NODE_ENV === 'production' || env.MSH_SLACK_IDEMPOTENCY_STORE_URL) return null;
  return { async claim(key) { if (memory.has(key)) return false; memory.add(key); return true; } };
}

async function claim(store, key) {
  if (!store || typeof store.claim !== 'function') throw new Error('durable idempotency store unavailable');
  return store.claim(key);
}

async function governedRuntime(input, env) {
  const url = env.MSH_GOVERNED_RUNTIME_URL;
  if (!url) throw Object.assign(new Error('governed runtime unavailable'), { transient: false });
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
  if (!response.ok) throw Object.assign(new Error(`runtime HTTP ${response.status}`), { transient: response.status >= 500 || response.status === 429 });
  const body = await response.json();
  return body.response || body.text || body.message || '';
}

export async function handlePayload(payload, options = {}) {
  const env = options.env || process.env;
  const data = eventData(payload);
  if (payload?.type === 'url_verification') return { status: 200, body: { challenge: payload.challenge } };
  if (!data.id || data.type !== 'message' || !data.text) return { status: 400, body: { error: 'malformed_event' } };
  const auth = authorizeEvent({ team_id: data.team, user: data.user, channel: data.channel }, env);
  if (!auth.ok) return { status: 403, body: { denied: true, reason: auth.reason }, audit: auditRecord(data, 'denied') };
  const address = parseAddress(data.text);
  if (!address.ok || restricted.test(address.prompt) || mutation.test(address.prompt)) return { status: 403, body: { denied: true, reason: address.reason || 'restricted_content' }, audit: auditRecord(data, 'denied', address.agent?.name) };
  const store = options.idempotency || defaultStore(env);
  let first;
  try { first = await claim(store, data.id); } catch { return { status: 503, body: { error: 'idempotency_unavailable' } }; }
  if (!first) return { status: 200, body: { duplicate: true } };
  const runtime = options.runtime || ((input) => governedRuntime(input, env));
  try {
    const response = await runtime({ correlation_id: data.id, agent: address.agent.name, role: address.agent.role, prompt: address.prompt, channel: data.channel, thread: data.ts, governed: true });
    if (options.publisher) await options.publisher({ channel: data.channel, thread: data.ts, text: `*${address.agent.name} | ${address.agent.role}*\n${response}`, correlation_id: data.id });
    return { status: 200, body: { accepted: true, agent: address.agent.name }, audit: auditRecord(data, 'accepted', address.agent.name) };
  } catch (error) {
    return { status: error?.transient || transient.test(error?.message || '') ? 202 : 502, body: { error: 'runtime_failure', retryable: Boolean(error?.transient || transient.test(error?.message || '')) }, audit: auditRecord(data, 'runtime_failure', address.agent.name) };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  if (payload?.type === 'url_verification') return res.status(200).json({ challenge: payload.challenge });
  if (!verifySlackSignature({ body, timestamp: req.headers['x-slack-request-timestamp'], signature: req.headers['x-slack-signature'], secret: process.env.SLACK_SIGNING_SECRET })) return res.status(401).json({ error: 'invalid_signature' });
  const result = await handlePayload(payload);
  return res.status(result.status).json(result.body);
}
