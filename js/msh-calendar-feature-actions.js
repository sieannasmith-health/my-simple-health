/* My Simple Health — Calendar selected-layer action doorways */
(function () {
  'use strict';

  const root = document.querySelector('[data-msh-calendar]');
  if (!root || !window.MSHStorage) return;

  const ACTIONS = Object.freeze({
    movement: { label: 'Add movement', category: 'movement', native: 'movement' },
    cycle: { label: 'Add cycle information', category: 'cycle', native: 'cycle' },
    symptoms: { label: 'Add symptoms', category: 'symptom', title: 'Symptoms' },
    medications: { label: 'Add medication', category: 'medication', title: 'Medication' },
    sexualHealth: { label: 'Add sexual health information', category: 'sexualHealth', title: 'Sexual health' },
    care: { label: 'Add care or appointment', category: 'care', title: 'Care & appointment' },
    measurements: { label: 'Add measurement', category: 'measurement', title: 'Measurement' },
    life: { label: 'Add life context', category: 'life', title: 'Life context' },
    observations: { label: 'Add observation', category: 'note', title: 'Observation' }
  });

  let genericSheet = null;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function selectedDate() {
    return root.querySelector('[data-date].is-selected')?.dataset.date ||
      root.querySelector('[data-date][aria-current="date"]')?.dataset.date ||
      new Date().toISOString().slice(0, 10);
  }

  function enabledLayers() {
    const state = MSHStorage.getState();
    const layers = state?.calendar?.settings?.layers || {};
    return Object.keys(ACTIONS).filter(key => layers[key] === true);
  }

  function actionMarkup(key) {
    const item = ACTIONS[key];
    if (!item) return '';
    if (item.native === 'movement') return `<button type="button" class="msh-button" data-add-movement>${esc(item.label)}</button>`;
    if (item.native === 'cycle') return `<button type="button" class="msh-button-secondary" data-open-sheet>${esc(item.label)}</button>`;
    return `<button type="button" class="msh-button-secondary" data-add-calendar-layer="${esc(key)}">${esc(item.label)}</button>`;
  }

  function syncDayActions() {
    const inspector = root.querySelector('.msh-date-inspector');
    if (!inspector) return;
    let actions = inspector.querySelector('.msh-date-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'msh-date-actions';
      inspector.appendChild(actions);
    }
    const keys = enabledLayers();
    const markup = keys.length
      ? keys.map(actionMarkup).join('')
      : '<p class="msh-date-action-empty">Choose what you want to use in Customize.</p>';
    if (actions.innerHTML !== markup) actions.innerHTML = markup;
  }

  function openGenericSheet(layerKey) {
    const item = ACTIONS[layerKey];
    if (!item || item.native) return;
    genericSheet?.remove();
    const date = selectedDate();
    genericSheet = document.createElement('div');
    genericSheet.className = 'msh-calendar-generic-entry';
    genericSheet.innerHTML = `
      <div class="msh-sheet-backdrop" data-close-generic-entry></div>
      <section class="msh-cycle-sheet" role="dialog" aria-modal="true" aria-labelledby="generic-entry-title">
        <header>
          <div><p class="msh-eyebrow">${esc(item.title)} · ${esc(date)}</p><h2 id="generic-entry-title">Add ${esc(item.title.toLowerCase())}</h2></div>
          <button type="button" data-close-generic-entry aria-label="Close">×</button>
        </header>
        <form data-generic-calendar-form data-layer="${esc(layerKey)}">
          <label class="msh-cycle-field">What happened?<input name="title" required maxlength="120" placeholder="${esc(item.title)}"></label>
          <label class="msh-cycle-field">Anything else you want to remember?<textarea name="detail" rows="4" maxlength="1000" placeholder="Optional"></textarea></label>
          <footer><button type="button" class="msh-text-button" data-close-generic-entry>Cancel</button><button class="msh-button" type="submit">Save</button></footer>
        </form>
      </section>`;
    root.appendChild(genericSheet);
    genericSheet.querySelector('input[name="title"]')?.focus();
  }

  function saveGeneric(form) {
    const layerKey = form.dataset.layer;
    const item = ACTIONS[layerKey];
    if (!item || item.native) return;
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    const detail = String(data.get('detail') || '').trim();
    if (!title) return;
    const date = selectedDate();
    MSHStorage.updateState(state => {
      state.calendar.events ||= [];
      state.calendar.events.push({
        id: `calendar_${item.category}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        date,
        category: item.category,
        title,
        detail,
        recordStatus: 'recorded',
        informationClass: 'RECORDED',
        createdAt: new Date().toISOString()
      });
      return state;
    });
    genericSheet?.remove();
    genericSheet = null;
    window.MSHFeedback?.emit('record', { source: `calendar-${layerKey}` });
    location.reload();
  }

  root.addEventListener('click', event => {
    const add = event.target.closest('[data-add-calendar-layer]');
    if (add) {
      event.preventDefault();
      openGenericSheet(add.dataset.addCalendarLayer);
      return;
    }
    if (event.target.closest('[data-close-generic-entry]')) {
      event.preventDefault();
      genericSheet?.remove();
      genericSheet = null;
    }
  });

  root.addEventListener('submit', event => {
    if (!event.target.matches('[data-generic-calendar-form]')) return;
    event.preventDefault();
    saveGeneric(event.target);
  });

  root.addEventListener('change', event => {
    if (event.target.matches('[data-calendar-layer]')) {
      window.setTimeout(syncDayActions, 0);
    }
  });

  const observer = new MutationObserver(() => {
    if (!genericSheet) syncDayActions();
  });
  observer.observe(root, { childList: true });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && genericSheet) {
      genericSheet.remove();
      genericSheet = null;
    }
  });

  syncDayActions();
})();