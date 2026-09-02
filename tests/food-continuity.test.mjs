import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const FoodContinuity = require('../js/msh-food-continuity.js');

function baseState() {
  return { food: { foods: [], onHand: [], meals: [], recipes: [], groceries: [] } };
}

test('purchased grocery becomes on-hand inventory and stays linked', () => {
  const state = baseState();
  state.food.groceries.push({ id: 'grocery_1', name: 'Greek yogurt', quantity: '2 tubs', reason: 'Breakfast', status: 'active' });
  const result = FoodContinuity.purchaseGroceryItem(state, 'grocery_1', { purchasedAt: '2026-09-01T12:00:00.000Z', location: 'Fridge' });
  assert.equal(result.grocery.status, 'purchased');
  assert.equal(result.inventoryCreated, true);
  assert.equal(result.state.food.foods.length, 1);
  assert.equal(result.state.food.onHand.length, 1);
  assert.equal(result.state.food.onHand[0].sourceGroceryItemId, 'grocery_1');
  assert.equal(result.state.food.onHand[0].location, 'Fridge');
  assert.equal(result.state.food.onHand[0].quantity, '2 tubs');
});

test('purchasing same grocery twice does not duplicate inventory', () => {
  const state = baseState();
  state.food.groceries.push({ id: 'grocery_1', name: 'Milk', status: 'active' });
  const first = FoodContinuity.purchaseGroceryItem(state, 'grocery_1');
  const second = FoodContinuity.purchaseGroceryItem(first.state, 'grocery_1');
  assert.equal(first.inventoryCreated, true);
  assert.equal(second.inventoryCreated, false);
  assert.equal(second.state.food.onHand.length, 1);
  assert.equal(second.state.food.foods.length, 1);
});

test('purchased grocery reuses an existing food directory entry', () => {
  const state = baseState();
  state.food.foods.push({ id: 'food_1', name: 'Salmon', category: 'Protein', status: 'active' });
  state.food.groceries.push({ id: 'grocery_1', name: 'salmon', quantity: '1 package', status: 'active' });
  const result = FoodContinuity.purchaseGroceryItem(state, 'grocery_1');
  assert.equal(result.state.food.foods.length, 1);
  assert.equal(result.stock.foodId, 'food_1');
});

test('used-up inventory can create one restock grocery item', () => {
  const state = baseState();
  state.food.foods.push({ id: 'food_1', name: 'Eggs', category: 'Protein', status: 'active' });
  state.food.onHand.push({ id: 'stock_1', foodId: 'food_1', quantity: '12', source: 'manual' });
  const result = FoodContinuity.markStockUsedUp(state, 'stock_1', { addToGrocery: true, quantity: '12', reason: 'Used up' });
  assert.equal(result.state.food.onHand.length, 0);
  assert.equal(result.restockCreated, true);
  assert.equal(result.state.food.groceries.length, 1);
  assert.equal(result.state.food.groceries[0].name, 'Eggs');
  assert.equal(result.state.food.groceries[0].reason, 'Used up');
});

test('restock suggestion does not duplicate an active grocery item', () => {
  const state = baseState();
  state.food.foods.push({ id: 'food_1', name: 'Spinach', status: 'active' });
  state.food.groceries.push({ id: 'grocery_1', name: 'spinach', status: 'active', reason: 'For salads' });
  const result = FoodContinuity.suggestRestock(state, 'food_1');
  assert.equal(result.created, false);
  assert.equal(result.state.food.groceries.length, 1);
  assert.equal(result.grocery.id, 'grocery_1');
});

test('product-linked grocery reuses product-linked food even if names differ', () => {
  const state = baseState();
  state.food.foods.push({ id: 'food_1', productId: 'product_abc', name: 'Yogurt', status: 'active' });
  state.food.groceries.push({ id: 'grocery_1', productId: 'product_abc', name: 'Fage Greek Yogurt 5%', status: 'active' });
  const result = FoodContinuity.purchaseGroceryItem(state, 'grocery_1');
  assert.equal(result.state.food.foods.length, 1);
  assert.equal(result.stock.foodId, 'food_1');
  assert.equal(result.stock.productId, 'product_abc');
});
