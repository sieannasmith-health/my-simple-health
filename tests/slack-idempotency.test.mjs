import test from 'node:test';
import assert from 'node:assert/strict';
import { validateClaimInput, claimWithRedis, releaseWithRedis, processIdempotency } from '../api/slack-idempotency.js';

test('validates claim key, action, and bounded ttl', () => {
  assert.deepEqual(validateClaimInput({ key: 'evt-1', ttl_seconds: 600 }), { ok: true, key: 'evt-1', action: 'claim', ttl: 600 });
  assert.deepEqual(validateClaimInput({ key: 'evt-1', action: 'release' }), { ok: true, key: 'evt-1', action: 'release', ttl: null });
  assert.equal(validateClaimInput({ key: '', ttl_seconds: 600 }).error, 'invalid_key');
  assert.equal(validateClaimInput({ key: 'evt-1', action: 'unknown' }).error, 'invalid_action');
  assert.equal(validateClaimInput({ key: 'evt-1', ttl_seconds: 10 }).error, 'invalid_ttl');
});

test('uses atomic Redis SET NX EX claim contract through Vercel KV REST', async () => {
  let request;
  const fetchImpl = async (url, init) => {
    request = { url, init, body: JSON.parse(init.body) };
    return { ok: true, async json() { return { result: 'OK' }; } };
  };
  const claimed = await claimWithRedis(
    { key: 'Ev123', ttl: 600 },
    { KV_REST_API_URL: 'https://redis.example', KV_REST_API_TOKEN: 'redis-token' },
    fetchImpl
  );
  assert.equal(claimed, true);
  assert.equal(request.url, 'https://redis.example');
  assert.equal(request.body[0], 'SET');
  assert.equal(request.body[2], '1');
  assert.equal(request.body[3], 'NX');
  assert.equal(request.body[4], 'EX');
  assert.equal(request.body[5], 600);
});

test('release deletes the same hashed Redis key used for claims', async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, body: JSON.parse(init.body) });
    return { ok: true, async json() { return { result: requests.length === 1 ? 'OK' : 1 }; } };
  };
  const env = { KV_REST_API_URL: 'https://redis.example', KV_REST_API_TOKEN: 'redis-token' };
  await claimWithRedis({ key: 'Ev123', ttl: 600 }, env, fetchImpl);
  await releaseWithRedis({ key: 'Ev123' }, env, fetchImpl);
  assert.equal(requests[1].body[0], 'DEL');
  assert.equal(requests[0].body[1], requests[1].body[1]);
});

test('processIdempotency handles release without requiring ttl', async () => {
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    return { ok: true, async json() { return { result: body[0] === 'DEL' ? 1 : 'OK' }; } };
  };
  const result = await processIdempotency(
    { key: 'Ev123', action: 'release' },
    { KV_REST_API_URL: 'https://redis.example', KV_REST_API_TOKEN: 'redis-token' },
    fetchImpl
  );
  assert.deepEqual(result, { ok: true, released: true });
});

test('duplicate claim returns false', async () => {
  const fetchImpl = async () => ({ ok: true, async json() { return { result: null }; } });
  const claimed = await claimWithRedis(
    { key: 'Ev123', ttl: 600 },
    { KV_REST_API_URL: 'https://redis.example', KV_REST_API_TOKEN: 'redis-token' },
    fetchImpl
  );
  assert.equal(claimed, false);
});

test('fails closed when KV REST is missing or unavailable', async () => {
  await assert.rejects(() => claimWithRedis({ key: 'Ev123', ttl: 600 }, {}, async () => {}), /kv_rest_not_configured/);
  await assert.rejects(
    () => claimWithRedis(
      { key: 'Ev123', ttl: 600 },
      { KV_REST_API_URL: 'https://redis.example', KV_REST_API_TOKEN: 'redis-token' },
      async () => ({ ok: false, status: 500, async json() { return {}; } })
    ),
    /kv_http_500/
  );
});
