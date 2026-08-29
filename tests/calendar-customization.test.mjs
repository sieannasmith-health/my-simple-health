import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const storageSource=await readFile(new URL('../js/msh-storage.js',import.meta.url),'utf8');
const calendarSource=await readFile(new URL('../js/msh-calendar.js',import.meta.url),'utf8');
const css=await readFile(new URL('../css/msh-cycle.css',import.meta.url),'utf8');

function runtime(seed=null){
  const memory=new Map();
  if(seed)memory.set('msh_data',JSON.stringify(seed));
  const app={console,Date,Math,crypto:{randomUUID:()=>`calendar-${Math.random()}`},localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,String(value)),removeItem:key=>memory.delete(key)},sessionStorage:{removeItem(){}}};
  app.window=app;app.globalThis=app;
  vm.runInNewContext(storageSource,app,{filename:'msh-storage.js'});
  return app;
}

test('Calendar has only Month and Timeline as primary time views',()=>{
  assert.match(calendarSource,/tabButton\('calendar','Month'\)/);
  assert.match(calendarSource,/tabButton\('timeline','Timeline'\)/);
  assert.doesNotMatch(calendarSource,/tabButton\('cycle'/);
  assert.match(calendarSource,/requestedView==='timeline' \? 'timeline' : 'calendar'/);
});

test('Customize consolidates the nine supported visible layers with appearance',()=>{
  for(const label of ['Movement','Cycle','Symptoms','Medications','Sexual health','Care & appointments','Measurements','Life context','Observations'])assert.match(calendarSource,new RegExp(`'${label.replace(/[&]/g,'\\&')}'`));
  assert.match(calendarSource,/data-calendar-customize/);
  assert.match(calendarSource,/What belongs in view\?/);
  assert.match(calendarSource,/Visibility changes this Calendar only/);
  assert.match(calendarSource,/calendarAppearanceControl\(state\)/);
  assert.doesNotMatch(calendarSource,/\['practices','Practices'\]|\['projects','Projects'\]/);
  assert.match(css,/msh-calendar-customization-menu/);
});

test('fresh defaults are useful but do not assume Cycle, Sexual health, Practices, or Projects',()=>{
  const state=runtime().MSHStorage.getState(),layers=state.calendar.settings.layers;
  assert.equal(layers.movement,true);
  assert.equal(layers.symptoms,true);
  assert.equal(layers.care,true);
  assert.equal(layers.observations,true);
  assert.equal(layers.cycle,false);
  assert.equal(layers.sexualHealth,false);
  assert.equal(layers.practices,false);
  assert.equal(layers.projects,false);
  assert.equal(state.calendar.settings.visibilityVersion,2);
});

test('visibility migration changes presentation preferences without mutating records or predictions',()=>{
  const event={id:'care-1',category:'care',date:'2026-08-20',provenance:{status:'USER_STATED'},informationClass:'RECORDED'};
  const prediction={id:'prediction-1',type:'predicted_period',startDate:'2026-08-30',endDate:'2026-09-02',informationClass:'PREDICTED'};
  const app=runtime({schemaVersion:7,calendar:{events:[event],predictions:[prediction],settings:{layers:{cycle:true,practices:true,projects:true}}}}),state=app.MSHStorage.getState();
  assert.equal(state.calendar.settings.layers.cycle,false);
  assert.equal(state.calendar.settings.layers.practices,false);
  assert.equal(state.calendar.settings.layers.projects,false);
  assert.deepEqual(JSON.parse(JSON.stringify(state.calendar.events[0])),event);
  assert.deepEqual(JSON.parse(JSON.stringify(state.calendar.predictions[0])),prediction);
});

test('Cycle subrecords project through their own existing layer types',()=>{
  for(const category of ['symptom','medication','sexualHealth','measurement','note'])assert.match(calendarSource,new RegExp(`category:'${category}'`));
  assert.match(calendarSource,/cycleRelatedEvents/);
  assert.match(calendarSource,/layerEnabled\(state,event\.category\)/);
  assert.match(calendarSource,/const cycleVisible=state\.calendar\.settings\.layers\.cycle!==false/);
});
