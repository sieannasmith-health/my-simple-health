import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dashboard = await readFile(new URL('../js/msh-dashboard.js', import.meta.url), 'utf8');
const progress = await readFile(new URL('../js/msh-progress.js', import.meta.url), 'utf8');
const healthHtml = await readFile(new URL('../my-health.html', import.meta.url), 'utf8');

test('My Health preserves the approved workspace hierarchy in order', () => {
  const headings = [
    'Where I am',
    'What I’m working on',
    'What I’m practicing and learning',
    'What has changed',
    'Where I can go next'
  ];
  let last = -1;
  for (const heading of headings) {
    const index = dashboard.indexOf(heading);
    assert.ok(index > last, `${heading} follows the preceding workspace section`);
    last = index;
  }
});

test('My Health no longer renders the decorative arch or oversized hero', () => {
  assert.equal(dashboard.includes('msh-home-hero'), false);
  assert.equal(dashboard.includes('msh-home-story'), false);
  assert.equal(healthHtml.includes('msh-dashboard-intro'), false);
});

test('Hello is described as connective intelligence, not a next-step recommender', () => {
  assert.match(dashboard, /work across the health information, questions, choices, experiences, and learning/i);
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
