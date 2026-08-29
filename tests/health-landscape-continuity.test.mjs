import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [landscape, myHealth] = await Promise.all([
  readFile(new URL('../health-landscape.html', import.meta.url), 'utf8'),
  readFile(new URL('../js/msh-my-health-entry.js', import.meta.url), 'utf8')
]);

test('a selected Landscape dimension opens an in-place exploration surface', () => {
  assert.match(landscape, /id="dimensionExploration"/);
  assert.match(landscape, /if\(selected\.key!==\'none\'\)openDimension\(selected\.key,\{push:true\}\)/);
  assert.doesNotMatch(landscape, /function selectPriority[^}]*my-health\.html/);
  assert.match(landscape, /← YOUR LANDSCAPE/);
  assert.match(landscape, /MY HEALTH/);
});

test('dimension context is appended to the completed canonical instrument record', () => {
  assert.match(landscape, /instrumentId:'health_landscape'/);
  assert.match(landscape, /instrumentVersion:'HL-1'/);
  assert.match(landscape, /experienceVersion:'HEALTH-LANDSCAPE-V1'/);
  assert.match(landscape, /record\.dimensionContexts\.push\(/);
  assert.match(landscape, /provenance:MSHStorage\.createProvenance\(MSHStorage\.PROVENANCE\.USER_STATED/);
  assert.doesNotMatch(landscape, /focuses\.push|projects\.push|practices\.push/);
});

test('saving context stays in the dimension and preserves history-aware return', () => {
  assert.match(landscape, /Saved with this Landscape\. You can stay here/);
  assert.match(landscape, /history\.pushState\(\{mshLandscapeDimension:true/);
  assert.match(landscape, /function returnToLandscape\(\)\{if\(new URLSearchParams\(location\.search\)\.has\('dimension'\)\)history\.back\(\)/);
  assert.match(landscape, /window\.addEventListener\('popstate'/);
});

test('My Health routes Landscape completion back to Landscape rather than Journey', () => {
  assert.match(myHealth, /latest\.progressType === 'landscape_mapped'/);
  assert.match(myHealth, /isLandscape \? route\('landscape',\{from:'my-health'\}\)/);
  assert.match(myHealth, /isLandscape \? 'Open Landscape' : 'Open Journey'/);
});
