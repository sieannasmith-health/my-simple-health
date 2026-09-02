import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

test('receipt, consumption, and expiration actions use semantic icons instead of emoji', () => {
  const receipt = read('js/msh-food-receipt-acquisition.js');
  const consumption = read('js/msh-food-consumption-ui.js');
  const expiration = read('js/msh-food-expiration.js');
  const icons = read('js/msh-area-icons.js');

  assert.match(receipt, /MSHAreaIcons\?\.svg\('receipt'/);
  assert.match(consumption, /MSHAreaIcons\?\.svg\('meal'/);
  assert.match(expiration, /MSHAreaIcons\?\.svg\('dateLabel'/);

  assert.doesNotMatch(receipt, /🧾/u);
  assert.doesNotMatch(consumption, /🍽️/u);
  assert.doesNotMatch(expiration, /📅/u);

  assert.match(icons, /receipt:/);
  assert.match(icons, /meal:/);
  assert.match(icons, /dateLabel:/);
});
