/* My Simple Health — Food continuity core
 *
 * Bridges the existing personal Food state so a grocery item can become
 * on-hand inventory after purchase, and a depleted food can return to the
 * grocery list without creating duplicates. This module is intentionally
 * UI-agnostic so native/web clients can share the same behavior contract.
 */
(function (global) {
  'use strict';

  const clone = value => JSON.parse(JSON.stringify(value));
  const now = () => new Date().toISOString();
  const uid = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function key(value) {
    return text(value).toLowerCase().replace(/\s+/g, ' ');
  }

  function ensureFoodState(state) {
    const next = clone(state || {});
    if (!next.food || typeof next.food !== 'object') next.food = {};
    ['foods', 'onHand', 'meals', 'recipes', 'groceries'].forEach(name => {
      if (!Array.isArray(next.food[name])) next.food[name] = [];
    });
    return next;
  }

  function findFoodForGrocery(food, grocery) {
    if (grocery.productId) {
      const byProduct = food.foods.find(item => item.productId === grocery.productId);
      if (byProduct) return byProduct;
    }
    const groceryKey = key(grocery.name);
    return food.foods.find(item => key(item.name) === groceryKey) || null;
  }

  function ensureFoodForGrocery(food, grocery, timestamp) {
    let item = findFoodForGrocery(food, grocery);
    if (item) {
      if (item.status === 'archived') {
        item.status = 'active';
        item.restoredAt = timestamp;
      }
      if (!item.productId && grocery.productId) item.productId = grocery.productId;
      return item;
    }

    item = {
      id: uid('food'),
      productId: grocery.productId || null,
      name: text(grocery.name) || 'Unnamed food',
      category: grocery.category || 'Other',
      status: 'active',
      source: 'grocery_purchase',
      createdAt: timestamp,
      updatedAt: timestamp
    };
    food.foods.push(item);
    return item;
  }

  function purchaseGroceryItem(state, groceryId, options) {
    const settings = options || {};
    const next = ensureFoodState(state);
    const food = next.food;
    const grocery = food.groceries.find(item => item.id === groceryId);
    if (!grocery) throw new Error('Grocery item not found.');

    const timestamp = settings.purchasedAt || grocery.purchasedAt || now();
    grocery.status = 'purchased';
    grocery.purchasedAt = timestamp;

    const directoryFood = ensureFoodForGrocery(food, grocery, timestamp);
    const existingStock = food.onHand.find(item => item.sourceGroceryItemId === grocery.id);
    if (existingStock) {
      return {
        state: next,
        grocery: clone(grocery),
        food: clone(directoryFood),
        stock: clone(existingStock),
        inventoryCreated: false
      };
    }

    const stock = {
      id: uid('stock'),
      foodId: directoryFood.id,
      productId: directoryFood.productId || grocery.productId || null,
      location: settings.location || grocery.storageLocation || 'Unsorted',
      quantity: text(settings.quantity || grocery.quantity) || '1 purchased unit',
      useSoon: false,
      source: 'grocery_purchase',
      sourceGroceryItemId: grocery.id,
      acquiredAt: timestamp,
      createdAt: timestamp
    };
    food.onHand.push(stock);

    return {
      state: next,
      grocery: clone(grocery),
      food: clone(directoryFood),
      stock: clone(stock),
      inventoryCreated: true
    };
  }

  function suggestRestock(state, foodId, options) {
    const settings = options || {};
    const next = ensureFoodState(state);
    const food = next.food;
    const directoryFood = food.foods.find(item => item.id === foodId);
    if (!directoryFood) throw new Error('Food not found.');

    const existing = food.groceries.find(item =>
      item.status !== 'purchased' &&
      ((directoryFood.productId && item.productId === directoryFood.productId) || key(item.name) === key(directoryFood.name))
    );
    if (existing) return { state: next, grocery: clone(existing), created: false };

    const timestamp = settings.createdAt || now();
    const grocery = {
      id: uid('grocery'),
      productId: directoryFood.productId || null,
      name: directoryFood.name,
      quantity: settings.quantity || null,
      reason: settings.reason || 'Restock after using what was on hand',
      estimatedPrice: settings.estimatedPrice == null ? null : Number(settings.estimatedPrice),
      status: 'active',
      source: 'inventory_continuity',
      createdAt: timestamp
    };
    food.groceries.push(grocery);
    return { state: next, grocery: clone(grocery), created: true };
  }

  function markStockUsedUp(state, stockId, options) {
    const settings = options || {};
    const next = ensureFoodState(state);
    const food = next.food;
    const index = food.onHand.findIndex(item => item.id === stockId);
    if (index < 0) throw new Error('On-hand item not found.');

    const stock = food.onHand[index];
    const foodId = stock.foodId;
    food.onHand.splice(index, 1);

    if (!settings.addToGrocery) {
      return { state: next, removedStock: clone(stock), restock: null };
    }

    const result = suggestRestock(next, foodId, {
      quantity: settings.quantity || null,
      reason: settings.reason || 'Used up',
      estimatedPrice: settings.estimatedPrice
    });
    return { state: result.state, removedStock: clone(stock), restock: result.grocery, restockCreated: result.created };
  }

  const API = Object.freeze({
    ensureFoodState,
    purchaseGroceryItem,
    suggestRestock,
    markStockUsedUp
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.MSHFoodContinuity = API;
})(typeof window !== 'undefined' ? window : globalThis);
