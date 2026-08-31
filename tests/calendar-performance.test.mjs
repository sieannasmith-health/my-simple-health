import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const source=path=>fs.readFileSync(new URL(path,root),'utf8');
function dataAPI(){const sandbox={window:{}};sandbox.globalThis=sandbox.window;vm.runInNewContext(source('js/msh-calendar-data.js'),sandbox);return sandbox.window.MSHCalendarData;}
const baseState=events=>({
  calendar:{events,settings:{layers:{movement:true,cycle:false,symptoms:true,medications:true,sexualHealth:false,care:true,measurements:true,life:true,observations:true,practices:false,projects:false}}},
  progressEvents:[],practiceAttempts:[],practices:[],projects:[]
});

test('large histories materialize only events inside the displayed month',()=>{
  const api=dataAPI(),events=[];
  for(let index=0;index<100000;index+=1){const year=2000+Math.floor(index/365),day=index%28+1;events.push({id:`old-${index}`,date:`${year}-01-${String(day).padStart(2,'0')}`,category:'movement',title:'Historical movement'});}
  events.push({id:'august-1',date:'2026-08-04',category:'movement',title:'Walk'});
  events.push({id:'august-2',date:'2026-08-18',category:'measurement',title:'Measurement'});
  const result=api.visibleHealthEvents({state:baseState(events),range:{startDate:'2026-08-01',endDate:'2026-08-31'}});
  assert.equal(result.availableCount,100002);
  assert.equal(result.processedCount,2);
  assert.deepEqual(Array.from(result.events,event=>event.id),['august-1','august-2']);
});

test('Map-key deduplication preserves one canonical dated event without a quadratic findIndex pass',()=>{
  const api=dataAPI(),duplicate={id:'same',date:'2026-08-10',category:'movement',title:'Walk'};
  const result=api.deriveHealthEvents(baseState([duplicate,duplicate]),[],{startDate:'2026-08-01',endDate:'2026-08-31'});
  assert.equal(result.events.length,1);
  assert.doesNotMatch(source('js/msh-calendar-data.js'),/findIndex\(/);
  assert.match(source('js/msh-calendar-data.js'),/const byKey=new Map\(\)/);
});

test('Timeline rendering remains bounded for dense event windows',()=>{
  const api=dataAPI(),events=Array.from({length:5000},(_,index)=>({id:`event-${index}`,date:`2026-08-${String(index%28+1).padStart(2,'0')}`,category:'movement'}));
  assert.equal(api.boundedTimeline(events,60).length,60);
  assert.equal(api.boundedTimeline(events,5000).length,100);
});

test('repeated Calendar projections remain bounded and stable',()=>{
  const api=dataAPI(),events=Array.from({length:20000},(_,index)=>({id:`event-${index}`,date:index%2?`2026-08-${String(index%28+1).padStart(2,'0')}`:'2020-01-01',category:'movement'}));
  for(let render=0;render<25;render+=1){
    const result=api.visibleHealthEvents({state:baseState(events),range:{startDate:'2026-08-01',endDate:'2026-08-31'}});
    assert.equal(result.events.length,10000);
    assert.equal(api.boundedTimeline(result.events,60).length,60);
    assert.ok(api.indexByDate(result.events).size<=31);
  }
});

test('Calendar requests only the displayed native date range and instruments bounded renders',()=>{
  const calendar=source('js/msh-calendar.js'),bridge=source('js/msh-connected-health.js'),html=source('calendar.html');
  assert.match(bridge,/calendarRange:\(\{areas,startDate,endDate\}\) => request\('calendarRange'/);
  assert.match(calendar,/requestNativeRange\(state,range\)/);
  assert.match(calendar,/MSHCalendarData\.indexByDate/);
  assert.match(calendar,/TIMELINE_RENDER_LIMIT = 60/);
  assert.match(calendar,/domElementCount/);
  assert.match(calendar,/durationMs/);
  assert.doesNotMatch(calendar,/msh:connected-health-changed',render/);
  assert.match(html,/js\/msh-calendar-data\.js/);
});
