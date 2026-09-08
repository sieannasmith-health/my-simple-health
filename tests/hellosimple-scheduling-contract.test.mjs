import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../hellosimple/app.js', import.meta.url), 'utf8');

test('HelloSimple exposes dynamic daily work concepts', () => {
  assert.match(app, /Today's schedule|Today’s schedule|schedule/i);
  assert.match(app, /current objective|company objective/i);
  assert.match(app, /human action|needs you/i);
  assert.match(app, /Hello Workers/i);
});

test('progression is evidence-oriented, not authority granting', () => {
  assert.match(app, /evidence/i);
  assert.match(app, /XP/i);
  assert.doesNotMatch(app, /grant.*admin|admin.*unlock/i);
});
