import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const foundation = read('css/msh-foundation.css');
const environmentCss = read('css/msh-environment.css');
const workspaceCss = read('css/msh-glass-workspace.css');
const sensoryCss = read('css/msh-sensory.css');
const environmentJs = read('js/msh-environment.js');

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

function runtime() {
  const sandbox = { Date, setInterval() { return 0; } };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(environmentJs, sandbox, { filename: 'msh-environment.js' });
  return sandbox.MSHEnvironment;
}

function luminance(rgb) {
  const channels = rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (values[0] + .05) / (values[1] + .05);
}

function blend(foreground, alpha, background) {
  return foreground.map((channel, index) => channel * alpha + background[index] * (1 - alpha));
}

test('Light and Dark expose one complete, centralized Glass token family', () => {
  const light = block(foundation, ':root,\n[data-theme="light"]');
  const dark = block(foundation, '[data-theme="dark"]');
  for (const token of ['soft-bg', 'reading-bg', 'panel-bg', 'overlay-bg', 'border', 'text-primary', 'text-secondary', 'ink', 'ink-secondary']) {
    assert.match(light, new RegExp(`--msh-glass-${token}:`), `Light missing ${token}`);
    assert.match(dark, new RegExp(`--msh-glass-${token}:`), `Dark missing ${token}`);
  }
});

test('time controls atmosphere without owning any Glass theme token', () => {
  assert.doesNotMatch(environmentCss, /\[data-daypart=[^\]]+\][^{]*\{[^}]*--msh-glass-/);
  const env = runtime();
  assert.equal(env.resolve(new Date(2026, 7, 29, 13, 30)).id, 'afternoon');
  assert.equal(env.resolve(new Date(2026, 7, 29, 22, 30)).id, 'night');
  assert.equal('theme' in env.resolve(new Date(2026, 7, 29, 13, 30)), false);
  assert.equal('theme' in env.resolve(new Date(2026, 7, 29, 22, 30)), false);
});

test('workspace, carousel panels, and controls consume the Glass family', () => {
  assert.match(workspaceCss, /\.msh-glass-workspace\{[^}]*background:var\(--msh-glass-reading-bg\)[^}]*color:var\(--msh-glass-ink\)/);
  assert.match(workspaceCss, /\.msh-tools-directory section\{[^}]*background:var\(--msh-glass-panel-bg\)[^}]*color:var\(--msh-glass-text-primary\)/);
  assert.match(sensoryCss, /\.msh-glide-arrow\{[^}]*background:var\(--msh-glass-panel-bg\)[^}]*color:var\(--msh-glass-text-primary\)/);
  assert.doesNotMatch(block(workspaceCss, '.msh-glass-workspace'), /60s/);
});

test('Glass text retains WCAG AA contrast over worst-case environmental backdrops', () => {
  const lightBackdrop = [0, 0, 0];
  const lightReading = blend([245, 241, 231], .82, lightBackdrop);
  const lightPanel = blend([255, 253, 249], .9, lightBackdrop);
  for (const surface of [lightReading, lightPanel]) {
    assert.ok(contrast([37, 40, 34], surface) >= 4.5);
    assert.ok(contrast([72, 77, 71], surface) >= 4.5);
  }

  const darkBackdrop = [255, 255, 255];
  const darkReading = blend([20, 23, 21], .84, darkBackdrop);
  const darkPanel = blend([27, 30, 28], .96, darkBackdrop);
  for (const surface of [darkReading, darkPanel]) {
    const secondary = blend([245, 241, 231], .78, surface);
    assert.ok(contrast([245, 241, 231], surface) >= 4.5);
    assert.ok(contrast(secondary, surface) >= 4.5);
  }
});

test('private surface matrix loads shared theme before workspace presentation', () => {
  for (const page of ['my-health.html', 'calendar.html']) {
    const html = read(page);
    assert.ok(html.indexOf('js/msh-theme.js') < html.indexOf('css/msh-foundation.css'), `${page} must apply theme before styles`);
    assert.match(html, /css\/msh-foundation\.css/);
  }
  const health = read('my-health.html');
  assert.match(health, /css\/msh-glass-workspace\.css/);
  assert.match(health, /css\/msh-thought-capture\.css/);
  for (const view of ['explore', 'tools']) assert.match(read('js/msh-dashboard.js'), new RegExp(view));
});
