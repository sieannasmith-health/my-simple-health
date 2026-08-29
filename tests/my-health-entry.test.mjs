import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const entrySource = await readFile(new URL('../js/msh-my-health-entry.js', import.meta.url), 'utf8');
const entryCss = await readFile(new URL('../css/msh-my-health-dashboard.css', import.meta.url), 'utf8');
const healthHtml = await readFile(new URL('../my-health.html', import.meta.url), 'utf8');

function renderEntry({ meaningful = true, search = '?view=workspace', state } = {}) {
  let ready;
  const content = { innerHTML:'', querySelector:() => null };
  const classes = new Set(['msh-home-world', 'is-first-door', 'msh-glass-world']);
  const world = {
    classList: {
      add(...values) { values.forEach(value => classes.add(value)); },
      remove(...values) { values.forEach(value => classes.delete(value)); }
    },
    querySelector(selector) { return selector === '.msh-home-world-content' ? content : null; }
  };
  const root = {
    innerHTML:'unchanged',
    querySelector(selector) { return selector === '.msh-home-world' ? world : null; }
  };
  const sourceState = state || {
    calendar:{ events:[] }, progressEvents:[], practices:[], projects:[],
    visionEntries:[], landscapes:[], wellnessWheel:{ current:null }
  };
  const storage = {
    getState:() => sourceState,
    getActivePractice:value => value.practices[0] || null,
    getActiveProject:value => value.projects[0] || null,
    getCurrentLandscape:() => null,
    getCurrentLearning:() => []
  };
  const document = {
    querySelector(selector) { return selector === '[data-msh-dashboard]' ? root : null; },
    addEventListener(type, callback) { if (type === 'DOMContentLoaded') ready = callback; }
  };
  const sandbox = {
    console, Date, URLSearchParams, location:{ search }, document,
    MSHStorage:storage,
    MSHFirstDoor:{ hasMeaningfulContext:() => meaningful },
    MSHEnvironment:{ getCurrent:() => ({ label:'Afternoon' }) },
    requestAnimationFrame:callback => callback()
  };
  sandbox.window = sandbox;
  vm.runInNewContext(entrySource, sandbox, { filename:'msh-my-health-entry.js' });
  ready();
  return { content:content.innerHTML, root:root.innerHTML, classes };
}

test('returning My Health reuses the existing time-aware environment', () => {
  const rendered = renderEntry();
  assert.ok(rendered.classes.has('msh-returning-dashboard-world'));
  assert.ok(!rendered.classes.has('is-first-door'));
  assert.ok(!rendered.classes.has('msh-glass-world'));
  assert.match(rendered.content, /Understand your health\. Live your life\./);
  assert.match(entryCss, /msh-returning-dashboard-world \.msh-home-world-content/);
});

test('fresh users still remain in the First Door flow', () => {
  const rendered = renderEntry({ meaningful:false, search:'' });
  assert.equal(rendered.content, '');
  assert.equal(rendered.root, 'unchanged');
  assert.ok(rendered.classes.has('is-first-door'));
});

test('future Calendar plans are not presented as completed latest activity', () => {
  const rendered = renderEntry({ state:{
    calendar:{ events:[{ id:'future', title:'Future appointment', startAt:'2999-01-01T12:00:00.000Z' }] },
    progressEvents:[], projects:[], visionEntries:[], landscapes:[], wellnessWheel:{ current:null },
    practices:[{ id:'practice', title:'Current Practice', description:'Something currently being tried.' }]
  }});
  assert.match(rendered.content, /Current Practice/);
  assert.doesNotMatch(rendered.content, /Future appointment|Latest activity/);
});

test('returning entry keeps one dominant feature and a connected story carousel', () => {
  for (const route of ['calendar.html', 'my-landscape.html', 'my-practice.html', 'my-project.html', 'my-vision.html', 'my-learning.html', 'my-progress.html']) {
    assert.match(entrySource, new RegExp(route.replace('.', '\\.')));
  }
  assert.match(entrySource, /class="msh-feature-board"/);
  assert.match(entrySource, /data-story-carousel/);
  assert.match(entrySource, /title:'Today'.*title:'Landscape'.*title:'Horizon'.*title:'Path'.*title:'Practice'.*title:'Discovery'.*title:'Journey'/s);
  assert.doesNotMatch(entrySource, /Strength|streak|completion ring/i);
});

test('story carousel is swipeable, keyboard navigable, and visually focused', () => {
  assert.match(entryCss, /scroll-snap-type: x mandatory/);
  assert.match(entryCss, /grid-auto-columns: minmax\(300px, 42%\)/);
  assert.match(entryCss, /\.msh-story-card\.is-current/);
  assert.match(entrySource, /event\.key === 'ArrowRight'/);
  assert.match(entrySource, /event\.key === 'ArrowLeft'/);
  assert.match(entrySource, /data-carousel-prev/);
  assert.match(entrySource, /data-carousel-next/);
});

test('My Health loads the returning entry after the canonical dashboard and preserves responsive safeguards', () => {
  assert.ok(healthHtml.indexOf('js/msh-dashboard.js') < healthHtml.indexOf('js/msh-my-health-entry.js'));
  assert.match(entryCss, /@media \(max-width: 900px\)/);
  assert.match(entryCss, /@media \(max-width: 700px\)/);
  assert.match(entryCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(entryCss, /width: calc\(100% - 32px\)/);
});
