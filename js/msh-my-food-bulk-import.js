/* My Simple Health — bulk inventory entry for My Food */
(function () {
  'use strict';
  const root = document.querySelector('[data-msh-food]');
  if (!root || !window.MSHStorage) return;

  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const now = () => new Date().toISOString();

  function enhance() {
    const header = root.querySelector('.msh-food-header');
    const add = root.querySelector('[data-open-add]');
    if (!header || !add || header.querySelector('[data-bulk-food-import]')) return;

    add.textContent = '＋ Add one';
    const bulk = document.createElement('button');
    bulk.type = 'button';
    bulk.className = 'msh-food-add';
    bulk.dataset.bulkFoodImport = '';
    bulk.textContent = 'Import inventory';
    add.insertAdjacentElement('beforebegin', bulk);
  }

  function openImport() {
    const dialog = root.querySelector('[data-food-dialog]');
    if (!dialog) return;
    dialog.innerHTML = `<div class="msh-food-dialog-card">
      <div class="msh-food-dialog-head">
        <div><h2>Import inventory</h2><p>Add a whole group at once. Paste one item per line, then choose where these items are stored.</p></div>
        <button class="msh-food-close" type="button" data-close-bulk-import aria-label="Close">×</button>
      </div>
      <form class="msh-food-form" data-bulk-inventory-form>
        <label>Items
          <textarea name="items" rows="9" required placeholder="Greek yogurt\nSalmon\nGreen beans\nRice\nCoffee beans"></textarea>
        </label>
        <label>Stored in
          <select name="location">
            <option>Pantry</option>
            <option>Fridge</option>
            <option>Freezer</option>
          </select>
        </label>
        <p class="msh-food-import-note">MSH will reuse foods already in Your Food and add only the missing inventory records.</p>
        <button class="msh-food-primary" type="submit">Add all to inventory</button>
      </form>
    </div>`;
    dialog.hidden = false;
    dialog.querySelector('textarea')?.focus();
  }

  function closeImport() {
    const dialog = root.querySelector('[data-food-dialog]');
    if (dialog) dialog.hidden = true;
  }

  function parseItems(value) {
    return [...new Set(String(value || '')
      .split(/\r?\n/)
      .map(item => item.replace(/^[-•*\d.)\s]+/, '').trim())
      .filter(Boolean))];
  }

  root.addEventListener('click', event => {
    const bulk = event.target.closest('[data-bulk-food-import]');
    if (bulk) { event.preventDefault(); openImport(); return; }
    const close = event.target.closest('[data-close-bulk-import]');
    if (close) { event.preventDefault(); closeImport(); }
  }, true);

  root.addEventListener('submit', event => {
    const form = event.target.closest('[data-bulk-inventory-form]');
    if (!form) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const data = new FormData(form);
    const items = parseItems(data.get('items'));
    const location = String(data.get('location') || 'Pantry');
    if (!items.length) return;

    window.MSHStorage.updateState(state => {
      state.food ||= { foods:[], onHand:[], meals:[], recipes:[], groceries:[] };
      state.food.foods ||= [];
      state.food.onHand ||= [];

      items.forEach(name => {
        let food = state.food.foods.find(item => String(item.name || '').toLowerCase() === name.toLowerCase());
        if (!food) {
          food = {
            id:window.MSHStorage.uid('food'),
            name,
            category:'Other',
            status:'active',
            source:'bulk_import',
            createdAt:now()
          };
          state.food.foods.push(food);
        }
        if (!state.food.onHand.some(item => item.foodId === food.id && item.location === location)) {
          state.food.onHand.push({
            id:window.MSHStorage.uid('stock'),
            foodId:food.id,
            location,
            quantity:'',
            useSoon:false,
            source:'bulk_import',
            createdAt:now()
          });
        }
      });
      return state;
    });

    closeImport();
    const onHandDoor = root.querySelector('[data-view="onhand"]');
    if (onHandDoor) onHandDoor.click();
  }, true);

  const observer = new MutationObserver(enhance);
  observer.observe(root, { childList:true, subtree:true });
  enhance();
})();
