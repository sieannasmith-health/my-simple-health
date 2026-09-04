import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Lifecycle = require('../js/msh-food-lifecycle.js');
const Continuity = require('../js/msh-food-continuity.js');

function baseState() {
  return { food: { foods: [], onHand: [], meals: [], recipes: [], groceries: [] } };
}

test('grocery purchase creates one canonical product acquisition lot price and legacy stock link', () => {
  const state = baseState();
  state.food.groceries.push({ id:'grocery_1', name:'Greek yogurt', brand:'Fage', quantity:'2 tubs', estimatedPrice:8.49, status:'active' });
  const result = Continuity.purchaseGroceryItem(state, 'grocery_1', {
    purchasedAt:'2026-09-03T18:00:00.000Z', location:'Fridge'
  });

  assert.equal(result.inventoryCreated, true);
  assert.equal(result.state.food.acquisition.products.length, 1);
  assert.equal(result.state.food.acquisition.acquisitions.length, 1);
  assert.equal(result.state.food.acquisition.inventoryLots.length, 1);
  assert.equal(result.state.food.acquisition.priceObservations.length, 1);
  assert.equal(result.inventoryLot.storageLocation, 'refrigerator');
  assert.equal(result.inventoryLot.quantityRemaining, 2);
  assert.equal(result.inventoryLot.unit, 'tubs');
  assert.equal(result.stock.location, 'Fridge');
  assert.equal(result.stock.inventoryLotId, result.inventoryLot.id);
  assert.equal(result.grocery.productId, result.inventoryLot.productId);
  assert.equal(result.state.food.acquisition.priceObservations[0].price, 8.49);
  assert.equal(result.inventoryLot.provenance.sourceRecordId, 'grocery_1');
});

test('purchasing the same grocery item twice is idempotent across canonical inventory', () => {
  const state = baseState();
  state.food.groceries.push({ id:'grocery_1', name:'Milk', quantity:'1 gallon', status:'active' });
  const first = Continuity.purchaseGroceryItem(state, 'grocery_1', { location:'Fridge' });
  const second = Continuity.purchaseGroceryItem(first.state, 'grocery_1', { location:'Fridge' });

  assert.equal(first.inventoryCreated, true);
  assert.equal(second.inventoryCreated, false);
  assert.equal(second.state.food.acquisition.products.length, 1);
  assert.equal(second.state.food.acquisition.acquisitions.length, 1);
  assert.equal(second.state.food.acquisition.inventoryLots.length, 1);
  assert.equal(second.state.food.onHand.length, 1);
});

test('consumption depletes the canonical lot and its on-hand mirror together', () => {
  const received = Lifecycle.receivePurchase(baseState(), {
    name:'Eggs', quantity:'12 eggs', location:'Fridge', purchasedAt:'2026-09-03T12:00:00.000Z'
  });
  const partial = Lifecycle.consume(received.state, {
    productId:received.product.id, foodId:received.food.id, foodName:'Eggs', quantity:4, unit:'eggs'
  });
  assert.equal(partial.state.food.acquisition.inventoryLots[0].quantityRemaining, 8);
  assert.equal(partial.state.food.onHand[0].quantityValue, 8);
  assert.equal(partial.state.food.consumptionEvents.length, 1);

  const finished = Lifecycle.consume(partial.state, {
    productId:received.product.id, foodId:received.food.id, foodName:'Eggs', quantity:8, unit:'eggs'
  });
  assert.equal(finished.state.food.acquisition.inventoryLots[0].status, 'depleted');
  assert.equal(finished.state.food.onHand.length, 0);
  assert.equal(finished.state.food.consumptionEvents.length, 2);
});

test('use soon derives from confirmed inventory dates instead of a disconnected flag', () => {
  const first = Lifecycle.receivePurchase(baseState(), {
    name:'Spinach', quantity:1, unit:'bag', location:'Fridge', expiration:'2026-09-06T12:00:00.000Z'
  });
  const second = Lifecycle.receivePurchase(first.state, {
    name:'Rice', quantity:1, unit:'bag', location:'Pantry', bestBy:'2027-01-01T12:00:00.000Z'
  });
  const soon = Lifecycle.useSoon(second.state, { now:new Date('2026-09-03T12:00:00.000Z'), days:5 });
  assert.equal(soon.length, 1);
  assert.equal(soon[0].productId, first.product.id);
});

test('low or depleted canonical inventory becomes a replenishment candidate only when not already listed', () => {
  const received = Lifecycle.receivePurchase(baseState(), {
    name:'Oats', quantity:2, unit:'canisters', location:'Pantry', lowThreshold:1
  });
  const used = Lifecycle.consume(received.state, {
    productId:received.product.id, foodId:received.food.id, foodName:'Oats', quantity:1, unit:'canisters'
  });
  const candidates = Lifecycle.replenishmentCandidates(used.state);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].reason, 'low');

  used.state.food.groceries.push({ id:'grocery_oats', productId:received.product.id, name:'Oats', status:'active' });
  assert.equal(Lifecycle.replenishmentCandidates(used.state).length, 0);
});

test('used up action records depletion and can return the same canonical product to groceries', () => {
  const received = Lifecycle.receivePurchase(baseState(), { name:'Salmon', quantity:'1 package', location:'Freezer' });
  const result = Continuity.markStockUsedUp(received.state, received.stock.id, { addToGrocery:true, quantity:'1 package' });

  assert.equal(result.state.food.acquisition.inventoryLots[0].status, 'depleted');
  assert.equal(result.state.food.onHand.length, 0);
  assert.equal(result.state.food.consumptionEvents.length, 1);
  assert.equal(result.state.food.groceries.length, 1);
  assert.equal(result.state.food.groceries[0].productId, received.product.id);
});