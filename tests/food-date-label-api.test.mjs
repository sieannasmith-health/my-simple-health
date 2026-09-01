import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/food-date-label.js';

function responseHarness() {
  return {
    statusCode:200, body:null, headers:{},
    setHeader(name,value){ this.headers[name]=value; },
    status(code){ this.statusCode=code; return this; },
    json(value){ this.body=value; return this; },
    end(){ return this; }
  };
}

test('rejects requests without a food date-label image', async () => {
  const res = responseHarness();
  await handler({method:'POST',body:{}},res);
  assert.equal(res.statusCode,400);
  assert.equal(res.body.success,false);
});

test('requires server-side OpenAI configuration', async () => {
  const original = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const res = responseHarness();
    await handler({method:'POST',body:{image:'data:image/jpeg;base64,AAAA'}},res);
    assert.equal(res.statusCode,503);
    assert.equal(res.body.success,false);
  } finally {
    if (original === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original;
  }
});

test('returns structured extraction without changing the model date', async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = 'test-key';
  globalThis.fetch = async () => ({
    ok:true,
    status:200,
    async json(){
      return {
        output_text:JSON.stringify({
          printedText:'BEST IF USED BY SEP 14 2026',
          labelType:'best_if_used_by',
          normalizedDate:'2026-09-14',
          confidence:0.97,
          ambiguous:false,
          ambiguityReason:null
        })
      };
    }
  });
  try {
    const res = responseHarness();
    await handler({method:'POST',body:{image:'data:image/jpeg;base64,AAAA'}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.success,true);
    assert.equal(res.body.extraction.labelType,'best_if_used_by');
    assert.equal(res.body.extraction.normalizedDate,'2026-09-14');
    assert.equal(res.body.extraction.provenance,'MODEL_INFERRED');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});
