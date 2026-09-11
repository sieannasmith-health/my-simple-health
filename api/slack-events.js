import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const memoryKeys = new Map();
const registryPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../agent-runtime/agents.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const agents = new Map(Object.entries(registry).filter(([key]) => key !== '_organization').map(([key, value]) => [key, value]));

const asList = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
const nowSeconds = () => Math.floor(Date.now() / 1000);

export function verifySlackSignature({ body, timestamp, signature, secret, tolerance = 300 }) {
  if (!body || !timestamp || !signature || !secret) return false;
  const parsed = Number(timestamp);
  if (!Number.isFinite(parsed) || Math.abs(nowSeconds() - parsed) > tolerance) return false;
  const expected = `v0=${crypto.createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')}`;
  const actual = Buffer.from(String(signature));
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && crypto.timingSafeEqual(actual, wanted);
}

export function parseAddress(text) {
  const match = String(text || '').match(/^\s*([^:]{1,80})\s*:\s*([\s\S]+?)\s*$/);
  if (!match) return { ok: false, reason: 'address_required' };
  const label = match[1].trim().toLowerCase();
  const body = match[2].trim();
  if (label === 'everyone') return { ok: true, key: 'nomy', name: 'Nomy', body, everyone: true };
  const key = [...agents.keys()].find((candidate) => candidate === label);
  if (!key) return { ok: false, reason: 'unknown_agent' };
  return { ok: true, key, name: agents.get(key).name, role: agents.get(key).role, body };
}

export function authorizeEvent(event, env = process.env) {
  const team = event.team_id || event.team || event.event?.team;
  const channel = event.channel_id || event.channel || event.event?.channel_id || event.event?.channel;
  const user = event.user_id || event.user || event.event?.user_id || event.event?.user;
  const teams = asList(env.MSH_SLACK_TEAM_ID || env.MSH_SLACK_TEAM_IDS);
  const channels = asList(env.MSH_SLACK_ALLOWED_CHANNELS);
  const users = asList(env.MSH_SLACK_ALLOWED_USERS);
  if (!teams.includes(team)) return { ok: false, reason: 'workspace_not_allowed' };
  if (!channels.includes(channel)) return { ok: false, reason: 'channel_not_allowed' };
  if (!users.includes(user)) return { ok: false, reason: 'user_not_allowed' };
  return { ok: true, team, channel, user };
}

export function classifyFailure(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  if (status === 429 || status >= 500 || error?.code === 'ETIMEDOUT' || error?.code === 'ECONNRESET') return 'transient';
  return 'permanent';
}

const sensitivePattern = /\b(?:diagnos(?:is|ed)|medical record|patient|medical history|prescription|medication list|病歴|ssn|social security|credit card)\b/i;
const mutationPattern = /\b(?:merge|close|delete|deploy|release|change|edit|create|approve|revoke)\b\s+(?:the\s+)?(?:github|pull request|issue|repository|production|product|engineering|durable|workflow|gate)/i;

function audit(entry, sink) {
  if (typeof sink === 'function') sink({
    correlation_id: entry.correlation_id,
    agent: entry.agent,
    channel: entry.channel,
    workspace: entry.workspace,
    purpose: entry.purpose,
    timestamp: entry.timestamp,
    result: entry.result,
    reference: entry.reference
  });
}

function eventData(payload) {
  const event = payload?.event || payload;
  return {
    id: payload?.event_id || event?.event_id || event?.client_msg_id,
    team: payload?.team_id || event?.team_id || event?.team,
    user: event?.user_id || event?.user,
    channel: event?.channel_id || event?.channel,
    ts: event?.ts,
    text: event?.text,
    type: event?.type
  };
}

