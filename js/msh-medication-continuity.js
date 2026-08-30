/* My Simple Health — Medication Continuity MVP */
(function () {
  'use strict';

  const root = document.querySelector('[data-msh-calendar]');
  if (!root || !window.MSHStorage) return;

  const EVENT_TYPE = 'medication_refill_outreach';
  const CHANNEL_LABELS = Object.freeze({
    portal: 'Patient portal',
    secure_message: 'Secure provider message',
    pharmacy: 'Pharmacy',
    other: 'Other connected channel'
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

  function plusDays(dateString, amount) {
    const date = new Date(`${dateString}T12:00:00`);
    date.setDate(date.getDate() + amount);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function buildMessage(event) {
    const continuity = event.continuity || {};
    const medication = event.medication || {};
    const dose = medication.dose ? ` ${medication.dose}` : '';
    const pharmacy = continuity.pharmacy ? ` Please send it to ${continuity.pharmacy}.` : '';
    return `Hi, I’m running low on ${medication.name || 'my medication'}${dose} and need a refill. Could you please send a refill to my pharmacy?${pharmacy} Thank you.`;
  }

  function getEvents() {
    return MSHStorage.getState()?.calendar?.events || [];
  }

  function dueRequests() {
    const today = isoToday();
    return getEvents()
      .filter(event => event && event.type === EVENT_TYPE && event.date <= today)
      .filter(event => ['scheduled', 'ready'].includes(event.continuity?.status || 'scheduled'))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  function approvedRequests() {
    return getEvents()
      .filter(event => event && event.type === EVENT_TYPE)
      .filter(event => event.continuity?.status === 'approved_pending_connection')
      .sort((a, b) => String(b.continuity?.approvedAt || '').localeCompare(String(a.continuity?.approvedAt || '')))
      .slice(0, 2);
  }

  function renderContinuityPanel() {
    root.querySelector('[data-medication-continuity-panel]')?.remove();
    const due = dueRequests();
    const approved = approvedRequests();
    if (!due.length && !approved.length) return;

    const panel = document.createElement('section');
    panel.className = 'msh-medication-continuity-panel';
    panel.dataset.medicationContinuityPanel = '';
    panel.setAttribute('aria-label', 'Medication continuity');

    const dueMarkup = due.map(event => {
      const medication = event.medication || {};
      const message = buildMessage(event);
      return `
        <article class="msh-medication-request" data-medication-request="${esc(event.id)}">
          <div class="msh-medication-request-copy">
            <p class="msh-eyebrow">Refill request ready</p>
            <h2>${esc(medication.name || 'Medication')} needs your approval</h2>
            <p>${esc(message)}</p>
            <p class="msh-medication-request-meta">Scheduled ${esc(event.date)} · ${esc(CHANNEL_LABELS[event.continuity?.channel] || 'Connected provider channel')}</p>
          </div>
          <div class="msh-medication-request-actions">
            <button type="button" class="msh-button" data-approve-medication-request="${esc(event.id)}">Approve request</button>
            <button type="button" class="msh-text-button" data-reschedule-medication-request="${esc(event.id)}">Not today</button>
          </div>
        </article>`;
    }).join('');

    const approvedMarkup = approved.map(event => `
      <article class="msh-medication-request is-approved">
        <div class="msh-medication-request-copy">
          <p class="msh-eyebrow">Approved</p>
          <h2>${esc(event.medication?.name || 'Medication')} refill request is ready to send</h2>
          <p>MSH has recorded your approval. Automatic delivery will use the connected provider channel once that integration is available.</p>
        </div>
      </article>`).join('');

    panel.innerHTML = `<div class="msh-medication-continuity-heading"><p class="msh-eyebrow">Continuity</p><h2>Keep the next step from getting lost.</h2></div>${dueMarkup}${approvedMarkup}`;

    const first = root.firstElementChild;
    if (first) root.insertBefore(panel, first.nextSibling);
    else root.appendChild(panel);
  }

  function openMedicationSheet() {
    sheet?.remove();
    const date = selectedDate();
    const suggestedOutreach = plusDays(date, 23);
    sheet = document.createElement('div');
    sheet.className = 'msh-calendar-generic-entry msh-medication-continuity-sheet';
    sheet.innerHTML = `
      <div class="msh-sheet-backdrop" data-close-medication-continuity></div>
      <section class="msh-cycle-sheet" role="dialog" aria-modal="true" aria-labelledby="medication-continuity-title">
        <header>
          <div><p class="msh-eyebrow">Medication continuity</p><h2 id="medication-continuity-title">Stay ahead of your next refill</h2></div>
          <button type="button" data-close-medication-continuity aria-label="Close">×</button>
        </header>
        <form data-medication-continuity-form>
          <div class="msh-medication-form-grid">
            <label class="msh-cycle-field">Medication<input name="medication" required maxlength="120" placeholder="Medication name"></label>
            <label class="msh-cycle-field">Dose<input name="dose" maxlength="80" placeholder="Optional"></label>
            <label class="msh-cycle-field">When should MSH prepare the refill request?<input name="outreachDate" type="date" required value="${esc(suggestedOutreach)}"></label>
            <label class="msh-cycle-field">Provider<input name="provider" maxlength="120" placeholder="Optional"></label>
            <label class="msh-cycle-field">Pharmacy<input name="pharmacy" maxlength="160" placeholder="Optional"></label>
            <label class="msh-cycle-field">How should the approved request be sent?
              <select name="channel">
                <option value="portal">Patient portal</option>
                <option value="secure_message">Secure provider message</option>
                <option value="pharmacy">Pharmacy</option>
                <option value="other">Other connected channel</option>
              </select>
            </label>
          </div>
          <div class="msh-medication-approval-note">
            <strong>MSH will ask before anything is sent.</strong>
            <span>On the scheduled date, the request will be prepared for you to review and approve.</span>
          </div>
          <footer><button type="button" class="msh-text-button" data-close-medication-continuity>Cancel</button><button class="msh-button" type="submit">Schedule refill outreach</button></footer>
        </form>
      </section>`;
    root.appendChild(sheet);
    sheet.querySelector('input[name="medication"]')?.focus();
  }

  function saveMedicationPlan(form) {
    const data = new FormData(form);
    const medication = String(data.get('medication') || '').trim();
    const dose = String(data.get('dose') || '').trim();
    const outreachDate = String(data.get('outreachDate') || '').trim();
    const provider = String(data.get('provider') || '').trim();
    const pharmacy = String(data.get('pharmacy') || '').trim();
    const channel = String(data.get('channel') || 'portal').trim();
    if (!medication || !/^\d{4}-\d{2}-\d{2}$/.test(outreachDate)) return;

    MSHStorage.updateState(state => {
      state.calendar.events ||= [];
      state.calendar.events.push({
        id: `calendar_medication_continuity_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: EVENT_TYPE,
        date: outreachDate,
        category: 'medication',
        title: `${medication} refill outreach`,
        detail: 'MSH will prepare a refill request for approval.',
        medication: { name: medication, dose: dose || null },
        continuity: {
          status: 'scheduled',
          provider: provider || null,
          pharmacy: pharmacy || null,
          channel: CHANNEL_LABELS[channel] ? channel : 'portal',
          requiresUserApproval: true,
          approvedAt: null,
          sentAt: null
        },
        recordStatus: 'planned',
        informationClass: 'USER_STATED',
        createdAt: new Date().toISOString()
      });
      return state;
    });

    sheet?.remove();
    sheet = null;
    window.MSHFeedback?.emit('record', { source: 'calendar-medication-continuity' });
    renderContinuityPanel();
  }

  function approveRequest(id) {
    MSHStorage.updateState(state => {
      const event = (state.calendar.events || []).find(item => item.id === id && item.type === EVENT_TYPE);
      if (!event) return state;
      event.continuity ||= {};
      event.continuity.status = 'approved_pending_connection';
      event.continuity.approvedAt = new Date().toISOString();
      event.recordStatus = 'approved';
      return state;
    });
    window.MSHFeedback?.emit('complete', { source: 'medication-refill-approval' });
    renderContinuityPanel();
  }

  function rescheduleRequest(id) {
    MSHStorage.updateState(state => {
      const event = (state.calendar.events || []).find(item => item.id === id && item.type === EVENT_TYPE);
      if (!event) return state;
      event.date = plusDays(isoToday(), 1);
      event.continuity ||= {};
      event.continuity.status = 'scheduled';
      return state;
    });
    renderContinuityPanel();
  }

  root.addEventListener('click', event => {
    const medicationAdd = event.target.closest('[data-add-calendar-layer="medications"]');
    if (medicationAdd) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openMedicationSheet();
    }
  }, true);

  root.addEventListener('click', event => {
    const approve = event.target.closest('[data-approve-medication-request]');
    if (approve) {
      event.preventDefault();
      approveRequest(approve.dataset.approveMedicationRequest);
      return;
    }
    const reschedule = event.target.closest('[data-reschedule-medication-request]');
    if (reschedule) {
      event.preventDefault();
      rescheduleRequest(reschedule.dataset.rescheduleMedicationRequest);
      return;
    }
    if (event.target.closest('[data-close-medication-continuity]')) {
      event.preventDefault();
      sheet?.remove();
      sheet = null;
    }
  });

  root.addEventListener('submit', event => {
    if (!event.target.matches('[data-medication-continuity-form]')) return;
    event.preventDefault();
    saveMedicationPlan(event.target);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sheet) {
      sheet.remove();
      sheet = null;
    }
  });

  renderContinuityPanel();
})();
