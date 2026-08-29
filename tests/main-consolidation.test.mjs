import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('main preserves the current storytelling homepage and canonical Health Landscape', async () => {
  const [home, landscape, wheel] = await Promise.all([
    read('index.html'), read('health-landscape.html'), read('wellness-wheel.html')
  ]);
  assert.match(home, /Your health, in context\./);
  assert.match(home, /Understand your health without turning your life into a health project\./);
  assert.match(home, /css\/msh-public-story\.css/);
  assert.match(landscape, /Your Health Landscape/);
  assert.match(landscape, /js\/msh-storage\.js/);
  assert.match(wheel, /url=health-landscape\.html/);
});

test('accepted My Health refinements are connected to their single canonical routes', async () => {
  const [health, project, calendar] = await Promise.all([
    read('my-health.html'), read('my-project.html'), read('calendar.html')
  ]);
  for (const asset of ['msh-glass-workspace.css', 'msh-my-health-dashboard.css', 'msh-thought-capture.css', 'msh-my-health-entry.js', 'msh-thought-capture.js']) {
    assert.match(health, new RegExp(asset.replaceAll('.', '\\.')));
  }
  assert.match(project, /msh-project-layout\.css/);
  for (const asset of ['msh-calendar-appearance.js', 'msh-movement-directory.js', 'msh-movement.js']) {
    assert.match(calendar, new RegExp(asset.replaceAll('.', '\\.')));
  }
});

test('application pages contain no visible Hello navigation or launcher', async () => {
  const shell = await read('js/msh-shell.js');
  const glass = await read('js/msh-glass-workspace.js');
  assert.doesNotMatch(shell, /key:'hello', label:'Hello'/);
  assert.doesNotMatch(shell, /mountUniversalHello\(active\)/);
  assert.doesNotMatch(glass, /data-msh-hello-open|msh-ambient-glass/);
});
