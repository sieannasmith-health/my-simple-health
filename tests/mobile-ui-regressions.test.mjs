import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Food and Calendar load the physical-device mobile regression stylesheet', () => {
  assert.match(read('my-food.html'), /msh-mobile-ui-regressions\.css/);
  assert.match(read('calendar.html'), /msh-mobile-ui-regressions\.css/);
});

test('Calendar loads imported sleep dedupe before Calendar render code', () => {
  const html = read('calendar.html');
  const dedupe = html.indexOf('msh-calendar-import-dedupe.js');
  const calendar = html.indexOf('msh-calendar.js');
  assert.ok(dedupe > -1);
  assert.ok(calendar > dedupe);
});

test('Imported sleep projection renders at most one sleep card per day', () => {
  const context = {
    globalThis: null,
    window: {
      MSHHealthRecords: {
        calendarEvents() {
          return [
            { id: 'sleep-1', date: '2026-09-01', title: 'Sleep recorded', sourceKind: 'apple_health' },
            { id: 'sleep-2', date: '2026-09-01', title: 'Sleep recorded', sourceKind: 'apple_health' },
            { id: 'sleep-3', date: '2026-09-02', title: 'Sleep recorded', sourceKind: 'apple_health' },
            { id: 'weight-1', date: '2026-09-01', title: 'Weight recorded', sourceKind: 'apple_health' }
          ];
        }
      }
    }
  };
  context.globalThis = context.window;
  vm.runInNewContext(read('js/msh-calendar-import-dedupe.js'), context);
  const events = context.window.MSHHealthRecords.calendarEvents([]);
  const sleep = events.filter(event => event.title === 'Sleep recorded');
  assert.equal(sleep.length, 2);
  assert.deepEqual(Array.from(sleep, event => event.date), ['2026-09-01', '2026-09-02']);
  assert.equal(events.filter(event => event.title === 'Weight recorded').length, 1);
});

test('Mobile Calendar sheet uses a bounded grid instead of horizontal chip scrolling', () => {
  const css = read('css/msh-mobile-ui-regressions.css');
  assert.match(css, /\.msh-cycle-sheet \.msh-cycle-chips[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /overflow:\s*visible !important/);
});
