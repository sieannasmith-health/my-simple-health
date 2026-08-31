/* My Simple Health — native bridge only. Imported health values remain in page memory. */
(function (global) {
  'use strict';
  let snapshot = Object.freeze({available:false, connected:false, status:'unavailable', selectedAreas:[], records:[], partialFailures:[], lastSuccessfulSyncAt:null});
  const pending = new Map();
  const nativeHandler = () => global.webkit?.messageHandlers?.mshHealth;
  const publish = next => {
    const records = global.MSHHealthRecords?.normalize(next?.records || snapshot.records) || [];
    snapshot = Object.freeze({...snapshot, ...next, records:Object.freeze(records)});
    global.dispatchEvent?.(new CustomEvent('msh:connected-health-changed', {detail:status()}));
    return status();
  };
  const status = () => ({...snapshot, selectedAreas:[...snapshot.selectedAreas], records:[...snapshot.records], partialFailures:[...snapshot.partialFailures]});
  const request = (action, payload={}) => new Promise((resolve, reject) => {
    const handler = nativeHandler();
    if (!handler) { resolve(publish({available:false,status:'unavailable'})); return; }
    const requestId = global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    pending.set(requestId, {resolve,reject});
    handler.postMessage({action, requestId, ...payload});
  });
  const receive = message => {
    if (!message || typeof message !== 'object') return;
    const result = publish(message.state || message);
    const waiter = pending.get(message.requestId);
    if (waiter) { pending.delete(message.requestId); message.error ? waiter.reject(new Error('Apple Health request failed.')) : waiter.resolve(result); }
  };
  const api = Object.freeze({
    status, records:() => [...snapshot.records], receive,
    refresh:areas => request('status',areas?.length ? {areas} : {}),
    calendarRange:({areas,startDate,endDate}) => request('calendarRange',{areas,startDate,endDate}),
    connect:areas => request('connect',{areas}),
    sync:areas => request('sync',areas?.length ? {areas} : {}),
    disconnect:() => request('disconnect'),
    removeImportedData:() => request('removeImportedData'),
    manage:() => request('manage')
  });
  global.MSHConnectedHealth = api;
  global.MSHConnectedHealthReceive = receive;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global.document) global.addEventListener('DOMContentLoaded', () => {
    const areas = new URLSearchParams(global.location?.search || '').get('view') === 'activity' ? ['movement'] : undefined;
    api.refresh(areas);
  });
})(typeof window !== 'undefined' ? window : globalThis);
