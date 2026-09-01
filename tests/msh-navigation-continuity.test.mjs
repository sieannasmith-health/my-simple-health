import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const routeSource = await read('js/msh-routes.js');
const shellSource = await read('js/msh-shell.js');
const dashboardSource = await read('js/msh-dashboard.js');
const calendarSource = await read('js/msh-calendar.js');

function loadRoutes(pathname='/my-health.html', search='') {
  const listeners={};
  const document={body:{dataset:{mshPage:'health'}},addEventListener(type,listener){listeners[type]=listener;},querySelectorAll(){return[];}};
  const sandbox={URL,URLSearchParams,Date,document,location:{href:`https://msh.test${pathname}${search}`,origin:'https://msh.test',pathname,search},sessionStorage:{setItem(){}}};
  sandbox.window=sandbox;sandbox.globalThis=sandbox;
  vm.runInNewContext(routeSource,sandbox,{filename:'msh-routes.js'});
  return sandbox.MSHRoutes;
}

test('canonical registry separates private, public, and external destinations', () => {
  const routes=loadRoutes();
  for(const key of ['health','explore','tools','calendar','landscape','assessments','horizon','path','practice','discovery','journey','healthStory','cycle','movement','hello'])assert.equal(routes.get(key).type,'PRIVATE');
  for(const key of ['publicHome','science','publicResources','recipes'])assert.equal(routes.get(key).type,'PUBLIC');
  assert.equal(routes.classify('https://example.com/health'),'EXTERNAL');
  assert.equal(routes.classify('mailto:hello@example.com'),'EXTERNAL');
  assert.equal(routes.href('landscape'),'health-landscape.html');
  assert.equal(routes.href('healthStory'),'my-health-story.html');
  assert.equal(routes.href('cycle',{from:'tools'}),'calendar.html?view=cycle&from=tools');
});

test('shared primary navigation never routes a private tab to the public site', () => {
  for(const key of ['health','explore','tools','calendar'])assert.match(shellSource,new RegExp(`'${key}'`));
  assert.doesNotMatch(shellSource,/href:'topics\.html'|simplifiedHealthNav/);
  assert.match(shellSource,/MSHRoutes\.currentKey\(\)/);
  assert.match(shellSource,/MSHRoutes\.decorate\(document\)/);
});

test('active private pages load continuity state before mounting the shared shell', async () => {
  const pages=['my-health.html','my-landscape.html','my-vision.html','my-project.html','my-practice.html','my-learning.html','my-progress.html','calendar.html','assessments.html','health-landscape.html','hello.html'];
  for(const page of pages){
    const html=await read(page);
    for(const asset of ['js/msh-theme.js','js/msh-routes.js','js/msh-environment.js','js/msh-feedback.js','js/msh-sound.js','css/msh-foundation.css','css/msh-app.css','css/msh-sensory.css','js/msh-shell.js'])assert.match(html,new RegExp(asset.replaceAll('.','\\.')),`${page} includes ${asset}`);
    assert.ok(html.indexOf('js/msh-routes.js') < html.lastIndexOf('js/msh-shell.js'),`${page} loads routes before shell`);
    assert.match(html,/data-msh-header/);
    assert.match(html,/data-msh-mobile-nav/);
  }
});

test('Explore stays private and exposes public science as an explicit doorway', () => {
  assert.match(dashboardSource,/state:'explore'/);
  assert.match(dashboardSource,/route\('landscape',\{from:'explore'\}\)/);
  assert.match(dashboardSource,/route\('assessments',\{from:'explore'\}\)/);
  assert.match(dashboardSource,/Public My Simple Health/);
  assert.match(dashboardSource,/Go to the public science library/);
});

test('canonical Landscape replaces paused Dimensions in primary and first-use routes', async () => {
  const [firstDoor,entry,landscape]=await Promise.all([read('js/msh-first-door.js'),read('js/msh-my-health-entry.js'),read('js/msh-landscape.js')]);
  assert.match(routeSource,/landscape: Object\.freeze\([^\n]*href:'health-landscape\.html'/);
  assert.doesNotMatch(firstDoor,/my-landscape\.html\?start=dimensions/);
  assert.match(entry,/landscape:'health-landscape\.html'/);
  assert.doesNotMatch(landscape,/href="wellness-wheel\.html"/);
});

test('Cycle and Movement deep links enter Calendar without adding a domain-level primary view', () => {
  assert.match(calendarSource,/requestedView = routeParameters\.get\('view'\)/);
  assert.match(calendarSource,/requestedView==='timeline' \? 'timeline' : 'calendar'/);
  assert.match(calendarSource,/customizationOpen = requestedView==='cycle'/);
  assert.match(calendarSource,/requestedView === 'movement' \? 'plan' : null/);
  assert.match(dashboardSource,/data-msh-route="cycle"/);
  assert.match(dashboardSource,/data-msh-route="movement"/);
});

test('transition vocabulary preserves browser navigation responsiveness', () => {
  const routes=loadRoutes();
  assert.equal(routes.transition('health',routes.get('tools')),'glide');
  assert.equal(routes.transition('explore',routes.get('landscape')),'open');
  assert.equal(routes.transition('landscape',routes.get('health')),'return');
  assert.equal(routes.transition('health',routes.get('science')),'doorway');
  assert.equal(routes.transition('health',{type:'EXTERNAL',key:'outside'}),'departure');
  assert.doesNotMatch(routeSource,/setTimeout\([^)]*location|preventDefault\(\).*location/s);
});
