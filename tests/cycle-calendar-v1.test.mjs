import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const storageSource = await readFile(new URL('../js/msh-storage.js', import.meta.url), 'utf8');
const cycleSource = await readFile(new URL('../js/msh-cycle.js', import.meta.url), 'utf8');
const intelligenceSource = await readFile(new URL('../js/msh-intelligence.js', import.meta.url), 'utf8');
const sanitizerSource = await readFile(new URL('../server/hello/sanitizeJourneyContext.js', import.meta.url), 'utf8');
const calendarHtml = await readFile(new URL('../calendar.html', import.meta.url), 'utf8');
const calendarJs = await readFile(new URL('../js/msh-calendar.js', import.meta.url), 'utf8');
const calendarCss = await readFile(new URL('../css/msh-cycle.css', import.meta.url), 'utf8');
const helloHtml = await readFile(new URL('../hello.html', import.meta.url), 'utf8');

function runtime() {
  const memory = new Map();
  const sandbox = {
    console, Date, Math,
    crypto:{ randomUUID:() => `id-${memory.size}` },
    localStorage:{ getItem:key=>memory.get(key)||null, setItem:(key,value)=>memory.set(key,String(value)), removeItem:key=>memory.delete(key) },
    sessionStorage:{ removeItem() {} }
  };
  sandbox.window=sandbox; sandbox.globalThis=sandbox;
  vm.runInNewContext(storageSource,sandbox,{filename:'msh-storage.js'});
  vm.runInNewContext(cycleSource,sandbox,{filename:'msh-cycle.js'});
  return sandbox;
}
function seedCycles(app, starts, length=4) {
  starts.forEach(start=>app.MSHCycle.recordPeriod(start,app.MSHCycle.addDays(start,length-1),'medium'));
}

test('recorded period days persist and predictions remain replaceable separate records', () => {
  const app=runtime();
  seedCycles(app,['2026-05-01','2026-05-28','2026-06-24']);
  const state=app.MSHStorage.getState();
  assert.equal(app.MSHCycle.periodDays(state).length,12);
  assert.ok(state.calendar.events.every(event=>event.recordStatus==='recorded'&&!event.prediction));
  assert.ok(state.calendar.predictions.every(event=>event.recordStatus==='predicted'&&event.prediction.version==='2.0.0'));
  const recordedIds=Array.from(state.calendar.events,event=>event.id);
  app.MSHStorage.updateState(next=>{next.calendar.predictions=app.MSHCycle.calculatePredictions(next,{generatedAt:'2026-07-01T00:00:00.000Z'});return next;});
  assert.deepEqual(Array.from(app.MSHStorage.getState().calendar.events,event=>event.id),recordedIds);
});

test('daily symptoms can be recorded, edited, and removed without creating duplicate dates', () => {
  const app=runtime();
  app.MSHCycle.saveDailyObservation('2026-08-25',{bleeding:'light',symptoms:['cramps','fatigue']});
  app.MSHCycle.saveDailyObservation('2026-08-25',{bleeding:'medium',symptoms:['headache']});
  let state=app.MSHStorage.getState();
  assert.equal(app.MSHCycle.recordedCycleEvents(state).length,1);
  assert.deepEqual(Array.from(app.MSHCycle.dailyObservation(state,'2026-08-25').value.symptoms),['headache']);
  assert.equal(app.MSHCycle.removeDailyObservation('2026-08-25'),true);
  state=app.MSHStorage.getState();
  assert.equal(app.MSHCycle.dailyObservation(state,'2026-08-25'),null);
});

test('stats use recorded cycles only and return description without normal/abnormal labels', () => {
  const app=runtime(); seedCycles(app,['2026-05-01','2026-05-26','2026-06-24']);
  const stats=app.MSHCycle.calculateStats(app.MSHStorage.getState());
  assert.equal(stats.averageCycleLength,27);
  assert.deepEqual(Array.from(stats.observedCycleRange),[25,29]);
  assert.doesNotMatch(JSON.stringify(stats),/normal|abnormal/i);
});

