import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const storageSource=await readFile(new URL('../js/msh-storage.js',import.meta.url),'utf8');
const directorySource=await readFile(new URL('../js/msh-movement-directory.js',import.meta.url),'utf8');
const movementSource=await readFile(new URL('../js/msh-movement.js',import.meta.url),'utf8');
const calendarSource=await readFile(new URL('../js/msh-calendar.js',import.meta.url),'utf8');
const calendarHtml=await readFile(new URL('../calendar.html',import.meta.url),'utf8');
const css=await readFile(new URL('../css/msh-cycle.css',import.meta.url),'utf8');

function runtime(seed=null){
  const memory=new Map();let sequence=0;
  if(seed)memory.set('msh_data',JSON.stringify(seed));
  const app={console,Date,Math,crypto:{randomUUID:()=>`movement-${++sequence}`},localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,String(value)),removeItem:key=>memory.delete(key)},sessionStorage:{removeItem(){}}};
  app.window=app;app.globalThis=app;
  vm.runInNewContext(storageSource,app,{filename:'msh-storage.js'});
  vm.runInNewContext(directorySource,app,{filename:'msh-movement-directory.js'});
  vm.runInNewContext(movementSource,app,{filename:'msh-movement.js'});
  return app;
}

test('planned movement uses the shared Calendar event collection and stores no post-event interpretation',()=>{
  const app=runtime();
  const event=app.MSHMovement.plan({movementType:'strength',title:'Strength session',date:'2026-08-28',time:'17:30',durationMinutes:'45',notes:'After work'});
  const state=app.MSHStorage.getState();
  assert.equal(state.calendar.events.length,1);
  assert.equal(state.calendar.events[0].id,event.id);
  assert.equal(event.category,'movement');
  assert.equal(event.movement.status,'planned');
  assert.equal(event.movement.movementType,'strength');
  assert.equal(event.recordStatus,'recorded');
  assert.equal(event.informationClass,'RECORDED');
  assert.equal(event.provenance.status,'USER_STATED');
  assert.ok(event.startAt);
  assert.equal('experience' in event.movement,false);
  assert.equal(state.reflections.length,0);
  assert.equal(state.learningEntries.length,0);
});

test('post-movement experience preserves RPE, energy, reflection, and user attribution without inventing cause',()=>{
  const app=runtime();
  const planned=app.MSHMovement.plan({movementType:'walk',date:'2026-08-28',durationMinutes:30});
  const saved=app.MSHMovement.recordExperience(planned.id,{status:'modified',durationMinutes:22,rpe:8,energy:'lower',attributions:['sleep','stress','unknown'],reflection:'My legs felt heavier than expected.'});
  assert.equal(saved.movement.status,'modified');
  assert.deepEqual({...saved.movement.experience.perceivedEffort},{value:8,scale:'RPE_1_10',description:'Very hard'});
  assert.equal(saved.movement.experience.energy.value,'lower');
  assert.deepEqual([...saved.movement.experience.possibleInfluences],['sleep','stress','unknown']);
  assert.equal(saved.movement.experience.attributionMeaning,'USER_SELECTED_POSSIBLE_INFLUENCE');
  assert.equal(saved.movement.experience.attributionProvenance.status,'USER_STATED');
  assert.equal(app.MSHStorage.getState().reflections.length,0);
  assert.equal(app.MSHStorage.getState().learningEntries.length,0);
});

test('movement validation rejects invalid event inputs and effort values',()=>{
  const app=runtime();
  assert.equal(app.MSHMovement.plan({movementType:'teleporting',date:'2026-08-28'}),null);
  const event=app.MSHMovement.plan({movementType:'run',date:'2026-08-28'});
  assert.equal(event.startAt,'');
  assert.equal(app.MSHMovement.recordExperience(event.id,{status:'completed',rpe:11}),null);
  assert.equal(app.MSHMovement.getEvent(event.id).movement.status,'planned');
});

