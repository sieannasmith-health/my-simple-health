/* My Simple Health — Calendar sharing foundation */
(function () {
  'use strict';

  const root = document.querySelector('[data-msh-calendar]');
  if (!root) return;

  const STORAGE_KEY = 'msh_calendar_sharing_v1';
  const DEFAULTS = Object.freeze({
    personName: '',
    sharePeriodUpdates: false,
    transportState: 'local_only'
  });

  let sheet = null;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function getPreferences() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        ...DEFAULTS,
        ...raw,
        personName: typeof raw.personName === 'string' ? raw.personName.trim().slice(0, 80) : '',
        sharePeriodUpdates: raw.sharePeriodUpdates === true,
        transportState: 'local_only'
      };
    } catch (_) {
      return { ...DEFAULTS };
    }
  }

  function savePreferences(next) {
    const clean = {
      personName: String(next.personName || '').trim().slice(0, 80),
      sharePeriodUpdates: next.sharePeriodUpdates === true,
      transportState: 'local_only'
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    return clean;
  }

  function sharingLabel() {
    const prefs = getPreferences();
    return prefs.personName ? `Sharing · ${prefs.personName}` : 'Sharing';
  }

  function syncEntryPoint() {
    const inspector = root.querySelector('.msh-date-inspector');
    if (!inspector) return;
    let entry = inspector.querySelector('[data-calendar-sharing-entry]');
    if (!entry) {
      entry = document.createElement('div');
      entry.dataset.calendarSharingEntry = '';
      entry.className = 'msh-date-actions';
      inspector.appendChild(entry);
    }
    entry.innerHTML = `<button type="button" class="msh-button-secondary" data-open-calendar-sharing>${esc(sharingLabel())}</button>`;
  }

  function openSheet() {
    sheet?.remove();
    const prefs = getPreferences();
    sheet = document.createElement('div');
    sheet.className = 'msh-calendar-sharing-sheet';
    sheet.innerHTML = `
      <div class="msh-sheet-backdrop" data-close-calendar-sharing></div>
      <section class="msh-cycle-sheet" role="dialog" aria-modal="true" aria-labelledby="calendar-sharing-title">
        <header>
          <div>
            <p class="msh-eyebrow">Calendar sharing</p>
            <h2 id="calendar-sharing-title">Share only what you choose.</h2>
          </div>
          <button type="button" data-close-calendar-sharing aria-label="Close">×</button>
        </header>

        <form data-calendar-sharing-form>
          <label class="msh-cycle-field">Person
            <input name="personName" maxlength="80" autocomplete="off" placeholder="Name or nickname" value="${esc(prefs.personName)}">
          </label>

          <div class="msh-cycle-field">
            <span>Privacy levels</span>
            <div class="msh-learning-columns" aria-label="Calendar privacy levels">
              <div><strong>Private</strong><p>Only you.</p></div>
              <div><strong>Shared</strong><p>Visible to the person you choose.</p></div>
              <div><strong>Both of us</strong><p>A shared item either person can use.</p></div>
            </div>
          </div>

          <label class="msh-cycle-toggle">
            <input type="checkbox" name="sharePeriodUpdates" ${prefs.sharePeriodUpdates ? 'checked' : ''}>
            <span>Share period start and end updates</span>
          </label>

          <p class="msh-date-action-empty">Sensitive entries remain private unless you explicitly share them.</p>
          <p class="msh-date-action-empty">This build saves the sharing choices on this device. Account-to-account delivery is the next connection layer.</p>

          <footer>
            <button type="button" class="msh-text-button" data-close-calendar-sharing>Cancel</button>
            <button class="msh-button" type="submit">Save sharing</button>
          </footer>
        </form>
      </section>`;
    root.appendChild(sheet);
  }

  root.addEventListener('click', event => {
    if (event.target.closest('[data-open-calendar-sharing]')) {
      event.preventDefault();
      openSheet();
      return;
    }
    if (event.target.closest('[data-close-calendar-sharing]')) {
      event.preventDefault();
      sheet?.remove();
      sheet = null;
    }
  });

  root.addEventListener('submit', event => {
    if (!event.target.matches('[data-calendar-sharing-form]')) return;
    event.preventDefault();
    const data = new FormData(event.target);
    savePreferences({
      personName: data.get('personName'),
      sharePeriodUpdates: data.get('sharePeriodUpdates') === 'on'
    });
    sheet?.remove();
    sheet = null;
    syncEntryPoint();
    window.MSHFeedback?.emit('record', { source: 'calendar-sharing-preferences' });
  });

  const observer = new MutationObserver(() => {
    if (!sheet) syncEntryPoint();
  });
  observer.observe(root, { childList: true, subtree: true });

  window.MSHCalendarSharing = Object.freeze({
    getPreferences,
    savePreferences,
    scopeForSensitiveEntry: () => 'private',
    scopeLabels: Object.freeze({ private: 'Private', shared: 'Shared', joint: 'Both of us' })
  });

  syncEntryPoint();
})();