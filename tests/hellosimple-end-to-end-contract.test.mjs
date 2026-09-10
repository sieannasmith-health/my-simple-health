import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../hellosimple/app.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../hellosimple/styles.css', import.meta.url), 'utf8');
const html = await readFile(new URL('../hellosimple/index.html', import.meta.url), 'utf8');

test('HelloSimple exposes the complete employee operating journey', () => {
  for (const label of ['Today','Missions','Human Actions','Hello Workers','Workstreams','Journey','Skills & Contribution','Impact Portfolio','Profile']) {
    assert.match(app, new RegExp(label.replace(/[&]/g, '&')));
  }
});

test('Today ties role, schedule, human work, AI work, and company objective together', () => {
  assert.match(app, /Current company objective/);
  assert.match(app, /Today's schedule/);
  assert.match(app, /Needs you/);
  assert.match(app, /Dynamic work/);
  assert.match(app, /Hello Workers/);
});

test('progression is evidence-backed and does not grant sensitive authority', () => {
  assert.match(app, /Completion evidence/);
  assert.match(app, /Impact Portfolio/);
  assert.match(app, /Rewards unlock progression and responsibility, not sensitive authority/);
});

test('pilot profiles are independent and include Brandon trial progression', () => {
  assert.match(app, /Founder & CEO/);
  assert.match(app, /Co-Founder, Growth & Commercial Strategy \(Trial\)/);
  assert.match(app, /Founding Operator/);
  assert.match(app, /Founder Review/);
});

test('interface remains professional and responsive', () => {
  assert.match(css, /@media/);
  assert.match(css, /grid-template-columns/);
  assert.match(html, /viewport/);
  assert.doesNotMatch(app, /confetti|fireworks|animation:/i);
});
