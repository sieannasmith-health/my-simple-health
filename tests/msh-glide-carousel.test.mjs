import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runtime = await readFile(new URL('../js/msh-glide.js', import.meta.url), 'utf8');
const sensory = await readFile(new URL('../css/msh-sensory.css', import.meta.url), 'utf8');
const glass = await readFile(new URL('../css/msh-glass-workspace.css', import.meta.url), 'utf8');
const dashboard = await readFile(new URL('../js/msh-dashboard.js', import.meta.url), 'utf8');
const health = await readFile(new URL('../my-health.html', import.meta.url), 'utf8');

test('shared glide controller mounts for Tools and Explore without autoplay or looping', () => {
  assert.match(health, /js\/msh-glide\.js/);
  assert.match(dashboard, /data-msh-glide-label="Tools" data-msh-glide-item="tool"/);
  assert.match(dashboard, /data-msh-glide-label="Explore My Health" data-msh-glide-item="activity"/);
  assert.match(runtime, /querySelectorAll\('\.msh-glide'\)/);
  assert.doesNotMatch(runtime, /setInterval|autoplay|loop/i);
});

test('carousel exposes bounded real-button controls and an accessible position', () => {
  assert.match(runtime, /previous\.type = 'button'/);
  assert.match(runtime, /next\.type = 'button'/);
  assert.match(runtime, /`Previous \$\{itemName\}`/);
  assert.match(runtime, /`Next \$\{itemName\}`/);
  assert.match(runtime, /previous\.disabled = active === 0/);
  assert.match(runtime, /next\.disabled = active === items\.length - 1/);
  assert.match(runtime, /aria-live', 'polite'/);
  assert.match(runtime, /\$\{active \+ 1\} \/ \$\{items\.length\}/);
});

test('native snap, arrow glide, focused keyboard navigation, and semantic feedback coexist', () => {
  assert.match(sensory, /scroll-snap-type:x proximity/);
  assert.match(runtime, /track\.scrollTo\(/);
  assert.match(runtime, /behavior: reducedMotion\(\) \? 'auto' : 'smooth'/);
  assert.match(runtime, /event\.target !== track/);
  assert.match(runtime, /'ArrowLeft', 'ArrowRight'/);
  assert.match(runtime, /MSHFeedback\.emit\('select'/);
  assert.match(runtime, /MSHFeedback\.emit\('settle'/);
});

test('carousel cards use theme surfaces with personal accent only as punctuation', () => {
  assert.match(glass, /background:var\(--msh-glass-panel-bg\)/);
  assert.match(glass, /color:var\(--msh-glass-text-primary\)/);
  assert.match(glass, /\.msh-glass-category\{[^}]*color:var\(--msh-personal-accent\)/);
  assert.match(glass, /section\.is-current\{[^}]*var\(--msh-personal-accent\)/);
  assert.doesNotMatch(glass, /\.msh-tools-directory section\{[^}]*rgba\(7,23,18/);
});

test('desktop arrows and mobile position affordance preserve swipe, reduced motion, and containment', () => {
  assert.match(sensory, /\.msh-glide-shell\{[^}]*min-width:0/);
  assert.match(sensory, /\.msh-glide-arrow:disabled\{[^}]*opacity:\.25/);
  assert.match(sensory, /@media\(max-width:860px\)\{[\s\S]*?\.msh-glide-shell\{display:block\}/);
  assert.match(sensory, /\.msh-glide>\*\{flex-basis:min\(78vw,340px\)\}/);
  assert.match(sensory, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(sensory, /\.msh-glide\{scroll-behavior:auto\}/);
});
