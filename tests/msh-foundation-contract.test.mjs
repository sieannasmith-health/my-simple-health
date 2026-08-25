import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const shell = await readFile(new URL('../js/msh-shell.js', import.meta.url), 'utf8');
const hello = await readFile(new URL('../hello.html', import.meta.url), 'utf8');
const appCss = await readFile(new URL('../css/msh-app.css', import.meta.url), 'utf8');
const foundationCss = await readFile(new URL('../css/msh-foundation.css', import.meta.url), 'utf8');
const journeyCss = await readFile(new URL('../css/msh-journey.css', import.meta.url), 'utf8');

test('Hello is a primary workspace destination with an active-state key', () => {
  assert.match(shell, /key:'hello', label:'Hello'/);
  assert.doesNotMatch(shell, /msh-hello-launcher/);
  assert.match(hello, /data-msh-page="hello"/);
  assert.match(hello, /data-msh-header/);
  assert.match(hello, /data-msh-mobile-nav/);
  assert.match(shell, /mobileNav\.scrollLeft = currentLink\.offsetLeft/);
});

test('Hello uses the same-origin API and does not send a separate profile', () => {
  assert.match(hello, /fetch\(\s*"\/api\/hello"/);
  assert.doesNotMatch(hello, /my-simple-health\.vercel\.app\/api\/hello/);
  assert.doesNotMatch(hello, /profile\s*:/);
});

test('Horizon decorative line cannot overlap introductory text', () => {
  assert.match(appCss, /\.msh-horizon-glow\{display:none!important\}/);
});

test('buttons and action areas share explicit label centering', () => {
  assert.match(foundationCss, /\.msh-button,[\s\S]*text-align:\s*center/);
  assert.match(foundationCss, /\.msh-card-actions/);
});

test('Journey removes latency-producing transitions and respects reduced motion', () => {
  assert.match(journeyCss, /touch-action:pan-y/);
  assert.match(journeyCss, /transition:none/);
  assert.match(journeyCss, /prefers-reduced-motion:reduce/);
});

test('Hello inline application script remains syntactically valid', () => {
  const scripts = [...hello.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1]).filter(Boolean);
  assert.doesNotThrow(() => new vm.Script(scripts.at(-1), { filename:'hello-inline.js' }));
});
