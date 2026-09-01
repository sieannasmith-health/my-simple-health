import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const foundation = fs.readFileSync(new URL('../css/msh-foundation.css', import.meta.url), 'utf8');
const environment = fs.readFileSync(new URL('../css/msh-environment.css', import.meta.url), 'utf8');
const workspace = fs.readFileSync(new URL('../css/msh-glass-workspace.css', import.meta.url), 'utf8');
const calendar = fs.readFileSync(new URL('../css/msh-cycle.css', import.meta.url), 'utf8');

function block(source, selector) {
  const start = source.indexOf(selector);
  assert.notEqual(start, -1, `Missing ${selector}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error(`Unclosed ${selector}`);
}

function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map(value => Number.parseInt(value, 16) / 255);
  const linear = channels.map(value => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

test('dark mode establishes a neutral canvas and three neutral charcoal elevations', () => {
  const dark = block(foundation, '[data-theme="dark"]');
  assert.match(dark, /--msh-dark-canvas:\s*#0d0f0e/);
  assert.match(dark, /--msh-dark-surface-1:\s*#141715/);
  assert.match(dark, /--msh-dark-surface-2:\s*#1b1e1c/);
  assert.match(dark, /--msh-dark-surface-3:\s*#232724/);
  assert.match(dark, /--msh-page:\s*var\(--msh-dark-canvas\)/);
  assert.match(dark, /--msh-surface:\s*var\(--msh-dark-surface-1\)/);
  assert.doesNotMatch(dark, /--msh-page:\s*#1b211d|--msh-surface:\s*#252c27/);
});

test('dark mode uses warm-white text with accessible primary contrast', () => {
  const dark = block(foundation, '[data-theme="dark"]');
  assert.match(dark, /--msh-dark-text-primary:\s*#f5f1e7/);
  assert.match(dark, /--msh-dark-text-secondary:\s*rgba\(245, 241, 231, \.74\)/);
  assert.match(dark, /--msh-dark-text-muted:\s*rgba\(245, 241, 231, \.56\)/);
  assert.ok(contrast('#f5f1e7', '#0d0f0e') >= 7, 'primary dark-mode contrast should exceed WCAG AAA for body text');
});

test('dark glass and headers remain neutral while brand color stays an accent', () => {
  const dark = block(foundation, '[data-theme="dark"]');
  const header = block(foundation, '[data-theme="dark"] .msh-app-header');
  assert.match(dark, /--msh-glass-soft-bg:\s*rgba\(13, 15, 14, \.78\)/);
  assert.match(dark, /--msh-glass-reading-bg:\s*rgba\(20, 23, 21, \.84\)/);
  assert.match(dark, /--msh-glass-panel-bg:\s*rgba\(27, 30, 28, \.96\)/);
  assert.match(dark, /--msh-glass-overlay-bg:\s*rgba\(27, 30, 28, \.96\)/);
  assert.match(dark, /--msh-glass-text-primary:\s*#f5f1e7/);
  assert.match(dark, /--msh-glass-text-secondary:\s*rgba\(245, 241, 231, \.78\)/);
  assert.match(dark, /--msh-accent:\s*#a9bb91/);
  assert.match(header, /background:\s*rgba\(13,\s*15,\s*14,\s*\.82\)/);
});

test('environment does not override theme-owned glass surfaces', () => {
  const sources = [foundation, environment, workspace];
  const legacyGreenSurfaces = /rgba\((?:18,31,25|20,29,24|27,37,31)|#1b211d|#252c27|#2a322c|#2d352f|#30382f/;
  sources.forEach(source => assert.doesNotMatch(source, legacyGreenSurfaces));
  assert.doesNotMatch(environment, /\[data-daypart=[^\]]+\][^{]*\{[^}]*--msh-glass-(?:soft|reading|panel|overlay|ink)/);
  assert.doesNotMatch(environment, /\[data-daypart=[^\]]+\][^{]*\.msh-app-(?:header|logo|nav)/);
});

test('theme switching does not inherit the environmental sixty-second transition', () => {
  const glass = block(workspace, '.msh-glass-workspace');
  assert.match(glass, /background-color\s+var\(--msh-motion-base\)/);
  assert.doesNotMatch(glass, /60s/);
  assert.match(workspace, /\.msh-tools-directory section\{[^}]*background:var\(--msh-glass-panel-bg\)[^}]*color:var\(--msh-glass-text-primary\)/);
});

test('Calendar builds neutral hierarchy from shared surfaces and reserves accent for selected states', () => {
  assert.match(calendar, /\.msh-cycle-calendar-panel,.msh-cycle-content\{[^}]*background:var\(--msh-surface\)/);
  assert.match(calendar, /\.msh-calendar-day\{[^}]*background:var\(--msh-surface-alt\)/);
  assert.match(calendar, /\.msh-date-inspector\{[^}]*background:linear-gradient\(150deg,var\(--msh-surface\),var\(--msh-surface-alt\)\)/);
  assert.match(calendar, /\.msh-calendar-customization>summary\{[^}]*background:var\(--msh-surface-alt\)/);
  assert.match(calendar, /\.msh-calendar-main\.has-calendar-accent \.msh-cycle-tabs button\[aria-selected="true"\]/);
});
