import crypto from 'node:crypto';

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

export function bearerToken(headers = {}) {
  const value = String(headers.authorization || headers.Authorization || '');
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

export function validateClaimInput(input) {
  const key = String(input?.key || '').trim();
  const action = String(input?.action || 'claim').trim().toLowerCase();
  const ttl = Number(input?.ttl_seconds ?? 600);
  if (!key || key.length > 256) return { ok: false, status: 400, error: 'invalid_key' };
  if (!['claim', 'release'].includes(action)) return { ok: false, status: 400, error: 'invalid_action' };
  if (action === 'claim' && (!Number.isInteger(ttl) || ttl < 60 || ttl > 3600)) return { ok: false, status: 400, error: 'invalid_ttl' };
  return { ok: true, key, action, ttl: action === 'claim' ? ttl : null };
}

function redisKeyFor(key) {
  const digest = crypto.createHash('sha256').update(key).digest('hex');
  return `msh:slack:event:${digest}`;
}

async function redisRequest(command, env = process.env, fetchImpl = fetch) {
  const baseUrl = String(env.KV_REST_API_URL || '').replace(/\/$/, '');
  const token = String(env.KV_REST_API_TOKEN || '');
  if (!baseUrl || !token) throw Object.assign(new Error('kv_rest_not_configured'), { status: 503 });

  const response = await fetchImpl(baseUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(command)
  });

  if (!response.ok) throw Object.assign(new Error(`kv_http_${response.status}`), { status: 503 });
  const body = await response.json();
  if (body?.error) throw Object.assign(new Error('kv_error'), { status: 503 });
  return body?.result;
}

export async function claimWithRedis({ key, ttl }, env = process.env, fetchImpl = fetch) {
  const result = await redisRequest(['SET', redisKeyFor(key), '1', 'NX', 'EX', ttl], env, fetchImpl);
  return result === 'OK';
}

export async function releaseWithRedis({ key }, env = process.env, fetchImpl = fetch) {
  await redisRequest(['DEL', redisKeyFor(key)], env, fetchImpl);
  return true;
}

export async function processIdempotency(input, env = process.env, fetchImpl = fetch) {
  const validated = validateClaimInput(input);
  if (!validated.ok) return validated;
  if (validated.action === 'release') {
    await releaseWithRedis(validated, env, fetchImpl);
    return { ok: true, released: true };
  }
  const claimed = await claimWithRedis(validated, env, fetchImpl);
  return { ok: true, claimed };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const expected = String(process.env.MSH_SLACK_IDEMPOTENCY_STORE_TOKEN || '');
  if (!expected) return res.status(503).json({ error: 'idempotency_token_not_configured' });
  if (!safeEqual(bearerToken(req.headers), expected)) return res.status(401).json({ error: 'unauthorized' });

  const validated = validateClaimInput(req.body);
  if (!validated.ok) return res.status(validated.status).json({ error: validated.error });

  try {
    if (validated.action === 'release') {
      await releaseWithRedis(validated, process.env);
      return res.status(200).json({ released: true });
    }
    const claimed = await claimWithRedis(validated, process.env);
    return res.status(200).json({ claimed });
  } catch (error) {
    console.error(JSON.stringify({ event: 'slack_idempotency_failure', error: String(error?.message || error) }));
    return res.status(Number(error?.status) || 503).json({ error: 'idempotency_unavailable' });
  }
}
