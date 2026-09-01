import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sharing = await readFile(new URL('../js/msh-calendar-sharing.js', import.meta.url), 'utf8');

test('Calendar sharing entry synchronization is idempotent under its MutationObserver', () => {
  assert.match(sharing, /if \(!holder\.querySelector\(':scope > \[data-open-calendar-share\]'\)\)/);
  assert.equal((sharing.match(/holder\.innerHTML = '<button/g) || []).length, 1);
});
