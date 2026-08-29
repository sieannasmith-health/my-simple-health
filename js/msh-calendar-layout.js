/* My Simple Health — Calendar layout preferences */
(function () {
  'use strict';

  const root = document.querySelector('[data-msh-calendar]');
  if (!root) return;

  const STORAGE_KEY = 'msh_calendar_layout_v1';
  const DEFAULTS = Object.freeze({ sidePanel: true });
  let applying = false;

  function readPreference() {
    try {
      const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
      return { sidePanel: value.sidePanel !== false };
    } catch (_) {
      return { ...DEFAULTS };
    }
  }

  function savePreference(patch) {
    const next = { ...readPreference(), ...(patch || {}) };
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (_) {}
    apply(next);
    return next;
  }

  function controlMarkup(preference) {
    return `<section class="msh-calendar-layout-settings" data-calendar-layout-settings>
      <p class="msh-calendar-customize-label">Layout</p>
      <h2>Calendar view</h2>
      <p>Choose what stays visible beside the calendar. This changes layout only and never changes your records.</p>
      <label class="msh-calendar-layout-toggle">
        <span><strong>Date side panel</strong><small>Show “What was happening around this time?” beside the calendar.</small></span>
        <input type="checkbox" data-calendar-side-panel ${preference.sidePanel ? 'checked' : ''}>
        <i aria-hidden="true"></i>
      </label>
    </section>`;
  }

  function syncControl(preference) {
    const menu = root.querySelector('[data-calendar-customize] .msh-calendar-customization-menu');
    if (!menu) return;
    let section = menu.querySelector('[data-calendar-layout-settings]');
    if (!section) {
      menu.insertAdjacentHTML('afterbegin', controlMarkup(preference));
      section = menu.querySelector('[data-calendar-layout-settings]');
    }
    const input = section && section.querySelector('[data-calendar-side-panel]');
    if (input) input.checked = preference.sidePanel;
  }

  function apply(preference) {
    if (applying) return;
    applying = true;
    const next = preference || readPreference();
    root.dataset.calendarSidePanel = next.sidePanel ? 'visible' : 'hidden';
    syncControl(next);
    applying = false;
  }

  root.addEventListener('change', event => {
    if (!event.target.matches('[data-calendar-side-panel]')) return;
    savePreference({ sidePanel: event.target.checked });
  });

  const observer = new MutationObserver(() => apply(readPreference()));
  observer.observe(root, { childList: true, subtree: true });

  apply(readPreference());

  window.MSHCalendarLayout = Object.freeze({
    STORAGE_KEY,
    readPreference,
    savePreference,
    apply
  });
})();
