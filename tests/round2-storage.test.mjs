import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../js/msh-storage.js', import.meta.url), 'utf8');

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function loadContract() {
  const sandbox = {
    console,
    crypto: { randomUUID: () => 'test-id' },
    localStorage: createStorage(),
    sessionStorage: createStorage()
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'msh-storage.js' });
  return sandbox;
}

test('normalizes every shared collection so cross-page reads cannot break', () => {
  const { MSHStorage } = loadContract();
  const normalized = MSHStorage.normalizeState({ projects: null, practices: {}, settings: null });
  for (const key of ['landscapes','focuses','visionEntries','projects','practices','practiceAttempts','reflections','learningEntries','progressEvents','returnPoints']) {
    assert.equal(Array.isArray(normalized[key]), true, key);
  }
  assert.equal(normalized.schemaVersion, 6);
  assert.deepEqual(Array.from(normalized.calendar.events), []);
  assert.equal(normalized.calendar.privacy.cycleCalendar, true);
});

test('preserves an inference-to-confirmation transition without relabelling its origin', () => {
  const { MSHStorage } = loadContract();
  const inferred = MSHStorage.createProvenance(MSHStorage.PROVENANCE.MODEL_INFERRED, {
    sourceId: 'hello-interpretation-1',
    recordedAt: '2026-08-23T12:00:00.000Z'
  });
  const confirmed = MSHStorage.confirmInference(inferred, {
    confirmedAt: '2026-08-23T12:05:00.000Z',
    editedByUser: true
  });
  assert.equal(confirmed.status, MSHStorage.PROVENANCE.USER_CONFIRMED);
  assert.equal(confirmed.transitions[0].from, MSHStorage.PROVENANCE.MODEL_INFERRED);
  assert.equal(confirmed.transitions[0].to, MSHStorage.PROVENANCE.USER_CONFIRMED);
  assert.equal(confirmed.editedByUser, true);
});

test('migrates a legacy Current Vision without losing the user statement', () => {
  const { MSHStorage } = loadContract();
  const state = MSHStorage.normalizeState({
    visionEntries: [{ id:'vision-old', status:'current', statement:'A steadier life with room for rest.', createdAt:'2026-01-01T00:00:00.000Z' }]
  });
  const vision = MSHStorage.getCurrentVision(state);
  assert.equal(vision.synthesis.confirmationStatus, 'confirmed');
  assert.equal(vision.synthesis.statement, 'A steadier life with room for rest.');
});

test('does not promote an unconfirmed synthesis to Current Vision', () => {
  const { MSHStorage } = loadContract();
  const state = MSHStorage.normalizeState({
    visionEntries: [{ id:'vision-draft', status:'current', responses:{life:'More room'}, synthesis:{statement:'More room.', confirmationStatus:'pending'} }]
  });
  assert.equal(MSHStorage.getCurrentVision(state), null);
});

test('paused and completed Projects remain queryable history while only active drives Practice', () => {
  const { MSHStorage } = loadContract();
  const state = MSHStorage.normalizeState({
    projects: [
      { id:'paused', status:'paused', updatedAt:'2026-01-02T00:00:00.000Z' },
      { id:'done', status:'completed', updatedAt:'2026-01-03T00:00:00.000Z' },
      { id:'active', status:'active', updatedAt:'2026-01-04T00:00:00.000Z' }
    ],
    practices: [{ id:'practice', projectId:'active', status:'active', updatedAt:'2026-01-04T00:00:00.000Z' }]
  });
  assert.equal(state.projects.length, 3);
  assert.equal(MSHStorage.getActiveProject(state).id, 'active');
  assert.equal(MSHStorage.getActivePractice(state).id, 'practice');
});

test('records meaningful events once when a lifecycle action supplies a dedupe key', () => {
  const { MSHStorage } = loadContract();
  const state = MSHStorage.createInitialState();
  MSHStorage.recordEvent(state, { progressType:'project_started', statement:'Started', dedupeKey:'project-started:1' });
  MSHStorage.recordEvent(state, { progressType:'project_started', statement:'Started', dedupeKey:'project-started:1' });
  assert.equal(state.progressEvents.length, 1);
});

test('persists a Wellness Wheel into the same state used by Landscape, Progress, and Hello', () => {
  const sandbox = loadContract();
  sandbox.MSHStorage.saveWellnessWheel({ id:'wheel-1', scores:{physical:7}, completedAt:'2026-08-23T12:00:00.000Z' });
  const state = sandbox.MSHStorage.getState();
  assert.equal(state.wellnessWheel.current.scores.physical, 7);
  assert.equal(state.progressEvents[0].progressType, 'landscape_mapped');
});
