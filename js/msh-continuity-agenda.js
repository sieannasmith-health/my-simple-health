/* My Simple Health — Continuity Agenda */
(function () {
  'use strict';

  const root = document.querySelector('[data-msh-calendar]');
  if (!root || !window.MSHStorage) return;

  const MEDICATION_EVENT = 'medication_refill_outreach';
  const SECTION_ORDER = ['ready', 'waiting', 'risk', 'upcoming', 'resolved'];
  const SECTION_META = Object.freeze({
    ready: { label: 'Ready for you', hint: 'A next step is waiting on you.' },
    waiting: { label: 'Waiting', hint: 'You have done your part. MSH is keeping the thread visible.' },
    risk: { label: 'At risk', hint: 'This step may need attention soon.' },
    upcoming: { label: 'Upcoming', hint: 'Already on the horizon.' },
    resolved: { label: 'Resolved', hint: 'Continuity restored.' }
  });

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function today() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function daysFromToday(dateString) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateString || ''))) return null;
    const start = new Date(`${today()}T12:00:00`);
    const target = new Date(`${dateString}T12:00:00`);
    return Math.round((target - start) / 86400000);
  }

  function niceDate(dateString) {
    if (!dateString) return 'No date';
    const date = new Date(`${dateString}T12:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function classify(event) {
    const continuity = event.continuity || {};
    const status = continuity.status || '';
    if (['resolved', 'completed', 'filled', 'picked_up'].includes(status) || event.recordStatus === 'resolved') return 'resolved';
    if (status === 'approved_pending_connection' || status === 'sent' || status === 'waiting') return 'waiting';
    if (status === 'at_risk' || continuity.atRisk === true) return 'risk';
    const delta = daysFromToday(event.date);
    if (delta != null && delta <= 0 && ['scheduled', 'ready'].includes(status || 'scheduled')) return 'ready';
    return 'upcoming';
  }

  function supportingText(event, section) {
    const continuity = event.continuity || {};
    if (event.type === MEDICATION_EVENT) {
      if (section === 'ready') return 'Refill request is prepared and waiting for approval.';
      if (section === 'waiting') return continuity.sentAt ? 'Request sent. Waiting for the next update.' : 'Approved. Waiting for a connected provider channel.';
      if (section === 'risk') return 'Medication continuity may be interrupted if this is not resolved.';
      if (section === 'resolved') return 'Refill continuity restored.';
      return `Refill outreach scheduled for ${niceDate(event.date)}.`;
    }
    return event.detail || 'A health step is being kept visible in Continuity.';
  }

  function actionMarkup(event, section) {
    if (event.type === MEDICATION_EVENT && section === 'ready') {
      return `<div class="msh-continuity-agenda-actions">
        <button type="button" class="msh-button" data-approve-medication-request="${esc(event.id)}">Approve &amp; send</button>
        <button type="button" class="msh-text-button" data-reschedule-medication-request="${esc(event.id)}">Tomorrow</button>
      </div>`;
    }
    return '';
  }

  function itemMarkup(event, section) {
    const label = event.medication?.name || event.title || 'Health step';
    return `<article class="msh-continuity-agenda-item" data-continuity-state="${section}">
      <div class="msh-continuity-agenda-copy">
        <div class="msh-continuity-agenda-item-topline">
          <span class="msh-continuity-state-pill">${esc(SECTION_META[section].label)}</span>
          <span class="msh-continuity-agenda-date">${esc(niceDate(event.date))}</span>
        </div>
        <h3>${esc(label)}</h3>
        <p>${esc(supportingText(event, section))}</p>
      </div>
      ${actionMarkup(event, section)}
    </article>`;
  }

  function getContinuityEvents() {
    const events = MSHStorage.getState()?.calendar?.events || [];
    return events
      .filter(event => event && (event.continuity || event.type === MEDICATION_EVENT))
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  }

  function render() {
    root.querySelector('[data-continuity-agenda]')?.remove();
    const events = getContinuityEvents();
    const grouped = Object.fromEntries(SECTION_ORDER.map(key => [key, []]));
    events.forEach(event => grouped[classify(event)].push(event));

    const agenda = document.createElement('section');
    agenda.className = 'msh-continuity-agenda';
    agenda.dataset.continuityAgenda = '';
    agenda.setAttribute('aria-label', 'Continuity agenda');

    const sections = SECTION_ORDER
      .filter(key => grouped[key].length)
      .map(key => `<section class="msh-continuity-agenda-group" data-continuity-group="${key}">
        <header><div><p class="msh-eyebrow">${esc(SECTION_META[key].label)}</p><p>${esc(SECTION_META[key].hint)}</p></div><span>${grouped[key].length}</span></header>
        <div class="msh-continuity-agenda-list">${grouped[key].map(event => itemMarkup(event, key)).join('')}</div>
      </section>`).join('');

    agenda.innerHTML = `<div class="msh-continuity-agenda-heading">
      <div><p class="msh-eyebrow">Continuity</p><h2>Agenda</h2><p>What needs attention next, what is already in motion, and what has been resolved.</p></div>
    </div>
    ${sections || '<div class="msh-continuity-agenda-empty"><strong>Nothing needs your attention right now.</strong><span>Future continuity steps will appear here automatically.</span></div>'}`;

    const first = root.firstElementChild;
    if (first) root.insertBefore(agenda, first.nextSibling);
    else root.appendChild(agenda);
  }

  document.addEventListener('msh:continuity-changed', render);
  window.addEventListener('storage', event => { if (event.key === 'msh_data') render(); });

  const observer = new MutationObserver(() => {
    if (!root.querySelector('[data-continuity-agenda]')) render();
  });
  observer.observe(root, { childList: true });

  render();
})();
