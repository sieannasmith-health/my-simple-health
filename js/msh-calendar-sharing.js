/* My Simple Health — event-based Calendar sharing */
(function () {
  'use strict';

  const root = document.querySelector('[data-msh-calendar]');
  if (!root || !window.MSHStorage) return;

  const PEOPLE_KEY = 'msh_calendar_people_v1';
  let sheet = null;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function uid(prefix) {
    if (window.crypto?.randomUUID) return `${prefix}_${window.crypto.randomUUID()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  }

  function selectedDate() {
    return root.querySelector('[data-date].is-selected')?.dataset.date ||
      root.querySelector('[data-date][aria-current="date"]')?.dataset.date ||
      new Date().toISOString().slice(0,10);
  }

  function getPeople() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PEOPLE_KEY) || '[]');
      return Array.isArray(parsed)
        ? parsed.filter(person => person && typeof person.id === 'string' && typeof person.name === 'string')
        : [];
    } catch (_) {
      return [];
    }
  }

  function savePeople(people) {
    localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
    return people;
  }

  function addPerson(name) {
    const clean = String(name || '').trim().slice(0,80);
    if (!clean) return null;
    const people = getPeople();
    const existing = people.find(person => person.name.toLowerCase() === clean.toLowerCase());
    if (existing) return existing;
    const person = { id: uid('person'), name: clean, createdAt: new Date().toISOString() };
    people.push(person);
    savePeople(people);
    return person;
  }

  function eventLabel(item) {
    if (item.category === 'sexualHealth') return '♡ Sexual health';
    return item.title || 'Calendar event';
  }

  function eventsForSelectedDate() {
    const date = selectedDate();
    const state = MSHStorage.getState();
    return (state.calendar?.events || []).filter(item => item && item.date === date && item.recordStatus !== 'predicted');
  }

  function personOptions(selectedId) {
    const people = getPeople();
    if (!people.length) return '<option value="">Add a person first</option>';
    return `<option value="">Choose person</option>${people.map(person => `<option value="${esc(person.id)}" ${selectedId===person.id?'selected':''}>${esc(person.name)}</option>`).join('')}`;
  }

  function openMainSheet() {
    sheet?.remove();
    const date = selectedDate();
    const people = getPeople();
    const dayEvents = eventsForSelectedDate();
    sheet = document.createElement('div');
    sheet.className = 'msh-calendar-sharing-sheet';
    sheet.innerHTML = `
      <div class="msh-sheet-backdrop" data-close-calendar-share></div>
      <section class="msh-cycle-sheet" role="dialog" aria-modal="true" aria-labelledby="calendar-share-title">
        <header>
          <div><p class="msh-eyebrow">${esc(date)}</p><h2 id="calendar-share-title">Add / Share</h2></div>
          <button type="button" data-close-calendar-share aria-label="Close">×</button>
        </header>

        <div class="msh-cycle-field">
          <span>People</span>
          ${people.length ? `<div class="msh-cycle-chips">${people.map(person => `<span class="msh-button-secondary">${esc(person.name)}</span>`).join('')}</div>` : '<p class="msh-date-action-empty">No one has been added. Adding a person gives them no access by itself.</p>'}
          <button type="button" class="msh-button-secondary" data-calendar-add-person>+ Add person</button>
        </div>

        <div class="msh-cycle-field">
          <span>Shared events</span>
          <button type="button" class="msh-button-secondary" data-calendar-new-shared-event>+ New shared event</button>
          ${dayEvents.length ? dayEvents.map(item => {
            const sharing = item.sharing || {};
            const person = people.find(candidate => candidate.id === sharing.personId);
            const status = sharing.scope === 'shared' && person ? `Shared with ${person.name}` : 'Private';
            return `<button type="button" class="msh-button-secondary" data-calendar-share-existing="${esc(item.id)}"><strong>${esc(eventLabel(item))}</strong><small>${esc(status)}</small></button>`;
          }).join('') : '<p class="msh-date-action-empty">No recorded events on this date yet.</p>'}
        </div>

        <p class="msh-date-action-empty">Your calendar itself stays private. Only the event or recurring series you explicitly share becomes visible to the person you choose.</p>
        <footer><button type="button" class="msh-text-button" data-close-calendar-share>Done</button></footer>
      </section>`;
    root.appendChild(sheet);
  }

  function openAddPersonSheet() {
    sheet.innerHTML = `
      <div class="msh-sheet-backdrop" data-close-calendar-share></div>
      <section class="msh-cycle-sheet" role="dialog" aria-modal="true" aria-labelledby="calendar-person-title">
        <header><div><p class="msh-eyebrow">Sharing</p><h2 id="calendar-person-title">Add person</h2></div><button type="button" data-close-calendar-share aria-label="Close">×</button></header>
        <form data-calendar-person-form>
          <label class="msh-cycle-field">Name<input name="name" required maxlength="80" placeholder="Name or nickname" autocomplete="off"></label>
          <p class="msh-date-action-empty">This only adds them as someone you can choose later. It does not share any events or health information.</p>
          <footer><button type="button" class="msh-text-button" data-calendar-share-back>Back</button><button type="submit" class="msh-button">Add</button></footer>
        </form>
      </section>`;
    sheet.querySelector('input[name="name"]')?.focus();
  }

  function openNewSharedEventSheet() {
    const date = selectedDate();
    sheet.innerHTML = `
      <div class="msh-sheet-backdrop" data-close-calendar-share></div>
      <section class="msh-cycle-sheet" role="dialog" aria-modal="true" aria-labelledby="calendar-new-shared-title">
        <header><div><p class="msh-eyebrow">${esc(date)}</p><h2 id="calendar-new-shared-title">New shared event</h2></div><button type="button" data-close-calendar-share aria-label="Close">×</button></header>
        <form data-calendar-shared-event-form>
          <label class="msh-cycle-field">Event<input name="title" required maxlength="120" placeholder="What are you planning?"></label>
          <label class="msh-cycle-field">Share with<select name="personId" required>${personOptions('')}</select></label>
          <label class="msh-cycle-field">Repeat<select name="recurrence"><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
          <label class="msh-cycle-field">Anything else?<textarea name="detail" rows="3" maxlength="1000" placeholder="Optional"></textarea></label>
          <p class="msh-date-action-empty">Only this event or recurring series is shared. The rest of your calendar remains private.</p>
          <footer><button type="button" class="msh-text-button" data-calendar-share-back>Back</button><button type="submit" class="msh-button">Save shared event</button></footer>
        </form>
      </section>`;
  }

  function openExistingEventSheet(eventId) {
    const state = MSHStorage.getState();
    const item = (state.calendar?.events || []).find(event => event.id === eventId);
    if (!item) return openMainSheet();
    const sharing = item.sharing || { scope: 'private', personId: '', recurrence: 'none' };
    sheet.innerHTML = `
      <div class="msh-sheet-backdrop" data-close-calendar-share></div>
      <section class="msh-cycle-sheet" role="dialog" aria-modal="true" aria-labelledby="calendar-existing-share-title">
        <header><div><p class="msh-eyebrow">Share this event</p><h2 id="calendar-existing-share-title">${esc(eventLabel(item))}</h2></div><button type="button" data-close-calendar-share aria-label="Close">×</button></header>
        <form data-calendar-existing-share-form data-event-id="${esc(item.id)}">
          <label class="msh-cycle-field">Visibility<select name="scope"><option value="private" ${sharing.scope!=='shared'?'selected':''}>Private</option><option value="shared" ${sharing.scope==='shared'?'selected':''}>Shared</option></select></label>
          <label class="msh-cycle-field">Share with<select name="personId">${personOptions(sharing.personId || '')}</select></label>
          <label class="msh-cycle-field">Repeat sharing<select name="recurrence"><option value="none" ${(sharing.recurrence||'none')==='none'?'selected':''}>This event only</option><option value="daily" ${sharing.recurrence==='daily'?'selected':''}>Daily series</option><option value="weekly" ${sharing.recurrence==='weekly'?'selected':''}>Weekly series</option><option value="monthly" ${sharing.recurrence==='monthly'?'selected':''}>Monthly series</option></select></label>
          ${item.category === 'sexualHealth' ? '<p class="msh-date-action-empty"><strong>Sensitive entry:</strong> sharing this requires this explicit event-level choice. It is never shared because another person was added.</p>' : ''}
          <footer><button type="button" class="msh-text-button" data-calendar-share-back>Back</button><button type="submit" class="msh-button">Save</button></footer>
        </form>
      </section>`;
  }

  function saveSharedEvent(form) {
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    const personId = String(data.get('personId') || '');
    const recurrence = String(data.get('recurrence') || 'none');
    if (!title || !getPeople().some(person => person.id === personId)) return;
    const date = selectedDate();
    MSHStorage.updateState(state => {
      state.calendar.events ||= [];
      state.calendar.events.push({
        id: uid('calendar_shared'), date, category: 'life', title,
        detail: String(data.get('detail') || '').trim(),
        recordStatus: 'recorded', informationClass: 'RECORDED',
        sharing: { scope: 'shared', personId, recurrence, explicit: true },
        createdAt: new Date().toISOString()
      });
      return state;
    });
    openMainSheet();
  }

  function saveExistingSharing(form) {
    const eventId = form.dataset.eventId;
    const data = new FormData(form);
    const scope = data.get('scope') === 'shared' ? 'shared' : 'private';
    const personId = scope === 'shared' ? String(data.get('personId') || '') : '';
    const recurrence = scope === 'shared' ? String(data.get('recurrence') || 'none') : 'none';
    if (scope === 'shared' && !getPeople().some(person => person.id === personId)) return;
    MSHStorage.updateState(state => {
      const item = (state.calendar.events || []).find(event => event.id === eventId);
      if (item) item.sharing = { scope, personId, recurrence, explicit: true };
      return state;
    });
    openMainSheet();
  }

  function syncEntryPoint() {
    const inspector = root.querySelector('.msh-date-inspector');
    if (!inspector) return;
    let holder = inspector.querySelector('[data-calendar-sharing-entry]');
    if (!holder) {
      holder = document.createElement('div');
      holder.dataset.calendarSharingEntry = '';
      holder.className = 'msh-date-actions';
      inspector.appendChild(holder);
    }
    holder.innerHTML = '<button type="button" class="msh-button-secondary" data-open-calendar-share>+ Add / Share</button>';
  }

  root.addEventListener('click', event => {
    if (event.target.closest('[data-open-calendar-share]')) { event.preventDefault(); openMainSheet(); return; }
    if (event.target.closest('[data-calendar-add-person]')) { event.preventDefault(); openAddPersonSheet(); return; }
    if (event.target.closest('[data-calendar-new-shared-event]')) { event.preventDefault(); openNewSharedEventSheet(); return; }
    const existing = event.target.closest('[data-calendar-share-existing]');
    if (existing) { event.preventDefault(); openExistingEventSheet(existing.dataset.calendarShareExisting); return; }
    if (event.target.closest('[data-calendar-share-back]')) { event.preventDefault(); openMainSheet(); return; }
    if (event.target.closest('[data-close-calendar-share]')) { event.preventDefault(); sheet?.remove(); sheet = null; }
  });

  root.addEventListener('submit', event => {
    if (event.target.matches('[data-calendar-person-form]')) {
      event.preventDefault();
      addPerson(new FormData(event.target).get('name'));
      openMainSheet();
      return;
    }
    if (event.target.matches('[data-calendar-shared-event-form]')) {
      event.preventDefault(); saveSharedEvent(event.target); return;
    }
    if (event.target.matches('[data-calendar-existing-share-form]')) {
      event.preventDefault(); saveExistingSharing(event.target);
    }
  });

  const observer = new MutationObserver(() => { if (!sheet) syncEntryPoint(); });
  observer.observe(root, { childList: true, subtree: true });

  window.MSHCalendarSharing = Object.freeze({
    getPeople,
    addPerson,
    scopeLabels: Object.freeze({ private: 'Private', shared: 'Shared' })
  });

  syncEntryPoint();
})();