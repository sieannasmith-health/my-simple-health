import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

test('theme runtime loads the shared surface contrast stylesheet', () => {
  const source = read('js/msh-theme.js');
  assert.match(source, /msh-surface-contrast\.css/);
  assert.match(source, /ensureContrastStylesheet/);
  assert.match(source, /data-msh-surface-contrast|mshSurfaceContrast/);
});

test('surface contrast contract defines dark and light neutral text', () => {
  const css = read('css/msh-surface-contrast.css');
  assert.match(css, /--msh-on-surface-primary:#f7f5ef/);
  assert.match(css, /--msh-on-surface-secondary:#d7d4cc/);
  assert.match(css, /--msh-on-surface-primary:#1d211d/);
  assert.match(css, /--msh-on-surface-secondary:#555b54/);
});

test('contrast contract explicitly covers Financial Health and My Health', () => {
  const css = read('css/msh-surface-contrast.css');
  assert.match(css, /msh-financial-share-option small/);
  assert.match(css, /msh-financial-share-disclosure/);
  assert.match(css, /data-msh-page="health"/);
  assert.match(css, /msh-my-health-dashboard__intro/);
});

test('accent colors remain opt-in exceptions', () => {
  const css = read('css/msh-surface-contrast.css');
  assert.match(css, /msh-accent-text/);
  assert.match(css, /msh-gold-text/);
  assert.match(css, /msh-danger-text/);
});
