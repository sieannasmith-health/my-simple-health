import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dashboard = await readFile(new URL('../js/msh-dashboard.js', import.meta.url), 'utf8');
const landscape = await readFile(new URL('../js/msh-landscape.js', import.meta.url), 'utf8');
const vision = await readFile(new URL('../js/msh-vision.js', import.meta.url), 'utf8');
const phaseCss = await readFile(new URL('../css/msh-ux-phase-one.css', import.meta.url), 'utf8');

test('first use remains a three-step progressive doorway', () => {
  assert.match(dashboard, /Welcome/);
  assert.match(dashboard, /A little context/);
  assert.match(dashboard, /Your starting point/);
  assert.match(dashboard, /data-first-door-intent/);
});

test('Landscape lets a person choose an area while preserving the existing observation pipeline', () => {
  assert.match(landscape, /data-action="start-domain"/);
  assert.match(landscape, /dimensions\.createObservation/);
  assert.match(landscape, /healthMapRole: 'canonical_measurement_record'/);
  assert.match(landscape, /selfMapRole: 'derived_visualization_only'/);
});

test('Horizon presents one prompt at a time and keeps synthesis user-confirmable', () => {
  assert.doesNotMatch(vision, /prompts\.map\(\(item, index\) => `<label class="msh-vision-prompt"/);
  assert.match(vision, /const item = prompts\[promptIndex\]/);
  assert.match(vision, /confirmationStatus:'pending'/);
  assert.match(vision, /confirmationStatus:'confirmed'/);
  assert.match(vision, /correctedByUser/);
});

test('Horizon supports uncertainty and optional early synthesis', () => {
  assert.match(vision, /data-action="not-sure"/);
  assert.match(vision, /data-action="synthesize"/);
  assert.match(vision, /if \(!responseCount\(\)\) return/);
});

test('phase-one interaction system includes responsive and reduced-motion rules', () => {
  assert.match(phaseCss, /@media\(max-width:620px\)/);
  assert.match(phaseCss, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(phaseCss, /var\(--msh-surface\)/);
  assert.match(phaseCss, /var\(--msh-heading\)/);
});
