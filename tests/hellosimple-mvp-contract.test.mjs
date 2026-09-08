import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../hellosimple/index.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../hellosimple/app.js', import.meta.url), 'utf8');

test('HelloSimple exposes the approved employee MVP surfaces', () => {
  for (const label of [
    'Today',
    'Missions',
    'Human Actions',
    'Hello Workers',
    'Skills & Contribution',
    'Impact Portfolio',
    'Profile'
  ]) assert.match(js, new RegExp(label.replace(/[&]/g, '\\&')));
  assert.match(html, /HelloSimple/);
});

test('pilot profiles are independent and include founder + trial co-founder', () => {
  assert.match(js, /Siea Smith/);
  assert.match(js, /Founder & CEO/);
  assert.match(js, /Brandon Smith/);
  assert.match(js, /Growth & Commercial Strategy \(Trial\)/);
});

test('progression is tied to real missions, skills, evidence and human lane', () => {
  assert.match(js, /Evidence:/);
  assert.match(js, /Skill gained → contribution made → evidence recorded/);
  assert.match(js, /Human judgment, review, approval, or action/);
  assert.match(js, /Complete mission/);
  assert.match(js, /XP earned/);
});