test('a custom movement preserves the person’s exact wording as the primary record',()=>{
  const app=runtime();
  const labels=['30 min Caroline Girvan legs','Walk Mochi','Moved furniture','Gardened'];
  const events=labels.map((movementLabel,index)=>app.MSHMovement.plan({movementLabel,date:`2026-08-${String(20+index).padStart(2,'0')}`}));
  assert.deepEqual(events.map(event=>event.title),labels);
  assert.ok(events.every(event=>event.movement.movementLabel===event.title&&event.movement.entryMode==='custom'));
  assert.ok(events.every(event=>event.movement.directoryItemId===null));
});

test('directory selections preserve specific sports, daily movement, and meaningful events',()=>{
  const app=runtime();
  const ids=['basketball','moving_furniture','ran_marathon'];
  const events=ids.map((id,index)=>{const item=app.MSHMovementDirectory.get(id);return app.MSHMovement.plan({movementLabel:item.label,directoryItemId:item.id,date:`2026-08-${25+index}`});});
  assert.deepEqual(events.map(event=>event.title),['Basketball','Moving furniture','Ran a marathon']);
  assert.deepEqual(events.map(event=>event.movement.directoryCategory),['sports','daily_living','events_accomplishments']);
  assert.ok(events.every(event=>event.movement.entryMode==='directory'));
  assert.ok(events.every(event=>event.movement.movementType==='other'));
});

test('Movement Directory is reusable, searchable, and broader than workouts',()=>{
  const app=runtime();
  const categoryIds=app.MSHMovementDirectory.DIRECTORY.map(category=>category.id);
  for(const id of ['exercise_modalities','aerobic_locomotor','mobility_recovery','sports','recreation','daily_living','events_accomplishments'])assert.ok(categoryIds.includes(id));
  assert.equal(app.MSHMovementDirectory.search('pilates')[0].label,'Pilates');
  assert.equal(app.MSHMovementDirectory.search('daily').some(item=>item.id==='housework'),true);
  assert.equal(app.MSHMovementDirectory.search('marathon').some(item=>item.id==='ran_marathon'),true);
});

test('older Calendar state gains the movement visibility layer without changing event history',()=>{
  const seed={schemaVersion:7,calendar:{events:[{id:'old-note',category:'note',date:'2026-08-01'}],predictions:[],settings:{layers:{cycle:true}},privacy:{cycleCalendar:true}}};
  const app=runtime(seed),state=app.MSHStorage.getState();
  assert.equal(state.calendar.settings.layers.movement,true);
  assert.equal(state.calendar.settings.layers.cycle,false);
  assert.equal(state.calendar.settings.layers.practices,false);
  assert.equal(state.calendar.settings.layers.projects,false);
  assert.equal(state.calendar.events.length,1);
  assert.equal(state.calendar.events[0].id,'old-note');
});

test('Calendar delegates movement records to a specific renderer and keeps the experience non-gamified',()=>{
  assert.match(calendarHtml,/js\/msh-movement\.js/);
  assert.match(calendarHtml,/js\/msh-movement-directory\.js/);
  assert.match(calendarSource,/function movementCalendarCard/);
  assert.match(calendarSource,/function genericCalendarEvent/);
  assert.match(calendarSource,/item\.category==='movement'\?movementCalendarCard/);
  assert.match(calendarSource,/Record how it went/);
  assert.match(calendarSource,/This records your experience/);
  assert.match(calendarSource,/Search or type a movement/);
  assert.match(calendarSource,/Browse Movement Directory/);
  assert.match(calendarSource,/form\.dataset\.directoryItemId=item\.id/);
  assert.doesNotMatch(`${calendarSource}\n${movementSource}`,/calories|streak|badge|leaderboard|achievement/i);
});

test('movement interaction remains responsive and readable with restrained presentation',()=>{
  assert.match(css,/msh-movement-boundary/);
  assert.match(css,/msh-rpe-field/);
  assert.match(css,/@media\(max-width:600px\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
