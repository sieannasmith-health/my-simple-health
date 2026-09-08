import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Hello prompt advances after a resolved clarification instead of repeating', () => {
  const source = readFileSync(new URL('../server/hello.js', import.meta.url), 'utf8');
  assert.match(source, /Treat a short correction or clarification as an update/);
  assert.match(source, /do not ask the same question again/);
  assert.match(source, /do not repeat the prior explanation/);
  assert.match(source, /Avoid near-duplicate consecutive responses/);
});
