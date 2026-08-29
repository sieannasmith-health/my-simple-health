import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const ui=await readFile(new URL('../js/msh-calendar.js',import.meta.url),'utf8');
const css=await readFile(new URL('../css/msh-cycle.css',import.meta.url),'utf8');
const storage=await readFile(new URL('../js/msh-storage.js',import.meta.url),'utf8');

test('Calendar is framed as health in time rather than a period tracker',()=>{
  assert.match(ui,/Calendar · Health in time/);
  assert.match(ui,/What is happening when\?/);
  assert.match(ui,/Month[\s\S]*Timeline[\s\S]*Cycle layer/);
  assert.doesNotMatch(ui,/Calendar · Cycle layer/);
});

test('Calendar derives dated context from existing records without a competing data store',()=>{
  for(const source of ['calendar.events','progressEvents','practiceAttempts','practices','projects'])assert.match(ui,new RegExp(source.replace('.','\\.')));
  assert.match(ui,/shown from their original records rather than copied into Calendar/);
  assert.doesNotMatch(ui,/calendar\.events\.push/);
});

test('existing storage layers remain the source of visibility preferences',()=>{
  for(const layer of ['cycle','life','appointments','practices','projects','routines'])assert.match(storage,new RegExp(`${layer}:true`));
  assert.match(ui,/data-calendar-layer/);
  assert.match(ui,/calendar\.settings\.layers/);
});

test('a selected date has an inspectable, nonjudgmental health-time view',()=>{
  assert.match(ui,/What was happening around this time\?/);
  assert.match(ui,/An open day is still part of the picture/);
  assert.match(ui,/aria-live="polite"/);
  assert.match(css,/msh-date-inspector/);
});

test('cycle remains a distinct layer with recorded and predicted boundaries intact',()=>{
  assert.match(ui,/Cycle layer/);
  assert.match(ui,/Estimated, not recorded/);
  assert.match(ui,/should not be relied upon as contraception/);
  assert.match(ui,/data-cycle-form/);
  assert.match(ui,/Cycle privacy and use/);
});

test('responsive, focus, and reduced-motion treatments cover the new Calendar controls',()=>{
  assert.match(css,/msh-calendar-layers input:focus-visible/);
  assert.match(css,/@media\(max-width:920px\)/);
  assert.match(css,/@media\(max-width:600px\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
