import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dashboard = await readFile(new URL('../js/msh-dashboard.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../css/msh-glass-workspace.css', import.meta.url), 'utf8');

test('Health Map presents five plain-language layers connected to the person', () => {
  for (const [label, meaning] of [
    ['Landscape', 'Where I am'],
    ['Horizon', 'Where I want to go'],
    ['Path', 'What matters now / what I’ve chosen'],
    ['Practice', 'What I’m trying'],
    ['Discovery', 'What I’m learning']
  ]) {
    assert.match(dashboard, new RegExp(`label:'${label}'.*meaning:'${meaning.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  }
  assert.match(dashboard, /msh-health-map-you/);
  assert.match(dashboard, /Your context, held together/);
  assert.match(dashboard, /msh-health-map-connection/);
});

test('Health Map removes completion framing and keeps empty layers open', () => {
  assert.doesNotMatch(dashboard, /signalCount|profile completion|current parts of your picture|\/5<\/span>/i);
  assert.match(dashboard, /Open to explore/);
  assert.match(dashboard, /No action required/);
  assert.match(dashboard, /does not need to be completed first/);
});

test('saved context changes presentation without changing the storage model', () => {
  assert.match(dashboard, /present:Boolean\(landscape \|\| landscapeDraft \|\| wheel\)/);
  assert.match(dashboard, /present:Boolean\(vision \|\| visionDraft\)/);
  assert.match(dashboard, /present:Boolean\(project\)/);
  assert.match(dashboard, /present:Boolean\(practice\)/);
  assert.match(dashboard, /present:Boolean\(learning\)/);
  assert.match(dashboard, /layer\.present \? ' has-context'/);
  assert.doesNotMatch(dashboard, /localStorage\.setItem|saveLandscape|saveVision|saveProject|savePractice/);
});

test('selecting a layer transforms the same Glass and back restores the map', () => {
  assert.match(dashboard, /data-health-map-layer/);
  assert.match(dashboard, /selectedHealthLayer = mapLayer\.dataset\.healthMapLayer/);
  assert.match(dashboard, /renderHealthLayer\(selected\)/);
  assert.match(dashboard, /data-health-map-back/);
  assert.match(dashboard, /selectedHealthLayer = null/);
  assert.match(dashboard, /renderGlass\(/);
});

test('existing destinations remain available without stacked forms', () => {
  for (const route of ['my-landscape.html', 'my-vision.html', 'my-project.html', 'my-practice.html', 'my-learning.html']) {
    assert.match(dashboard, new RegExp(route.replace('.', '\\.')));
  }
  const mapStart = dashboard.indexOf('function healthMapLayers');
  const mapEnd = dashboard.indexOf('function render()', mapStart);
  assert.doesNotMatch(dashboard.slice(mapStart, mapEnd), /<form|<textarea|<input/);
});

test('map supports focus, mobile, and reduced-motion presentation', () => {
  assert.match(css, /\.msh-health-map-layer:focus-visible/);
  assert.match(css, /@media\(max-width:600px\)/);
  assert.match(css, /\.msh-health-map-board>svg\{display:none\}/);
  assert.match(css, /width:100%/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /msh-health-map-connection.*transition:none!important/);
});
