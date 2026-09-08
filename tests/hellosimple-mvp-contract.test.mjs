import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../hellosimple/index.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../hellosimple/app.js', import.meta.url), 'utf8');

test('HelloSimple exposes the approved employee MVP surfaces', () => {
  for (const label of [
    'Today', 'Missions', 'Human Actions', 'Hello Workers', 'Workstreams', 'Journey',
    'Skills & Contribution', 'Impact Portfolio', 'Profile'
  ]) assert.match(js, new RegExp(label.replace(/[&]/g, '\\&')));
  assert.match(html, /HelloSimple/);
});

test('pilot profiles are independent and include founder + trial co-founder', () => {
  assert.match(js, /Siea Smith/);
  assert.match(js, /Founder & CEO/);
  assert.match(js, /Brandon Smith/);
  assert.match(js, /Growth & Commercial Strategy \(Trial\)/);
});

test('progression is tied to real missions, skills, evidence and the human lane', () => {
  assert.match(js, /evidence/i);
  assert.match(js, /Skill gained → contribution made → evidence recorded/);
  assert.match(js, /Human judgment, review, approval/i);
  assert.match(js, /Complete mission/);
  assert.match(js, /XP/i);
  assert.match(js, /training completion alone does not equal demonstrated skill/i);
});

test('daily work and progression remain separate from authorization', () => {
  assert.match(js, /Today's schedule/);
  assert.match(js, /Current company objective/);
  assert.match(js, /Rewards can unlock new mission types/i);
  assert.match(js, /XP never automatically grants/i);
});
