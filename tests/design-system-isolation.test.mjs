import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const modernRoutes = [
  'index.html',
  'my-health.html',
  'my-landscape.html',
  'my-vision.html',
  'my-project.html',
  'my-practice.html',
  'my-learning.html',
  'my-progress.html',
  'calendar.html',
  'hello.html'
];

test('modern product routes load the canonical foundation without legacy style.css', async () => {
  for (const route of modernRoutes) {
    const html = await readFile(new URL(`../${route}`, import.meta.url), 'utf8');
    assert.match(html, /href=["']css\/msh-foundation\.css["']/);
    assert.doesNotMatch(html, /href=["']style\.css["']/);
  }
});

test('legacy and supporting public surfaces retain style.css during isolation', async () => {
  for (const route of ['assessments.html', 'wellness-wheel.html']) {
    const html = await readFile(new URL(`../${route}`, import.meta.url), 'utf8');
    assert.match(html, /href=["']style\.css["']/);
  }
});

test('canonical foundation owns theme, palette, primitive, focus, and motion contracts', async () => {
  const css = await readFile(new URL('../css/msh-foundation.css', import.meta.url), 'utf8');
  for (const token of [
    '--msh-page', '--msh-surface', '--msh-surface-elevated', '--msh-text',
    '--msh-text-muted', '--msh-forest', '--msh-sage', '--msh-cream',
    '--msh-ivory', '--msh-beige', '--msh-clay', '--msh-gold',
    '--msh-blue-gray', '--msh-border', '--msh-shadow', '--msh-radius-lg',
    '--msh-space-4', '--msh-font-editorial', '--msh-focus', '--msh-motion-base'
  ]) assert.match(css, new RegExp(token));

  assert.match(css, /\[data-theme="dark"\]/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /\.msh-button/);
  assert.match(css, /\.msh-card/);
  assert.match(css, /:focus-visible/);
});

test('Hello owns its specialized conversation layout outside the legacy stylesheet', async () => {
  const html = await readFile(new URL('../hello.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../css/msh-hello-base.css', import.meta.url), 'utf8');
  assert.match(html, /msh-hello-base\.css[\s\S]*msh-app\.css/);
  for (const selector of [
    '.hello-page', '.hello-shell', '.hello-chat-wrap', '.hello-chat-thread',
    '.hello-message-row', '.hello-bubble', '.hello-input-wrap', '.hello-send-btn',
    '.hello-context-bar', '.hello-actions'
  ]) assert.ok(css.includes(selector), `${selector} should remain in the Hello module`);
});
