import test from 'node:test';
import assert from 'node:assert/strict';
import { validateClaimInput, claimWithRedis, releaseWithRedis, processIdempotency } from '../api/slack-idempotency.js';

test('validates claim key, action, bounded ttl, and release token', () => {
  assert.deepEqual(validateClaimInput({ key: 'evt-1', ttl_seconds: 600 }), { ok: true, key: 'evt-1', action: 'claim', ttl: 600, claimToken: null });
  assert.deepEqual(validateClaimInput({ key: 'evt-1', action: 'release', claim_token: 'owner-token' }), { ok: true, key: 'evt-1', action: 'release', ttl: null, claimToken: 'owner-token' });
  assert.equal(validateClaimInput({ key: 'evt-1', action: 'release' }).error, 'invalid_claim_token');
  assert.equal(validateClaimInput({ key: '', ttl_seconds: 600 }).error, 'invalid_key');
  assert.equal(validateClaimInput({ key: 'evt-1', action: 'unknown' }).error, 'invalid_action');
  assert.equal(validateClaimInput({ key: 'evt-1', ttl_seconds: 10 }).error, 'invalid_ttl');
});

test('uses atomic Redis SET NX EX claim contract and returns ownership token', async () => {
  let request;
  const fetchImpl = async (url, init) => {
    request = { url, body: JSON.parse(init.body) };
    return { ok: true, async json() { return { result: 'OK' }; } };
  };
  const claimToken = await claimWithRedis(
    { key: 'Ev123', ttl: 600 },
    { KV_REST_API_URL: 'https://redis.example', KV_REST_API_TOKEN: 'redis-token' },
    fetchImpl
  );
  assert.match(claimToken, /^[0-9a-f]{64}$/);
  assert.equal(request.url, 'https://redis.example');
  assert.equal(request.body[0], 'SET');
  assert.equal(request.body[2], claimToken);
  assert.equal(request.body[3], 'NX');
  assert.equal(request.body[4], 'EX');
  assert.equal(request.body[5], 600);
});

test('release uses atomic compare-and-delete with the ownership token', async () => {
  let request;
  const fetchImpl = async (url, init) => {
    request = { url, body: JSON.parse(init.body) };
    return { ok: true, async json() { return { result: 1 }; } };
  };
  const released = await releaseWithRedis(
    { key: 'Ev123', claimToken: 'owner-token' },
    { KV_REST_API_URL: 'https://redis.example', KV_REST_API_TOKEN: 'redis-token' },
    fetchImpl
  );
  assert.equal(released, true);
  assert.equal(request.body[0], 'EVAL');
  assert.match(request.body[1], /GET/);
  assert.match(request.body[1], /DEL/);
  assert.equal(request.body[2], 1);
  assert.match(request.body[3], /^msh:slack:event:[0-9a-f]{64}$/);
  assert.equal(request.body[4], 'owner-token');
});

test('stale owner release returns false and cannot delete a newer claim', async () => {
  const fetchImpl = async () => ({ ok: true, async json() { return { result: 0 }; } });
  const released = await releaseWithRedis(
    { key: 'Ev123', claimToken: 'stale-token' },
    { KV_REST_API_URL: 'https://redis.example', KV_REST_API_TOKEN: 'redis-token' },
    fetchImpl
  );
  assert.equal(released, false);
});

test('processIdempotency returns claim token and requires it for release', async () => {
  const fetchClaim = async () => ({ ok: true, async json() { return { result: 'OK' }; } });
  const claim = await processIdempotency(
    { key: 'Ev123', action: 'claim', ttl_seconds: 600 },
    { KV_REST_API_URL: 'https://redis.example', KV_REST_API_TOKEN: 'redis-token' },
    fetchClaim
  );
  assert.equal(claim.ok, true);
  assert.equal(claim.claimed, true);
  assert.match(claim.claim_token, /^[0-9a-f]{64}$/);

  const invalidRelease = await processIdempotency(
    { key: 'Ev123', action: 'release' },
    { KV_REST_API_URL: 'https://redis.example', KV_REST_API_TOKEN: 'redis-token' },
    fetchClaim
  );
  assert.deepEqual(invalidRelease, { ok: false, status: 400, error: 'invalid_claim_token' });
});

test('duplicate claim returns null ownership token', async () => {
  const fetchImpl = async () => ({ ok: true, async json() { return { result: null }; } });
  const claimToken = await claimWithRedis(
    { key: 'Ev123', ttl: 600 },
    { KV_REST_API_URL: 'https://redis.example', KV_REST_API_TOKEN: 'redis-token' },
    fetchImpl
  );
  assert.equal(claimToken, null);
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
