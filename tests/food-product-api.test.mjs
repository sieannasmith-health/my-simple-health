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
              fiber_100g:null,
              sugars_100g:'',
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
    assert.equal(res.body.product.nutrition.nutrients.per100g.fiberG, null);
    assert.equal(res.body.product.nutrition.nutrients.per100g.sugarsG, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('falls back to USDA FoodData Central when Open Food Facts has no match', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.USDA_FDC_API_KEY;
  process.env.USDA_FDC_API_KEY = 'test-key';
  let calls = 0;
  globalThis.fetch = async (url, options = {}) => {
    calls += 1;
    if (String(url).includes('openfoodfacts.org')) {
      return { ok:false, status:404, async json(){ return {}; } };
    }
    assert.match(String(url), /api\.nal\.usda\.gov\/fdc\/v1\/foods\/search/);
    assert.match(String(url), /api_key=test-key/);
    assert.equal(options.method, 'POST');
    const body = JSON.parse(options.body);
    assert.deepEqual(body.dataType, ['Branded']);
    assert.equal(body.query, '036000291452');
    return {
      ok:true,
      status:200,
      async json(){
        return {
          foods:[{
            fdcId:123456,
            gtinUpc:'036000291452',
            description:'USDA Test Yogurt',
            brandName:'Example Brand',
            foodCategory:'Yogurt',
            ingredients:'Milk, cultures',
            servingSize:170,
            servingSizeUnit:'g',
            foodNutrients:[
              { nutrientName:'Protein', value:9.5, unitName:'G' },
              { nutrientName:'Sodium, Na', value:48, unitName:'MG' }
            ]
          }]
        };
      }
    };
  };

  try {
    const res = responseHarness();
    await handler({ method:'GET', url:'/api/food-product?code=036000291452' }, res);
    assert.equal(calls, 2);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.provider, 'usda_fooddata_central');
    assert.equal(res.body.product.canonicalName, 'USDA Test Yogurt');
    assert.equal(res.body.product.nutrition.sourceRecordId, '123456');
    assert.deepEqual(res.body.product.nutrition.nutrients.protein, { value:9.5, unit:'G' });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.USDA_FDC_API_KEY;
    else process.env.USDA_FDC_API_KEY = originalKey;
  }
});

test('returns a clean not-found response without inventing a product', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.USDA_FDC_API_KEY;
  delete process.env.USDA_FDC_API_KEY;
  globalThis.fetch = async () => ({ ok:false, status:404, async json(){ return {}; } });
  try {
    const res = responseHarness();
    await handler({ method:'GET', url:'/api/food-product?code=036000291452' }, res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.found, false);
    assert.deepEqual(res.body.sourcesChecked, ['open_food_facts']);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.USDA_FDC_API_KEY;
    else process.env.USDA_FDC_API_KEY = originalKey;
  }
});
