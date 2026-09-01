import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/food-product-match.js';

function responseHarness() {
  return {
    statusCode:200, body:null, headers:{},
    setHeader(name,value){ this.headers[name]=value; },
    status(code){ this.statusCode=code; return this; },
    json(value){ this.body=value; return this; },
    end(){ return this; }
  };
}

test('requires server-side USDA configuration', async () => {
  const original = process.env.USDA_FDC_API_KEY;
  delete process.env.USDA_FDC_API_KEY;
  try {
    const res = responseHarness();
    await handler({method:'POST',body:{name:'Greek yogurt'}}, res);
    assert.equal(res.statusCode,503);
    assert.equal(res.body.success,false);
  } finally {
    if (original === undefined) delete process.env.USDA_FDC_API_KEY;
    else process.env.USDA_FDC_API_KEY = original;
  }
});

test('ranks stronger text overlap and preserves exact branded serving metadata', async () => {
  const originalKey = process.env.USDA_FDC_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.USDA_FDC_API_KEY = 'test-key';
  globalThis.fetch = async () => ({
    ok:true,
    status:200,
    async json(){
      return { foods:[
        {fdcId:1,description:'Chocolate sandwich cookies',brandOwner:'Example',dataType:'Branded',foodNutrients:[]},
        {
          fdcId:2,
          description:'Plain Greek Yogurt 32 oz',
          brandOwner:'Example Dairy LLC',
          brandName:'Example Dairy',
          gtinUpc:'036000291452',
          dataType:'Branded',
          brandedFoodCategory:'Yogurt',
          packageWeight:'32 oz',
          servingSize:170,
          servingSizeUnit:'g',
          householdServingFullText:'3/4 cup (170 g)',
          ingredients:'Cultured milk',
          foodNutrients:[
            {nutrientName:'Energy',value:59},
            {nutrientName:'Protein',value:10.3},
            {nutrientName:'Sodium, Na',value:36}
          ]
        }
      ]};
    }
  });
  try {
    const res = responseHarness();
    await handler({method:'POST',body:{name:'Greek yogurt'}}, res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.success,true);
    const candidate = res.body.candidates[0];
    assert.equal(candidate.providerId,'2');
    assert.ok(candidate.score > res.body.candidates[1].score);
    assert.equal(candidate.brand,'Example Dairy');
    assert.equal(candidate.packageWeight,'32 oz');
    assert.deepEqual(candidate.serving,{size:170,unit:'g',household:'3/4 cup (170 g)'});
    assert.equal(candidate.nutrition.basis,'per_100g');
    assert.equal(candidate.nutrition.caloriesKcal,59);
    assert.equal(candidate.nutrition.proteinG,10.3);
    assert.equal(candidate.nutrition.sodiumMg,36);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.USDA_FDC_API_KEY;
    else process.env.USDA_FDC_API_KEY = originalKey;
  }
});
