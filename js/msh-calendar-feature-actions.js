/* My Simple Health — Calendar selected-layer action doorways */
(function () {
  'use strict';

  const root = document.querySelector('[data-msh-calendar]');
  if (!root || !window.MSHStorage) return;

  const ACTIONS = Object.freeze({
    event: { label: 'Add event', category: 'event', title: 'Event', fieldLabel: 'Event', placeholder: 'Birthday, celebration, work, travel…', detailLabel: 'Notes' },
    movement: { label: 'Movement', category: 'movement', native: 'movement', icon: 'movement' },
    cycle: { label: 'Cycle', category: 'cycle', native: 'cycle', icon: 'cycle' },
    symptoms: { label: 'Symptoms', category: 'symptom', title: 'Symptoms', fieldLabel: 'Symptom', placeholder: 'What are you experiencing?', detailLabel: 'Notes', icon: 'symptoms' },
    medications: { label: 'Add medication', category: 'medication', title: 'Medication', fieldLabel: 'Rx Name', placeholder: 'Medication name', detailLabel: 'Dose, timing, or notes' },
    sexualHealth: { label: 'Sexual health', category: 'sexualHealth', title: 'Sexual health', special: 'sexualHealth', icon: 'sexualHealth' },
    care: { label: 'Add appointment', category: 'care', title: 'Appointment', fieldLabel: 'Appointment', placeholder: 'Doctor, dentist, therapy, or other care', detailLabel: 'Location or notes' },
    measurements: { label: 'Measurement', category: 'measurement', title: 'Measurement', fieldLabel: 'Measurement', placeholder: 'Blood pressure, weight, temperature…', detailLabel: 'Value or notes', icon: 'measurements' },
    observations: { label: 'Add observation', category: 'note', title: 'Observation', fieldLabel: 'Observation', placeholder: 'What did you notice?', detailLabel: 'Notes', allowPhoto: true }
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

  function icon(name, extraClass='') {
    return window.MSHAreaIcons?.svg(name, extraClass) || '';
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

  function healthChoiceMarkup(key) {
    const item = ACTIONS[key];
    const areaIcon = item.icon ? icon(item.icon) : '';
    if (item.native === 'movement') {
      return `<button type="button" class="msh-button-secondary" data-add-movement data-close-after-native>${areaIcon}<span>${esc(item.label)}</span></button>`;
    }
    if (item.native === 'cycle') {
      return `<button type="button" class="msh-button-secondary" data-open-sheet data-close-after-native>${areaIcon}<span>${esc(item.label)}</span></button>`;
    }
    return `<button type="button" class="msh-button-secondary" data-add-calendar-layer="${esc(key)}">${areaIcon}<span>${esc(item.label)}</span></button>`;
  }

  function openHealthEventSheet() {
    genericSheet?.remove();
    const date = selectedDate();
    genericSheet = document.createElement('div');
    genericSheet.className = 'msh-calendar-generic-entry';

    const choices = HEALTH_EVENT_KEYS.filter(layerEnabled).map(healthChoiceMarkup).join('');

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

  function observationPhotoMarkup() {
    return `
      <label class="msh-cycle-field">Photo <span class="msh-date-action-empty">Optional</span>
        <input type="file" name="photo" accept="image/*" capture="environment">
      </label>
      <p class="msh-date-action-empty">Take a photo or choose one from your library. It stays attached to this observation and does not appear on the main Calendar.</p>`;
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
      const fieldLabel = item.fieldLabel || item.title;
      const placeholder = item.placeholder || item.title;
      const detailLabel = item.detailLabel || 'Notes';
      genericSheet.innerHTML = `
        <div class="msh-sheet-backdrop" data-close-generic-entry></div>
        <section class="msh-cycle-sheet" role="dialog" aria-modal="true" aria-labelledby="generic-entry-title">
          <header>
            <div><p class="msh-eyebrow">${esc(item.title)} · ${esc(date)}</p><h2 id="generic-entry-title">Add ${esc(item.title.toLowerCase())}</h2></div>
            <button type="button" data-close-generic-entry aria-label="Close">×</button>
          </header>
          <form data-generic-calendar-form data-layer="${esc(layerKey)}">
            <label class="msh-cycle-field">${esc(fieldLabel)}<input name="title" required maxlength="120" placeholder="${esc(placeholder)}"></label>
            <label class="msh-cycle-field">${esc(detailLabel)}<textarea name="detail" rows="4" maxlength="1000" placeholder="Optional"></textarea></label>
            ${item.allowPhoto ? observationPhotoMarkup() : ''}
            <footer><button type="button" class="msh-text-button" data-close-generic-entry>Cancel</button><button class="msh-button" type="submit">Save</button></footer>
          </form>
        </section>`;
    }

    root.appendChild(genericSheet);
    genericSheet.querySelector('input[name="title"]')?.focus();
  }

  async function observationPhoto(file) {
    if (!file || !file.type?.startsWith('image/')) return null;
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = dataUrl;
    });
    const maxSide = 1280;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      name: file.name || 'observation-photo.jpg',
      type: 'image/jpeg',
      dataUrl: canvas.toDataURL('image/jpeg', 0.78)
    };
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
        title: 'Sexual health',
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

  async function saveGeneric(form) {
    const layerKey = form.dataset.layer;
    const item = ACTIONS[layerKey];
    if (!item || item.native || item.special) return;
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    const detail = String(data.get('detail') || '').trim();
    if (!title) return;
    const date = selectedDate();
    const photoFile = item.allowPhoto ? data.get('photo') : null;
    let photo = null;
    if (photoFile instanceof File && photoFile.size > 0) {
      try {
        photo = await observationPhoto(photoFile);
      } catch (_) {
        photo = null;
      }
    }
    MSHStorage.updateState(state => {
      state.calendar.events ||= [];
      state.calendar.events.push({
        id: `calendar_${item.category}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        date,
        category: item.category,
        title,
        detail,
        photo,
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