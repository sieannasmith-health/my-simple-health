import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/food-product.js';

function responseHarness() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { return this; }
  };
}

test('rejects an invalid GTIN before making an upstream request', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('should not run'); };
  try {
    const res = responseHarness();
    await handler({ method:'GET', url:'/api/food-product?code=036000291453' }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('normalizes a provider response behind the MSH product contract', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /036000291452/);
    assert.match(options.headers['User-Agent'], /MySimpleHealth/);
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          status:'success',
          product:{
            code:'036000291452',
            product_name:'Test Yogurt',
            brands:'Example Brand',
            quantity:'32 oz',
            serving_size:'170 g',
            ingredients_text:'Milk, cultures',
            allergens_tags:['en:milk'],
            nutriments:{
              'energy-kcal_100g':100,
              proteins_100g:10,
              carbohydrates_100g:8,
              fat_100g:2,
              sodium_100g:0.05
            }
          }
        };
      }
    };
  };

  try {
    const res = responseHarness();
    await handler({ method:'GET', url:'/api/food-product?code=036000291452' }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.product.canonicalName, 'Test Yogurt');
    assert.equal(res.body.product.identifier.scheme, 'gtin_12');
    assert.equal(res.body.product.nutrition.nutrients.per100g.sodiumMg, 50);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns a clean not-found response without inventing a product', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok:false, status:404, async json(){ return {}; } });
  try {
    const res = responseHarness();
    await handler({ method:'GET', url:'/api/food-product?code=036000291452' }, res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.found, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
