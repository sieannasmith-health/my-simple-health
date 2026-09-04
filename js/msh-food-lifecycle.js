/* My Simple Health — canonical Food lifecycle foundation
 *
 * One contract for Product → Acquisition → Inventory → Consumption → Restock.
 * Keeps the existing My Food arrays compatible while giving every physical
 * food purchase a stable product and inventory-lot identity with provenance.
 */
(function (global) {
  'use strict';

  const clone = value => JSON.parse(JSON.stringify(value));
  const now = () => new Date().toISOString();
  const uid = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const LOCATIONS = Object.freeze(['pantry', 'refrigerator', 'freezer', 'other']);

  function text(value) { return String(value == null ? '' : value).trim(); }
  function key(value) { return text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function number(value) {
    if (value == null || value === '') return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  }
  function money(value) {
    const result = number(value);
    return result == null ? null : Math.round(result * 100) / 100;
  }
  function iso(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  function normalizeLocation(value) {
    const raw = key(value);
    if (!raw) return 'other';
    if (raw.includes('pantry') || raw.includes('cabinet')) return 'pantry';
    if (raw.includes('fridge') || raw.includes('refrigerator')) return 'refrigerator';
    if (raw.includes('freezer') || raw.includes('frozen')) return 'freezer';
    return LOCATIONS.includes(raw) ? raw : 'other';
  }
  function parseQuantity(value, explicitUnit) {
    if (typeof value === 'number') return { value:Number.isFinite(value) ? value : 1, unit:explicitUnit || 'unit' };
    const raw = text(value);
    const match = raw.match(/^([0-9]+(?:\.[0-9]+)?)\s*(.*)$/);
    if (!match) return { value:1, unit:explicitUnit || raw || 'unit' };
    return { value:Number(match[1]), unit:explicitUnit || text(match[2]) || 'unit' };
  }

  function ensureState(state) {
    const next = clone(state || {});
    if (!next.food || typeof next.food !== 'object') next.food = {};
    ['foods','onHand','meals','recipes','groceries','consumptionEvents'].forEach(name => {
      if (!Array.isArray(next.food[name])) next.food[name] = [];
    });
    if (!next.food.acquisition || typeof next.food.acquisition !== 'object') next.food.acquisition = {};
    ['products','identifiers','merchants','merchantLocations','acquisitions','inventoryLots','priceObservations','financialLinks'].forEach(name => {
      if (!Array.isArray(next.food.acquisition[name])) next.food.acquisition[name] = [];
    });
    return next;
  }

  function findProduct(state, input) {
    const food = state.food;
    const acquisition = food.acquisition;
    if (input.productId) return acquisition.products.find(item => item.id === input.productId) || null;
    const directory = input.foodId ? food.foods.find(item => item.id === input.foodId) : null;
    if (directory && directory.productId) return acquisition.products.find(item => item.id === directory.productId) || null;
    const candidateName = key(input.canonicalName || input.name);
    const candidateBrand = key(input.brand);
    if (!candidateName) return null;
    return acquisition.products.find(product => key(product.canonicalName) === candidateName && key(product.brand) === candidateBrand) || null;
  }

  function ensureProduct(state, input, timestamp) {
    const existing = findProduct(state, input || {});
    if (existing) return existing;
    const data = input || {};
    const product = {
      id:data.productId || uid('product'),
      canonicalName:text(data.canonicalName || data.name) || 'Unnamed food',
      brand:text(data.brand) || null,
      description:text(data.description) || null,
      packageQuantity:number(data.packageQuantity),
      packageUnit:data.packageUnit || null,
      category:data.category || null,
      imageUrl:data.imageUrl || null,
      createdAt:timestamp,
      updatedAt:timestamp
    };
    state.food.acquisition.products.push(product);
    return product;
  }

  function ensureDirectoryFood(state, input, product, timestamp) {
    const food = state.food;
    let item = null;
    if (input.foodId) item = food.foods.find(candidate => candidate.id === input.foodId) || null;
    if (!item && product) item = food.foods.find(candidate => candidate.productId === product.id) || null;
    if (!item) item = food.foods.find(candidate => key(candidate.name) === key(input.name || product?.canonicalName)) || null;
    if (!item) {
      item = {
        id:uid('food'), productId:product ? product.id : null,
        name:text(input.name || product?.canonicalName) || 'Unnamed food',
        category:input.category || product?.category || 'Other', status:'active',
        source:input.source || 'food_lifecycle', createdAt:timestamp, updatedAt:timestamp
      };
      food.foods.push(item);
    } else {
      if (!item.productId && product) item.productId = product.id;
      if (item.status === 'archived') item.status = 'active';
      item.updatedAt = timestamp;
    }
    return item;
  }

  function receivePurchase(state, input) {
    const next = ensureState(state);
    const data = input || {};
    const timestamp = iso(data.acquiredAt || data.purchasedAt) || now();
    const product = ensureProduct(next, data, timestamp);
    const directoryFood = ensureDirectoryFood(next, data, product, timestamp);
    const quantity = parseQuantity(data.quantity == null ? 1 : data.quantity, data.unit);

    const sourceId = data.sourceGroceryItemId || data.groceryItemId || data.acquisitionItemId || null;
    const existingLot = sourceId ? next.food.acquisition.inventoryLots.find(lot =>
      lot.sourceGroceryItemId === sourceId || lot.acquisitionItemId === sourceId
    ) : null;
    if (existingLot) {
      const stock = next.food.onHand.find(item => item.inventoryLotId === existingLot.id) || null;
      return { state:next, product:clone(product), food:clone(directoryFood), lot:clone(existingLot), stock:clone(stock), created:false };
    }

    const acquisitionId = data.acquisitionId || uid('acquisition');
    const acquisitionItemId = data.acquisitionItemId || uid('acq_item');
    const provenance = {
      sourceType:data.sourceType || (data.sourceGroceryItemId ? 'grocery_list' : 'manual'),
      sourceRecordId:sourceId,
      observedAt:timestamp,
      importedAt:now(),
      confidence:data.confidence == null ? null : Math.max(0,Math.min(1,Number(data.confidence)))
    };
    const lineTotal = money(data.lineTotal != null ? data.lineTotal : data.purchasePrice != null ? data.purchasePrice : data.estimatedPrice);
    const acquisition = {
      id:acquisitionId, ownerId:data.ownerId || null, householdId:data.householdId || null,
      acquiredAt:timestamp, merchantId:data.merchantId || null, source:provenance,
      total:lineTotal, currency:data.currency || 'USD', status:'recorded', createdAt:timestamp, updatedAt:timestamp,
      items:[{
        id:acquisitionItemId, acquisitionId, productId:product.id,
        sourceDescription:text(data.name || product.canonicalName), quantity:quantity.value, unit:quantity.unit,
        unitPrice:money(data.unitPrice), lineTotal, resolutionStatus:'user_confirmed', category:data.category || product.category || null,
        provenance
      }]
    };
    next.food.acquisition.acquisitions.push(acquisition);

    const lot = {
      id:data.inventoryLotId || uid('inventory_lot'), ownerId:data.ownerId || null, householdId:data.householdId || null,
      productId:product.id, acquisitionItemId, sourceGroceryItemId:data.sourceGroceryItemId || data.groceryItemId || null,
      quantityAcquired:quantity.value, quantityRemaining:quantity.value, unit:quantity.unit,
      storageLocation:normalizeLocation(data.storageLocation || data.location), acquiredAt:timestamp,
      openedAt:iso(data.openedAt), bestBy:iso(data.bestBy), expiration:iso(data.expiration),
      dateLabel:data.dateLabel ? clone(data.dateLabel) : null, lowThreshold:number(data.lowThreshold),
      status:'available', provenance
    };
    next.food.acquisition.inventoryLots.push(lot);

    if (lineTotal != null) {
      next.food.acquisition.priceObservations.push({
        id:uid('price'), productId:product.id, merchantId:data.merchantId || null,
        observedAt:timestamp, price:lineTotal, packageQuantity:quantity.value, packageUnit:quantity.unit,
        currency:data.currency || 'USD', source:provenance
      });
    }

    const stock = {
      id:data.stockId || uid('stock'), foodId:directoryFood.id, productId:product.id, inventoryLotId:lot.id,
      location:lot.storageLocation, quantity:`${quantity.value} ${quantity.unit}`.trim(), quantityValue:quantity.value, unit:quantity.unit,
      useSoon:false, source:data.source || 'food_lifecycle', sourceGroceryItemId:lot.sourceGroceryItemId,
      acquiredAt:timestamp, openedAt:lot.openedAt, dateLabel:lot.dateLabel, createdAt:timestamp
    };
    next.food.onHand.push(stock);
    return { state:next, product:clone(product), food:clone(directoryFood), lot:clone(lot), stock:clone(stock), acquisition:clone(acquisition), created:true };
  }

  function consume(state, input) {
    const next = ensureState(state);
    const data = input || {};
    const requested = number(data.quantity == null ? data.amount : data.quantity);
    if (requested == null || requested <= 0) throw new Error('Consumption quantity must be greater than zero.');
    const lots = next.food.acquisition.inventoryLots
      .filter(lot => lot.status !== 'depleted' && (!data.productId || lot.productId === data.productId) && (!data.inventoryLotId || lot.id === data.inventoryLotId))
      .sort((a,b) => String(a.acquiredAt || '').localeCompare(String(b.acquiredAt || '')));
    let remaining = requested;
    const adjustments = [];
    lots.forEach(lot => {
      if (remaining <= 0) return;
      const available = Math.max(0,number(lot.quantityRemaining) || 0);
      if (!available) return;
      const used = Math.min(available,remaining);
      lot.quantityRemaining = Math.round((available-used)*1e6)/1e6;
      remaining = Math.round((remaining-used)*1e6)/1e6;
      if (lot.quantityRemaining <= 0) { lot.quantityRemaining = 0; lot.status = 'depleted'; }
      const stock = next.food.onHand.find(item => item.inventoryLotId === lot.id);
      if (stock) {
        stock.quantityValue = lot.quantityRemaining;
        stock.unit = lot.unit || stock.unit || 'unit';
        stock.quantity = `${lot.quantityRemaining} ${stock.unit}`.trim();
        if (lot.status === 'depleted') next.food.onHand = next.food.onHand.filter(item => item.id !== stock.id);
      }
      adjustments.push({ inventoryLotId:lot.id, quantityUsed:used, unit:lot.unit || null });
    });
    const consumed = Math.round((requested-remaining)*1e6)/1e6;
    const event = {
      id:data.id || uid('consumption'), ownerId:data.ownerId || null,
      productId:data.productId || lots[0]?.productId || null, foodId:data.foodId || null,
      foodName:text(data.foodName) || null, amount:consumed, unit:data.unit || lots[0]?.unit || 'unit',
      mealType:data.mealType || null, recipeId:data.recipeId || null, consumedAt:iso(data.consumedAt) || now(),
      inventoryAdjustment:{ requested, consumed, unfulfilled:remaining, adjustments },
      source:{ kind:data.sourceKind || 'USER_ENTRY', provenance:data.provenance || 'USER_STATED' }, createdAt:now()
    };
    next.food.consumptionEvents.push(event);
    return { state:next, event:clone(event), consumed, unfulfilled:remaining, adjustments:clone(adjustments) };
  }

  function useSoon(state, options) {
    const settings = { days:5, now:new Date(), ...(options || {}) };
    const next = ensureState(state);
    const anchor = new Date(settings.now);
    const limit = new Date(anchor.getTime() + Number(settings.days) * 86400000);
    return next.food.acquisition.inventoryLots.filter(lot => {
      if (lot.status === 'depleted') return false;
      const value = lot.expiration || lot.bestBy || lot.dateLabel?.normalizedDate;
      if (!value) return false;
      const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
      return !Number.isNaN(date.getTime()) && date >= anchor && date <= limit;
    }).sort((a,b) => String(a.expiration || a.bestBy || a.dateLabel?.normalizedDate).localeCompare(String(b.expiration || b.bestBy || b.dateLabel?.normalizedDate))).map(clone);
  }

  function replenishmentCandidates(state) {
    const next = ensureState(state);
    const activeGroceryProducts = new Set(next.food.groceries.filter(item => item.status !== 'purchased').map(item => item.productId).filter(Boolean));
    const totals = new Map();
    next.food.acquisition.inventoryLots.forEach(lot => {
      if (!lot.productId || lot.status === 'depleted') return;
      const current = totals.get(lot.productId) || { remaining:0, threshold:null, unit:lot.unit || null };
      current.remaining += Math.max(0,number(lot.quantityRemaining) || 0);
      if (number(lot.lowThreshold) != null) current.threshold = Math.max(current.threshold == null ? 0 : current.threshold,number(lot.lowThreshold));
      totals.set(lot.productId,current);
    });
    return next.food.acquisition.products.map(product => {
      const total = totals.get(product.id) || { remaining:0, threshold:null, unit:null };
      const depleted = total.remaining <= 0;
      const low = total.threshold != null && total.remaining <= total.threshold;
      if ((!depleted && !low) || activeGroceryProducts.has(product.id)) return null;
      return { productId:product.id, name:product.canonicalName, remaining:total.remaining, unit:total.unit, reason:depleted ? 'out' : 'low' };
    }).filter(Boolean);
  }

  const API = Object.freeze({ LOCATIONS, normalizeLocation, parseQuantity, ensureState, ensureProduct, receivePurchase, consume, useSoon, replenishmentCandidates });
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.MSHFoodLifecycle = API;
})(typeof window !== 'undefined' ? window : globalThis);