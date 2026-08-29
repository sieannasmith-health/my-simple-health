import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const storageSource = await readFile(new URL('../js/msh-storage.js', import.meta.url), 'utf8');
const landscapeSource = await readFile(new URL('../js/msh-landscape.js', import.meta.url), 'utf8');
const dashboardSource = await readFile(new URL('../js/msh-dashboard.js', import.meta.url), 'utf8');
const projectSource = await readFile(new URL('../js/msh-project.js', import.meta.url), 'utf8');
const landscapeHtml = await readFile(new URL('../my-landscape.html', import.meta.url), 'utf8');
const glassCss = await readFile(new URL('../css/msh-glass-workspace.css', import.meta.url), 'utf8');

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function loadStorage() {
  let sequence = 0;
  const sandbox = {
    console,
    crypto: { randomUUID: () => `test-${++sequence}` },
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage()
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(storageSource, sandbox, { filename:'msh-storage.js' });
  return sandbox.MSHStorage;
}

test('Landscape uses the existing photographic, time-aware Glass environment as one workspace', () => {
  for (const required of ['js/msh-environment.js', 'css/msh-environment.css', 'css/msh-glass-workspace.css', 'js/msh-glass-workspace.js']) {
    assert.match(landscapeHtml, new RegExp(required.replace(/[./]/g, '\\$&')));
  }
  assert.match(landscapeSource, /data-landscape-workspace/);
  assert.match(landscapeSource, /function ensureWorkspace/);
  assert.match(landscapeSource, /msh-home-cinematic/);
  assert.match(glassCss, /msh-landscape-workspace-content/);
  assert.match(glassCss, /@media\(prefers-reduced-motion:reduce\)/);
});

test('measurement remains separate from chosen personal meaning', () => {
  assert.match(landscapeSource, /dimensions\.createObservation/);
  assert.match(landscapeSource, /screen = 'discovery'/);
  assert.match(landscapeSource, /screen = 'attention'/);
  assert.match(landscapeSource, /The Landscape stays behind this decision\. It does not choose for you\./);
  assert.doesNotMatch(landscapeSource, /function saveObservation[\s\S]{0,900}saveFocusDecision/);
});

test('a durable relationship requires a valid confirmed disposition', () => {
  const storage = loadStorage();
  assert.equal(storage.saveFocusDecision({ label:'Energy', navigationState:'unknown' }), null);
  assert.equal(storage.getState().focuses.length, 0);
  const saved = storage.saveFocusDecision({
    label:'Energy', navigationState:'explore', subjectType:'landscape_domain', subjectId:'physical', sourceType:'landscape', sourceId:'landscape-1'
  });
  assert.equal(saved.navigationState, 'explore');
  assert.equal(saved.provenance.status, storage.PROVENANCE.USER_STATED);
  assert.equal(storage.getState().focuses.length, 1);
  assert.match(landscapeSource, /Your choice is not saved until you confirm it\./);
  assert.match(landscapeSource, /data-action="confirm-disposition"/);
});

test('all six relationships remain distinct and multiple meaningful subjects coexist', () => {
  const storage = loadStorage();
  const choices = ['develop', 'preserve', 'explore', 'prepare', 'adapt', 'no_action'];
  choices.forEach((choice, index) => storage.saveFocusDecision({
    label:`Subject ${index}`, navigationState:choice, subjectType:'landscape_domain', subjectId:`domain-${index}`, sourceType:'landscape', sourceId:'landscape-1'
  }));
  const current = storage.getCurrentFocuses();
  assert.equal(current.length, 6);
  assert.deepEqual(new Set(current.map(item => item.navigationState)), new Set(choices));
  assert.equal(storage.getState().settings.reminders && Object.keys(storage.getState().settings.reminders).length, 0);
});

test('changing the relationship to the same subject preserves history rather than overwriting it', () => {
  const storage = loadStorage();
  storage.saveFocusDecision({ label:'Energy', navigationState:'explore', subjectType:'landscape_domain', subjectId:'physical', sourceType:'landscape', sourceId:'landscape-1' });
  storage.saveFocusDecision({ label:'Energy', navigationState:'develop', subjectType:'landscape_domain', subjectId:'physical', sourceType:'landscape', sourceId:'landscape-2' });
  const state = storage.getState();
  assert.equal(state.focuses.length, 2);
  assert.equal(state.focuses.filter(item => item.status === 'historical').length, 1);
  assert.equal(state.focuses.filter(item => item.status === 'active').length, 1);
});

test('multiple develop intentions require a capacity decision without historicalizing either subject', () => {
  const storage = loadStorage();
  const first = storage.saveFocusDecision({ label:'Sleep', navigationState:'develop', subjectType:'landscape_domain', subjectId:'sleep', sourceType:'landscape', sourceId:'landscape-1' });
  const second = storage.saveFocusDecision({ label:'Energy', navigationState:'develop', subjectType:'landscape_domain', subjectId:'energy', sourceType:'landscape', sourceId:'landscape-1' });
  assert.equal(storage.getCurrentFocuses().filter(item => item.navigationState === 'develop').length, 2);
  storage.saveFocusCapacityDecision(second.id, 'shape_this_now');
  const state = storage.getState();
  assert.equal(state.focuses.find(item => item.id === first.id).status, 'active');
  assert.equal(state.focuses.find(item => item.id === second.id).projectReadiness, 'selected_for_shaping');
  assert.match(landscapeSource, /screen = 'capacity'/);
  assert.match(landscapeSource, /capacityFocus/);
  assert.match(dashboardSource, /competing\.length > 1/);
  assert.match(landscapeSource, /Explicit capacity choice required/);
});

test('only develop exposes the change doorway and the doorway creates no Project', () => {
  assert.match(landscapeSource, /pendingDisposition === 'develop' \? 'doorway' : 'relationship'/);
  assert.match(landscapeSource, /Reaching it has not created a Project\./);
  assert.match(landscapeSource, /my-project\.html\?focus=/);
  assert.doesNotMatch(landscapeSource, /projects\.push/);
  assert.match(projectSource, /requestedFocusId/);
  assert.match(projectSource, /x\.navigationState === 'develop'/);
  assert.match(projectSource, /focusId:selectedFocus/);
  assert.match(projectSource, /You have more than one thing you want to work on\./);
});

test('nothing standing out creates no focus and no-action creates no continued pressure', () => {
  assert.match(landscapeSource, /data-action="nothing-stands-out"/);
  assert.match(landscapeSource, /No “what matters now” record, Project, reminder, or next-step pressure has been created\./);
  assert.match(landscapeSource, /No reminder, Project, or continued workspace pressure has been created\./);
  assert.doesNotMatch(landscapeSource, /nothing-stands-out[\s\S]{0,500}saveFocusDecision/);
});

test('My Health shows current relationships without profile-completion framing', () => {
  assert.match(dashboardSource, /const currentFocuses = MSHStorage\.getCurrentFocuses/);
  assert.match(dashboardSource, /This relationship remains visible without automatically creating a Project\./);
  assert.match(dashboardSource, /Context in view/);
  assert.doesNotMatch(dashboardSource, /<span>\/5<\/span>/);
  assert.doesNotMatch(dashboardSource, /state\.focuses\.forEach\(item => \{ if \(item\.status === 'active'/);
});

test('time of day changes atmosphere only, not disposition or routing', () => {
  assert.match(landscapeHtml, /js\/msh-environment\.js/);
  assert.doesNotMatch(landscapeSource, /daypart|morning|afternoon|evening|night/);
});
