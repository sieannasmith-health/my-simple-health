import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/msh-food-consumption.js';

const food = globalThis.MSHFoodConsumption;

test('calculates nutrients from grams using per-100g product data', () => {
  const specifics = { nutrition:{ caloriesKcal:100, proteinG:10, carbohydrateG:20, fatG:5 }, serving:{size:170,unit:'g'} };
  const result = food.calculateNutrition(specifics, 170, 'g');
  assert.equal(result.grams,170);
  assert.equal(result.nutrients.caloriesKcal,170);
  assert.equal(result.nutrients.proteinG,17);
  assert.equal(result.nutrients.carbohydrateG,34);
  assert.equal(result.nutrients.fatG,8.5);
});

test('converts servings to grams when serving size is known', () => {
  const specifics = { nutrition:{caloriesKcal:60}, serving:{size:170,unit:'g'} };
  const result = food.calculateNutrition(specifics, 2, 'serving');
  assert.equal(result.grams,340);
  assert.equal(result.nutrients.caloriesKcal,204);
});

test('keeps unknown nutrient values null instead of zero', () => {
  const result = food.calculateNutrition({nutrition:{caloriesKcal:100,proteinG:null},serving:{size:100,unit:'g'}},1,'serving');
  assert.equal(result.nutrients.caloriesKcal,100);
  assert.equal(result.nutrients.proteinG,null);
});

test('parses package mass and converts measured food into purchased-unit fractions', () => {
  const specifics = { packageWeight:'32 oz (907 g)', serving:{size:170,unit:'g'} };
  assert.equal(food.packageGrams(specifics),907);
  assert.equal(food.purchasedUnitsForAmount(170,'g',specifics),0.187431);
});

test('uses ounce package mass when grams are unavailable', () => {
  const specifics = { packageWeight:'12 oz' };
  assert.equal(food.packageGrams(specifics),340.19);
});

test('consumes oldest matching inventory lots first', () => {
  const result = food.consumeFromLots([
    {id:'new',productId:'p1',quantityRemaining:1,status:'available',acquiredAt:'2026-08-20'},
    {id:'old',productId:'p1',quantityRemaining:2,status:'available',acquiredAt:'2026-08-10'},
    {id:'other',productId:'p2',quantityRemaining:4,status:'available',acquiredAt:'2026-08-01'}
  ],'p1',2.5);
  const old = result.lots.find(lot => lot.id === 'old');
  const newer = result.lots.find(lot => lot.id === 'new');
  assert.equal(old.quantityRemaining,0);
  assert.equal(old.status,'depleted');
  assert.equal(newer.quantityRemaining,0.5);
  assert.equal(result.consumed,2.5);
});

test('measured events require a positive amount', () => {
  assert.throws(() => food.createConsumptionEvent({foodName:'Yogurt',mode:'measured',amount:0,unit:'g'}), /requires an amount/);
});