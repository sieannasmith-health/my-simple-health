import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'agent-runtime', 'agents.json'), 'utf8'));
const AGENTS = Object.freeze(Object.fromEntries(
  Object.entries(registry)
    .filter(([key, value]) => key !== '_organization' && value?.name && value?.role)
    .map(([key, value]) => [key, { name: value.name, role: value.role, mission: value.mission || '', handoff: value.handoff || '' }])
));

const devEventIds = new Set();
const transient = /(?:timeout|temporar(?:y|ily)|rate.?limit|\b429\b|\b5\d\d\b|network|unavailable|econnreset)/i;
const restricted = /\b(?:diagnos(?:is|ed)|medical record|patient|phi|protected health|social security|ssn|credit card|password|secret|token|api key)\b/i;
const mutation = /\b(?:merge|close|delete|deploy|approve|revoke|change permissions?|create durable|modify github|edit product state)\b/i;
const addressPattern = /^\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(\S[\s\S]*)$/;
const MAX_RUNTIME_MS = 20_000;
const MAX_SLACK_MS = 10_000;

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
    ts: event.thread_ts || event.ts,
    text: event.text,
    type: event.type,
    subtype: event.subtype,
    botId: event.bot_id
  };
}

function withTimeout(promise, milliseconds, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error(`${label}_timeout`), { transient: true })), milliseconds))
  ]);
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

export function canonicalAgents() {
  return AGENTS;
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

function auditRecord(data, result, agent, reason = null) {
  return {
    event_id: data.id || null,
    correlation_id: data.id || null,
    workspace: data.team || null,
    channel: data.channel || null,
    user: data.user || null,
    thread: data.ts || null,
    agent: agent || null,
    purpose: 'governed Slack collaboration',
    result,
    reason,
    timestamp: new Date().toISOString()
  };
}

function emitAudit(record) {
  console.info(JSON.stringify({ type: 'msh_slack_bridge_audit', ...record }));
}

function developmentStore() {
  return {
    async claim(key) {
      if (devEventIds.has(key)) return false;
      devEventIds.add(key);
      return true;
    },
    async release(key) {
      devEventIds.delete(key);
    }
  };
}

function httpIdempotencyStore(env) {
  const url = env.MSH_SLACK_IDEMPOTENCY_STORE_URL;
  if (!url) return null;
  const headers = {
    'content-type': 'application/json',
    ...(env.MSH_SLACK_IDEMPOTENCY_STORE_TOKEN ? { authorization: `Bearer ${env.MSH_SLACK_IDEMPOTENCY_STORE_TOKEN}` } : {})
  };
  return {
    async claim(key) {
      const response = await withTimeout(fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'claim', key, ttl_seconds: 600 })
      }), 5_000, 'idempotency');
      if (!response.ok) throw Object.assign(new Error(`idempotency_http_${response.status}`), { transient: response.status >= 500 || response.status === 429 });
      const data = await response.json();
      return Boolean(data.claimed);
    },
    async release(key) {
      const response = await withTimeout(fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'release', key })
      }), 5_000, 'idempotency_release');
      if (!response.ok) throw Object.assign(new Error(`idempotency_release_http_${response.status}`), { transient: true });
      return true;
    }
  };
}

function defaultStore(env) {
  const durable = httpIdempotencyStore(env);
  if (durable) return durable;
  if (env.NODE_ENV === 'production') return null;
  return developmentStore();
}

async function claim(store, key) {
  if (!store || typeof store.claim !== 'function') throw new Error('durable idempotency store unavailable');
  return store.claim(key);
}

async function release(store, key) {
  if (!store || typeof store.release !== 'function') throw new Error('durable idempotency release unavailable');
  return store.release(key);
}

async function governedRuntime(input, env) {
  const url = env.MSH_GOVERNED_RUNTIME_URL;
  if (!url) throw Object.assign(new Error('governed_runtime_not_configured'), { transient: false });

  const response = await withTimeout(fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(env.MSH_GOVERNED_RUNTIME_TOKEN ? { authorization: `Bearer ${env.MSH_GOVERNED_RUNTIME_TOKEN}` } : {})
    },
    body: JSON.stringify(input)
  }), MAX_RUNTIME_MS, 'runtime');
  if (!response.ok) throw Object.assign(new Error(`runtime_http_${response.status}`), { transient: response.status >= 500 || response.status === 429 });
  const body = await response.json();
  return String(body.response || body.text || body.message || '').trim();
}

