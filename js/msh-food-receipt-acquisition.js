/* My Simple Health — receipt acquisition workflow */
(function (root) {
  'use strict';

  const page = document.querySelector('[data-msh-food]');
  if (!page) return;

  const STORE_OPTIONS = ['Costco','Meijer','Kroger','Sam\'s Club','Trader Joe\'s','Whole Foods','BJ\'s','Target','Walmart','Aldi','Other'];
  let parsedReceipt = null;

  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  function dialog() { return page.querySelector('[data-food-dialog]'); }
  function dialogHead(title, copy) {
    return `<div class="msh-food-dialog-head"><div><h2>${esc(title)}</h2>${copy ? `<p>${esc(copy)}</p>` : ''}</div><button class="msh-food-close" type="button" data-close-dialog aria-label="Close">×</button></div>`;
  }
  function open(markup) {
    const target = dialog();
    if (!target) return;
    target.innerHTML = `<div class="msh-food-dialog-card msh-food-receipt-dialog">${markup}</div>`;
    target.hidden = false;
  }
  function close() {
    const target = dialog();
    if (target) target.hidden = true;
  }

  function enhanceAddMenu() {
    const actions = dialog() && dialog().querySelector('.msh-food-actions');
    if (!actions || actions.querySelector('[data-add-receipt]')) return;
    const button = document.createElement('button');
    button.className = 'msh-food-action';
    button.type = 'button';
    button.dataset.addReceipt = '';
    button.innerHTML = '🧾 <strong>Add a receipt</strong><br><small>Turn a grocery receipt into one reviewed purchase.</small>';
    actions.appendChild(button);
  }

  function receiptForm() {
    parsedReceipt = null;
    open(`${dialogHead('Add a receipt','Take a photo or upload one. MSH will read it, then you confirm what should enter your food system.')}
      <form class="msh-food-form" data-receipt-form>
        <label>Store
          <select name="store">${STORE_OPTIONS.map(name => `<option>${esc(name)}</option>`).join('')}</select>
        </label>
        <fieldset><legend>Receipt image</legend>
          <label>Take a photo<input type="file" name="cameraReceipt" accept="image/*" capture="environment" data-receipt-image></label>
          <label>Upload a photo<input type="file" name="uploadedReceipt" accept="image/*" data-receipt-image></label>
        </fieldset>
        <img class="msh-food-receipt-preview" data-receipt-preview hidden alt="Receipt preview">
        <p class="msh-food-acquisition-status" data-receipt-status hidden></p>
        <button class="msh-food-primary" type="submit">Read receipt</button>
      </form>`);
  }

  async function imageData(file) {
    if (!file || !file.type.startsWith('image/')) throw new Error('Choose a receipt image.');
    const raw = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('The receipt image could not be opened.'));
      reader.readAsDataURL(file);
    });

    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('The receipt image could not be opened.'));
      element.src = raw;
    });

    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  }

  function money(value) {
    return value == null ? '—' : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value));
  }

  function receiptReview(receipt) {
    parsedReceipt = receipt;
    const items = Array.isArray(receipt.items) ? receipt.items : [];
    const rows = items.map((item, index) => {
      const defaultInclude = item.itemType === 'food' || item.itemType === 'beverage';
      const confidence = item.confidence == null ? 'Unknown confidence' : `${Math.round(Number(item.confidence) * 100)}% read confidence`;
      return `<div class="msh-receipt-line" data-receipt-line="${index}">
        <label class="msh-receipt-include"><input type="checkbox" name="include-${index}" ${defaultInclude ? 'checked' : ''}> Add to food system</label>
        <div class="msh-receipt-line-main">
          <label>Item name<input name="name-${index}" value="${esc(item.normalizedName || item.receiptText || '')}"></label>
          <div class="msh-receipt-line-meta">
            <span>${esc(item.receiptText || 'No printed line')}</span>
            <span>${esc(item.itemType || 'unknown')}</span>
            <span>${esc(confidence)}</span>
          </div>
        </div>
        <div class="msh-receipt-line-price"><strong>${money(item.lineTotal)}</strong><small>${item.quantity == null ? 'Qty not printed' : `Qty ${esc(item.quantity)}`}</small></div>
      </div>`;
    }).join('');

    open(`${dialogHead('Review this receipt','Nothing is added until you confirm it. Unchecked lines remain preserved on the acquisition but do not enter food inventory.')}
      <form class="msh-food-form" data-receipt-review-form>
        <div class="msh-receipt-summary">
          <div><span>Merchant</span><strong>${esc(receipt.merchant || receipt.selectedStore || 'Unknown')}</strong></div>
          <div><span>Date</span><strong>${esc(receipt.purchaseDate || 'Not found')}</strong></div>
          <div><span>Total</span><strong>${money(receipt.total)}</strong></div>
        </div>
        <div class="msh-receipt-lines">${rows || '<p>No line items were readable. You can close this receipt without saving.</p>'}</div>
        ${rows ? '<button class="msh-food-primary" type="submit">Confirm receipt</button>' : ''}
      </form>`);
  }

  function fingerprint(receipt) {
    const source = [
      receipt.merchant || receipt.selectedStore || '', receipt.purchaseDate || '', receipt.total == null ? '' : receipt.total,
      ...(Array.isArray(receipt.items) ? receipt.items.map(item => `${item.receiptText || ''}:${item.lineTotal == null ? '' : item.lineTotal}`) : [])
    ].join('|');
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `receipt_${(hash >>> 0).toString(16)}`;
  }

  function findOrCreateProduct(name, itemType) {
    const app = root.MSHFoodAcquisitionApp;
    const key = String(name || '').trim().toLowerCase();
    const state = app.repository.snapshot();
    let product = state.products.find(candidate => String(candidate.canonicalName || '').trim().toLowerCase() === key);
    if (!product) product = app.repository.addProduct({ canonicalName:name, category:itemType || null });
    return product;
  }

  function projectLegacyFood(product, item) {
    let legacyFoodId = null;
    root.MSHStorage.updateState(state => {
      state.food = state.food || { foods:[], onHand:[], meals:[], recipes:[], groceries:[] };
      state.food.foods = Array.isArray(state.food.foods) ? state.food.foods : [];
      state.food.onHand = Array.isArray(state.food.onHand) ? state.food.onHand : [];
      let food = state.food.foods.find(candidate => candidate.productId === product.id);
      if (!food) {
        food = state.food.foods.find(candidate => String(candidate.name || '').trim().toLowerCase() === String(product.canonicalName || '').trim().toLowerCase());
      }
      if (!food) {
        food = {
          id:root.MSHStorage.uid('food'), productId:product.id, name:product.canonicalName,
          category:product.category || 'Other', status:'active', source:'receipt', createdAt:new Date().toISOString()
        };
        state.food.foods.push(food);
      } else if (!food.productId) {
        food.productId = product.id;
      }
      legacyFoodId = food.id;
      state.food.onHand.push({
        id:root.MSHStorage.uid('stock'), foodId:food.id, location:'Unsorted',
        quantity:item.quantity == null ? '1 purchased unit' : `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`,
        useSoon:false, source:'receipt', createdAt:new Date().toISOString()
      });
      return state;
    });
    return legacyFoodId;
  }

  async function saveReviewedReceipt(form) {
    const app = root.MSHFoodAcquisitionApp;
    if (!app || !parsedReceipt) throw new Error('Food Acquisition is not ready.');

    const items = (parsedReceipt.items || []).map((item, index) => {
      const include = Boolean(form.elements[`include-${index}`] && form.elements[`include-${index}`].checked);
      const confirmedName = String(form.elements[`name-${index}`] && form.elements[`name-${index}`].value || '').trim();
      if (!include) return { ...item, productId:null, resolutionStatus:'unresolved' };
      if (!confirmedName) throw new Error('Every selected receipt line needs an item name.');
      const product = findOrCreateProduct(confirmedName, item.itemType);
      return { ...item, normalizedName:confirmedName, productId:product.id, resolutionStatus:'user_confirmed' };
    });

    const receipt = { ...parsedReceipt, items };
    const sourceRecordId = fingerprint(receipt);
    const result = await app.recordReceipt(receipt, {
      sourceType:'receipt_image', sourceProvider:'msh_receipt_ai', sourceRecordId,
      observedAt:parsedReceipt.parsedAt || new Date().toISOString(), userConfirmed:true
    });

    if (result.status !== 'duplicate') {
      result.acquisition.items.forEach((savedItem, index) => {
        const sourceItem = items[index];
        if (!savedItem.productId || sourceItem.resolutionStatus !== 'user_confirmed') return;
        app.repository.addInventoryLot({
          productId:savedItem.productId,
          acquisitionItemId:savedItem.id,
          quantityAcquired:sourceItem.quantity == null ? 1 : sourceItem.quantity,
          quantityRemaining:sourceItem.quantity == null ? 1 : sourceItem.quantity,
          unit:sourceItem.unit || 'purchased_unit',
          acquiredAt:result.acquisition.acquiredAt,
          storageLocation:null
        });
        const observedPrice = sourceItem.unitPrice != null
          ? sourceItem.unitPrice
          : sourceItem.lineTotal != null && Number(sourceItem.quantity) > 0
            ? Number(sourceItem.lineTotal) / Number(sourceItem.quantity)
            : sourceItem.lineTotal;
        if (observedPrice != null) {
          app.repository.addPriceObservation({
            productId:savedItem.productId,
            merchantId:result.acquisition.merchantId,
            observedAt:result.acquisition.acquiredAt,
            price:observedPrice,
            source:{ sourceType:'receipt_image', sourceProvider:'msh_receipt_ai', sourceRecordId }
          });
        }
        const product = app.repository.snapshot().products.find(candidate => candidate.id === savedItem.productId);
        if (product) projectLegacyFood(product, sourceItem);
      });
    }

    return result;
  }

  page.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.matches('[data-open-add]')) setTimeout(enhanceAddMenu, 0);
    if (button.matches('[data-add-receipt]')) receiptForm();
    if (button.matches('[data-close-dialog]')) close();
  });

  page.addEventListener('change', async event => {
    const input = event.target.closest('[data-receipt-image]');
    if (!input || !input.files || !input.files[0]) return;
    try {
      const data = await imageData(input.files[0]);
      const preview = dialog() && dialog().querySelector('[data-receipt-preview]');
      if (preview) { preview.src = data; preview.hidden = false; preview.dataset.image = data; }
    } catch (error) {
      const status = dialog() && dialog().querySelector('[data-receipt-status]');
      if (status) { status.textContent = error.message; status.hidden = false; }
    }
  });

  page.addEventListener('submit', async event => {
    if (event.target.matches('[data-receipt-form]')) {
      event.preventDefault();
      const form = event.target;
      const status = form.querySelector('[data-receipt-status]');
      const preview = form.querySelector('[data-receipt-preview]');
      if (!preview || !preview.dataset.image) {
        status.textContent = 'Choose or take a receipt photo first.'; status.hidden = false; return;
      }
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true; submit.textContent = 'Reading receipt…';
      status.textContent = 'Reading only what is visible on the receipt…'; status.hidden = false;
      try {
        const response = await fetch('/api/food-receipt', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ image:preview.dataset.image, store:form.elements.store.value })
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.message || 'The receipt could not be read.');
        receiptReview(payload.receipt);
      } catch (error) {
        status.textContent = error.message || 'The receipt could not be read.'; status.hidden = false;
        submit.disabled = false; submit.textContent = 'Read receipt';
      }
      return;
    }

    if (event.target.matches('[data-receipt-review-form]')) {
      event.preventDefault();
      const form = event.target;
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true; submit.textContent = 'Saving receipt…';
      try {
        const result = await saveReviewedReceipt(form);
        const duplicate = result.status === 'duplicate';
        open(`${dialogHead(duplicate ? 'Receipt already saved' : 'Receipt added', duplicate ? 'MSH matched this to an acquisition already in your food history, so it was not counted twice.' : 'The receipt is now one acquisition. Confirmed food lines were connected to inventory and price history.')}
          <div class="msh-food-acquisition-status"><strong>${duplicate ? 'No duplicate inventory was created.' : `${result.acquisition.items.filter(item => item.productId).length} confirmed items added.`}</strong></div>
          <button class="msh-food-primary" type="button" data-close-dialog>Done</button>`);
        parsedReceipt = null;
      } catch (error) {
        submit.disabled = false; submit.textContent = 'Confirm receipt';
        const message = document.createElement('p');
        message.className = 'msh-food-acquisition-status is-error';
        message.textContent = error.message || 'The receipt could not be saved.';
        form.prepend(message);
      }
    }
  });
})(window);