test('personal patterns require sufficient cycles and never claim diagnosis or causation', () => {
  const app=runtime(); seedCycles(app,['2026-05-01','2026-05-28']);
  assert.deepEqual(Array.from(app.MSHCycle.calculatePatterns(app.MSHStorage.getState())),[]);
  seedCycles(app,['2026-06-24']);
  ['2026-05-01','2026-05-28','2026-06-24'].forEach(date=>app.MSHCycle.saveDailyObservation(date,{bleeding:'medium',symptoms:['cramps']}));
  const patterns=app.MSHCycle.calculatePatterns(app.MSHStorage.getState());
  assert.equal(patterns[0].cyclesIncluded,3);
  assert.equal(patterns[0].diagnosis,false);
  assert.equal(patterns[0].causalClaim,false);
  assert.ok(patterns[0].sourceData.length>=3);
});

test('fertility output is estimated and the interface includes the contraception boundary', () => {
  const app=runtime(); seedCycles(app,['2026-05-01','2026-05-28']);
  const fertility=app.MSHStorage.getState().calendar.predictions.find(item=>item.type==='estimated_fertile_window');
  assert.equal(fertility.recordStatus,'predicted');
  assert.equal(fertility.provenance.status,'SYSTEM_OBSERVED');
  assert.match(calendarJs,/should not be relied upon as contraception/);
  assert.doesNotMatch(calendarJs,/pregnan(t|cy)\s+(confirmed|detected)/i);
});

test('privacy scopes are independent and Hello writes only via a validated controlled action', () => {
  const app=runtime();
  const action=app.MSHCycle.proposeControlledAction('Add my period starting today.',new Date(2026,7,25));
  assert.equal(action.type,'RECORD_PERIOD_START');
  assert.equal(app.MSHCycle.executeControlledAction(action).reason,'HELLO_ACCESS_DISABLED');
  app.MSHCycle.updatePrivacy({hello:true});
  const result=app.MSHCycle.executeControlledAction(action);
  assert.equal(result.ok,true);
  assert.equal(result.event.source.type,'HELLO_CONTROLLED_ACTION');
  const privacy=app.MSHStorage.getState().calendar.privacy;
  assert.equal(privacy.hello,true); assert.equal(privacy.workspace,false); assert.equal(privacy.patternAnalysis,false);
  assert.equal(app.MSHCycle.proposeControlledAction('I wonder when my next period is.'),null);
});

test('Hello receives cycle context only after its independent permission is enabled', () => {
  const app=runtime();
  app.MSHCycle.recordPeriod('2026-08-25','2026-08-27','medium');
  vm.runInNewContext(intelligenceSource,app,{filename:'msh-intelligence.js'});
  assert.equal(app.MSHIntelligence.buildContextItems(app.MSHStorage.getState()).some(item=>item.source.startsWith('cycle.')),false);
  app.MSHCycle.updatePrivacy({hello:true});
  const items=app.MSHIntelligence.buildContextItems(app.MSHStorage.getState()).filter(item=>item.source.startsWith('cycle.'));
  assert.ok(items.length>0);
  assert.ok(items.every(item=>['USER_STATED','SYSTEM_OBSERVED'].includes(item.epistemicStatus)));
  assert.match(sanitizerSource,/"cycle\."/);
});

test('Calendar is a shared workspace layer with mobile, swipe, sheets, and reduced motion', () => {
  assert.match(calendarHtml,/data-msh-page="calendar"/);
  assert.match(calendarHtml,/msh-storage\.js[\s\S]*msh-cycle\.js[\s\S]*msh-shell\.js/);
  assert.match(calendarJs,/pointerdown[\s\S]*pointerup/);
  assert.match(calendarJs,/role="dialog"[\s\S]*sticky save|role="dialog"/i);
  assert.match(calendarCss,/@media\(max-width:600px\)/);
  assert.match(calendarCss,/prefers-reduced-motion:reduce/);
  assert.match(helloHtml,/proposeControlledAction[\s\S]*executeControlledAction/);
});
