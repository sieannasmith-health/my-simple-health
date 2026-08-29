import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const environmentSource = await readFile(new URL('../js/msh-environment.js',import.meta.url),'utf8');
const dashboardSource = await readFile(new URL('../js/msh-dashboard.js',import.meta.url),'utf8');
const environmentCss = await readFile(new URL('../css/msh-environment.css',import.meta.url),'utf8');
const healthHtml = await readFile(new URL('../my-health.html',import.meta.url),'utf8');

function loadEnvironment() {
  const sandbox = { Date, setInterval:() => 0 };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(environmentSource,sandbox,{filename:'msh-environment.js'});
  return sandbox.MSHEnvironment;
}

test('daypart engine resolves four atmospheric states in one persistent world',() => {
  const environment = loadEnvironment();
  assert.equal(environment.resolve(new Date(2026,0,1,5,30)).id,'morning');
  assert.equal(environment.resolve(new Date(2026,0,1,8,30)).id,'morning');
  assert.equal(environment.resolve(new Date(2026,0,1,12,0)).id,'afternoon');
  assert.equal(environment.resolve(new Date(2026,0,1,16,30)).id,'afternoon');
  assert.equal(environment.resolve(new Date(2026,0,1,19,30)).id,'evening');
  assert.equal(environment.resolve(new Date(2026,0,1,23,0)).id,'night');
});

test('environmental light, warmth, haze, and Glass values interpolate continuously',() => {
  const environment = loadEnvironment();
  for (const hour of [0,4,5,8,9,16,17,20,21,23]) {
    const state = environment.resolve(new Date(2026,0,1,hour,30));
    for (const key of ['progress','light','warmth','haze','glass']) assert.ok(state[key] >= 0 && state[key] <= 1,`${key} must stay bounded`);
  }
  const before = environment.resolve(new Date(2026,0,1,11,59));
  const after = environment.resolve(new Date(2026,0,1,12,1));
  assert.ok(Math.abs(before.light - after.light) < .03,'crossing a named state must not visually jump');
});

test('Home loads the environment without exposing the paused Hello presence',() => {
  assert.match(healthHtml,/js\/msh-environment\.js/);
  assert.match(healthHtml,/css\/msh-environment\.css/);
  assert.match(healthHtml,/msh-environment-home/);
  assert.match(environmentCss,/\.msh-hello-launcher,.msh-environment-home \.msh-hello-dock\{display:none\}/);
  assert.doesNotMatch(dashboardSource,/data-msh-hello-open|msh-ambient-glass/);
  assert.doesNotMatch(dashboardSource,/msh-dashboard-hello-panel/);
});

test('Home uses one Glass Health Map instead of a dashboard summary',() => {
  assert.match(dashboardSource,/msh-health-map-board/);
  assert.match(dashboardSource,/msh-health-map-you/);
  assert.match(dashboardSource,/renderHealthLayer/);
  assert.doesNotMatch(dashboardSource,/signalCount|current parts of your picture/);
  assert.doesNotMatch(dashboardSource,/msh-dashboard-three-column/);
});

test('environment includes responsive and reduced-motion static fallbacks',() => {
  assert.match(environmentCss,/@media\(max-width:860px\)/);
  assert.match(environmentCss,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(environmentCss,/animation:none!important/);
  assert.match(environmentCss,/\[data-daypart="night"\]/);
  assert.match(environmentCss,/--msh-environment-light/);
  assert.match(environmentCss,/transition:filter 60s linear/);
});

test('Home uses a photographic environmental plate rather than CSS-drawn landscape geometry',() => {
  assert.match(environmentCss,/my-health-world-v1\.jpg/);
  assert.doesNotMatch(dashboardSource,/msh-home-ridge|msh-home-water|msh-home-field|msh-home-sun/);
  assert.doesNotMatch(environmentCss,/clip-path:polygon/);
});

test('visual system retains reusable kinetic primitives and North Star behavior',() => {
  assert.match(healthHtml,/msh-system-loader/);
  assert.match(environmentCss,/msh-kinetic-dots/);
  assert.match(environmentCss,/msh-orbit/);
  assert.match(environmentCss,/msh-editorial-metric/);
  assert.match(environmentSource,/mountNorthStar/);
  assert.match(environmentCss,/\.msh-north-star/);
});
