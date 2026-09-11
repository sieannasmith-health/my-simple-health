import crypto from 'node:crypto';

const TEST_DEDUPE = new Map();
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
  genesis: { name: 'Genesis', role: 'Architecture' },
  newton: { name: 'Newton', role: 'Data & Analytics' },
  harper: { name: 'Harper', role: 'Product' },
  june: { name: 'June', role: 'QA' },
  atlas: { name: 'Atlas', role: 'Infrastructure' },
  reese: { name: 'Reese', role: 'Legal & Compliance' },
  iris: { name: 'Iris', role: 'Research & Insights' },
  tessa: { name: 'Tessa', role: 'Quality Engineering' }
});

const csv = (value = '') => new Set(String(value).split(',').map(x => x.trim()).filter(Boolean));
const production = () => process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
const constantTime = (a, b) => {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

export function verifySlackSignature({ body, timestamp, signature, secret, now = Date.now() }) {
  const seconds = Number(timestamp);
  if (!body || !secret || !Number.isFinite(seconds) || Math.abs(Math.floor(now / 1000) - seconds) > 300) return false;
  const expected = `v0=${crypto.createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')}`;
  return constantTime(expected, signature);
}

export function parseAddress(text) {
  const match = String(text || '').match(/^\s*([A-Za-z][A-Za-z0-9 _-]{0,63})\s*:\s*([\s\S]+?)\s*$/);
  if (!match) return { ok: false, reason: 'missing_address' };
  const requested = match[1].trim().toLowerCase().replace(/[ _-]+/g, '');
  const key = requested === 'everyone' ? 'nomy' : requested;
  if (!AGENTS[key]) return { ok: false, reason: 'unknown_agent' };
  return { ok: true, key, agent: AGENTS[key], text: match[2].trim() };
}

export function authorizeEvent(event, env = process.env) {
  const team = event.team_id || event.team;
  const channel = event.channel_id || event.channel;
  const user = event.user_id || event.user;
  const allowedChannels = csv(env.MSH_SLACK_ALLOWED_CHANNELS || 'C0C0T9F3LUF');
  const allowedUsers = csv(env.MSH_SLACK_ALLOWED_USERS);
  if (!team || team !== env.MSH_SLACK_TEAM_ID) return { ok: false, reason: 'workspace_denied' };
  if (!allowedChannels.has(channel)) return { ok: false, reason: 'channel_denied' };
  if (!allowedUsers.has(user)) return { ok: false, reason: 'user_denied' };
  return { ok: true, team, channel, user };
}

const sensitive = /\b(?:diagnos(?:is|ed)|medical record|patient|prescription|medication list|ssn|social security|insurance member|date of birth|dob)\b/i;
const mutation = /\b(?:merge|close|delete|deploy|approve|publish|modify|change permissions?)\b(?:[\s\S]{0,40})\b(?:github|repository|pull request|production|account|database|workflow)\b/i;
const audit = (record) => ({ ...record, message: undefined });

async function claimIdempotency(id, options, env) {
  if (!id) return { ok: false, reason: 'missing_event_id' };
  if (options.store?.claim) return options.store.claim(id);
  if (options.store?.has && options.store?.set) {
    if (options.store.has(id)) return { duplicate: true };
    options.store.set(id, Date.now());
    return { ok: true };
  }
  const endpoint = env.MSH_SLACK_IDEMPOTENCY_URL;
  if (!endpoint) {
    if (production()) return { ok: false, reason: 'idempotency_unavailable' };
    if (TEST_DEDUPE.has(id)) return { duplicate: true };
    TEST_DEDUPE.set(id, Date.now());
    return { ok: true };
  }
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(env.MSH_SLACK_IDEMPOTENCY_TOKEN ? { authorization: `Bearer ${env.MSH_SLACK_IDEMPOTENCY_TOKEN}` } : {}) },
      body: JSON.stringify({ key: id, ttl_seconds: 86400 })
    });
    if (response.status === 409) return { duplicate: true };
    if (!response.ok) return { ok: false, reason: 'idempotency_unavailable' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'idempotency_unavailable' };
  }
}

