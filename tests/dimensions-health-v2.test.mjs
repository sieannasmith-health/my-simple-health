import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const registrySource = await readFile(new URL('../data/landscape-items-v1.js', import.meta.url), 'utf8');
const dimensionsSource = await readFile(new URL('../js/msh-dimensions-v2.js', import.meta.url), 'utf8');
const landscapeSource = await readFile(new URL('../js/msh-landscape.js', import.meta.url), 'utf8');
const storageSource = await readFile(new URL('../js/msh-storage.js', import.meta.url), 'utf8');

const sandbox = { console, Date, Math, crypto:globalThis.crypto };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.runInNewContext(registrySource, sandbox, { filename:'landscape-items-v1.js' });
vm.runInNewContext(dimensionsSource, sandbox, { filename:'msh-dimensions-v2.js' });

const config = sandbox.MSHLandscapeConfig;
const v2 = sandbox.MSHDimensionsV2;
const item = config.items[0];

test('one response produces an immediate interpreted discovery', () => {
  const observation = v2.createObservation(config, item, item.options[1], { recordedAt:'2026-08-24T12:00:00.000Z' });
  assert.match(v2.interpretationFor(observation, item), /signal|context|fit|clearer view/i);
  assert.match(landscapeSource, /screen = 'discovery';\s*render\(\)/);
});

test('several responses increase Self Map resolution without creating a second data record', () => {
  const one = [v2.createObservation(config, config.items[0], config.items[0].options[3])];
  const several = [
    ...one,
    v2.createObservation(config, config.items[1], config.items[1].options[2]),
    v2.createObservation(config, config.items[4], config.items[4].options[4])
  ];
  const firstMap = v2.buildSelfMap(config, one);
  const richerMap = v2.buildSelfMap(config, several);
  assert.ok(richerMap.resolution > firstMap.resolution);
  assert.equal(richerMap.derivedFrom, 'healthMap.landscapes.responses');
  assert.match(landscapeSource, /selfMapRole: 'derived_visualization_only'/);
});

test('stopping early preserves an in-progress useful partial summary', () => {
  assert.match(landscapeSource, /function showPartialSummary\(\)/);
  assert.match(landscapeSource, /What you explored is already useful/);
  assert.match(landscapeSource, /unfinished picture is saved as in progress—not failed/);
});

test('not sure is represented explicitly as missingness', () => {
  const observation = v2.createObservation(config, item, null, { missingReason:'NOT_SURE' });
  assert.equal(observation.value, null);
  assert.equal(observation.missingness.status, 'MISSING');
  assert.equal(observation.missingness.reason, 'NOT_SURE');
  assert.match(v2.interpretationFor(observation, item), /stay open/i);
});

test('skipping an area is represented without imputation', () => {
  const observation = v2.createObservation(config, item, null, { missingReason:'SKIPPED_AREA' });
  assert.equal(observation.value, null);
  assert.equal(observation.signal, null);
  assert.equal(observation.missingness.reason, 'SKIPPED_AREA');
  assert.match(landscapeSource, /Leave the rest of/);
});

test('a low response does not automatically become a problem or goal', () => {
  const low = v2.createObservation(config, item, item.options[0]);
  const interpretation = v2.interpretationFor(low, item);
  assert.match(interpretation, /not automatically|not an instruction/i);
  assert.doesNotMatch(interpretation, /create|start|set (a )?goal/i);
});

test('insufficient data produces no claimed correlation', () => {
  assert.deepEqual(Array.from(v2.associationClaims([])), []);
  assert.deepEqual(Array.from(v2.associationClaims([v2.createObservation(config, item, item.options[0])])), []);
  assert.match(landscapeSource, /No relationships have been inferred/);
});

test('existing research constructs and registry remain intact', () => {
  assert.equal(config.version, 'WL-PROTOTYPE-1');
  assert.equal(config.items.length, 27);
  assert.equal(config.domains.length, 9);
  assert.deepEqual(
    Array.from(config.items, entry => entry.id).slice(0, 4),
    ['PHY-01', 'PHY-02', 'PHY-03', 'PHY-04']
  );
  assert.ok(config.items.every(entry => entry.construct && entry.options.length === 5));
});

test('saved observations are analytics-ready and legacy responses migrate safely', () => {
  const observation = v2.createObservation(config, item, item.options[2], { recordedAt:'2026-08-24T12:00:00.000Z' });
  for (const key of ['construct','value','scale','answeredAt','timeframe','dimension','source','assessmentVersion','provenance','missingness']) {
    assert.ok(Object.hasOwn(observation, key), `missing ${key}`);
  }
  assert.equal(observation.provenance.status, 'USER_STATED');
  assert.equal(observation.scale.type, 'ordinal');

  const memory = new Map();
  const storageSandbox = {
    console,
    Date,
    Math,
    crypto:globalThis.crypto,
    localStorage:{ getItem:key => memory.get(key) || null, setItem:(key, value) => memory.set(key, value), removeItem:key => memory.delete(key) },
    sessionStorage:{ removeItem() {} }
  };
  storageSandbox.window = storageSandbox;
  storageSandbox.globalThis = storageSandbox;
  vm.runInNewContext(storageSource, storageSandbox, { filename:'msh-storage.js' });
  const migrated = storageSandbox.MSHStorage.normalizeState({
    schemaVersion:3,
    landscapes:[{ id:'legacy', instrumentVersion:'WL-PROTOTYPE-1', responses:[{ itemId:'PHY-01', domain:'physical', construct:'energy', value:'somewhat', label:'Somewhat', signal:'mixed', answeredAt:'2026-08-23T12:00:00.000Z' }] }]
  });
  const migratedResponse = migrated.landscapes[0].responses[0];
  assert.equal(migrated.schemaVersion, 6);
  assert.equal(migratedResponse.provenance.status, 'USER_STATED');
  assert.equal(migratedResponse.missingness.status, 'OBSERVED');
  assert.equal(migratedResponse.source.instrument, 'dimensions_of_health');
});
