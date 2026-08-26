import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const componentSource = await readFile(new URL('../js/msh-glass-workspace.js',import.meta.url),'utf8');
const dashboardSource = await readFile(new URL('../js/msh-dashboard.js',import.meta.url),'utf8');
const shellSource = await readFile(new URL('../js/msh-shell.js',import.meta.url),'utf8');
const css = await readFile(new URL('../css/msh-glass-workspace.css',import.meta.url),'utf8');
const html = await readFile(new URL('../my-health.html',import.meta.url),'utf8');

function loadComponent() {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(componentSource,sandbox,{filename:'msh-glass-workspace.js'});
  return sandbox.MSHGlassWorkspace;
}

test('Glass Workspace is a reusable labelled surface with selectable regions',() => {
  const glass = loadComponent();
  const output = glass.markup({ state:'test', title:'A question', intro:'Some context', choices:[{id:'one',label:'One choice',detail:'Useful detail'}] });
  assert.match(output,/data-msh-glass/);
  assert.match(output,/aria-labelledby="msh-glass-title"/);
  assert.match(output,/data-glass-choice="one"/);
  assert.match(output,/role="listitem"/);
  assert.match(output,/tabindex="-1"/);
});

test('My Health proves the complete Something is not working to Sleep answer branch',() => {
  assert.match(dashboardSource,/value === 'not_working'/);
  assert.match(dashboardSource,/What feels hardest right now\?/);
  assert.match(dashboardSource,/What has your sleep been like\?/);
  assert.match(dashboardSource,/Sleep — waking during the night/);
  assert.match(dashboardSource,/Waking during the night/);
  assert.match(dashboardSource,/Answer \/ Depth on demand/);
  assert.match(dashboardSource,/saveEntry\('not_working', 'Sleep — waking during the night'/);
});

test('answer surface exposes only functional comprehension and next-direction controls',() => {
  assert.match(dashboardSource,/aria-label="Answer comprehension"/);
  assert.match(dashboardSource,/aria-current="true">Read/);
  assert.match(dashboardSource,/<summary>Sources<\/summary>/);
  assert.doesNotMatch(dashboardSource,/>Listen<|>Visual</);
  assert.match(dashboardSource,/data-msh-hello-open/);
  assert.match(dashboardSource,/href="calendar\.html"/);
});

test('simplified My Health shell does not remove the underlying journey navigation',() => {
  assert.match(shellSource,/simplifiedHealthNav/);
  for (const label of ['My Health','Explore','Tools','Hello']) assert.match(shellSource,new RegExp(`label:'${label}'`));
  for (const label of ['Landscape','Horizon','Path','Practice','Discovery','Journey','Calendar']) assert.match(shellSource,new RegExp(`label:'${label}'`));
});

test('Glass Workspace supports contrast, focus, touch, mobile, fallback, and reduced motion',() => {
  assert.match(html,/msh-glass-workspace\.css/);
  assert.match(html,/msh-glass-workspace\.js/);
  assert.match(css,/backdrop-filter:blur\(18px\)/);
  assert.match(css,/@supports not/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/min-height:144px/);
  assert.match(css,/@media\(max-width:600px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/transition:none!important/);
});