async function governedRuntime(input, env) {
  const url = env.MSH_GOVERNED_RUNTIME_URL;
  if (!url) throw Object.assign(new Error('governed runtime unavailable'), { code: 'GOVERNED_RUNTIME_UNAVAILABLE', transient: false });
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(env.MSH_GOVERNED_RUNTIME_TOKEN ? { authorization: `Bearer ${env.MSH_GOVERNED_RUNTIME_TOKEN}` } : {}) },
    body: JSON.stringify(input)
  });
  if (!response.ok) throw Object.assign(new Error(`governed runtime ${response.status}`), { transient: response.status >= 500 || response.status === 429 });
  const data = await response.json();
  return data.response ?? data.text ?? '';
}

export function classifyFailure(error) {
  return error?.transient || [408, 429, 500, 502, 503, 504].includes(error?.status)
    ? 'transient' : 'permanent';
}

export async function handlePayload(payload, options = {}) {
  const env = options.env || process.env;
  if (payload?.type === 'url_verification') return { status: 200, body: { challenge: payload.challenge } };
  const event = payload?.event || {};
  if (payload?.type !== 'event_callback' && !event.type) return { status: 400, body: { error: 'malformed_event' } };
  if (event.type !== 'message' || event.subtype || event.bot_id) return { status: 200, body: { ignored: true } };

  const id = payload.event_id || event.event_id;
  const user = event.user_id || event.user;
  const channel = event.channel_id || event.channel;
  const auth = authorizeEvent({ ...event, user, channel }, env);
  if (!auth.ok) return { status: 403, body: { denied: true, reason: auth.reason } };
  const claim = await claimIdempotency(id, options, env);
  if (claim.duplicate) return { status: 200, body: { duplicate: true } };
  if (!claim.ok) return { status: 503, body: { error: claim.reason } };

  const addressed = parseAddress(event.text);
  if (!addressed.ok) return { status: 400, body: { denied: true, reason: addressed.reason } };
  if (sensitive.test(addressed.text) || mutation.test(addressed.text)) {
    options.audit?.(audit({ event_id: id, agent: addressed.agent.name, channel, user, result: 'denied' }));
    return { status: 200, body: { denied: true, reason: 'restricted_content' } };
  }

  const correlationId = `slack:${id}`;
  const input = { correlationId, agent: addressed.agent.name, role: addressed.agent.role, text: addressed.text, channel, thread: event.thread_ts || event.ts };
  try {
    const runtime = options.runtime || ((value) => governedRuntime(value, env));
    const response = await runtime(input);
    const text = `*${addressed.agent.name} | ${addressed.agent.role}*\n${String(response)}`;
    if (options.publisher) await options.publisher({ text, channel, thread: event.thread_ts || event.ts, correlationId });
    options.audit?.(audit({ event_id: id, correlationId, agent: addressed.agent.name, channel, user, result: 'allowed' }));
    return { status: 200, body: { ok: true, correlation_id: correlationId } };
  } catch (error) {
    options.audit?.(audit({ event_id: id, correlationId, agent: addressed.agent.name, channel, user, result: classifyFailure(error) }));
    return { status: classifyFailure(error) === 'transient' ? 503 : 502, body: { error: 'runtime_unavailable', correlation_id: correlationId } };
  }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'method_not_allowed' });
  const body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body || {});
  const timestamp = request.headers['x-slack-request-timestamp'];
  const signature = request.headers['x-slack-signature'];
  if (!verifySlackSignature({ body, timestamp, signature, secret: process.env.SLACK_SIGNING_SECRET })) return response.status(401).json({ error: 'invalid_signature' });
  const result = await handlePayload(JSON.parse(body));
  return response.status(result.status).json(result.body);
}
