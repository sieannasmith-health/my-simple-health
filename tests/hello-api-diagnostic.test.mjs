import assert from 'node:assert/strict';
import test from 'node:test';

import handler from '../api/hello.js';

function responseRecorder() {
  const result = { statusCode: 200, headers: {}, body: null };
  return {
    result,
    response: {
      setHeader(name, value) { result.headers[name] = value; },
      status(code) { result.statusCode = code; return this; },
      json(body) { result.body = body; return result; },
      end() { return result; }
    }
  };
}

test('Hello reports an explicit configuration error when no server-side model key exists', async () => {
  const previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const { result, response } = responseRecorder();
    await handler({ method:'POST', body:{ message:'hello', journeyContext:null } }, response);
    assert.equal(result.statusCode, 503);
    assert.equal(result.body.code, 'HELLO_MODEL_NOT_CONFIGURED');
    assert.doesNotMatch(JSON.stringify(result.body), /api[_-]?key/i);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});
