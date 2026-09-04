/* My Simple Health — Food continuity core
 *
 * Bridges grocery → canonical product/acquisition/inventory and inventory →
 * grocery restock. Legacy My Food arrays remain readable for existing UI.
 */
(function (global) {
  'use strict';

  const clone = value => JSON.parse(JSON.stringify(value));
  const now = () => new Date().toISOString();
  const uid = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const Lifecycle = global.MSHFoodLifecycle || (typeof require === 'function' ? require('./msh-food-lifecycle.js') : null);

  function text(value) { return String(value == null ? '' : value).trim(); }
  function key(value) { return text(value).toLowerCase().replace(/\s+/g, ' '); }

  function ensureFoodState(state) {
    if (Lifecycle) return Lifecycle.ensureState(state);
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

  function purchaseGroceryItem(state, groceryId, options) {
    const settings = options || {};
    const next = ensureFoodState(state);
    const grocery = next.food.groceries.find(item => item.id === groceryId);
    if (!grocery) throw new Error('Grocery item not found.');
    const timestamp = settings.purchasedAt || grocery.purchasedAt || now();
    grocery.status = 'purchased';
    grocery.purchasedAt = timestamp;

    if (Lifecycle) {
      const displayLocation = settings.location || grocery.storageLocation || 'Unsorted';
      const result = Lifecycle.receivePurchase(next, {
        productId:grocery.productId || null,
        name:grocery.name,
        brand:grocery.brand || null,
        category:grocery.category || null,
        quantity:settings.quantity || grocery.quantity || 1,
        unit:settings.unit || grocery.unit || null,
        location:displayLocation,
        purchasedAt:timestamp,
        purchasePrice:settings.purchasePrice == null ? grocery.actualPrice == null ? grocery.estimatedPrice : grocery.actualPrice : settings.purchasePrice,
        unitPrice:grocery.unitPrice == null ? null : grocery.unitPrice,
        merchantId:grocery.merchantId || null,
        currency:grocery.currency || 'USD',
        sourceGroceryItemId:grocery.id,
        source:'grocery_purchase',
        sourceType:'grocery_list',
        ownerId:grocery.ownerId || null,
        householdId:grocery.householdId || null,
        lowThreshold:settings.lowThreshold == null ? grocery.lowThreshold : settings.lowThreshold
      });
      const savedGrocery = result.state.food.groceries.find(item => item.id === groceryId);
      if (savedGrocery && result.product && !savedGrocery.productId) savedGrocery.productId = result.product.id;
      const savedStock = result.state.food.onHand.find(item => item.inventoryLotId === result.lot?.id) || null;
      if (savedStock) savedStock.location = displayLocation;
      return {
        state:result.state,
        grocery:clone(savedGrocery || grocery),
        food:result.food,
        stock:clone(savedStock || result.stock),
        inventoryLot:result.lot,
        acquisition:result.acquisition || null,
        inventoryCreated:result.created
      };
    }

    let directoryFood = findFoodForGrocery(next.food, grocery);
    if (!directoryFood) {
      directoryFood = { id:uid('food'), productId:grocery.productId || null, name:text(grocery.name) || 'Unnamed food', category:grocery.category || 'Other', status:'active', source:'grocery_purchase', createdAt:timestamp, updatedAt:timestamp };
      next.food.foods.push(directoryFood);
    }
    const existingStock = next.food.onHand.find(item => item.sourceGroceryItemId === grocery.id);
    if (existingStock) return { state:next, grocery:clone(grocery), food:clone(directoryFood), stock:clone(existingStock), inventoryCreated:false };
    const stock = { id:uid('stock'), foodId:directoryFood.id, productId:directoryFood.productId || grocery.productId || null, location:settings.location || grocery.storageLocation || 'Unsorted', quantity:text(settings.quantity || grocery.quantity) || '1 purchased unit', useSoon:false, source:'grocery_purchase', sourceGroceryItemId:grocery.id, acquiredAt:timestamp, createdAt:timestamp };
    next.food.onHand.push(stock);
    return { state:next, grocery:clone(grocery), food:clone(directoryFood), stock:clone(stock), inventoryCreated:true };
  }

  function suggestRestock(state, foodId, options) {
    const settings = options || {};
    const next = ensureFoodState(state);
    const food = next.food;
    const directoryFood = food.foods.find(item => item.id === foodId);
    if (!directoryFood) throw new Error('Food not found.');
    const existing = food.groceries.find(item => item.status !== 'purchased' && ((directoryFood.productId && item.productId === directoryFood.productId) || key(item.name) === key(directoryFood.name)));
    if (existing) return { state:next, grocery:clone(existing), created:false };
    const timestamp = settings.createdAt || now();
    const grocery = {
      id:uid('grocery'), productId:directoryFood.productId || null, name:directoryFood.name,
      quantity:settings.quantity || null,
      reason:settings.reason || 'Restock after using what was on hand',
      estimatedPrice:settings.estimatedPrice == null ? null : Number(settings.estimatedPrice),
      status:'active', source:'inventory_continuity', createdAt:timestamp
    };
    food.groceries.push(grocery);
    return { state:next, grocery:clone(grocery), created:true };
  }

  function markStockUsedUp(state, stockId, options) {
    const settings = options || {};
    let next = ensureFoodState(state);
    const stock = next.food.onHand.find(item => item.id === stockId);
    if (!stock) throw new Error('On-hand item not found.');
    const foodId = stock.foodId;

    if (Lifecycle && stock.inventoryLotId) {
      const lot = next.food.acquisition.inventoryLots.find(item => item.id === stock.inventoryLotId);
      if (lot) {
        const amount = Math.max(0, Number(lot.quantityRemaining) || 0);
        if (amount > 0) next = Lifecycle.consume(next, { inventoryLotId:lot.id, productId:lot.productId, foodId, foodName:(next.food.foods.find(item => item.id === foodId) || {}).name, quantity:amount, unit:lot.unit, sourceKind:'INVENTORY_ACTION', provenance:'USER_CONFIRMED' }).state;
        else {
          lot.status = 'depleted';
          next.food.onHand = next.food.onHand.filter(item => item.id !== stockId);
        }
      } else next.food.onHand = next.food.onHand.filter(item => item.id !== stockId);
    } else next.food.onHand = next.food.onHand.filter(item => item.id !== stockId);

    if (!settings.addToGrocery) return { state:next, removedStock:clone(stock), restock:null };
    const result = suggestRestock(next, foodId, { quantity:settings.quantity || null, reason:settings.reason || 'Used up', estimatedPrice:settings.estimatedPrice });
    return { state:result.state, removedStock:clone(stock), restock:result.grocery, restockCreated:result.created };
  }

  function replenishLowStock(state, options) {
    const next = ensureFoodState(state);
    if (!Lifecycle) return { state:next, candidates:[], groceries:[] };
    const candidates = Lifecycle.replenishmentCandidates(next);
    let working = next;
    const groceries = [];
    candidates.forEach(candidate => {
      const directoryFood = working.food.foods.find(item => item.productId === candidate.productId);
      if (!directoryFood) return;
      const result = suggestRestock(working, directoryFood.id, {
        reason:candidate.reason === 'out' ? 'Out of stock' : 'Running low',
        ...(options || {})
      });
      working = result.state;
      groceries.push(result.grocery);
    });
    return { state:working, candidates:clone(candidates), groceries:clone(groceries) };
  }

  const API = Object.freeze({ ensureFoodState, purchaseGroceryItem, suggestRestock, markStockUsedUp, replenishLowStock });
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.MSHFoodContinuity = API;
})(typeof window !== 'undefined' ? window : globalThis);