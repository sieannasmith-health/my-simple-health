import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const styles = await readFile(new URL('../css/msh-journey-deck.css', import.meta.url), 'utf8');
const behavior = await readFile(new URL('../js/msh-journey-deck.js', import.meta.url), 'utf8');

test('landing page restores the six-stage connected journey deck', () => {
  const stages = ['landscape', 'horizon', 'path', 'practice', 'discovery', 'journey'];
  assert.match(index, /id="journey"[^>]*data-journey-deck/);
  stages.forEach(stage => assert.match(index, new RegExp(`data-stage="${stage}"`)));
  assert.equal((index.match(/data-journey-card/g) || []).length, stages.length);
});

test('deck exposes controls, progress, and keyboard movement', () => {
  assert.match(index, /data-journey-previous/);
  assert.match(index, /data-journey-next/);
  assert.match(index, /data-journey-progress/);
  assert.match(behavior, /ArrowLeft/);
  assert.match(behavior, /ArrowRight/);
  assert.match(behavior, /aria-current/);
});

test('deck supports scroll movement, mobile snapping, and reduced motion', () => {
  assert.match(behavior, /translate3d/);
  assert.match(styles, /scroll-snap-type:\s*x mandatory/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(behavior, /prefers-reduced-motion: reduce/);
});

test('landing page retains its existing detailed product story', () => {
  assert.match(index, /id="product-in-motion"/);
  assert.match(index, /Built on science/);
  assert.match(index, /Designed for real life/);
});
