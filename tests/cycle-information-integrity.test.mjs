import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

import { sanitizeJourneyContext } from '../server/hello/sanitizeJourneyContext.js';

const storageSource = await readFile(new URL('../js/msh-storage.js', import.meta.url), 'utf8');
const cycleSource = await readFile(new URL('../js/msh-cycle.js', import.meta.url), 'utf8');
const intelligenceSource = await readFile(new URL('../js/msh-intelligence.js', import.meta.url), 'utf8');

function runtime() {
  const memory = new Map();
  let nextId = 0;
  const sandbox = {
    console,
    Date,
    Math,
    crypto: { randomUUID: () => `cycle-integrity-${++nextId}` },
    localStorage: {
      getItem: key => memory.get(key) || null,
      setItem: (key, value) => memory.set(key, String(value)),
      removeItem: key => memory.delete(key)
    },
    sessionStorage: { removeItem() {} }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(storageSource, sandbox, { filename: 'msh-storage.js' });
  vm.runInNewContext(cycleSource, sandbox, { filename: 'msh-cycle.js' });
  vm.runInNewContext(intelligenceSource, sandbox, { filename: 'msh-intelligence.js' });
  return sandbox;
}

function seedRecordedHistory(app) {
  for (const start of ['2026-05-01', '2026-05-29', '2026-06-26']) {
    app.MSHCycle.recordPeriod(start, app.MSHCycle.addDays(start, 3), 'medium');
    app.MSHCycle.saveDailyObservation(start, {
      bleeding: 'medium',
      periodMarker: 'start',
      symptoms: ['cramps']
    });
  }
  app.MSHCycle.updatePrivacy({ hello: true, patternAnalysis: true });
}

test('recorded Cycle summaries are personal observations, never predictions or user facts', () => {
  const app = runtime();
  seedRecordedHistory(app);

  const state = app.MSHStorage.getState();
  const items = app.MSHIntelligence.buildContextItems(state);
  const summary = items.find(item => item.source === 'cycle.recordedSummary');
  const pattern = items.find(item => item.source === 'cycle.personalPattern');
  const recent = items.find(item => item.source === 'cycle.recentObservation');

  assert.ok(summary);
  assert.equal(summary.informationClass, 'PERSONAL_OBSERVATION');
  assert.equal(summary.epistemicStatus, 'SYSTEM_OBSERVED');
  assert.notEqual(summary.informationClass, 'ESTIMATED_PREDICTED');

  assert.ok(pattern);
  assert.equal(pattern.informationClass, 'PERSONAL_OBSERVATION');
  assert.equal(pattern.epistemicStatus, 'SYSTEM_OBSERVED');

  assert.ok(recent);
  assert.equal(recent.informationClass, 'RECORDED');
  assert.equal(recent.epistemicStatus, 'USER_STATED');
});

test('actual predictions remain estimated and building Hello context does not mutate recorded history', () => {
  const app = runtime();
  seedRecordedHistory(app);

  const before = app.MSHStorage.getState();
  const recordedHistory = JSON.stringify(before.calendar.events);
  assert.ok(before.calendar.predictions.length > 0);
  assert.ok(before.calendar.predictions.every(item =>
    item.recordStatus === 'predicted' &&
    item.informationClass === 'ESTIMATED_PREDICTED' &&
    item.provenance.status === 'SYSTEM_OBSERVED'
  ));

  app.MSHIntelligence.buildHelloContext(before);

  const after = app.MSHStorage.getState();
  assert.equal(JSON.stringify(after.calendar.events), recordedHistory);
  assert.ok(after.calendar.events.every(item =>
    item.recordStatus === 'recorded' && item.informationClass === 'RECORDED'
  ));
});

test('Hello receives the corrected information class through the sanitized context pipeline', () => {
  const app = runtime();
  seedRecordedHistory(app);

  const clientContext = app.MSHIntelligence.buildHelloContext(app.MSHStorage.getState());
  const sanitized = sanitizeJourneyContext(clientContext);
  const summary = sanitized.contextItems.find(item => item.source === 'cycle.recordedSummary');
  const pattern = sanitized.contextItems.find(item => item.source === 'cycle.personalPattern');

  assert.ok(summary);
  assert.equal(summary.informationClass, 'PERSONAL_OBSERVATION');
  assert.equal(summary.epistemicStatus, 'SYSTEM_OBSERVED');
  assert.equal(summary.knowledgeCategory, 'SYSTEM_OBSERVATION');

  assert.ok(pattern);
  assert.equal(pattern.informationClass, 'PERSONAL_OBSERVATION');
  assert.equal(pattern.epistemicStatus, 'SYSTEM_OBSERVED');
});
