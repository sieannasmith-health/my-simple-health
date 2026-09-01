/* My Simple Health — Calendar selected-layer action doorways */
(function () {
  'use strict';

  const root = document.querySelector('[data-msh-calendar]');
  if (!root || !window.MSHStorage) return;

  const ACTIONS = Object.freeze({
    event: { label: 'Add event', category: 'event', title: 'Event', fieldLabel: 'Event', placeholder: 'Birthday, celebration, work, travel…' },
    movement: { label: 'Movement', category: 'movement', native: 'movement' },
    cycle: { label: 'Cycle', category: 'cycle', native: 'cycle' },
    symptoms: { label: 'Symptoms', category: 'symptom', title: 'Symptoms', fieldLabel: 'Symptom', placeholder: 'What are you experiencing?' },
    medications: { label: 'Add medication', category: 'medication', title: 'Medication', fieldLabel: 'Rx Name', placeholder: 'Medication name' },
    sexualHealth: { label: 'Sexual health', category: 'sexualHealth', title: 'Sexual health', special: 'sexualHealth' },
    care: { label: 'Add appointment', category: 'care', title: 'Appointment', fieldLabel: 'Appointment', placeholder: 'Doctor, dentist, therapy, or other care' },
    measurements: { label: 'Measurement', category: 'measurement', title: 'Measurement' },
    observations: { label: 'Add observation', category: 'note', title: 'Observation' }
  });

  const HEALTH_EVENT_KEYS = Object.freeze(['movement', 'cycle', 'symptoms', 'sexualHealth', 'measurements']);

  const SEXUAL_HEALTH_CHOICES = Object.freeze([
    ['libido', 'Libido'],
    ['protected_sex', 'Protected sex'],
    ['unprotected_sex', 'Unprotected sex'],
    ['masturbation', 'Masturbation'],
    ['kissing_intimacy', 'Kissing / intimacy'],
    ['arousal_function', 'Arousal / sexual function'],
    ['orgasm', 'Orgasm'],
    ['pain_discomfort', 'Pain / discomfort'],
    ['other', 'Other sexual activity']
  ]);

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

  function layerSettings() {
    return MSHStorage.getState()?.calendar?.settings?.layers || {};
  }

  function layerEnabled(key) {
    const layers = layerSettings();
    return layers[key] !== false;
  }

  function primaryActionMarkup() {
    const healthEnabled = HEALTH_EVENT_KEYS.some(layerEnabled);
    return [
      `<button type="button" class="msh-button" data-add-calendar-layer="event">Add event</button>`,
      healthEnabled ? `<button type="button" class="msh-button-secondary" data-open-health-event>Add health event</button>` : '',
      layerEnabled('medications') ? `<button type="button" class="msh-button-secondary" data-add-calendar-layer="medications">Add medication</button>` : '',
      layerEnabled('care') ? `<button type="button" class="msh-button-secondary" data-add-calendar-layer="care">Add appointment</button>` : '',
      layerEnabled('observations') ? `<button type="button" class="msh-button-secondary" data-add-calendar-layer="observations">Add observation</button>` : ''
    ].filter(Boolean).join('');
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
    const markup = primaryActionMarkup();
    if (actions.innerHTML !== markup) actions.innerHTML = markup;
  }

  function openHealthEventSheet() {
    genericSheet?.remove();
    const date = selectedDate();
    genericSheet = document.createElement('div');
    genericSheet.className = 'msh-calendar-generic-entry';

    const choices = HEALTH_EVENT_KEYS.filter(layerEnabled).map(key => {
      const item = ACTIONS[key];
      if (item.native === 'movement') {
        return `<button type="button" class="msh-button-secondary" data-add-movement data-close-after-native>${esc(item.label)}</button>`;
      }
      if (item.native === 'cycle') {
        return `<button type="button" class="msh-button-secondary" data-open-sheet data-close-after-native>${esc(item.label)}</button>`;
      }
      return `<button type="button" class="msh-button-secondary" data-add-calendar-layer="${esc(key)}">${esc(item.label)}</button>`;
    }).join('');

    genericSheet.innerHTML = `
      <div class="msh-sheet-backdrop" data-close-generic-entry></div>
      <section class="msh-cycle-sheet" role="dialog" aria-modal="true" aria-labelledby="health-event-title">
        <header>
          <div><p class="msh-eyebrow">Health · ${esc(date)}</p><h2 id="health-event-title">Add health event</h2></div>
          <button type="button" data-close-generic-entry aria-label="Close">×</button>
        </header>
        <div class="msh-cycle-field">
          <span>What would you like to record?</span>
          <div class="msh-cycle-chips" role="group" aria-label="Health event types">${choices}</div>
        </div>
        <footer><button type="button" class="msh-text-button" data-close-generic-entry>Cancel</button></footer>
      </section>`;

    root.appendChild(genericSheet);
  }

  function openSexualHealthSheet(item, date) {
    genericSheet.innerHTML = `
      <div class="msh-sheet-backdrop" data-close-generic-entry></div>
      <section class="msh-cycle-sheet" role="dialog" aria-modal="true" aria-labelledby="generic-entry-title">
        <header>
          <div><p class="msh-eyebrow">${esc(item.title)} · ${esc(date)}</p><h2 id="generic-entry-title">Add sexual health</h2></div>
          <button type="button" data-close-generic-entry aria-label="Close">×</button>
        </header>
        <div class="msh-cycle-field">
          <span>Select what you want to record</span>
          <div class="msh-cycle-chips" role="group" aria-label="Sexual health entries">
            ${SEXUAL_HEALTH_CHOICES.map(([value, label]) => `<button type="button" class="msh-button-secondary" data-sexual-health-choice="${esc(value)}">${esc(label)}</button>`).join('')}
          </div>
        </div>
        <p class="msh-date-action-empty">Your main Calendar will show only a discreet sexual health marker. The specific activity stays inside the saved entry.</p>
        <footer><button type="button" class="msh-text-button" data-close-generic-entry>Cancel</button></footer>
      </section>`;
  }

  function openGenericSheet(layerKey) {
    const item = ACTIONS[layerKey];
    if (!item || item.native) return;
    genericSheet?.remove();
    const date = selectedDate();
    genericSheet = document.createElement('div');
    genericSheet.className = 'msh-calendar-generic-entry';

    if (item.special === 'sexualHealth') {
      openSexualHealthSheet(item, date);
    } else {
      const fieldLabel = item.fieldLabel || 'What happened?';
      const placeholder = item.placeholder || item.title;
      genericSheet.innerHTML = `
        <div class="msh-sheet-backdrop" data-close-generic-entry></div>
        <section class="msh-cycle-sheet" role="dialog" aria-modal="true" aria-labelledby="generic-entry-title">
          <header>
            <div><p class="msh-eyebrow">${esc(item.title)} · ${esc(date)}</p><h2 id="generic-entry-title">Add ${esc(item.title.toLowerCase())}</h2></div>
            <button type="button" data-close-generic-entry aria-label="Close">×</button>
          </header>
          <form data-generic-calendar-form data-layer="${esc(layerKey)}">
            <label class="msh-cycle-field">${esc(fieldLabel)}<input name="title" required maxlength="120" placeholder="${esc(placeholder)}"></label>
            <label class="msh-cycle-field">Anything else you want to remember?<textarea name="detail" rows="4" maxlength="1000" placeholder="Optional"></textarea></label>
            <footer><button type="button" class="msh-text-button" data-close-generic-entry>Cancel</button><button class="msh-button" type="submit">Save</button></footer>
          </form>
        </section>`;
    }

    root.appendChild(genericSheet);
    genericSheet.querySelector('input[name="title"]')?.focus();
  }

  function saveSexualHealth(choice) {
    const selected = SEXUAL_HEALTH_CHOICES.find(([value]) => value === choice);
    if (!selected) return;
    const date = selectedDate();
    const [, label] = selected;
    MSHStorage.updateState(state => {
      state.calendar.events ||= [];
      state.calendar.events.push({
        id: `calendar_sexualHealth_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        date,
        category: 'sexualHealth',
        title: '♡ Sexual health',
        detail: '',
        sexualActivity: choice,
        sexualActivityLabel: label,
        privacyDisplay: 'discreet',
        recordStatus: 'recorded',
        informationClass: 'RECORDED',
        createdAt: new Date().toISOString()
      });
      return state;
    });
    genericSheet?.remove();
    genericSheet = null;
    window.MSHFeedback?.emit('record', { source: 'calendar-sexualHealth' });
    location.reload();
  }

  function saveGeneric(form) {
    const layerKey = form.dataset.layer;
    const item = ACTIONS[layerKey];
    if (!item || item.native || item.special) return;
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
    const openHealth = event.target.closest('[data-open-health-event]');
    if (openHealth) {
      event.preventDefault();
      openHealthEventSheet();
      return;
    }

    const sexualChoice = event.target.closest('[data-sexual-health-choice]');
    if (sexualChoice) {
      event.preventDefault();
      saveSexualHealth(sexualChoice.dataset.sexualHealthChoice);
      return;
    }

    const add = event.target.closest('[data-add-calendar-layer]');
    if (add) {
      event.preventDefault();
      openGenericSheet(add.dataset.addCalendarLayer);
      return;
    }

    if (event.target.closest('[data-close-after-native]')) {
      window.setTimeout(() => {
        genericSheet?.remove();
        genericSheet = null;
      }, 0);
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