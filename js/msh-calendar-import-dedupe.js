/* Calendar projection guard: avoid rendering many Apple Health sleep intervals as duplicate day cards. */
(function (global) {
  'use strict';
  const records = global.MSHHealthRecords;
  if (!records || typeof records.calendarEvents !== 'function') return;

  const originalCalendarEvents = records.calendarEvents;

  function calendarEvents(input) {
    const events = originalCalendarEvents(input);
    const seenSleepDays = new Set();

    return events.filter(event => {
      const isImportedSleep = event?.sourceKind === 'apple_health' && event?.title === 'Sleep recorded';
      if (!isImportedSleep) return true;
      const dayKey = event.date || String(event.startAt || '').slice(0, 10);
      if (!dayKey) return true;
      if (seenSleepDays.has(dayKey)) return false;
      seenSleepDays.add(dayKey);
      return true;
    });
  }

  global.MSHHealthRecords = Object.freeze({ ...records, calendarEvents });
})(typeof window !== 'undefined' ? window : globalThis);
