/* My Simple Health — bulk grocery list workflow */
(function (root) {
  'use strict';

  const page = document.querySelector('[data-msh-food]');
  if (!page || !root.MSHStorage) return;

  const selected = new Set();
  let tab = 'list';
  let applying = false;

  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const now = () => new Date().toISOString();

  function getFood() {
    const state = root.MSHStorage.getState();
    return state.food || { foods:[], onHand:[], meals:[], recipes:[], groceries:[] };
  }

  function normalizeGroceries() {
    root.MSHStorage.updateState(state => {
      state.food = state.food || { foods:[], onHand:[], meals:[], recipes:[], groceries:[] };
      state.food.groceries = Array.isArray(state.food.groceries) ? state.food.groceries : [];
      state.food.groceries = state.food.groceries.map(item => ({
        status:'active',
        createdAt:item.createdAt || now(),
        ...item
      }));
      return state;
    });
  }

  function groceryPanel() {
    return Array.from(page.querySelectorAll('.msh-food-panel')).find(panel =>
      panel.querySelector('h2')?.textContent.trim() === 'Grocery List'
    ) || null;
  }

  function itemMeta(item) {
    const pieces = [];
    if (item.quantity) pieces.push(item.quantity);
    if (item.reason) pieces.push(item.reason);
    if (!pieces.length) pieces.push('Added to grocery list');
    return pieces.join(' · ');
  }

  function rows(items, purchased) {
    if (!items.length) return `<div class="msh-grocery-empty">${purchased ? 'Nothing purchased yet.' : 'Your grocery list is clear.'}</div>`;
    return items.map(item => {
      const checked = selected.has(item.id);
      return `<article class="msh-grocery-bulk-row ${checked ? 'is-selected' : ''}" data-grocery-row="${esc(item.id)}">
        <label class="msh-grocery-select" aria-label="Select ${esc(item.name)}">
          <input type="checkbox" data-grocery-select="${esc(item.id)}" ${checked ? 'checked' : ''}>
          <span></span>
        </label>
        <button type="button" class="msh-grocery-item-main" data-grocery-toggle="${esc(item.id)}">
          <strong>${esc(item.name)}</strong>
          <small>${esc(itemMeta(item))}${purchased && item.purchasedAt ? ` · ${esc(new Date(item.purchasedAt).toLocaleDateString())}` : ''}</small>
        </button>
        ${item.estimatedPrice != null ? `<span class="msh-grocery-price">$${Number(item.estimatedPrice).toFixed(2)}</span>` : ''}
      </article>`;
    }).join('');
  }

  function selectionBar(count, purchasedTab) {
    if (!count) return '';
    return `<div class="msh-grocery-selection-bar">
      <strong>${count} selected</strong>
      <div>
        ${!purchasedTab ? `<button type="button" class="msh-food-secondary" data-grocery-share>Share</button>
        <button type="button" class="msh-food-secondary" data-grocery-purchase>Mark purchased</button>` : ''}
        <button type="button" class="msh-food-secondary msh-grocery-danger" data-grocery-delete>Delete</button>
        <button type="button" class="msh-food-secondary" data-grocery-clear-selection>Clear</button>
      </div>
    </div>`;
  }

  function renderBulkPanel() {
    const panel = groceryPanel();
    if (!panel || applying) return;
    applying = true;
    try {
      const food = getFood();
      const all = Array.isArray(food.groceries) ? food.groceries : [];
      const active = all.filter(item => item.status !== 'purchased');
      const purchased = all.filter(item => item.status === 'purchased').sort((a,b) => String(b.purchasedAt || '').localeCompare(String(a.purchasedAt || '')));
      const current = tab === 'purchased' ? purchased : active;
      const count = current.filter(item => selected.has(item.id)).length;

      panel.innerHTML = `<div class="msh-food-panel-head">
        <div><button class="msh-food-secondary" data-view="home">← My Food</button><h2>Grocery List</h2><p>Add several items at once, then select what you want to share, purchase, or remove.</p></div>
        <button type="button" class="msh-food-primary msh-grocery-add-multiple" data-grocery-add-multiple>+ Add multiple</button>
      </div>
      <div class="msh-grocery-tabs" role="tablist" aria-label="Grocery list views">
        <button type="button" class="${tab === 'list' ? 'is-active' : ''}" data-grocery-tab="list">Shopping list <span>${active.length}</span></button>
        <button type="button" class="${tab === 'purchased' ? 'is-active' : ''}" data-grocery-tab="purchased">Purchased <span>${purchased.length}</span></button>
      </div>
      ${selectionBar(count, tab === 'purchased')}
      <div class="msh-grocery-bulk-list">${rows(current, tab === 'purchased')}</div>
      ${tab === 'list' && active.length ? `<div class="msh-grocery-footer-actions"><button type="button" class="msh-food-secondary" data-grocery-select-all>Select all</button><small>${active.length} item${active.length === 1 ? '' : 's'} on your shopping list</small></div>` : ''}`;
    } finally {
      applying = false;
    }
  }

  function openBulkAdd() {
    const dialog = page.querySelector('[data-food-dialog]');
    if (!dialog) return;
    dialog.innerHTML = `<div class="msh-food-dialog-card msh-grocery-bulk-dialog">
      <div class="msh-food-dialog-head"><div><h2>Add multiple groceries</h2><p>Enter one item per line. You can add a quantity after a vertical bar.</p></div><button class="msh-food-close" type="button" data-grocery-close aria-label="Close">×</button></div>
      <form class="msh-food-form" data-grocery-bulk-form>
        <label>Items<textarea name="items" rows="9" required placeholder="Greek yogurt | 32 oz\nEggs | 1 dozen\nBananas | 1 bunch\nBaby spinach | 6 oz"></textarea></label>
        <label>Reason for this group <input name="reason" placeholder="Optional, e.g. Weekly groceries"></label>
        <small class="msh-grocery-form-help">You can paste an entire list here. Blank lines are ignored.</small>
        <button class="msh-food-primary" type="submit">Add all items</button>
      </form>
    </div>`;
    dialog.hidden = false;
    dialog.querySelector('textarea')?.focus();
  }

  function closeBulkDialog() {
    const dialog = page.querySelector('[data-food-dialog]');
    if (dialog) dialog.hidden = true;
  }

  function addMany(form) {
    const data = new FormData(form);
    const reason = String(data.get('reason') || '').trim();
    const lines = String(data.get('items') || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length) return;
    root.MSHStorage.updateState(state => {
      state.food = state.food || { foods:[], onHand:[], meals:[], recipes:[], groceries:[] };
      state.food.groceries = Array.isArray(state.food.groceries) ? state.food.groceries : [];
      lines.forEach(line => {
        const [namePart, ...quantityParts] = line.split('|');
        const name = String(namePart || '').trim();
        if (!name) return;
        state.food.groceries.push({
          id:root.MSHStorage.uid('grocery'),
          name,
          quantity:quantityParts.join('|').trim() || null,
          reason:reason || '',
          status:'active',
          createdAt:now()
        });
      });
      return state;
    });
    closeBulkDialog();
    renderBulkPanel();
  }

  function selectedItems() {
    const food = getFood();
    return (food.groceries || []).filter(item => selected.has(item.id));
  }

  async function shareSelected() {
    const items = selectedItems().filter(item => item.status !== 'purchased');
    if (!items.length) return;
    const text = ['Grocery List', ...items.map(item => `• ${item.name}${item.quantity ? ` — ${item.quantity}` : ''}`)].join('\n');
    if (navigator.share) {
      try { await navigator.share({ title:'Grocery List', text }); return; } catch (error) { if (error?.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(text);
      alert('Selected grocery items copied to the clipboard.');
    } catch (_) {
      prompt('Copy this grocery list:', text);
    }
  }

  function markPurchased() {
    if (!selected.size) return;
    const stamp = now();
    root.MSHStorage.updateState(state => {
      state.food.groceries = (state.food.groceries || []).map(item => selected.has(item.id)
        ? { ...item, status:'purchased', purchasedAt:stamp }
        : item);
      return state;
    });
    selected.clear();
    renderBulkPanel();
  }

  function deleteSelected() {
    if (!selected.size) return;
    root.MSHStorage.updateState(state => {
      state.food.groceries = (state.food.groceries || []).filter(item => !selected.has(item.id));
      return state;
    });
    selected.clear();
    renderBulkPanel();
  }

  page.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.matches('[data-grocery-add-multiple]')) { openBulkAdd(); return; }
    if (button.matches('[data-grocery-close]')) { closeBulkDialog(); return; }
    if (button.dataset.groceryTab) { tab = button.dataset.groceryTab; selected.clear(); renderBulkPanel(); return; }
    if (button.dataset.groceryToggle) {
      const id = button.dataset.groceryToggle;
      selected.has(id) ? selected.delete(id) : selected.add(id);
      renderBulkPanel();
      return;
    }
    if (button.matches('[data-grocery-select-all]')) {
      const active = (getFood().groceries || []).filter(item => item.status !== 'purchased');
      active.forEach(item => selected.add(item.id));
      renderBulkPanel();
      return;
    }
    if (button.matches('[data-grocery-clear-selection]')) { selected.clear(); renderBulkPanel(); return; }
    if (button.matches('[data-grocery-share]')) { shareSelected(); return; }
    if (button.matches('[data-grocery-purchase]')) { markPurchased(); return; }
    if (button.matches('[data-grocery-delete]')) { deleteSelected(); }
  });

  page.addEventListener('change', event => {
    const checkbox = event.target.closest('[data-grocery-select]');
    if (!checkbox) return;
    checkbox.checked ? selected.add(checkbox.dataset.grocerySelect) : selected.delete(checkbox.dataset.grocerySelect);
    renderBulkPanel();
  });

  page.addEventListener('submit', event => {
    if (!event.target.matches('[data-grocery-bulk-form]')) return;
    event.preventDefault();
    addMany(event.target);
  });

  const observer = new MutationObserver(() => {
    if (!applying && groceryPanel() && !groceryPanel().querySelector('.msh-grocery-tabs')) renderBulkPanel();
  });
  observer.observe(page, { childList:true, subtree:true });

  normalizeGroceries();
  renderBulkPanel();
})(window);