import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(path, 'utf8');

test('production feature pages load the refined area icon layer', () => {
  for (const page of ['financial-health.html', 'calendar.html', 'my-food.html']) {
    const html = read(page);
    assert.match(html, /css\/msh-area-icons\.css/);
    assert.match(html, /js\/msh-area-icons\.js/);
  }
});

test('area icon system supplies semantic SVGs instead of platform emoji artwork', () => {
  const source = read('js/msh-area-icons.js');
  for (const name of ['household','goals','categories','items','lock','shield','movement','cycle','symptoms','sexualHealth','measurements','camera','grocery']) {
    assert.match(source, new RegExp(`${name}:`));
  }
  assert.match(source, /<svg viewBox="0 0 24 24"/);
  assert.match(source, /replace\(\/\^\\s\*\(📷\|🛒/u);
});
