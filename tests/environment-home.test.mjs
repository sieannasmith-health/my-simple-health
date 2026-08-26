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

test('daypart engine resolves six local-time environmental states',() => {
  const environment = loadEnvironment();
  assert.equal(environment.resolve(new Date(2026,0,1,5,30)).id,'dawn');
  assert.equal(environment.resolve(new Date(2026,0,1,8,30)).id,'morning');
  assert.equal(environment.resolve(new Date(2026,0,1,12,0)).id,'day');
  assert.equal(environment.resolve(new Date(2026,0,1,16,30)).id,'golden');
  assert.equal(environment.resolve(new Date(2026,0,1,19,30)).id,'evening');
  assert.equal(environment.resolve(new Date(2026,0,1,23,0)).id,'night');
});

test('daypart progress stays bounded for smooth environmental interpolation',() => {
  const environment = loadEnvironment();
  for (const hour of [0,4,5,8,9,16,17,20,21,23]) {
    const progress = environment.resolve(new Date(2026,0,1,hour,30)).progress;
    assert.ok(progress >= 0 && progress <= 1);
  }
});

test('Home loads the environment before content and exposes one ambient Hello presence',() => {
  assert.match(healthHtml,/js\/msh-environment\.js/);
  assert.match(healthHtml,/css\/msh-environment\.css/);
  assert.match(healthHtml,/msh-environment-home/);
  assert.match(environmentCss,/\.msh-hello-launcher,.msh-environment-home \.msh-hello-dock\{display:none\}/);
  assert.doesNotMatch(dashboardSource,/msh-dashboard-hello-panel/);
});

test('Home orientation uses one dominant action and progressively reveals relevant context',() => {
  assert.match(dashboardSource,/msh-home-orientation/);
  assert.match(dashboardSource,/msh-home-primary/);
  assert.match(dashboardSource,/msh-home-context/);
  assert.match(dashboardSource,/moments\.slice\(0,2\)/);
  assert.doesNotMatch(dashboardSource,/msh-dashboard-three-column/);
});

test('environment includes responsive and reduced-motion static fallbacks',() => {
  assert.match(environmentCss,/@media\(max-width:860px\)/);
  assert.match(environmentCss,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(environmentCss,/animation:none!important/);
  assert.match(environmentCss,/\[data-daypart="night"\]/);
});

test('Home uses a photographic environmental plate rather than CSS-drawn landscape geometry',() => {
  assert.match(environmentCss,/my-health-world-v1\.jpg/);
  assert.doesNotMatch(dashboardSource,/msh-home-ridge|msh-home-water|msh-home-field|msh-home-sun/);
  assert.doesNotMatch(environmentCss,/clip-path:polygon/);
});

test('visual prototype includes the signature kinetic primitives and North Star behavior',() => {
  assert.match(healthHtml,/msh-system-loader/);
  assert.match(dashboardSource,/msh-kinetic-dots/);
  assert.match(dashboardSource,/msh-orbit/);
  assert.match(dashboardSource,/msh-editorial-metric/);
  assert.match(environmentSource,/mountNorthStar/);
  assert.match(environmentCss,/\.msh-north-star/);
});
