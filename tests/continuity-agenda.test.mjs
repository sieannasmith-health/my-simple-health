import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const calendar = fs.readFileSync(new URL('../calendar.html', import.meta.url), 'utf8');
const agenda = fs.readFileSync(new URL('../js/msh-continuity-agenda.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../css/msh-continuity-agenda.css', import.meta.url), 'utf8');

test('Calendar loads the Continuity Agenda surface', () => {
  assert.match(calendar, /msh-continuity-agenda\.css/);
  assert.match(calendar, /msh-continuity-agenda\.js/);
});

test('Agenda preserves the five continuity states', () => {
  for (const state of ['ready', 'waiting', 'risk', 'upcoming', 'resolved']) {
    assert.match(agenda, new RegExp(`\\b${state}\\b`));
  }
  assert.match(agenda, /Ready for you/);
  assert.match(agenda, /At risk/);
  assert.match(agenda, /Continuity restored/);
});

test('Medication approval remains an explicit user action', () => {
  assert.match(agenda, /Approve &amp; send/);
  assert.match(agenda, /data-approve-medication-request/);
  assert.match(agenda, /data-reschedule-medication-request/);
});

test('Agenda has explicit dark mode contrast rules', () => {
  assert.match(css, /\[data-theme="dark"\] \.msh-continuity-agenda/);
  assert.match(css, /--msh-dark-text-primary/);
});
