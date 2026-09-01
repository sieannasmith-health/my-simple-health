/* My Simple Health — user-facing sleep projection for imported Apple Health records */
(function (global) {
  'use strict';
  const base = global.MSHHealthRecords;
  if (!base) return;

  const dateKey = record => {
    const value = record.eventEnd || record.eventStart;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(record.eventStart || '').slice(0, 10);
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: record.timezoneIdentifier || undefined,
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(date).reduce((out, part) => ({ ...out, [part.type]: part.value }), {});
      return `${parts.year}-${parts.month}-${parts.day}`;
    } catch (_) {
      return String(record.eventStart || '').slice(0, 10);
    }
  };

  const durationLabel = seconds => {
    const totalMinutes = Math.max(0, Math.round(Number(seconds || 0) / 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (!hours) return `${minutes} min`;
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  };

  function sleepEvent(record) {
    const seconds = Number.isFinite(Number(record.value))
      ? Number(record.value)
      : Math.max(0, (new Date(record.eventEnd) - new Date(record.eventStart)) / 1000);
    return {
      id: record.id,
      date: dateKey(record),
      startAt: record.eventStart,
      endAt: record.eventEnd || '',
      category: 'note',
      title: 'Sleep',
      detail: durationLabel(seconds),
      recordStatus: 'recorded',
      informationClass: 'RECORDED',
      provenance: 'IMPORTED',
      sourceKind: 'apple_health',
      source: record.source
    };
  }

  function calendarEvents(records) {
    const valid = base.normalize(records);
    const sessions = valid.filter(record => record.recordType === 'sleep.session');
    const sessionDays = new Set(sessions.map(dateKey));
    const nonSleep = valid.filter(record => record.recordType !== 'sleep.session' && record.recordType !== 'sleep.interval');
    const fallbackIntervals = valid.filter(record => record.recordType === 'sleep.interval' && !sessionDays.has(dateKey(record)));
    const projected = base.calendarEvents(nonSleep);
    projected.push(...sessions.map(sleepEvent));

    // A session is the preferred user-facing record. If an older database has
    // intervals but no derived session, collapse that night's asleep intervals
    // into one temporary Calendar projection instead of showing every stage.
    const grouped = new Map();
    fallbackIntervals.forEach(record => {
      const stage = record.metadata?.sleepStage;
      if (stage === 'awake' || stage === 'in_bed') return;
      const key = dateKey(record);
      const group = grouped.get(key) || [];
      group.push(record);
      grouped.set(key, group);
    });
    grouped.forEach((items, key) => {
      const start = items.map(item => new Date(item.eventStart)).sort((a,b) => a-b)[0];
      const end = items.map(item => new Date(item.eventEnd || item.eventStart)).sort((a,b) => b-a)[0];
      const seconds = Math.max(0, (end - start) / 1000);
      projected.push(sleepEvent({
        ...items[0],
        id: `sleep-projection:${key}`,
        recordType: 'sleep.session',
        eventStart: start.toISOString(),
        eventEnd: end.toISOString(),
        value: seconds,
        unit: 's'
      }));
    });
    return projected.sort((a,b) => String(a.startAt).localeCompare(String(b.startAt)));
  }

  global.MSHHealthRecords = Object.freeze({ ...base, calendarEvents });
})(typeof window !== 'undefined' ? window : globalThis);
