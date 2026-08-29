import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../js/msh-scrubber.js', import.meta.url), 'utf8');
const sandbox = {};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.runInNewContext(source, sandbox, { filename:'msh-scrubber.js' });
const scrubber = sandbox.MSHScrubber;

test('continuous positions map to sparse history at beginning, middle, and end', () => {
  assert.equal(scrubber.indexForPosition(0, 3), 0);
  assert.equal(scrubber.indexForPosition(500, 3), 1);
  assert.equal(scrubber.indexForPosition(1000, 3), 2);
  assert.equal(scrubber.positionForIndex(1, 3), 500);
});

test('continuous positions map to dense history without changing the range resolution', () => {
  assert.equal(scrubber.indexForPosition(0, 101), 0);
  assert.equal(scrubber.indexForPosition(503, 101), 50);
  assert.equal(scrubber.indexForPosition(1000, 101), 100);
  assert.equal(scrubber.MAX, 1000);
});

test('pointer and touch coordinates map continuously across the whole track', () => {
  assert.equal(scrubber.positionFromClientX(100, 100, 400), 0);
  assert.equal(scrubber.positionFromClientX(300, 100, 400), 500);
  assert.equal(scrubber.positionFromClientX(500, 100, 400), 1000);
  assert.equal(scrubber.positionFromClientX(650, 100, 400), 1000);
});

test('keyboard navigation moves by recorded events and respects boundaries', () => {
  assert.equal(scrubber.keyboardIndex('ArrowRight', 0, 8), 1);
  assert.equal(scrubber.keyboardIndex('ArrowLeft', 0, 8), 0);
  assert.equal(scrubber.keyboardIndex('Home', 4, 8), 0);
  assert.equal(scrubber.keyboardIndex('End', 4, 8), 7);
  assert.equal(scrubber.keyboardIndex('PageUp', 2, 8), 7);
  assert.equal(scrubber.keyboardIndex('PageDown', 2, 8), 0);
});
