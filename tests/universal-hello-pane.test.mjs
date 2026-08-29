import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const paneSource = await readFile(new URL('../js/msh-hello-workspace.js', import.meta.url), 'utf8');
const shellSource = await readFile(new URL('../js/msh-shell.js', import.meta.url), 'utf8');
const storageSource = await readFile(new URL('../js/msh-storage.js', import.meta.url), 'utf8');
const paneCss = await readFile(new URL('../css/msh-hello-pane.css', import.meta.url), 'utf8');
const helloHtml = await readFile(new URL('../hello.html', import.meta.url), 'utf8');
const embedSource = await readFile(new URL('../js/msh-hello-embed.js', import.meta.url), 'utf8');
const { sanitizeActivityContext } = await import('../api/sanitizeJourneyContext.js');

function memoryStorage() {
  const values = new Map();
  return {
    getItem:key => values.has(key) ? values.get(key) : null,
    setItem:(key, value) => values.set(key, String(value)),
    removeItem:key => values.delete(key)
  };
}

function paneRuntime() {
  const sandbox = { console, localStorage:memoryStorage(), sessionStorage:memoryStorage(), innerWidth:1440 };
  vm.createContext(sandbox);
  vm.runInContext(paneSource, sandbox);
  return sandbox.MSHHelloPane;
}

test('one shell module owns Docked, Floating, and Full presentation states', () => {
  const pane = paneRuntime();
  assert.deepEqual({ ...pane.STATES }, { DOCKED:'docked', FLOATING:'floating', FULL:'full' });
  assert.equal(pane.clampWidth(200, 1440), 400);
  assert.equal(pane.clampWidth(900, 1440), 720);
  assert.equal(pane.clampWidth(480, 1440), 480);
});

