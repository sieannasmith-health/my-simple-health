/* My Simple Health — provider-neutral imported health record contract and projections */
(function (global) {
  'use strict';
  const TYPES = new Set([
    'movement.workout','movement.step_sample','movement.step_daily_summary','movement.active_energy',
    'movement.exercise_time','movement.distance_walking_running','movement.distance_cycling',
    'movement.distance_swimming','cardio.heart_rate','cardio.resting_heart_rate','body.body_mass',
    'sleep.interval','sleep.session'
  ]);
  const UNITS = new Set(['count','m','kcal','s','beats/min','kg']);
  const isDate = value => typeof value === 'string' && !Number.isNaN(Date.parse(value));

  function validate(record) {
    if (!record || typeof record !== 'object') return false;
    if (!record.id || !TYPES.has(record.recordType) || !isDate(record.eventStart)) return false;
    if (record.eventEnd && !isDate(record.eventEnd)) return false;
    if (!record.source || record.source.provider !== 'apple_health' || !record.source.sourceRecordID) return false;
    if (record.provenance !== 'IMPORTED' || record.informationClass !== 'RECORDED') return false;
    if (record.unit != null && !UNITS.has(record.unit)) return false;
    return record.lifecycleStatus !== 'DELETED';
  }

  function normalize(records) {
    const byKey = new Map();
    (Array.isArray(records) ? records : []).filter(validate).forEach(record => {
      byKey.set(`${record.source.provider}:${record.source.sourceRecordID}`, Object.freeze({...record}));
    });
    return [...byKey.values()];
  }

  function calendarEvents(records) {
    return normalize(records).filter(record => ['movement.workout','sleep.session','sleep.interval','body.body_mass'].includes(record.recordType)).map(record => {
      const date = record.eventStart.slice(0, 10);
      const workout = record.recordType === 'movement.workout';
      const sleep = record.recordType === 'sleep.session' || record.recordType === 'sleep.interval';
      const title = workout ? (record.metadata?.activityName || 'Workout') : sleep ? 'Sleep recorded' : 'Weight recorded';
      const value = record.value == null ? '' : `${Number(record.value).toLocaleString()} ${record.unit || ''}`.trim();
      return {
        id: record.id, date, startAt: record.eventStart, endAt: record.eventEnd || '',
        category: workout ? 'movement' : sleep ? 'note' : 'measurement',
        title, detail: value, recordStatus: 'recorded', informationClass: 'RECORDED',
        provenance: 'IMPORTED', sourceKind: 'apple_health', source: record.source,
        movement: workout ? {status:'completed', origin:'apple_health', activityType:record.metadata?.activityType || '', durationMinutes:record.metadata?.durationSeconds ? Math.round(Number(record.metadata.durationSeconds) / 60) : null} : null
      };
    });
  }

  function dateKey(value, timezoneIdentifier) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezoneIdentifier || undefined,
        year:'numeric', month:'2-digit', day:'2-digit'
      }).formatToParts(date).reduce((result, part) => ({...result, [part.type]:part.value}), {});
      return `${parts.year}-${parts.month}-${parts.day}`;
    } catch (_) {
      const year = date.getFullYear();
      return `${year}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    }
  }

  function recordDay(record) {
    return record.metadata?.day || dateKey(record.eventStart, record.timezoneIdentifier);
  }

  function isDailySummary(record) {
    return record.recordType === 'movement.step_daily_summary' || record.metadata?.summary === 'daily';
  }

  function metricForDay(records, type, day, unit) {
    const matches = records.filter(record => record.recordType === type && recordDay(record) === day && Number.isFinite(Number(record.value)));
    const summaryRecord = matches.find(isDailySummary);
    if (summaryRecord) return Object.freeze({value:Number(summaryRecord.value), unit:summaryRecord.unit || unit, recordIds:[summaryRecord.id], summarized:true});
    const samples = matches.filter(record => !isDailySummary(record));
    if (!samples.length) return null;
    return Object.freeze({value:samples.reduce((sum, record) => sum + Number(record.value), 0), unit, recordIds:samples.map(record=>record.id), summarized:false});
  }

  function intervalMetric(records, types, start, end, metadataValue, unit) {
    if (Number.isFinite(Number(metadataValue))) return Object.freeze({value:Number(metadataValue), unit, recordIds:[], summarized:true});
    const samples = records.filter(record => types.includes(record.recordType) && !isDailySummary(record) && Number.isFinite(Number(record.value)) && new Date(record.eventStart) >= start && new Date(record.eventStart) < end);
    if (!samples.length) return null;
    return Object.freeze({value:samples.reduce((sum, record) => sum + Number(record.value), 0), unit, recordIds:samples.map(record=>record.id), summarized:false});
  }

  function activity(records, options={}) {
    const valid = normalize(records);
    const now = options.now ? new Date(options.now) : new Date();
    const timezone = options.timezoneIdentifier || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const todayKey = dateKey(now, timezone);
    const dayCount = Math.max(1, Math.min(30, Number(options.days) || 30));
    const days = [];
    const cursor = new Date(now); cursor.setHours(12,0,0,0); cursor.setDate(cursor.getDate() - dayCount + 1);
    for (let index=0; index<dayCount; index+=1) {
      const date = new Date(cursor); date.setDate(cursor.getDate()+index);
      const day = dateKey(date, timezone);
      const workouts = valid.filter(record => record.recordType === 'movement.workout' && recordDay(record) === day);
      days.push(Object.freeze({
        day,
        steps:metricForDay(valid,'movement.step_daily_summary',day,'count'),
        activeEnergy:metricForDay(valid,'movement.active_energy',day,'kcal'),
        exerciseTime:metricForDay(valid,'movement.exercise_time',day,'s'),
        distanceWalkingRunning:metricForDay(valid,'movement.distance_walking_running',day,'m'),
        workoutCount:workouts.length,
        workoutDurationSeconds:workouts.reduce((sum, record) => sum + Number(record.metadata?.durationSeconds || (record.eventEnd ? (new Date(record.eventEnd)-new Date(record.eventStart))/1000 : 0)),0)
      }));
    }

    const workouts = valid.filter(record => record.recordType === 'movement.workout').sort((a,b) => b.eventStart.localeCompare(a.eventStart)).map(record => {
      const start = new Date(record.eventStart);
      const end = record.eventEnd ? new Date(record.eventEnd) : new Date(start.getTime()+Number(record.metadata?.durationSeconds || 0)*1000);
      const activityName = record.metadata?.activityName || 'Workout';
      const distanceTypes = /cycl/i.test(activityName) ? ['movement.distance_cycling'] : /swim/i.test(activityName) ? ['movement.distance_swimming'] : ['movement.distance_walking_running'];
      return Object.freeze({
        id:record.id,
        activityName,
        activityType:record.metadata?.activityType || '',
        eventStart:record.eventStart,
        eventEnd:record.eventEnd || '',
        durationSeconds:Number(record.metadata?.durationSeconds || Math.max(0,(end-start)/1000)),
        activeEnergy:intervalMetric(valid,['movement.active_energy'],start,end,record.metadata?.activeEnergyKcal,'kcal'),
        distance:intervalMetric(valid,distanceTypes,start,end,record.metadata?.distanceMeters,'m'),
        source:record.source,
        provenance:record.provenance,
        informationClass:record.informationClass
      });
    });

    const today = days.find(day => day.day === todayKey) || Object.freeze({day:todayKey,steps:null,activeEnergy:null,exerciseTime:null,distanceWalkingRunning:null,workoutCount:0,workoutDurationSeconds:0});
    return Object.freeze({today, days:Object.freeze(days), workouts:Object.freeze(workouts), timezoneIdentifier:timezone});
  }

  function summary(records) {
    const valid = normalize(records);
    const latest = type => valid.filter(item => item.recordType === type).sort((a,b) => b.eventStart.localeCompare(a.eventStart))[0] || null;
    return {
      steps: latest('movement.step_daily_summary'),
      restingHeartRate: latest('cardio.resting_heart_rate'),
      bodyMass: latest('body.body_mass'),
      sleep: latest('sleep.session') || latest('sleep.interval'),
      workout: latest('movement.workout')
    };
  }

  const api = Object.freeze({validate, normalize, calendarEvents, activity, summary});
  global.MSHHealthRecords = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
