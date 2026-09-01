/* My Simple Health — Calendar actions, editing, reminders, and utility row */
(function () {
  'use strict';

  const root = document.querySelector('[data-msh-calendar]');
  if (!root || !window.MSHStorage) return;

  const ACTIONS = Object.freeze({
    event: { label: 'Event', category: 'event', title: 'Event', fieldLabel: 'Event', placeholder: 'Birthday, celebration, work, travel…', noteLabel: 'Notes' },
    movement: { label: 'Movement', category: 'movement', native: 'movement', icon: '↗' },
    cycle: { label: 'Cycle', category: 'cycle', native: 'cycle', icon: '◒' },
    symptoms: { label: 'Symptoms', category: 'symptom', title: 'Symptoms', fieldLabel: 'Symptom', placeholder: 'What are you experiencing?', noteLabel: 'Details', icon: '✦' },
    medications: { label: 'Medication', category: 'medication', title: 'Medication', fieldLabel: 'Rx Name', placeholder: 'Medication name', noteLabel: 'Dose, timing, or note' },
    sexualHealth: { label: 'Sexual health', category: 'sexualHealth', title: 'Sexual health', special: 'sexualHealth', icon: '♡' },
    care: { label: 'Appointment', category: 'care', title: 'Appointment', fieldLabel: 'Appointment', placeholder: 'Doctor, dentist, therapy, or other care', noteLabel: 'Details' },
    measurements: { label: 'Measurement', category: 'measurement', title: 'Measurement', fieldLabel: 'Measurement', placeholder: 'Blood pressure, weight, glucose…', noteLabel: 'Value or note', icon: '⌁' },
    observations: { label: 'Observation', category: 'note', title: 'Observation', fieldLabel: 'Observation', placeholder: 'What did you notice?', noteLabel: 'Notes', special: 'observation' }
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

  function uid(prefix) {
    if (window.crypto?.randomUUID) return `${prefix}_${window.crypto.randomUUID()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
    return layerSettings()[key] !== false;
  }

  function ensureStyles() {
    if (document.getElementById('msh-calendar-action-styles')) return;
    const style = document.createElement('style');
    style.id = 'msh-calendar-action-styles';
    style.textContent = `
      .msh-calendar-utility-row{display:flex;gap:.55rem;align-items:center;flex-wrap:wrap;margin-left:auto}
      .msh-calendar-utility-row button{display:inline-flex;align-items:center;gap:.4rem;min-height:40px}
      .msh-calendar-event-actions{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.75rem;padding-top:.7rem;border-top:1px solid var(--msh-border,rgba(30,35,30,.12))}
      .msh-calendar-event-actions button{font-size:.82rem}
      .msh-calendar-photo-preview{display:block;max-width:100%;max-height:180px;border-radius:12px;margin-top:.65rem;object-fit:cover}
      .msh-calendar-photo-actions{display:flex;gap:.5rem;flex-wrap:wrap}
      .msh-calendar-color-tools{display:grid;gap:.75rem}
      .msh-calendar-color-tools .msh-calendar-color-presets{display:flex;gap:.5rem;flex-wrap:wrap}
      .msh-calendar-color-tools [data-calendar-quick-accent]{display:inline-flex;align-items:center;gap:.4rem}
      .msh-calendar-color-tools [data-calendar-quick-accent] i{width:18px;height:18px;border-radius:50%;background:var(--swatch);border:1px solid rgba(0,0,0,.12)}
      .msh-calendar-reminder-grid{display:grid;gap:.8rem}
    `;
    document.head.appendChild(style);
  }

  function closeSheet() {
    genericSheet?.remove();
    genericSheet = null;
  }

  function makeSheet(title, eyebrow, body) {
    closeSheet();
    genericSheet = document.createElement('div');
    genericSheet.className = 'msh-calendar-generic-entry';
    genericSheet.innerHTML = `
      <div class="msh-sheet-backdrop" data-close-generic-entry></div>
      <section class="msh-cycle-sheet" role="dialog" aria-modal="true">
        <header>
          <div><p class="msh-eyebrow">${esc(eyebrow)}</p><h2>${esc(title)}</h2></div>
          <button type="button" data-close-generic-entry aria-label="Close">×</button>
        </header>
        ${body}
      </section>`;
    root.appendChild(genericSheet);
    return genericSheet;
  }

  function openAddSheet() {
    const date = selectedDate();
    makeSheet('Add to Calendar', date, `
      <div class="msh-cycle-field">
        <span>What are you adding?</span>
        <div class="msh-cycle-chips">
          <button type="button" class="msh-button-secondary" data-add-calendar-layer="event">Event</button>
          ${HEALTH_EVENT_KEYS.some(layerEnabled) ? '<button type="button" class="msh-button-secondary" data-open-health-event>Health event</button>' : ''}
          ${layerEnabled('medications') ? '<button type="button" class="msh-button-secondary" data-add-calendar-layer="medications">Medication</button>' : ''}
          ${layerEnabled('care') ? '<button type="button" class="msh-button-secondary" data-add-calendar-layer="care">Appointment</button>' : ''}
          ${layerEnabled('observations') ? '<button type="button" class="msh-button-secondary" data-add-calendar-layer="observations">Observation</button>' : ''}
        </div>
      </div>
      <footer><button type="button" class="msh-text-button" data-close-generic-entry>Cancel</button></footer>`);
  }

  function openHealthEventSheet() {
    const date = selectedDate();
    const choices = HEALTH_EVENT_KEYS.filter(layerEnabled).map(key => {
      const item = ACTIONS[key];
      const icon = item.icon ? `<span aria-hidden="true">${item.icon}</span>` : '';
      if (item.native === 'movement') return `<button type="button" class="msh-button-secondary" data-add-movement data-close-after-native>${icon}${esc(item.label)}</button>`;
      if (item.native === 'cycle') return `<button type="button" class="msh-button-secondary" data-open-sheet data-close-after-native>${icon}${esc(item.label)}</button>`;
      return `<button type="button" class="msh-button-secondary" data-add-calendar-layer="${esc(key)}">${icon}${esc(item.label)}</button>`;
    }).join('');

    makeSheet('Add health event', `Health · ${date}`, `
      <div class="msh-cycle-field"><span>What would you like to record?</span><div class="msh-cycle-chips">${choices}</div></div>
      <footer><button type="button" class="msh-text-button" data-close-generic-entry>Cancel</button></footer>`);
  }

  function openColorSheet() {
    const state = MSHStorage.getState();
    const preference = window.MSHCalendarAppearance?.getPreference?.(state) || {};
    const presets = window.MSHCalendarAppearance?.PRESETS || [];
    const currentCustom = preference.accentId === 'custom' ? preference.customColor : '#65717a';
    makeSheet('Calendar color', 'Appearance', `
      <div class="msh-calendar-color-tools">
        <p>Choose the accent used by this Calendar view.</p>
        <div class="msh-calendar-color-presets">
          ${presets.map(option => `<button type="button" class="msh-button-secondary" data-calendar-quick-accent="${esc(option.id)}" aria-pressed="${preference.accentId === option.id}"><i style="--swatch:${esc(option.color)}"></i>${esc(option.label)}</button>`).join('')}
        </div>
        <label class="msh-cycle-field">Custom color<input type="color" data-calendar-quick-custom value="${esc(currentCustom)}"></label>
        <button type="button" class="msh-text-button" data-calendar-quick-reset>Reset to default</button>
      </div>
      <footer><button type="button" class="msh-text-button" data-close-generic-entry>Done</button></footer>`);
  }

  function openSexualHealthSheet(item, date, existing) {
    const current = existing?.sexualActivity || '';
    makeSheet(existing ? 'Edit sexual health' : 'Add sexual health', `${item.title} · ${date}`, `
      <div class="msh-cycle-field">
        <span>Select what you want to record</span>
        <div class="msh-cycle-chips" role="group">
          ${SEXUAL_HEALTH_CHOICES.map(([value, label]) => `<button type="button" class="msh-button-secondary" data-sexual-health-choice="${esc(value)}" data-edit-event-id="${esc(existing?.id || '')}" aria-pressed="${current === value}">${esc(label)}</button>`).join('')}
        </div>
      </div>
      <p class="msh-date-action-empty">The main Calendar keeps this entry discreet. The specific activity stays inside the saved entry.</p>
      <footer><button type="button" class="msh-text-button" data-close-generic-entry>Cancel</button></footer>`);
  }

  function readPhoto(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve('');
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('Unable to read image'));
        image.onload = () => {
          const max = 1200;
          const scale = Math.min(1, max / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.78));
        };
        image.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
  }

  function openGenericSheet(layerKey, existingEvent) {
    const item = ACTIONS[layerKey];
    if (!item || item.native) return;
    const date = existingEvent?.date || selectedDate();
    if (item.special === 'sexualHealth') return openSexualHealthSheet(item, date, existingEvent);

    const fieldLabel = item.fieldLabel || item.title;
    const placeholder = item.placeholder || item.title;
    const noteLabel = item.noteLabel || 'Notes';
    const isObservation = item.special === 'observation';
    const timeValue = existingEvent?.startAt ? new Date(existingEvent.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
    makeSheet(existingEvent ? `Edit ${item.title.toLowerCase()}` : `Add ${item.title.toLowerCase()}`, `${item.title} · ${date}`, `
      <form data-generic-calendar-form data-layer="${esc(layerKey)}" data-event-id="${esc(existingEvent?.id || '')}">
        <label class="msh-cycle-field">${esc(fieldLabel)}<input name="title" required maxlength="120" placeholder="${esc(placeholder)}" value="${esc(existingEvent?.title || '')}"></label>
        <div class="msh-movement-fields">
          <label class="msh-cycle-field">Date<input type="date" name="date" required value="${esc(date)}"></label>
          <label class="msh-cycle-field">Time<input type="time" name="time" value="${esc(timeValue)}"></label>
        </div>
        <label class="msh-cycle-field">${esc(noteLabel)}<textarea name="detail" rows="4" maxlength="1000" placeholder="Optional">${esc(existingEvent?.detail || '')}</textarea></label>
        ${isObservation ? `
          <div class="msh-cycle-field">
            <span>Photo</span>
            <div class="msh-calendar-photo-actions">
              <label class="msh-button-secondary">Camera<input hidden type="file" name="photoCamera" accept="image/*" capture="environment"></label>
              <label class="msh-button-secondary">Photo Library<input hidden type="file" name="photoLibrary" accept="image/*"></label>
              ${existingEvent?.photoDataUrl ? '<button type="button" class="msh-text-button" data-remove-observation-photo>Remove photo</button>' : ''}
            </div>
            <img class="msh-calendar-photo-preview" data-observation-photo-preview ${existingEvent?.photoDataUrl ? `src="${esc(existingEvent.photoDataUrl)}"` : 'hidden'} alt="Observation photo preview">
            <input type="hidden" name="photoDataUrl" value="${esc(existingEvent?.photoDataUrl || '')}">
          </div>` : ''}
        <footer><button type="button" class="msh-text-button" data-close-generic-entry>Cancel</button><button class="msh-button" type="submit">${existingEvent ? 'Save changes' : 'Save'}</button></footer>
      </form>`);
    genericSheet.querySelector('input[name="title"]')?.focus();
  }

  function startAt(date, time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) || !/^\d{2}:\d{2}$/.test(String(time || ''))) return '';
    const parsed = new Date(`${date}T${time}:00`);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : '';
  }

  function saveSexualHealth(choice, eventId) {
    const selected = SEXUAL_HEALTH_CHOICES.find(([value]) => value === choice);
    if (!selected) return;
    const [, label] = selected;
    MSHStorage.updateState(state => {
      state.calendar.events ||= [];
      const existing = eventId ? state.calendar.events.find(event => event.id === eventId) : null;
      if (existing) {
        existing.sexualActivity = choice;
        existing.sexualActivityLabel = label;
        existing.updatedAt = new Date().toISOString();
      } else {
        state.calendar.events.push({
          id: uid('calendar_sexualHealth'), date: selectedDate(), category: 'sexualHealth', title: '♡ Sexual health', detail: '',
          sexualActivity: choice, sexualActivityLabel: label, privacyDisplay: 'discreet', recordStatus: 'recorded', informationClass: 'RECORDED', createdAt: new Date().toISOString()
        });
      }
      return state;
    });
    closeSheet();
    location.reload();
  }

  async function saveGeneric(form) {
    const layerKey = form.dataset.layer;
    const item = ACTIONS[layerKey];
    if (!item || item.native || item.special === 'sexualHealth') return;
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    const detail = String(data.get('detail') || '').trim();
    const date = String(data.get('date') || selectedDate());
    const time = String(data.get('time') || '');
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

    let photoDataUrl = String(data.get('photoDataUrl') || '');
    if (item.special === 'observation') {
      const file = data.get('photoCamera')?.size ? data.get('photoCamera') : data.get('photoLibrary');
      if (file?.size) photoDataUrl = await readPhoto(file);
    }

    MSHStorage.updateState(state => {
      state.calendar.events ||= [];
      const existing = form.dataset.eventId ? state.calendar.events.find(event => event.id === form.dataset.eventId) : null;
      if (existing) {
        existing.title = title;
        existing.detail = detail;
        existing.date = date;
        existing.startAt = startAt(date, time);
        if (existing.category === 'movement' && existing.movement) {
          existing.movement.movementLabel = title;
        }
        if (item.special === 'observation') existing.photoDataUrl = photoDataUrl;
        existing.updatedAt = new Date().toISOString();
      } else {
        state.calendar.events.push({
          id: uid(`calendar_${item.category}`), date, category: item.category, title, detail,
          startAt: startAt(date, time), photoDataUrl: item.special === 'observation' ? photoDataUrl : '',
          recordStatus: 'recorded', informationClass: 'RECORDED', createdAt: new Date().toISOString()
        });
      }
      return state;
    });
    closeSheet();
    location.reload();
  }

  function eventForId(eventId) {
    return (MSHStorage.getState()?.calendar?.events || []).find(event => event.id === eventId) || null;
  }

  function layerForEvent(event) {
    if (!event) return '';
    if (event.category === 'event') return 'event';
    if (event.category === 'symptom') return 'symptoms';
    if (event.category === 'medication') return 'medications';
    if (event.category === 'sexualHealth') return 'sexualHealth';
    if (event.category === 'care') return 'care';
    if (event.category === 'measurement') return 'measurements';
    if (event.category === 'note') return 'observations';
    if (event.category === 'movement') return 'event';
    return 'event';
  }

  function openEditEvent(eventId) {
    const item = eventForId(eventId);
    if (!item) return;
    if (item.category === 'sexualHealth') return openGenericSheet('sexualHealth', item);
    const layer = layerForEvent(item);
    const action = ACTIONS[layer] || ACTIONS.event;
    if (item.category === 'movement') {
      const movementLike = { ...item, category: 'event' };
      return openGenericSheet('event', movementLike);
    }
    openGenericSheet(layer, item);
  }

  function openReminderSheet(eventId) {
    const item = eventForId(eventId);
    if (!item) return;
    const reminder = item.reminder || {};
    makeSheet('Reminder', item.title || 'Calendar event', `
      <form data-calendar-reminder-form data-event-id="${esc(eventId)}" class="msh-calendar-reminder-grid">
        <label class="msh-cycle-field">Remind me<select name="leadMinutes">
          <option value="0" ${Number(reminder.leadMinutes) === 0 ? 'selected' : ''}>At the event time</option>
          <option value="30" ${Number(reminder.leadMinutes) === 30 ? 'selected' : ''}>30 minutes before</option>
          <option value="60" ${Number(reminder.leadMinutes) === 60 ? 'selected' : ''}>1 hour before</option>
          <option value="1440" ${Number(reminder.leadMinutes) === 1440 ? 'selected' : ''}>1 day before</option>
          <option value="10080" ${Number(reminder.leadMinutes) === 10080 ? 'selected' : ''}>1 week before</option>
        </select></label>
        <label class="msh-cycle-field">Delivery<select name="delivery">
          <option value="notification" ${reminder.delivery !== 'text' ? 'selected' : ''}>App notification</option>
          <option value="text" ${reminder.delivery === 'text' ? 'selected' : ''}>Text message</option>
        </select></label>
        <label class="msh-cycle-field">Message<textarea name="message" rows="3" maxlength="300" placeholder="Reminder: ${esc(item.title || 'Calendar event')}">${esc(reminder.message || '')}</textarea></label>
        <p class="msh-date-action-empty">App reminders can be scheduled locally. Text reminders are saved as an automation request and require a connected messaging service before they can actually send.</p>
        <footer><button type="button" class="msh-text-button" data-close-generic-entry>Cancel</button><button type="submit" class="msh-button">Save reminder</button></footer>
      </form>`);
  }

  function saveReminder(form) {
    const eventId = form.dataset.eventId;
    const data = new FormData(form);
    MSHStorage.updateState(state => {
      const item = (state.calendar.events || []).find(event => event.id === eventId);
      if (!item) return state;
      const delivery = data.get('delivery') === 'text' ? 'text' : 'notification';
      item.reminder = {
        enabled: true,
        leadMinutes: Number(data.get('leadMinutes') || 0),
        delivery,
        message: String(data.get('message') || '').trim(),
        status: delivery === 'text' ? 'pending_connection' : 'configured',
        explicit: true,
        updatedAt: new Date().toISOString()
      };
      item.updatedAt = new Date().toISOString();
      return state;
    });
    closeSheet();
    location.reload();
  }

  function deleteEvent(eventId) {
    const item = eventForId(eventId);
    if (!item) return;
    if (!window.confirm(`Delete “${item.title || 'this event'}”?`)) return;
    MSHStorage.updateState(state => {
      state.calendar.events = (state.calendar.events || []).filter(event => event.id !== eventId);
      return state;
    });
    location.reload();
  }

  function syncUtilityRow() {
    ensureStyles();
    const controls = root.querySelector('.msh-calendar-view-controls');
    if (!controls) return;
    const customize = controls.querySelector('[data-calendar-customize]');
    if (customize) customize.hidden = true;
    let row = controls.querySelector('.msh-calendar-utility-row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'msh-calendar-utility-row';
      controls.appendChild(row);
    }
    row.innerHTML = `
      <button type="button" class="msh-button-secondary" data-calendar-color aria-label="Change calendar color">◉ <span>Color</span></button>
      <button type="button" class="msh-button" data-calendar-add aria-label="Add to calendar">＋ <span>Add</span></button>
      <button type="button" class="msh-button-secondary" data-open-calendar-share aria-label="Share calendar event">↗ <span>Share</span></button>`;
  }

  function syncDayActions() {
    const actions = root.querySelector('.msh-date-inspector .msh-date-actions');
    if (actions) actions.remove();
  }

  function syncEventActions() {
    const date = selectedDate();
    const stateEvents = (MSHStorage.getState()?.calendar?.events || []).filter(event => event?.date === date && event.recordStatus !== 'predicted');
    const articles = [...root.querySelectorAll('.msh-date-events article')];
    const used = new Set();
    stateEvents.forEach(item => {
      let article = articles.find((candidate, index) => {
        if (used.has(index)) return false;
        const strong = candidate.querySelector('strong')?.textContent?.trim() || '';
        return strong === String(item.title || '').trim();
      });
      if (!article) return;
      const index = articles.indexOf(article);
      used.add(index);
      if (article.querySelector('.msh-calendar-event-actions')) return;
      const actions = document.createElement('div');
      actions.className = 'msh-calendar-event-actions';
      actions.innerHTML = `
        <button type="button" class="msh-text-button" data-calendar-edit-event="${esc(item.id)}">Edit</button>
        <button type="button" class="msh-text-button" data-calendar-share-event="${esc(item.id)}">Share</button>
        <button type="button" class="msh-text-button" data-calendar-remind-event="${esc(item.id)}">Remind</button>
        <button type="button" class="msh-text-button" data-calendar-delete-event="${esc(item.id)}">Delete</button>`;
      article.appendChild(actions);
    });
  }

  function syncUI() {
    syncUtilityRow();
    syncDayActions();
    syncEventActions();
  }

  root.addEventListener('click', event => {
    if (event.target.closest('[data-calendar-color]')) { event.preventDefault(); openColorSheet(); return; }
    if (event.target.closest('[data-calendar-add]')) { event.preventDefault(); openAddSheet(); return; }

    const edit = event.target.closest('[data-calendar-edit-event]');
    if (edit) { event.preventDefault(); openEditEvent(edit.dataset.calendarEditEvent); return; }

    const share = event.target.closest('[data-calendar-share-event]');
    if (share) {
      event.preventDefault();
      if (window.MSHCalendarSharing?.openEvent) window.MSHCalendarSharing.openEvent(share.dataset.calendarShareEvent);
      return;
    }

    const remind = event.target.closest('[data-calendar-remind-event]');
    if (remind) { event.preventDefault(); openReminderSheet(remind.dataset.calendarRemindEvent); return; }

    const remove = event.target.closest('[data-calendar-delete-event]');
    if (remove) { event.preventDefault(); deleteEvent(remove.dataset.calendarDeleteEvent); return; }

    const openHealth = event.target.closest('[data-open-health-event]');
    if (openHealth) { event.preventDefault(); openHealthEventSheet(); return; }

    const sexualChoice = event.target.closest('[data-sexual-health-choice]');
    if (sexualChoice) {
      event.preventDefault();
      saveSexualHealth(sexualChoice.dataset.sexualHealthChoice, sexualChoice.dataset.editEventId || '');
      return;
    }

    const add = event.target.closest('[data-add-calendar-layer]');
    if (add) { event.preventDefault(); openGenericSheet(add.dataset.addCalendarLayer); return; }

    if (event.target.closest('[data-close-after-native]')) {
      window.setTimeout(closeSheet, 0);
      return;
    }

    if (event.target.closest('[data-remove-observation-photo]')) {
      event.preventDefault();
      const form = event.target.closest('form');
      if (form) {
        form.elements.namedItem('photoDataUrl').value = '';
        const preview = form.querySelector('[data-observation-photo-preview]');
        if (preview) { preview.src = ''; preview.hidden = true; }
      }
      return;
    }

    const quickAccent = event.target.closest('[data-calendar-quick-accent]');
    if (quickAccent) {
      event.preventDefault();
      window.MSHCalendarAppearance?.savePreference?.({ accentId: quickAccent.dataset.calendarQuickAccent });
      closeSheet();
      location.reload();
      return;
    }

    if (event.target.closest('[data-calendar-quick-reset]')) {
      event.preventDefault();
      window.MSHCalendarAppearance?.reset?.();
      closeSheet();
      location.reload();
      return;
    }

    if (event.target.closest('[data-close-generic-entry]')) { event.preventDefault(); closeSheet(); }
  });

  root.addEventListener('submit', event => {
    if (event.target.matches('[data-generic-calendar-form]')) {
      event.preventDefault();
      saveGeneric(event.target).catch(() => {});
      return;
    }
    if (event.target.matches('[data-calendar-reminder-form]')) {
      event.preventDefault();
      saveReminder(event.target);
    }
  });

  root.addEventListener('change', event => {
    if (event.target.matches('[data-calendar-quick-custom]')) {
      window.MSHCalendarAppearance?.savePreference?.({ accentId: 'custom', customColor: event.target.value });
      closeSheet();
      location.reload();
      return;
    }
    if (event.target.matches('input[type="file"][name="photoCamera"],input[type="file"][name="photoLibrary"]')) {
      const file = event.target.files?.[0];
      const form = event.target.closest('form');
      if (!file || !form) return;
      readPhoto(file).then(dataUrl => {
        form.elements.namedItem('photoDataUrl').value = dataUrl;
        const preview = form.querySelector('[data-observation-photo-preview]');
        if (preview) { preview.src = dataUrl; preview.hidden = false; }
      }).catch(() => {});
    }
  });

  const observer = new MutationObserver(() => { if (!genericSheet) syncUI(); });
  observer.observe(root, { childList: true, subtree: true });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && genericSheet) closeSheet();
  });

  syncUI();
})();