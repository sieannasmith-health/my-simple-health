/* My Simple Health — Food Consumption UI */
(function (root) {
  'use strict';

  const page = document.querySelector('[data-msh-food]');
  if (!page || !root.MSHStorage || !root.MSHFoodConsumption) return;

  const consumption = root.MSHFoodConsumption;
  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
  const icon = (name, extraClass='') => root.MSHAreaIcons?.svg(name, extraClass) || '';

  function dialog() { return page.querySelector('[data-food-dialog]'); }
  function dialogHead(title, copy) {
    return `<div class="msh-food-dialog-head"><div><h2>${esc(title)}</h2>${copy ? `<p>${esc(copy)}</p>` : ''}</div><button class="msh-food-close" type="button" data-close-dialog aria-label="Close">×</button></div>`;
  }
  function open(markup) {
    const target = dialog();
    if (!target) return;
    target.innerHTML = `<div class="msh-food-dialog-card msh-food-consumption-dialog">${markup}</div>`;
    target.hidden = false;
  }
  function state() { return root.MSHStorage.getState(); }
  function foodState() { return state().food || {}; }

  function productMap() {
    const food = foodState();
    const acquisition = food.acquisition || {};
    return Object.fromEntries((acquisition.products || []).map(product => [product.id, product]));
  }

  function availableFoods() {
    const food = foodState();
    const products = productMap();
    const seen = new Set();
    const rows = [];
    (food.onHand || []).forEach(stock => {
      const legacy = (food.foods || []).find(item => item.id === stock.foodId);
      if (!legacy) return;
      const product = legacy.productId ? products[legacy.productId] : null;
      const key = product ? `product:${product.id}` : `food:${legacy.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({ foodId:legacy.id, productId:product && product.id || legacy.productId || null, name:product && product.canonicalName || legacy.name, brand:product && product.brand || null, hasSpecific:Boolean(product && food.productSpecifics && food.productSpecifics[product.id]), onHand:true });
    });
    (food.foods || []).forEach(legacy => {
      const product = legacy.productId ? products[legacy.productId] : null;
      const key = product ? `product:${product.id}` : `food:${legacy.id}`;
      if (seen.has(key) || legacy.status === 'archived') return;
      seen.add(key);
      rows.push({ foodId:legacy.id, productId:product && product.id || legacy.productId || null, name:product && product.canonicalName || legacy.name, brand:product && product.brand || null, hasSpecific:Boolean(product && food.productSpecifics && food.productSpecifics[product.id]), onHand:false });
    });
    return rows;
  }

  function enhanceAddMenu() {
    const actions = dialog() && dialog().querySelector('.msh-food-actions');
    if (!actions || actions.querySelector('[data-log-food]')) return;
    const button = document.createElement('button');
    button.className = 'msh-food-action';
    button.type = 'button';
    button.dataset.logFood = '';
    button.innerHTML = `${icon('meal','msh-area-icon--framed')}<strong>Log food eaten</strong><br><small>Quick, specific, or measured.</small>`;
    actions.appendChild(button);
  }

  function logForm() {
    const foods = availableFoods();
    const options = foods.map((item,index) => `<option value="${index}">${esc(item.name)}${item.brand ? ` · ${esc(item.brand)}` : ''}${item.onHand ? ' · on hand' : ''}</option>`).join('');
    open(`${dialogHead('Log food eaten','Choose how much detail fits this moment. You can stay quick or use an exact product and measured amount.')}
      <form class="msh-food-form" data-consumption-form>
        <label>Food<select name="foodIndex" data-consumption-food>${options || '<option value="">No foods available</option>'}</select></label>
        <fieldset class="msh-food-log-modes"><legend>How specific?</legend>
          <label><input type="radio" name="mode" value="quick" checked> <strong>Quick</strong><small>Record that you ate it.</small></label>
          <label><input type="radio" name="mode" value="specific"> <strong>Specific</strong><small>Use the exact product when available.</small></label>
          <label><input type="radio" name="mode" value="measured"> <strong>Measured</strong><small>Calculate nutrients from the amount eaten.</small></label>
        </fieldset>
        <div data-consumption-measurement hidden>
          <div class="msh-food-measure-row">
            <label>Amount<input name="amount" type="number" min="0" step="0.01" inputmode="decimal" value="1"></label>
            <label>Unit<select name="unit" data-consumption-unit><option value="serving">serving</option><option value="g">grams</option><option value="oz">ounces</option><option value="piece">piece</option><option value="portion">portion</option></select></label>
          </div>
          <div class="msh-food-nutrition-preview" data-nutrition-preview></div>
        </div>
        <label>Meal<select name="mealType"><option value="">Not specified</option><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option></select></label>
        <label>When<input name="consumedAt" type="datetime-local"></label>
        <label class="msh-food-inventory-choice"><input type="checkbox" name="reduceInventory" checked> Reduce on-hand inventory when the quantity can be reconciled safely</label>
        <p class="msh-food-acquisition-status" data-consumption-status hidden></p>
        <button class="msh-food-primary" type="submit" ${foods.length ? '' : 'disabled'}>Save food</button>
      </form>`);
    const form = dialog() && dialog().querySelector('[data-consumption-form]');
    if (form) {
      form._mshFoods = foods;
      const current = new Date();
      form.elements.consumedAt.value = new Date(current.getTime() - current.getTimezoneOffset() * 60000).toISOString().slice(0,16);
      updateMeasurement(form);
    }
  }

  function selectedFood(form) {
    const index = Number(form.elements.foodIndex.value);
    return form._mshFoods && form._mshFoods[index] || null;
  }

  function specificsFor(item) {
    const food = foodState();
    return item && item.productId && food.productSpecifics ? food.productSpecifics[item.productId] || null : null;
  }

  function nutrientLine(nutrition) {
    if (!nutrition) return '';
    const n = nutrition.nutrients || {};
    const parts = [];
    if (n.caloriesKcal != null) parts.push(`${n.caloriesKcal} kcal`);
    if (n.proteinG != null) parts.push(`${n.proteinG} g protein`);
    if (n.carbohydrateG != null) parts.push(`${n.carbohydrateG} g carbs`);
    if (n.fatG != null) parts.push(`${n.fatG} g fat`);
    if (n.fiberG != null) parts.push(`${n.fiberG} g fiber`);
    return parts.join(' · ');
  }

  function updateMeasurement(form) {
    const mode = form.elements.mode.value;
    const measured = form.querySelector('[data-consumption-measurement]');
    if (measured) measured.hidden = mode !== 'measured';
    const item = selectedFood(form);
    const specifics = specificsFor(item);
    const preview = form.querySelector('[data-nutrition-preview]');
    const status = form.querySelector('[data-consumption-status]');
    if (mode === 'specific' && !specifics) {
      status.textContent = 'This food does not have an exact branded product attached yet. It can still be saved as a general food.';
      status.hidden = false;
    } else if (mode !== 'specific' && status && !status.classList.contains('is-error')) {
      status.hidden = true;
    }
    if (!preview) return;
    if (mode !== 'measured') { preview.innerHTML = ''; return; }
    if (!specifics) {
      preview.innerHTML = '<small>No exact nutrition record is attached yet. You can still record the amount, but nutrients will remain unknown.</small>';
      return;
    }
    const calculated = consumption.calculateNutrition(specifics, form.elements.amount.value, form.elements.unit.value);
    const packageUnits = consumption.purchasedUnitsForAmount(form.elements.amount.value, form.elements.unit.value, specifics);
    preview.innerHTML = calculated
      ? `<strong>${esc(nutrientLine(calculated))}</strong><small>Calculated from ${esc(calculated.grams)} g using the stored exact-product nutrition record.${packageUnits != null ? ` This is about ${esc((packageUnits * 100).toFixed(1))}% of one purchased package.` : ''}</small>`
      : '<small>This serving unit cannot be converted to grams from the available product data. Try grams or ounces for a nutrient calculation.</small>';
  }

  function reduceInventory(productId, amount, unit, specifics) {
    if (!productId) return null;
    let result = null;
    root.MSHStorage.updateState(state => {
      state.food = state.food || {};
      state.food.acquisition = state.food.acquisition || {};
      const lots = Array.isArray(state.food.acquisition.inventoryLots) ? state.food.acquisition.inventoryLots : [];
      let quantity = Number(amount);
      if (!Number.isFinite(quantity) || quantity <= 0) quantity = 1;
      let purchasedUnits = null;
      if (['g','oz'].includes(unit) || (unit === 'serving' && specifics)) {
        purchasedUnits = consumption.purchasedUnitsForAmount(quantity, unit, specifics);
      } else if (['serving','piece','portion'].includes(unit)) {
        purchasedUnits = quantity;
      }
      if (purchasedUnits == null || purchasedUnits <= 0) {
        result = { applied:false, reason:'measurement_not_comparable' };
        return state;
      }
      const adjusted = consumption.consumeFromLots(lots, productId, purchasedUnits);
      state.food.acquisition.inventoryLots = adjusted.lots;
      result = { applied:adjusted.consumed > 0, purchasedUnitsRequested:purchasedUnits, consumed:adjusted.consumed, unfilled:adjusted.remaining, adjustments:adjusted.adjustments };
      return state;
    });
    return result;
  }

  function saveConsumption(form) {
    const item = selectedFood(form);
    if (!item) throw new Error('Choose a food first.');
    let mode = form.elements.mode.value;
    const specifics = specificsFor(item);
    if (mode === 'specific' && !specifics) mode = 'quick';
    const amount = Number(form.elements.amount.value || 1);
    const unit = form.elements.unit.value || 'portion';
    const calculated = mode === 'measured' && specifics ? consumption.calculateNutrition(specifics, amount, unit) : null;
    const inventoryAdjustment = form.elements.reduceInventory.checked
      ? reduceInventory(item.productId, mode === 'quick' ? 1 : amount, mode === 'quick' ? 'portion' : unit, specifics)
      : null;
    const event = consumption.createConsumptionEvent({
      productId:item.productId, foodId:item.foodId, foodName:item.name, mode,
      amount:mode === 'quick' ? null : amount, unit:mode === 'quick' ? 'portion' : unit,
      grams:calculated && calculated.grams, nutrition:calculated && calculated.nutrients,
      mealType:form.elements.mealType.value || null,
      consumedAt:form.elements.consumedAt.value || new Date().toISOString(), inventoryAdjustment
    });
    root.MSHStorage.updateState(state => {
      state.food = state.food || {};
      state.food.consumptionEvents = Array.isArray(state.food.consumptionEvents) ? state.food.consumptionEvents : [];
      state.food.consumptionEvents.push(event);
      return state;
    });
    return event;
  }

  page.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.matches('[data-open-add]')) setTimeout(enhanceAddMenu,0);
    if (button.matches('[data-log-food]')) logForm();
  });
  page.addEventListener('change', event => {
    const form = event.target.closest('[data-consumption-form]');
    if (form) updateMeasurement(form);
  });
  page.addEventListener('input', event => {
    const form = event.target.closest('[data-consumption-form]');
    if (form && (event.target.name === 'amount' || event.target.name === 'unit')) updateMeasurement(form);
  });
  page.addEventListener('submit', event => {
    if (!event.target.matches('[data-consumption-form]')) return;
    event.preventDefault();
    const form = event.target;
    const status = form.querySelector('[data-consumption-status]');
    try {
      const saved = saveConsumption(form);
      open(`${dialogHead('Food logged','This is recorded as something eaten, separately from the purchase record.')}
        <div class="msh-food-acquisition-status"><strong>${esc(saved.foodName)}</strong>${saved.mode === 'measured' && saved.grams != null ? `<br>${esc(saved.grams)} g logged${saved.nutrition && saved.nutrition.caloriesKcal != null ? ` · ${esc(saved.nutrition.caloriesKcal)} kcal` : ''}` : `<br>${esc(saved.mode === 'specific' ? 'Exact product' : 'Quick food record')}`}</div>
        <button class="msh-food-primary" type="button" data-close-dialog>Done</button>`);
    } catch (error) {
      status.textContent = error.message || 'The food could not be saved.';
      status.classList.add('is-error');
      status.hidden = false;
    }
  });
})(window);
