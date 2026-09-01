/* My Simple Health — optional food date / expiration capture */
(function (root) {
  'use strict';

  const page = document.querySelector('[data-msh-food]');
  if (!page || !root.MSHStorage) return;

  const LABELS = [
    ['expiration','Expiration'],
    ['use_by','Use by'],
    ['best_by','Best by'],
    ['best_if_used_by','Best if used by'],
    ['sell_by','Sell by'],
    ['freeze_by','Freeze by'],
    ['packed_on','Packed on'],
    ['manufactured_on','Manufactured on'],
    ['unknown','Other / unclear']
  ];

  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  function dialog() { return page.querySelector('[data-food-dialog]'); }
  function open(markup) {
    const target = dialog();
    if (!target) return;
    target.innerHTML = `<div class="msh-food-dialog-card msh-food-date-dialog">${markup}</div>`;
    target.hidden = false;
  }
  function head(title, copy) {
    return `<div class="msh-food-dialog-head"><div><h2>${esc(title)}</h2>${copy ? `<p>${esc(copy)}</p>` : ''}</div><button class="msh-food-close" type="button" data-close-dialog aria-label="Close">×</button></div>`;
  }

  function foodState() { return root.MSHStorage.getState().food || {}; }
  function productMap(food) {
    const acquisition = food.acquisition || {};
    return Object.fromEntries((acquisition.products || []).map(product => [product.id, product]));
  }

  function datedItems() {
    const food = foodState();
    const products = productMap(food);
    const items = [];
    const acquisition = food.acquisition || {};
    (acquisition.inventoryLots || []).filter(lot => lot.status !== 'depleted').forEach(lot => {
      const product = products[lot.productId];
      items.push({
        targetType:'inventory_lot', targetId:lot.id, productId:lot.productId,
        name:product && product.canonicalName || 'Food item', brand:product && product.brand || null,
        location:lot.storageLocation || null, current:lot.dateLabel || null,
        sortDate:lot.acquiredAt || ''
      });
    });

    (food.onHand || []).forEach(stock => {
      if (stock.productId || items.some(item => item.targetId === stock.inventoryLotId)) return;
      const legacy = (food.foods || []).find(item => item.id === stock.foodId);
      if (!legacy) return;
      items.push({
        targetType:'legacy_stock', targetId:stock.id, productId:legacy.productId || null,
        name:legacy.name || 'Food item', brand:null, location:stock.location || null,
        current:stock.dateLabel || null, sortDate:stock.createdAt || ''
      });
    });

    return items.sort((a,b) => String(b.sortDate).localeCompare(String(a.sortDate)));
  }

  function enhanceAddMenu() {
    const actions = dialog() && dialog().querySelector('.msh-food-actions');
    if (!actions || actions.querySelector('[data-add-food-date]')) return;
    const button = document.createElement('button');
    button.className = 'msh-food-action';
    button.type = 'button';
    button.dataset.addFoodDate = '';
    button.innerHTML = '📅 <strong>Add expiration / date label</strong><br><small>Take a photo or enter the printed date manually.</small>';
    actions.appendChild(button);
  }

  function options(items) {
    return items.map((item,index) => `<option value="${index}">${esc(item.name)}${item.brand ? ` · ${esc(item.brand)}` : ''}${item.location ? ` · ${esc(item.location)}` : ''}</option>`).join('');
  }

  function formMarkup() {
    const items = datedItems();
    open(`${head('Add a food date','Optional. Keep the package wording accurate, then confirm the structured date before it is saved.')}
      <form class="msh-food-form" data-food-date-form>
        <label>Food<select name="itemIndex">${options(items) || '<option value="">No inventory items available</option>'}</select></label>
        <fieldset><legend>How do you want to add it?</legend>
          <label><input type="radio" name="entryMode" value="photo" checked> Take or upload a photo</label>
          <label><input type="radio" name="entryMode" value="manual"> Enter manually</label>
        </fieldset>
        <div data-date-photo>
          <label>Take a picture<input type="file" accept="image/*" capture="environment" data-date-image></label>
          <label>Upload a picture<input type="file" accept="image/*" data-date-image></label>
          <img class="msh-food-date-preview" data-date-preview hidden alt="Food package date label preview">
          <button type="button" class="msh-food-secondary" data-read-food-date>Read date label</button>
        </div>
        <div data-date-entry>
          <label>Printed wording<input name="printedText" placeholder="Best if used by SEP 14 2026"></label>
          <label>Label type<select name="labelType">${LABELS.map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
          <label>Date<input name="normalizedDate" type="date"></label>
          <small>Use the date printed on the package. If the photo is unclear, leave the date blank rather than guessing.</small>
        </div>
        <p class="msh-food-acquisition-status" data-date-status hidden></p>
        <button class="msh-food-primary" type="submit" ${items.length ? '' : 'disabled'}>Save date</button>
      </form>`);
    const form = dialog() && dialog().querySelector('[data-food-date-form]');
    if (form) form._mshDateItems = items;
  }

  async function imageData(file) {
    if (!file || !file.type.startsWith('image/')) throw new Error('Choose a picture of the date label.');
    const raw = await new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('The image could not be opened.'));
      reader.readAsDataURL(file);
    });
    const image = await new Promise((resolve,reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('The image could not be opened.'));
      el.src = raw;
    });
    const maxSide = 1400;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth,image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1,Math.round(image.naturalWidth*scale));
    canvas.height = Math.max(1,Math.round(image.naturalHeight*scale));
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',0.86);
  }

  function applyExtraction(form, extraction) {
    form.elements.printedText.value = extraction.printedText || '';
    form.elements.labelType.value = LABELS.some(([value]) => value === extraction.labelType) ? extraction.labelType : 'unknown';
    form.elements.normalizedDate.value = extraction.normalizedDate || '';
    form.dataset.aiExtracted = 'true';
    form.dataset.aiConfidence = extraction.confidence == null ? '' : String(extraction.confidence);
    form.dataset.aiAmbiguous = extraction.ambiguous ? 'true' : 'false';
    const status = form.querySelector('[data-date-status]');
    if (extraction.ambiguous || !extraction.normalizedDate) {
      status.textContent = extraction.ambiguityReason || 'MSH could not confirm the full date from the image. Review the printed text and enter the date manually if you can read it.';
    } else {
      status.textContent = `MSH read “${extraction.printedText || extraction.normalizedDate}”. Review it, then save.`;
    }
    status.hidden = false;
  }

  function dateFieldForType(type) {
    if (type === 'expiration' || type === 'use_by') return 'expiration';
    if (type === 'best_by' || type === 'best_if_used_by' || type === 'freeze_by') return 'bestBy';
    return null;
  }

  function saveDate(form) {
    const item = form._mshDateItems && form._mshDateItems[Number(form.elements.itemIndex.value)];
    if (!item) throw new Error('Choose a food item.');
    const printedText = String(form.elements.printedText.value || '').trim();
    const labelType = form.elements.labelType.value || 'unknown';
    const normalizedDate = form.elements.normalizedDate.value || null;
    if (!printedText && !normalizedDate) throw new Error('Enter the printed wording or a date.');

    const dateLabel = {
      labelType,
      printedText:printedText || null,
      normalizedDate,
      entryMethod:form.dataset.aiExtracted === 'true' ? 'photo_ai' : 'manual',
      extractionConfidence:form.dataset.aiExtracted === 'true' && form.dataset.aiConfidence !== '' ? Number(form.dataset.aiConfidence) : null,
      wasAmbiguous:form.dataset.aiAmbiguous === 'true',
      provenance:'USER_CONFIRMED',
      confirmedAt:new Date().toISOString()
    };

    root.MSHStorage.updateState(state => {
      state.food = state.food || {};
      if (item.targetType === 'inventory_lot') {
        state.food.acquisition = state.food.acquisition || {};
        state.food.acquisition.inventoryLots = Array.isArray(state.food.acquisition.inventoryLots) ? state.food.acquisition.inventoryLots : [];
        const lot = state.food.acquisition.inventoryLots.find(candidate => candidate.id === item.targetId);
        if (!lot) throw new Error('The inventory item could not be found.');
        lot.dateLabel = dateLabel;
        const dateField = dateFieldForType(labelType);
        if (dateField) lot[dateField] = normalizedDate ? new Date(`${normalizedDate}T12:00:00`).toISOString() : null;
      } else {
        state.food.onHand = Array.isArray(state.food.onHand) ? state.food.onHand : [];
        const stock = state.food.onHand.find(candidate => candidate.id === item.targetId);
        if (!stock) throw new Error('The food item could not be found.');
        stock.dateLabel = dateLabel;
      }
      state.food.dateLabelEvents = Array.isArray(state.food.dateLabelEvents) ? state.food.dateLabelEvents : [];
      state.food.dateLabelEvents.push({
        id:root.MSHStorage.uid('food_date'), targetType:item.targetType, targetId:item.targetId,
        productId:item.productId || null, ...dateLabel
      });
      return state;
    });
    return { item, dateLabel };
  }

  page.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.matches('[data-open-add]')) setTimeout(enhanceAddMenu,0);
    if (button.matches('[data-add-food-date]')) { formMarkup(); return; }
    if (button.matches('[data-read-food-date]')) {
      const form = button.closest('[data-food-date-form]');
      const preview = form && form.querySelector('[data-date-preview]');
      const status = form && form.querySelector('[data-date-status]');
      if (!preview || !preview.dataset.image) {
        status.textContent = 'Take or upload a picture of the printed date first.';
        status.hidden = false;
        return;
      }
      button.disabled = true;
      button.textContent = 'Reading date…';
      try {
        const response = await fetch('/api/food-date-label', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({image:preview.dataset.image})
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.message || 'The date could not be read.');
        applyExtraction(form,payload.extraction);
      } catch (error) {
        status.textContent = error.message || 'The date could not be read.';
        status.hidden = false;
      } finally {
        button.disabled = false;
        button.textContent = 'Read date label';
      }
    }
  });

  page.addEventListener('change', async event => {
    const form = event.target.closest('[data-food-date-form]');
    if (!form) return;
    if (event.target.name === 'entryMode') {
      form.querySelector('[data-date-photo]').hidden = event.target.value !== 'photo';
      if (event.target.value === 'manual') {
        delete form.dataset.aiExtracted;
        delete form.dataset.aiConfidence;
        delete form.dataset.aiAmbiguous;
      }
      return;
    }
    const input = event.target.closest('[data-date-image]');
    if (!input || !input.files || !input.files[0]) return;
    const status = form.querySelector('[data-date-status]');
    try {
      const data = await imageData(input.files[0]);
      const preview = form.querySelector('[data-date-preview]');
      preview.src = data;
      preview.dataset.image = data;
      preview.hidden = false;
    } catch (error) {
      status.textContent = error.message;
      status.hidden = false;
    }
  });

  page.addEventListener('submit', event => {
    if (!event.target.matches('[data-food-date-form]')) return;
    event.preventDefault();
    const form = event.target;
    const status = form.querySelector('[data-date-status]');
    try {
      const saved = saveDate(form);
      const label = LABELS.find(([value]) => value === saved.dateLabel.labelType)?.[1] || 'Date';
      open(`${head('Food date saved','The printed label and the structured date are stored with this inventory item.')}
        <div class="msh-food-acquisition-status"><strong>${esc(saved.item.name)}</strong><br>${esc(label)}${saved.dateLabel.normalizedDate ? ` · ${esc(saved.dateLabel.normalizedDate)}` : ''}${saved.dateLabel.printedText ? `<br>Printed: ${esc(saved.dateLabel.printedText)}` : ''}</div>
        <button class="msh-food-primary" type="button" data-close-dialog>Done</button>`);
    } catch (error) {
      status.textContent = error.message || 'The date could not be saved.';
      status.classList.add('is-error');
      status.hidden = false;
    }
  });
})(window);
