import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const project = await readFile(new URL('../js/msh-project.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../css/msh-app.css', import.meta.url), 'utf8');

test('Active Path is an open SVG trail rather than connected containers', () => {
  assert.match(project, /msh-active-path-canvas/);
  assert.match(project, /data-trail-path/);
  assert.match(project, /msh-trail-established/);
  assert.doesNotMatch(project, /<div class="msh-path-visual">/);
  assert.doesNotMatch(project, /<article class="milestone">/);
});

test('Active Path reads existing project activity without mutating its model', () => {
  assert.match(project, /st\.practiceAttempts\.filter\(item => item\.projectId === p\.id\)/);
  assert.match(project, /st\.reflections\.filter\(item => item\.projectId === p\.id\)/);
  assert.match(project, /st\.learningEntries\.filter\(item => item\.projectId === p\.id/);
  assert.match(project, /projectProgress\(p, st\)/);
});

test('trail drawing and active-position motion respect reduced motion', () => {
  assert.match(css, /@keyframes msh-trail-draw/);
  assert.match(css, /@keyframes msh-path-breathe/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /\.msh-active-path-canvas \*\{animation:none!important;transition:none!important\}/);
});
