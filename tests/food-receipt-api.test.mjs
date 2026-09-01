import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/food-receipt.js';

function responseHarness() {
  return {
    statusCode:200,
    headers:{},
    body:null,
    setHeader(name,value){ this.headers[name]=value; },
    status(code){ this.statusCode=code; return this; },
    json(value){ this.body=value; return this; },
    end(){ return this; }
  };
}

test('receipt endpoint requires an image before calling the model', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('should not run'); };
  try {
    const res = responseHarness();
    await handler({ method:'POST', body:{ store:'Kroger' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('receipt endpoint keeps model output bounded by the receipt schema', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://api.openai.com/v1/responses');
    assert.match(options.headers.Authorization, /^Bearer /);
    const request = JSON.parse(options.body);
    assert.equal(request.text.format.name, 'msh_food_receipt');
    assert.equal(request.text.format.strict, true);
    return {
      ok:true,
      status:200,
      async json(){
        return {
          output_text:JSON.stringify({
            merchant:'Kroger', purchaseDate:'2026-08-31', subtotal:8.49, tax:0, fees:null, total:8.49, currency:'USD',
            items:[{
              receiptText:'GRK YOG 32OZ', normalizedName:'Greek yogurt', quantity:1, unit:'package',
              unitPrice:8.49, lineTotal:8.49, sourceIdentifier:null, itemType:'food', confidence:0.82
            }]
          })
        };
      }
    };
  };

  try {
    const res = responseHarness();
    await handler({ method:'POST', body:{ image:'data:image/jpeg;base64,abc', store:'Kroger' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.receipt.items[0].receiptText, 'GRK YOG 32OZ');
    assert.equal(res.body.receipt.items[0].normalizedName, 'Greek yogurt');
    assert.equal(res.body.receipt.items[0].confidence, 0.82);
    assert.equal(res.body.receipt.selectedStore, 'Kroger');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});

test('unknown store selection is normalized without inventing a retailer', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    const prompt = request.input[0].content.find(part => part.type === 'input_text').text;
    assert.match(prompt, /selected Other/);
    return {
      ok:true,
      async json(){
        return { output_text:JSON.stringify({ merchant:'Local Market', purchaseDate:null, subtotal:null, tax:null, fees:null, total:null, currency:'USD', items:[] }) };
      }
    };
  };
  try {
    const res = responseHarness();
    await handler({ method:'POST', body:{ image:'data:image/jpeg;base64,abc', store:'Not A Real Store' } }, res);
    assert.equal(res.body.receipt.selectedStore, 'Other');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});
