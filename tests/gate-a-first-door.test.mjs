import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const firstDoorSource = await readFile(new URL('../js/msh-first-door.js', import.meta.url), 'utf8');
const storageSource = await readFile(new URL('../js/msh-storage.js', import.meta.url), 'utf8');
const dashboardSource = await readFile(new URL('../js/msh-dashboard.js', import.meta.url), 'utf8');
const landscapeSource = await readFile(new URL('../js/msh-landscape.js', import.meta.url), 'utf8');
const helloSource = await readFile(new URL('../hello.html', import.meta.url), 'utf8');
const healthSource = await readFile(new URL('../my-health.html', import.meta.url), 'utf8');

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function loadFirstDoor() {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(firstDoorSource, sandbox, { filename:'msh-first-door.js' });
  return sandbox.MSHFirstDoor;
}

function loadStorage() {
  const sandbox = { console, crypto:{ randomUUID:() => 'test-id' }, localStorage:memoryStorage(), sessionStorage:memoryStorage() };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(storageSource, sandbox, { filename:'msh-storage.js' });
  return sandbox.MSHStorage;
}

test('offers the six approved ordinary-language first-use intents', () => {
  const firstDoor = loadFirstDoor();
  assert.deepEqual(Array.from(firstDoor.intents, item => item.id), [
    'health_question','not_working','work_on_something','care_support','clearer_picture','exploring'
  ]);
  for (const intent of firstDoor.intents) {
    assert.ok(intent.label.length > 5);
    assert.ok(intent.orientation.length > 40);
    assert.ok(intent.primary.href);
  }
});

test('routes each need to an existing capability instead of enforcing framework order', () => {
  const firstDoor = loadFirstDoor();
  assert.equal(firstDoor.getIntent('health_question').primary.href, 'topics.html');
  assert.equal(firstDoor.getIntent('not_working').primary.href, 'health-landscape.html');
  assert.equal(firstDoor.getIntent('care_support').primary.href, 'resources.html');
  assert.equal(firstDoor.getIntent('work_on_something').primary.href, 'my-project.html');
  assert.equal(firstDoor.getIntent('clearer_picture').primary.href, 'health-landscape.html');
  assert.equal(firstDoor.getIntent('exploring').prompt, '');
});

test('asks at most one context question and allows no-disclosure exploration', () => {
  const firstDoor = loadFirstDoor();
  for (const intent of firstDoor.intents) assert.equal(typeof intent.prompt, 'string');
  assert.equal(firstDoor.getIntent('clearer_picture').prompt, '');
  assert.equal(firstDoor.getIntent('exploring').prompt, '');
  assert.equal(firstDoor.getIntent('not_working').optional, true);
  assert.equal(firstDoor.getIntent('care_support').optional, true);
});

test('a first-door record alone does not masquerade as an established workspace', () => {
  const firstDoor = loadFirstDoor();
  const empty = { user:{ firstDoor:{ intent:'health_question' } }, wellnessWheel:{current:null}, calendar:{events:[]} };
  assert.equal(firstDoor.hasMeaningfulContext(empty), false);
  assert.equal(firstDoor.hasMeaningfulContext({ ...empty, projects:[{id:'p1'}] }), true);
  assert.equal(firstDoor.hasMeaningfulContext({ ...empty, calendar:{events:[{id:'event'}]} }), true);
});

test('stores the entry intent in shared state with USER_STATED provenance', () => {
  const storage = loadStorage();
  const saved = storage.saveFirstDoor({ intent:'health_question', context:'What does this result mean?', status:'context_added' });
  assert.equal(saved.intent, 'health_question');
  assert.equal(saved.provenance.status, storage.PROVENANCE.USER_STATED);
  assert.equal(storage.getState().user.firstDoor.context, 'What does this result mean?');
  assert.equal(storage.getState().schemaVersion, 7);
});

test('normalization rejects unknown intents without damaging existing state', () => {
  const storage = loadStorage();
  const normalized = storage.normalizeState({ user:{firstDoor:{intent:'unknown'}}, projects:[{id:'kept'}] });
  assert.equal(normalized.user.firstDoor, null);
  assert.equal(normalized.projects[0].id, 'kept');
});

test('the empty Home has a dedicated first door while populated journey access remains intact', () => {
  assert.match(healthSource, /js\/msh-first-door\.js/);
  assert.match(dashboardSource, /What brings you here today\?/);
  assert.match(dashboardSource, /MSHFirstDoor\.hasMeaningfulContext\(state\)/);
  assert.match(dashboardSource, /MSHGlassWorkspace\.markup/);
  assert.match(dashboardSource, /function healthMapLayers/);
  assert.match(dashboardSource, /label:'Landscape'.*label:'Horizon'.*label:'Path'.*label:'Practice'.*label:'Discovery'/s);
});

test('first-door routing carries context without putting personal text in the URL', () => {
  assert.match(helloSource, /applyFirstDoorDraft/);
  assert.match(helloSource, /getFirstDoor\(\)/);
  assert.match(helloSource, /get\("from"\) !== "first-door"/);
  assert.doesNotMatch(dashboardSource, /hello\.html\?[^"']*(prompt|context)=/);
  assert.doesNotMatch(firstDoorSource, /my-landscape\.html\?start=dimensions/);
});

test('care routing states the current prototype limitation honestly', () => {
  const firstDoor = loadFirstDoor();
  assert.match(firstDoor.getIntent('care_support').orientation, /does not currently provide a verified provider directory/i);
});