test('the paused Hello pane remains reusable but is not mounted by the application shell', () => {
  assert.doesNotMatch(shellSource, /msh-hello-workspace\.js|MSHHelloPane\.mount/);
  assert.match(paneSource, /src="hello\.html\?embedded=1"/);
  assert.doesNotMatch(paneSource, /fetch\(|\/api\/hello|renderHelloResponse|handleGuidedResponse/);
  assert.match(helloHtml, /js\/msh-hello-embed\.js/);
  assert.equal((helloHtml.match(/fetch\(\s*"\/api\/hello"/g) || []).length, 1);
});

test('page context contract is system-observed and explicitly non-recordable', () => {
  assert.match(shellSource, /route:/);
  assert.match(shellSource, /visibleActivity:/);
  assert.match(shellSource, /selectedObjectType/);
  assert.match(shellSource, /projectId/);
  assert.match(shellSource, /practiceId/);
  assert.match(shellSource, /questionText/);
  assert.match(shellSource, /allowedActions/);
  assert.match(shellSource, /provenance: 'SYSTEM_OBSERVED'/);
  assert.match(shellSource, /recordable: false/);

  const localStorage = memoryStorage();
  const sandbox = { console, localStorage, crypto:{ randomUUID:() => 'test' } };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(storageSource, sandbox);
  const stored = sandbox.MSHStorage.setHelloActivity({
    route:'/my-practice.html', page:'practice', activity:'practice', visibleActivity:'Practice experience',
    selectedObjectType:'practice', selectedObjectId:'p1', selectedObjectLabel:'Walk after lunch',
    projectId:'project1', practiceId:'p1', questionText:'How did that fit today?',
    allowedActions:['explain','reflect','adapt'], provenance:'SYSTEM_OBSERVED', recordable:true
  });
  assert.equal(stored.recordable, false);
  assert.equal(stored.provenance, 'SYSTEM_OBSERVED');
  assert.deepEqual([...stored.allowedActions], ['explain','reflect','adapt']);

  const serverContext = sanitizeActivityContext(stored);
  assert.equal(serverContext.route, '/my-practice.html');
  assert.equal(serverContext.visibleActivity, 'Practice experience');
  assert.equal(serverContext.selectedObjectLabel, 'Walk after lunch');
  assert.deepEqual(serverContext.allowedActions, ['explain','reflect','adapt']);
  assert.equal(serverContext.provenance, 'SYSTEM_OBSERVED');
  assert.equal(serverContext.recordable, false);
});

test('left-edge resize preserves the right edge while changing width', () => {
  const pane = paneRuntime();
  const start = { left:500, top:100, width:500, height:600 };
  const result = pane.resizeGeometry(start, 80, 0, 'left', { width:1440, height:900 });
  assert.equal(result.width, 420);
  assert.equal(result.left, 580);
  assert.equal(result.left + result.width, start.left + start.width);
});

test('top-edge resize preserves the bottom edge while changing height', () => {
  const pane = paneRuntime();
  const start = { left:500, top:100, width:500, height:600 };
  const result = pane.resizeGeometry(start, 0, 80, 'top', { width:1440, height:900 });
  assert.equal(result.height, 520);
  assert.equal(result.top, 180);
  assert.equal(result.top + result.height, start.top + start.height);
});

test('corner resize changes width and height together', () => {
  const pane = paneRuntime();
  const start = { left:500, top:160, width:500, height:560 };
  const result = pane.resizeGeometry(start, -80, -60, 'corner', { width:1440, height:900 });
  assert.equal(result.width, 580);
  assert.equal(result.height, 620);
  assert.equal(result.left + result.width, start.left + start.width);
  assert.equal(result.top + result.height, start.top + start.height);
});

test('geometry respects min and max boundaries and cannot leave the viewport', () => {
  const pane = paneRuntime();
  const tiny = pane.clampGeometry({ width:10, height:10, left:-100, top:-100 }, { width:1280, height:800 }, pane.STATES.FLOATING);
  const huge = pane.clampGeometry({ width:5000, height:5000, left:5000, top:5000 }, { width:1280, height:800 }, pane.STATES.FLOATING);
  assert.equal(tiny.width, 400);
  assert.equal(tiny.height, 420);
  assert.equal(tiny.left, 12);
  assert.equal(tiny.top, 12);
  assert.ok(huge.width <= 760);
  assert.equal(huge.height, 776);
  assert.ok(huge.left + huge.width <= 1268);
  assert.ok(huge.top + huge.height <= 788);
});

test('horizontal drag is bounded within both viewport edges', () => {
  const pane = paneRuntime();
  const start = { left:400, top:80, width:500, height:620 };
  const left = pane.moveGeometry(start, -5000, { width:1200, height:800 });
  const right = pane.moveGeometry(start, 5000, { width:1200, height:800 });
  assert.equal(left.left, 12);
  assert.equal(right.left + right.width, 1188);
  assert.equal(left.top, right.top);
});

test('desktop pane reflows, docks on either side, and full mode uses the same frame', () => {
  assert.match(paneCss, /padding-right:var\(--msh-hello-pane-width\)/);
  assert.match(paneCss, /padding-left:var\(--msh-hello-pane-width\)/);
  assert.match(paneCss, /cursor:ew-resize/);
  assert.match(paneCss, /cursor:ns-resize/);
  assert.match(paneCss, /cursor:nwse-resize/);
  assert.match(paneSource, /setPointerCapture/);
  assert.match(paneSource, /ArrowLeft/);
  assert.match(paneSource, /dock\(SIDES\.LEFT\)/);
  assert.match(paneSource, /dock\(SIDES\.RIGHT\)/);
  assert.match(paneCss, /data-state="full".*width:100%/s);
});

test('mobile uses a bottom sheet and full-screen state with safe-area and keyboard-friendly viewport units', () => {
  assert.match(paneCss, /@media\(max-width:760px\)/);
  assert.match(paneCss, /height:min\(68dvh,680px\)/);
  assert.match(paneCss, /env\(safe-area-inset-bottom\)/);
  assert.match(paneCss, /height:100dvh/);
});

test('conversation scroll survives shell transitions and navigation reloads', () => {
  assert.match(embedSource, /msh_hello_conversation_scroll/);
  assert.match(embedSource, /sessionStorage\.setItem/);
  assert.match(embedSource, /pagehide/);
  assert.match(paneSource, /msh_hello_surface_state/);
  assert.match(paneSource, /sessionStorage\.setItem/);
  assert.match(paneSource, /msh_hello_pane_geometry/);
});

test('all transitions preserve one Hello iframe instance', () => {
  assert.equal((paneSource.match(/<iframe class="msh-hello-frame"/g) || []).length, 1);
  assert.doesNotMatch(paneSource, /removeChild\(|replaceChildren\(|\.innerHTML\s*=/);
  assert.match(paneSource, /setState\(STATES\.FLOATING/);
  assert.match(paneSource, /setState\(STATES\.DOCKED/);
  assert.match(paneSource, /state === STATES\.FULL/);
});

test('universal surface preserves accessibility and reduced-motion behavior', () => {
  assert.match(paneSource, /role="dialog"/);
  assert.match(paneSource, /role="separator"/);
  assert.match(paneSource, /aria-label="Resize Hello width"/);
  assert.match(paneSource, /aria-label="Resize Hello height"/);
  assert.match(paneSource, /aria-label="Resize Hello width and height"/);
  assert.match(paneSource, /event\.key === 'Escape'/);
  assert.match(paneCss, /prefers-reduced-motion:reduce/);
});
