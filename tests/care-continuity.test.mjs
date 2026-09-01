import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const care = fs.readFileSync(new URL('../js/msh-care-continuity.js', import.meta.url), 'utf8');
const agenda = fs.readFileSync(new URL('../js/msh-continuity-agenda.js', import.meta.url), 'utf8');
const calendar = fs.readFileSync(new URL('../calendar.html', import.meta.url), 'utf8');

test('care continuity is wired into Calendar', () => {
  assert.match(calendar, /msh-care-continuity\.js/);
  assert.match(care, /care_followup/);
  assert.match(care, /appointment/);
  assert.match(care, /followup/);
  assert.match(care, /lab/);
  assert.match(care, /referral/);
  assert.match(care, /preventive/);
});

test('care continuity uses shared agenda states', () => {
  assert.match(agenda, /CARE_EVENT = 'care_followup'/);
  assert.match(agenda, /Mark resolved/);
  assert.match(agenda, /Needs attention/);
  assert.match(care, /status: waitingOn \? 'waiting' : 'scheduled'/);
  assert.match(care, /'at_risk'/);
  assert.match(care, /'resolved'/);
});
