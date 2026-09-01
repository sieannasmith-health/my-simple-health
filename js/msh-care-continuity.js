/* My Simple Health — Care Continuity MVP */
(function () {
  'use strict';

  const root = document.querySelector('[data-msh-calendar]');
  if (!root || !window.MSHStorage) return;

  const EVENT_TYPE = 'care_followup';
  const CARE_TYPES = Object.freeze({
    appointment: 'Appointment',
    followup: 'Follow-up',
    lab: 'Lab',
    referral: 'Referral',
    preventive: 'Preventive care',
    other: 'Care step'
  });

  let sheet = null;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function isoToday() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function selectedDate() {
    return root.querySelector('[data-date].is-selected')?.dataset.date ||
      root.querySelector('[data-date][aria-current="date"]')?.dataset.date || isoToday();
  }

  function openSheet() {
    sheet?.remove();
    const date = selectedDate();
    sheet = document.createElement('div');
    sheet.className = 'msh-calendar-generic-entry msh-care-continuity-sheet';
    sheet.innerHTML = `
      <div class="msh-sheet-backdrop" data-close-care-continuity></div>
      <section class="msh-cycle-sheet" role="dialog" aria-modal="true" aria-labelledby="care-continuity-title">
        <header>
          <div><p class="msh-eyebrow">Continuity</p><h2 id="care-continuity-title">Keep a care step moving</h2></div>
          <button type="button" data-close-care-continuity aria-label="Close">×</button>
        </header>
        <form data-care-continuity-form>
          <div class="msh-medication-form-grid">
            <label class="msh-cycle-field">Type
              <select name="careType">
                ${Object.entries(CARE_TYPES).map(([value,label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join('')}
              </select>
            </label>
            <label class="msh-cycle-field">What needs to happen?<input name="title" required maxlength="140" placeholder="Schedule follow-up with PCP"></label>
            <label class="msh-cycle-field">When should this come back to you?<input name="dueDate" type="date" required value="${esc(date)}"></label>
            <label class="msh-cycle-field">Who or what are you waiting on?<input name="waitingOn" maxlength="140" placeholder="Optional"></label>
          </div>
          <label class="msh-cycle-field">Anything useful to remember?<textarea name="detail" rows="4" maxlength="1000" placeholder="Optional"></textarea></label>
          <footer><button type="button" class="msh-text-button" data-close-care-continuity>Cancel</button><button class="msh-button" type="submit">Add to Continuity</button></footer>
        </form>
      </section>`;
    root.appendChild(sheet);
    sheet.querySelector('input[name="title"]')?.focus();
  }

  function save(form) {
    const data = new FormData(form);
    const careType = String(data.get('careType') || 'other');
    const title = String(data.get('title') || '').trim();
    const dueDate = String(data.get('dueDate') || '').trim();
    const waitingOn = String(data.get('waitingOn') || '').trim();
    const detail = String(data.get('detail') || '').trim();
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return;

    MSHStorage.updateState(state => {
      state.calendar.events ||= [];
      state.calendar.events.push({
        id: `calendar_care_continuity_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: EVENT_TYPE,
        date: dueDate,
        category: 'care',
        title,
        detail,
        care: { type: CARE_TYPES[careType] ? careType : 'other' },
        continuity: {
          status: waitingOn ? 'waiting' : 'scheduled',
          waitingOn: waitingOn || null,
          atRisk: false,
          resolvedAt: null
        },
        recordStatus: 'planned',
        informationClass: 'USER_STATED',
        createdAt: new Date().toISOString()
      });
      return state;
    });

    sheet?.remove();
    sheet = null;
    document.dispatchEvent(new CustomEvent('msh:continuity-changed'));
    window.MSHFeedback?.emit('record', { source: 'calendar-care-continuity' });
  }

  function updateStatus(id, status) {
    MSHStorage.updateState(state => {
      const item = (state.calendar.events || []).find(event => event.id === id && event.type === EVENT_TYPE);
      if (!item) return state;
      item.continuity ||= {};
      item.continuity.status = status;
      if (status === 'resolved') {
        item.continuity.resolvedAt = new Date().toISOString();
        item.recordStatus = 'resolved';
      } else if (status === 'at_risk') {
        item.continuity.atRisk = true;
      } else {
        item.continuity.atRisk = false;
      }
      return state;
    });
    document.dispatchEvent(new CustomEvent('msh:continuity-changed'));
  }

  root.addEventListener('click', event => {
    const add = event.target.closest('[data-add-calendar-layer="care"]');
    if (add) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openSheet();
      return;
    }
    if (event.target.closest('[data-close-care-continuity]')) {
      event.preventDefault();
      sheet?.remove();
      sheet = null;
      return;
    }
    const resolve = event.target.closest('[data-resolve-care-continuity]');
    if (resolve) {
      event.preventDefault();
      updateStatus(resolve.dataset.resolveCareContinuity, 'resolved');
      return;
    }
    const risk = event.target.closest('[data-risk-care-continuity]');
    if (risk) {
      event.preventDefault();
      updateStatus(risk.dataset.riskCareContinuity, 'at_risk');
    }
  }, true);

  root.addEventListener('submit', event => {
    if (!event.target.matches('[data-care-continuity-form]')) return;
    event.preventDefault();
    save(event.target);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sheet) {
      sheet.remove();
      sheet = null;
    }
  });
})();
