import assert from 'node:assert/strict';
import test from 'node:test';

import handler from '../api/youtube-playlist.js';

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    end(body = '') { this.body = body; }
  };
}

async function invoke(url) {
  const res = responseRecorder();
  await handler({ method: 'GET', url }, res);
  return { status: res.statusCode, body: JSON.parse(res.body) };
}

test('uses the YouTube Data API when the configured key works', async t => {
  const previousKey = process.env.YOUTUBE_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.YOUTUBE_API_KEY = 'test-key';
  const requests = [];
  globalThis.fetch = async url => {
    requests.push(String(url));
    if (String(url).includes('/playlistItems?')) {
      return new Response(JSON.stringify({
        items: [{
          contentDetails: { videoId: 'video-1' },
          snippet: { title: '20 minute yoga', position: 0 }
        }]
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      items: [{ id: 'video-1', contentDetails: { duration: 'PT20M' } }]
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  t.after(() => {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.YOUTUBE_API_KEY;
    else process.env.YOUTUBE_API_KEY = previousKey;
  });

  const result = await invoke('/api/youtube-playlist?url=https%3A%2F%2Fwww.youtube.com%2Fplaylist%3Flist%3DPLI0S9rxsS5uIKUSGMcnG_la4Iq9Le3HjC');

  assert.equal(result.status, 200);
  assert.equal(result.body.source, 'youtube-data-api');
  assert.equal(result.body.limited, false);
  assert.equal(result.body.videos[0].durationMinutes, 20);
  assert.equal(requests.length, 2);
});

test('falls back to the public feed when the Data API rejects the request', async t => {
  const previousKey = process.env.YOUTUBE_API_KEY;
  const previousFetch = globalThis.fetch;
  const previousWarn = console.warn;
  process.env.YOUTUBE_API_KEY = 'restricted-key';
  const requests = [];
  const warnings = [];
  globalThis.fetch = async url => {
    requests.push(String(url));
    if (String(url).includes('googleapis.com')) {
      return new Response(JSON.stringify({
        error: { status: 'PERMISSION_DENIED', errors: [{ reason: 'forbidden' }] }
      }), { status: 403, headers: { 'content-type': 'application/json' } });
    }
    return new Response(`<?xml version="1.0"?><feed>
      <entry><yt:videoId>video-2</yt:videoId><title>Gentle mobility</title></entry>
    </feed>`, { status: 200, headers: { 'content-type': 'text/xml' } });
  };
  console.warn = (...args) => warnings.push(args);
  t.after(() => {
    globalThis.fetch = previousFetch;
    console.warn = previousWarn;
    if (previousKey === undefined) delete process.env.YOUTUBE_API_KEY;
    else process.env.YOUTUBE_API_KEY = previousKey;
  });

  const result = await invoke('/api/youtube-playlist?playlistId=PLI0S9rxsS5uIKUSGMcnG_la4Iq9Le3HjC');

  assert.equal(result.status, 200);
  assert.equal(result.body.source, 'youtube-public-feed');
  assert.equal(result.body.limited, true);
  assert.equal(result.body.videos[0].videoId, 'video-2');
  assert.match(result.body.note, /most recent playlist videos/);
  assert.equal(requests.length, 2);
  assert.deepEqual(warnings[0][1], { status: 403, reason: 'forbidden' });
});

test('rejects invalid playlist input without calling YouTube', async t => {
  const previousFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response(); };
  t.after(() => { globalThis.fetch = previousFetch; });

  const result = await invoke('/api/youtube-playlist?playlistId=not-valid');

  assert.equal(result.status, 400);
  assert.equal(called, false);
});