async function postSlackReply({ channel, thread, text, env }) {
  if (!env.SLACK_BOT_TOKEN) throw Object.assign(new Error('slack_bot_token_not_configured'), { transient: false });
  const response = await withTimeout(fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.SLACK_BOT_TOKEN}` },
    body: JSON.stringify({ channel, thread_ts: thread, text })
  }), MAX_SLACK_MS, 'slack');
  if (!response.ok) throw Object.assign(new Error(`slack_http_${response.status}`), { transient: response.status >= 500 || response.status === 429 });
  const body = await response.json();
  if (!body.ok) throw Object.assign(new Error(`slack_api_${body.error || 'unknown'}`), { transient: body.error === 'ratelimited' });
  return body;
}

export async function handlePayload(payload, options = {}) {
  const env = options.env || process.env;
  const data = eventData(payload);

  if (payload?.type === 'url_verification') return { status: 200, body: { challenge: payload.challenge } };
  if (data.botId || data.subtype) return { status: 200, body: { ignored: true } };
  if (!data.id || data.type !== 'message' || !data.user || !data.channel || !data.ts || !data.text) return { status: 400, body: { error: 'malformed_event' } };

  const auth = authorizeEvent({ team_id: data.team, user: data.user, channel: data.channel }, env);
  if (!auth.ok) {
    const audit = auditRecord(data, 'denied', null, auth.reason);
    emitAudit(audit);
    return { status: 403, body: { denied: true, reason: auth.reason }, audit };
  }

  const address = parseAddress(data.text);
  const deniedReason = !address.ok ? address.reason : restricted.test(address.prompt) ? 'restricted_content' : mutation.test(address.prompt) ? 'durable_mutation_denied' : null;
  if (deniedReason) {
    const audit = auditRecord(data, 'denied', address.agent?.name, deniedReason);
    emitAudit(audit);
    return { status: 403, body: { denied: true, reason: deniedReason }, audit };
  }

  const store = options.idempotency || defaultStore(env);
  let first;
  try { first = await claim(store, data.id); }
  catch {
    const audit = auditRecord(data, 'failed', address.agent.name, 'idempotency_unavailable');
    emitAudit(audit);
    return { status: 503, body: { error: 'idempotency_unavailable' }, audit };
  }
  if (!first) return { status: 200, body: { duplicate: true } };

  const runtime = options.runtime || ((input) => governedRuntime(input, env));
  const publisher = options.publisher || ((input) => postSlackReply({ ...input, env }));
  try {
    const response = await runtime({
      correlation_id: data.id,
      agent_key: address.key,
      agent: address.agent.name,
      role: address.agent.role,
      mission: address.agent.mission,
      prompt: address.prompt,
      channel: data.channel,
      thread: data.ts,
      governed: true,
      source: 'slack'
    });
    if (!response) throw Object.assign(new Error('empty_runtime_response'), { transient: true });
    await publisher({ channel: data.channel, thread: data.ts, text: `*${address.agent.name} | ${address.agent.role}*\n${response}`, correlation_id: data.id });
    const audit = auditRecord(data, 'accepted', address.agent.name);
    emitAudit(audit);
    return { status: 200, body: { accepted: true, agent: address.agent.name }, audit };
  } catch (error) {
    const retryable = Boolean(error?.transient || transient.test(error?.message || ''));
    if (retryable) {
      try { await release(store, data.id); }
      catch {
        const audit = auditRecord(data, 'runtime_failure', address.agent.name, 'retry_release_failed');
        emitAudit(audit);
        return { status: 503, body: { error: 'idempotency_release_failed', retryable: false }, audit };
      }
    }
    const audit = auditRecord(data, 'runtime_failure', address.agent.name, retryable ? 'transient_failure' : 'permanent_failure');
    emitAudit(audit);
    return { status: retryable ? 202 : 502, body: { error: 'runtime_failure', retryable }, audit };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  let payload;
  try { payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'invalid_json' }); }
  if (payload?.type === 'url_verification') {
    if (!verifySlackSignature({ body, timestamp: req.headers['x-slack-request-timestamp'], signature: req.headers['x-slack-signature'], secret: process.env.SLACK_SIGNING_SECRET })) return res.status(401).json({ error: 'invalid_signature' });
    return res.status(200).json({ challenge: payload.challenge });
  }
  if (!verifySlackSignature({ body, timestamp: req.headers['x-slack-request-timestamp'], signature: req.headers['x-slack-signature'], secret: process.env.SLACK_SIGNING_SECRET })) return res.status(401).json({ error: 'invalid_signature' });
  const result = await handlePayload(payload);
  return res.status(result.status).json(result.body);
}
