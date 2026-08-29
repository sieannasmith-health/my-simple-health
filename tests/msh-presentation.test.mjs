import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dashboard = await readFile(new URL('../js/msh-dashboard.js', import.meta.url), 'utf8');
const progress = await readFile(new URL('../js/msh-progress.js', import.meta.url), 'utf8');
const healthHtml = await readFile(new URL('../my-health.html', import.meta.url), 'utf8');

test('My Health preserves the journey architecture without rendering it as a dashboard summary', () => {
  assert.match(dashboard,/Landscape/);
  assert.match(dashboard,/Horizon/);
  assert.match(dashboard,/Path/);
  assert.match(dashboard,/Practice/);
  assert.match(dashboard,/Discovery/);
  assert.match(dashboard,/msh-health-map-board/);
  assert.doesNotMatch(dashboard,/msh-dashboard-three-column/);
});

test('My Health no longer renders the decorative arch or oversized hero', () => {
  assert.equal(dashboard.includes('msh-home-hero'), false);
  assert.equal(dashboard.includes('msh-home-story'), false);
  assert.equal(healthHtml.includes('msh-dashboard-intro'), false);
});

test('Hello is described as connective intelligence, not a next-step recommender', () => {
  assert.match(dashboard, /Your context, held together/i);
  assert.doesNotMatch(dashboard, /reflect or find a next step/i);
});

test('Journey scrubber updates its detail in place instead of rebuilding the page', () => {
  assert.match(progress, /function updateScrubber/);
  assert.match(progress, /indexForPosition/);
  assert.doesNotMatch(progress, /requestAnimationFrame/);
  const inputHandler = progress.slice(progress.indexOf("root.addEventListener('input'"));
  assert.equal(inputHandler.includes('render()'), true, 'initial render remains');
  assert.equal(inputHandler.match(/render\(\)/g)?.length, 1, 'input path does not invoke another full render');
});