async function durableSeen(id, options, env) {
  if (options.store?.has) return options.store.has(id);
  const endpoint = env.MSH_SLACK_IDEMPOTENCY_URL;
  if (!endpoint) {
    if (options.runtime || options.publisher) return memoryKeys.has(id);
    throw Object.assign(new Error('durable idempotency store is required'), { code: 'IDEMPOTENCY_UNAVAILABLE' });
  }
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/${encodeURIComponent(id)}`, { method: 'GET' });
  if (!response.ok && response.status !== 404) throw Object.assign(new Error('idempotency store unavailable'), { status: response.status });
  return response.status === 200;
}

async function durableMark(id, options, env) {
  if (options.store?.set) return options.store.set(id);
  const endpoint = env.MSH_SLACK_IDEMPOTENCY_URL;
  if (!endpoint) { memoryKeys.set(id, Date.now()); return; }
  const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: id, expires_in: 86400 }) });
  if (!response.ok) throw Object.assign(new Error('idempotency store unavailable'), { status: response.status });
}

async function governedRuntime(input, env) {
  const endpoint = env.MSH_GOVERNED_RUNTIME_URL;
  if (!endpoint) throw Object.assign(new Error('governed runtime is not configured'), { code: 'GOVERNED_RUNTIME_UNAVAILABLE' });
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(env.MSH_GOVERNED_RUNTIME_TOKEN ? { authorization: `Bearer ${env.MSH_GOVERNED_RUNTIME_TOKEN}` } : {}) },
    body: JSON.stringify(input)
  });
  if (!response.ok) throw Object.assign(new Error(`governed runtime returned ${response.status}`), { status: response.status });
  const result = await response.json();
  return result.response || result.text || result.message || '';
}

async function slackPublisher(input, env) {
  if (!env.SLACK_BOT_TOKEN) throw Object.assign(new Error('Slack bot token is not configured'), { code: 'SLACK_TOKEN_UNAVAILABLE' });
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.SLACK_BOT_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ channel: input.channel, thread_ts: input.thread, text: input.text })
  });
  if (!response.ok) throw Object.assign(new Error(`Slack returned ${response.status}`), { status: response.status });
  const result = await response.json();
  if (!result.ok) throw Object.assign(new Error('Slack rejected message'), { status: result.error === 'ratelimited' ? 429 : 400 });
  return result;
}

export async function handlePayload(payload, options = {}) {
  const env = options.env || process.env;
  const data = eventData(payload);
  const correlationId = data.id || crypto.randomUUID();
  if (data.type && data.type !== 'message') return { status: 200, body: { ignored: true } };
  const auth = authorizeEvent({ team_id: data.team, user: data.user, channel: data.channel }, env);
  if (!auth.ok) return { status: 403, body: { denied: true, reason: auth.reason } };
  let alreadySeen;
  try { alreadySeen = await durableSeen(correlationId, options, env); } catch (error) { return { status: 503, body: { error: 'idempotency_unavailable', classification: classifyFailure(error) } }; }
  if (alreadySeen) return { status: 200, body: { duplicate: true } };
  const address = parseAddress(data.text);
  if (!address.ok) return { status: 400, body: { denied: true, reason: address.reason } };
  if (sensitivePattern.test(address.body) || mutationPattern.test(address.body)) {
    audit({ correlation_id: correlationId, agent: address.name, channel: data.channel, workspace: data.team, purpose: 'slack_request', timestamp: new Date().toISOString(), result: 'denied', reference: data.ts }, options.audit);
    return { status: 422, body: { denied: true, reason: 'restricted_content' } };
  }
  await durableMark(correlationId, options, env);
  const input = { correlation_id: correlationId, agent: address.name, agent_key: address.key, role: agents.get(address.key)?.role, message: address.body, channel: data.channel, thread: data.ts, source: 'slack' };
  try {
    const response = await (options.runtime ? options.runtime(input) : governedRuntime(input, env));
    const text = `*${address.name} | ${agents.get(address.key)?.role}*\n${String(response)}`;
    await (options.publisher ? options.publisher({ channel: data.channel, thread: data.ts, text, correlation_id: correlationId }) : slackPublisher({ channel: data.channel, thread: data.ts, text }, env));
    audit({ correlation_id: correlationId, agent: address.name, channel: data.channel, workspace: data.team, purpose: 'slack_request', timestamp: new Date().toISOString(), result: 'completed', reference: data.ts }, options.audit);
    return { status: 200, body: { accepted: true, correlation_id: correlationId } };
  } catch (error) {
    audit({ correlation_id: correlationId, agent: address.name, channel: data.channel, workspace: data.team, purpose: 'slack_request', timestamp: new Date().toISOString(), result: 'failed', reference: data.ts }, options.audit);
    return { status: classifyFailure(error) === 'transient' ? 503 : 502, body: { error: 'dispatch_failed', classification: classifyFailure(error), correlation_id: correlationId } };
  }
}

export default async function handler(req, res) {
  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  let payload;
  try { payload = JSON.parse(body); } catch { return res.status(400).json({ error: 'invalid_json' }); }
  if (payload.type === 'url_verification') return res.status(200).json({ challenge: payload.challenge });
  if (!verifySlackSignature({ body, timestamp: req.headers['x-slack-request-timestamp'], signature: req.headers['x-slack-signature'], secret: process.env.SLACK_SIGNING_SECRET })) return res.status(401).json({ error: 'invalid_signature' });
  const result = await handlePayload(payload);
  return res.status(result.status).json(result.body);
}
