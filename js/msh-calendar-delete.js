/* My Simple Health — delete or remove individual Calendar items */
(function (global) {
  'use strict';

  if (!global.MSHStorage || !global.MSHCalendarData) return;

  const root = document.querySelector('[data-msh-calendar]');
  if (!root) return;

  const baseCalendarData = global.MSHCalendarData;
  let latestVisibleEvents = [];

  function dismissedIds(state) {
    const source = state || global.MSHStorage.getState();
    const ids = source?.settings?.memory?.calendarDismissedEventIds;
    return new Set(Array.isArray(ids) ? ids : []);
  }

  function visibleHealthEvents(args) {
    const result = baseCalendarData.visibleHealthEvents(args);
    const hidden = dismissedIds(args?.state);
    const events = result.events.filter(item => !hidden.has(item.id));
    latestVisibleEvents = events;
    return { ...result, events };
  }

  global.MSHCalendarData = Object.freeze({
    ...baseCalendarData,
    visibleHealthEvents
  });

  function rememberDismissed(id) {
    if (!id) return;
    global.MSHStorage.updateState(state => {
      state.settings ||= {};
      state.settings.memory ||= {};
      const existing = Array.isArray(state.settings.memory.calendarDismissedEventIds)
        ? state.settings.memory.calendarDismissedEventIds
        : [];
      state.settings.memory.calendarDismissedEventIds = [...new Set([...existing, id])].slice(-1000);
      return state;
    });
  }

  function removeOwnedCalendarEvent(id) {
    let removed = false;
    global.MSHStorage.updateState(state => {
      const events = Array.isArray(state.calendar?.events) ? state.calendar.events : [];
      const next = events.filter(item => item.id !== id);
      removed = next.length !== events.length;
      state.calendar.events = next;
      return state;
    });
    return removed;
  }

  function categoryFor(article) {
    const className = [...article.classList].find(name => name.startsWith('is-') && name !== 'is-predicted');
    return className ? className.slice(3) : '';
  }

  function dateFor(article) {
    const direct = article.querySelector('time[datetime]')?.getAttribute('datetime');
    if (direct) return direct.slice(0, 10);
    return root.querySelector('.msh-calendar-day.is-selected[data-date]')?.dataset.date || '';
  }

  function titleFor(article) {
    return article.querySelector('strong')?.textContent?.trim() || 'this item';
  }

  function matchVisibleEvent(article, usedIds) {
    const category = categoryFor(article);
    const date = dateFor(article);
    const title = titleFor(article);
    const match = latestVisibleEvents.find(item =>
      !usedIds.has(item.id) &&
      item.category === category &&
      item.date === date &&
      String(item.title || 'Health observation').trim() === title
    );
    if (match) usedIds.add(match.id);
    return match || null;
  }

  function deleteButton(label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'msh-calendar-delete-button';
    button.setAttribute('aria-label', `Delete ${label}`);
    button.title = 'Delete';
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"/></svg>';
    return button;
  }

  function decorate() {
    const usedIds = new Set();
    root.querySelectorAll('.msh-date-events article, .msh-cycle-timeline article').forEach(article => {
      if (article.dataset.calendarDeleteReady === 'true' || article.classList.contains('is-predicted')) return;
      article.dataset.calendarDeleteReady = 'true';

      const category = categoryFor(article);
      const date = dateFor(article);
      const title = titleFor(article);

      if (category === 'cycle') {
        if (!date) return;
        const button = deleteButton(title);
        button.dataset.deleteCycleDate = date;
        button.dataset.deleteCalendarTitle = title;
        article.append(button);
        return;
      }

      const item = matchVisibleEvent(article, usedIds);
      if (!item?.id) return;
      const button = deleteButton(title);
      button.dataset.deleteCalendarEvent = item.id;
      button.dataset.deleteCalendarTitle = title;
      button.dataset.deleteCalendarSource = item.sourceKind || '';
      article.append(button);
    });
  }

  function refreshCalendar() {
    const selectedView = root.querySelector('[data-view][aria-selected="true"]');
    if (selectedView) {
      selectedView.click();
      return;
    }
    const selectedDate = root.querySelector('.msh-calendar-day.is-selected[data-date]');
    selectedDate?.click();
  }

  function confirmDelete(title, sourceKind) {
    if (sourceKind === 'apple_health') {
      return global.confirm(`Remove “${title}” from this Calendar?\n\nThe original Apple Health record will stay in Apple Health.`);
    }
    if (['progress', 'practice', 'project'].includes(sourceKind)) {
      return global.confirm(`Remove “${title}” from this Calendar?\n\nIts original My Simple Health record will stay where it was created.`);
    }
    return global.confirm(`Delete “${title}” from Calendar?\n\nThis cannot be undone.`);
  }

  root.addEventListener('click', event => {
    const eventButton = event.target.closest('[data-delete-calendar-event]');
    if (eventButton) {
      event.preventDefault();
      event.stopPropagation();
      const id = eventButton.dataset.deleteCalendarEvent;
      const title = eventButton.dataset.deleteCalendarTitle || 'this item';
      const sourceKind = eventButton.dataset.deleteCalendarSource || '';
      if (!confirmDelete(title, sourceKind)) return;

      if (sourceKind === 'calendar') {
        if (!removeOwnedCalendarEvent(id)) rememberDismissed(id);
      } else {
        rememberDismissed(id);
      }
      refreshCalendar();
      return;
    }

    const cycleButton = event.target.closest('[data-delete-cycle-date]');
    if (cycleButton) {
      event.preventDefault();
      event.stopPropagation();
      const date = cycleButton.dataset.deleteCycleDate;
      const title = cycleButton.dataset.deleteCalendarTitle || 'cycle observation';
      if (!global.confirm(`Delete “${title}” from ${date}?\n\nThis removes the recorded cycle entry for that day and cannot be undone.`)) return;
      global.MSHCycle?.removeDailyObservation(date);
      refreshCalendar();
    }
  }, true);

  const style = document.createElement('style');
  style.textContent = `
    .msh-date-events article[data-calendar-delete-ready="true"],
    .msh-cycle-timeline article[data-calendar-delete-ready="true"] {
      position: relative;
      padding-right: 3.25rem !important;
    }
    .msh-calendar-delete-button {
      appearance: none;
      position: absolute;
      right: .35rem;
      top: 50%;
      transform: translateY(-50%);
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--msh-muted, #8d8d88);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .msh-calendar-delete-button svg {
      width: 19px;
      height: 19px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.7;
      stroke-linecap: round;
      stroke-linejoin: round;
      pointer-events: none;
    }
    .msh-calendar-delete-button:hover,
    .msh-calendar-delete-button:focus-visible {
      background: color-mix(in srgb, currentColor 10%, transparent);
      color: #b33a32;
      outline: none;
    }
    .msh-calendar-delete-button:active {
      background: color-mix(in srgb, #b33a32 14%, transparent);
      color: #b33a32;
    }
    @media (max-width: 600px) {
      .msh-calendar-delete-button { right: .15rem; width: 42px; height: 42px; }
      .msh-date-events article[data-calendar-delete-ready="true"],
      .msh-cycle-timeline article[data-calendar-delete-ready="true"] { padding-right: 3.4rem !important; }
    }
  `;
  document.head.append(style);

  const observer = new MutationObserver(decorate);
  observer.observe(root, { childList: true, subtree: true });
  decorate();
})(typeof window !== 'undefined' ? window : globalThis);
