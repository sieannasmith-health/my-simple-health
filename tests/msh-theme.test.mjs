import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../js/msh-theme.js', import.meta.url), 'utf8');

function loadTheme({ stored = null, dark = false } = {}) {
  const values = new Map(stored === null ? [] : [['msh_theme_preference', stored]]);
  let systemListener = null;
  const media = {
    matches: dark,
    addEventListener(type, listener) { if (type === 'change') systemListener = listener; }
  };
  const documentElement = { dataset: {}, style: {} };
  const sandbox = {
    document: { documentElement },
    localStorage: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, String(value)); }
    },
    matchMedia() { return media; },
    Set
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'msh-theme.js' });
  return {
    ...sandbox,
    documentElement,
    values,
    setSystemDark(next) {
      media.matches = next;
      systemListener?.({ matches: next });
    }
  };
}

test('defaults to System and resolves before page styles load', () => {
  const light = loadTheme();
  assert.equal(light.documentElement.dataset.themePreference, 'system');
  assert.equal(light.documentElement.dataset.theme, 'light');
  assert.equal(light.documentElement.style.colorScheme, 'light');

  const dark = loadTheme({ dark: true });
  assert.equal(dark.documentElement.dataset.theme, 'dark');
});

test('persists an explicit preference and applies it immediately', () => {
  const sandbox = loadTheme({ dark: true });
  const result = sandbox.MSHTheme.setPreference('light');
  assert.deepEqual({ ...result }, { preference: 'light', resolved: 'light' });
  assert.equal(sandbox.values.get('msh_theme_preference'), 'light');
  assert.equal(sandbox.documentElement.dataset.theme, 'light');
});

test('System responds when the browser color scheme changes', () => {
  const sandbox = loadTheme({ stored: 'system', dark: false });
  sandbox.setSystemDark(true);
  assert.equal(sandbox.documentElement.dataset.themePreference, 'system');
  assert.equal(sandbox.documentElement.dataset.theme, 'dark');
  sandbox.setSystemDark(false);
  assert.equal(sandbox.documentElement.dataset.theme, 'light');
});

test('invalid stored values safely normalize to System', () => {
  const sandbox = loadTheme({ stored: 'sepia', dark: true });
  assert.equal(sandbox.MSHTheme.getPreference(), 'system');
  assert.equal(sandbox.documentElement.dataset.theme, 'dark');
});

test('workspace pages initialize the theme before loading CSS', async () => {
  const pages = [
    'my-health.html',
    'my-landscape.html',
    'my-vision.html',
    'my-project.html',
    'my-practice.html',
    'my-learning.html',
    'my-progress.html',
    'hello.html'
  ];
  for (const page of pages) {
    const html = await readFile(new URL(`../${page}`, import.meta.url), 'utf8');
    const themeIndex = html.indexOf('js/msh-theme.js');
    const cssIndex = html.indexOf('rel="stylesheet"');
    assert.ok(themeIndex > -1, `${page} includes the theme runtime`);
    assert.ok(themeIndex < cssIndex, `${page} applies theme before styles`);
  }
});

function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('core text and control token pairs meet WCAG AA contrast', () => {
  const pairs = [
    ['#2b302c', '#f7f4ec', 'light body text'],
    ['#606963', '#f7f4ec', 'light muted text'],
    ['#173d2b', '#fcfbf7', 'light forest text'],
    ['#e8eae4', '#1b211d', 'dark body text'],
    ['#bcc3bc', '#1b211d', 'dark muted text'],
    ['#f0f1eb', '#252c27', 'dark card heading'],
    ['#182019', '#c8ddbd', 'dark primary button']
  ];
  for (const [foreground, background, label] of pairs) {
    assert.ok(contrast(foreground, background) >= 4.5, `${label} meets 4.5:1`);
  }
});
