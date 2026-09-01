/* My Simple Health — Food Consumption model */
(function (global) {
  'use strict';

  const MODES = Object.freeze(['quick', 'specific', 'measured']);
  const UNITS = Object.freeze(['serving', 'g', 'oz', 'piece', 'portion']);
  const NUTRIENTS = Object.freeze(['caloriesKcal','proteinG','carbohydrateG','fatG','fiberG','sugarsG','sodiumMg']);
  const clone = value => JSON.parse(JSON.stringify(value));
  const now = () => new Date().toISOString();
  const uid = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  function numberOrNull(value) {
    if (value == null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function round(value, digits = 2) {
    if (value == null || !Number.isFinite(Number(value))) return null;
    const factor = 10 ** digits;
    return Math.round(Number(value) * factor) / factor;
  }

  function gramsForAmount(amount, unit, specifics) {
    const value = numberOrNull(amount);
    if (value == null || value <= 0) return null;
    if (unit === 'g') return value;
    if (unit === 'oz') return value * 28.349523125;
    if (unit === 'serving') {
      const serving = specifics && specifics.serving || {};
      const servingSize = numberOrNull(serving.size);
      const servingUnit = String(serving.unit || '').toLowerCase();
      if (servingSize == null) return null;
      if (servingUnit === 'g' || servingUnit === 'gram' || servingUnit === 'grams') return value * servingSize;
      if (servingUnit === 'oz' || servingUnit === 'ounce' || servingUnit === 'ounces') return value * servingSize * 28.349523125;
    }
    return null;
  }

  function calculateNutrition(specifics, amount, unit) {
    const nutrition = specifics && specifics.nutrition;
    if (!nutrition || typeof nutrition !== 'object') return null;
    const grams = gramsForAmount(amount, unit, specifics);
    if (grams == null) return null;
    const factor = grams / 100;
    const result = {};
    let hasValue = false;
    NUTRIENTS.forEach(key => {
      const base = numberOrNull(nutrition[key]);
      result[key] = base == null ? null : round(base * factor, key === 'caloriesKcal' ? 0 : 2);
      if (result[key] != null) hasValue = true;
    });
    return hasValue ? { grams:round(grams, 2), nutrients:result } : null;
  }

  function createConsumptionEvent(input) {
    const data = input || {};
    const mode = MODES.includes(data.mode) ? data.mode : 'quick';
    const unit = UNITS.includes(data.unit) ? data.unit : 'portion';
    const amount = numberOrNull(data.amount);
    if (!data.foodName && !data.productId) throw new Error('Food name or product is required.');
    if (mode === 'measured' && (amount == null || amount <= 0)) throw new Error('Measured food logging requires an amount.');
    return {
      id:data.id || uid('consumption'),
      ownerId:data.ownerId || null,
      productId:data.productId || null,
      foodId:data.foodId || null,
      foodName:String(data.foodName || '').trim() || null,
      mode,
      amount,
      unit,
      grams:numberOrNull(data.grams),
      mealType:data.mealType || null,
      consumedAt:data.consumedAt ? new Date(data.consumedAt).toISOString() : now(),
      nutrition:data.nutrition ? clone(data.nutrition) : null,
      inventoryAdjustment:data.inventoryAdjustment ? clone(data.inventoryAdjustment) : null,
      source:{
        kind:'USER_ENTRY',
        provenance:'USER_STATED'
      },
      createdAt:data.createdAt || now()
    };
  }

  function consumeFromLots(lots, productId, quantity) {
    const requested = numberOrNull(quantity);
    if (!productId || requested == null || requested <= 0) return { lots:clone(lots || []), consumed:0, remaining:requested || 0, adjustments:[] };
    let remaining = requested;
    const adjustments = [];
    const next = clone(lots || []).sort((a,b) => String(a.acquiredAt || '').localeCompare(String(b.acquiredAt || '')));
    next.forEach(lot => {
      if (remaining <= 0 || lot.productId !== productId || lot.status === 'depleted') return;
      const available = Math.max(0, Number(lot.quantityRemaining) || 0);
      if (!available) return;
      const used = Math.min(available, remaining);
      lot.quantityRemaining = round(available - used, 4);
      if (lot.quantityRemaining <= 0) {
        lot.quantityRemaining = 0;
        lot.status = 'depleted';
      }
      remaining = round(remaining - used, 4);
      adjustments.push({ inventoryLotId:lot.id, quantityUsed:used, unit:lot.unit || null });
    });
    return { lots:next, consumed:round(requested - remaining, 4), remaining, adjustments };
  }

  const API = Object.freeze({ MODES, UNITS, NUTRIENTS, gramsForAmount, calculateNutrition, createConsumptionEvent, consumeFromLots });
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.MSHFoodConsumption = API;
})(typeof window !== 'undefined' ? window : globalThis);
