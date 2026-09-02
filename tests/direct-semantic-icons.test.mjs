import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

test('area icon module is a pure renderer without DOM decoration', () => {
  const source = read('js/msh-area-icons.js');
  assert.match(source, /global\.MSHAreaIcons=Object\.freeze\(\{svg,names:/);
  assert.doesNotMatch(source, /MutationObserver|stripLeadingGlyph|decorateFood|decorateCalendar|decorateFinancial/);
});

test('Financial Health, Calendar, and My Food render semantic SVG icons directly', () => {
  const finance = read('js/msh-financial-sharing.js');
  const calendar = read('js/msh-calendar-feature-actions.js');
  const food = read('js/msh-my-food.js');

  assert.match(finance, /MSHAreaIcons\?\.svg/);
  assert.match(finance, /icon\(value,'msh-area-icon--framed'\)/);
  assert.match(finance, /icon\('lock'\)/);
  assert.match(finance, /icon\('shield','msh-area-icon--framed'\)/);

  assert.match(calendar, /icon: 'movement'/);
  assert.match(calendar, /icon: 'cycle'/);
  assert.match(calendar, /icon: 'symptoms'/);
  assert.match(calendar, /icon: 'sexualHealth'/);
  assert.match(calendar, /icon: 'measurements'/);
  assert.doesNotMatch(calendar, /↗|◐|✦|♡|⌁/u);
  assert.match(calendar, /title: 'Sexual health'/);

  assert.match(food, /icon\('camera','msh-area-icon--framed'\)/);
  assert.match(food, /icon\('grocery','msh-area-icon--framed'\)/);
  assert.match(food, /icon\('plus','msh-area-icon--framed'\)/);
  assert.doesNotMatch(food, /📷|🛒|＋/u);
});

test('production pages load area icon renderer before feature markup code', () => {
  const finance = read('financial-health.html');
  const calendar = read('calendar.html');
  const food = read('my-food.html');

  assert.ok(finance.indexOf('msh-area-icons.js') < finance.indexOf('msh-financial-sharing.js'));
  assert.ok(calendar.indexOf('msh-area-icons.js') < calendar.indexOf('msh-calendar-feature-actions.js'));
  assert.ok(food.indexOf('msh-area-icons.js') < food.indexOf('msh-my-food.js'));
});
