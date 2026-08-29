import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const storageSource=await readFile(new URL('../js/msh-storage.js',import.meta.url),'utf8');
const appearanceSource=await readFile(new URL('../js/msh-calendar-appearance.js',import.meta.url),'utf8');
const calendarSource=await readFile(new URL('../js/msh-calendar.js',import.meta.url),'utf8');
const calendarHtml=await readFile(new URL('../calendar.html',import.meta.url),'utf8');
const css=await readFile(new URL('../css/msh-cycle.css',import.meta.url),'utf8');

function runtime(seed=null){
  const memory=new Map();let id=0;
  if(seed)memory.set('msh_data',JSON.stringify(seed));
  const app={console,Date,Math,crypto:{randomUUID:()=>`accent-${++id}`},localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,String(value)),removeItem:key=>memory.delete(key)},sessionStorage:{removeItem(){}}};
  app.window=app;app.globalThis=app;
  vm.runInNewContext(storageSource,app,{filename:'msh-storage.js'});
  vm.runInNewContext(appearanceSource,app,{filename:'msh-calendar-appearance.js'});
  return app;
}

test('existing and migrated users retain the unchanged default Calendar accent',()=>{
  const fresh=runtime(),legacy=runtime({schemaVersion:7,calendar:{events:[{id:'kept'}],settings:{layers:{cycle:true}}}});
  assert.deepEqual({...fresh.MSHCalendarAppearance.getPreference()},{accentId:'default',customColor:null});
  assert.deepEqual({...legacy.MSHCalendarAppearance.getPreference()},{accentId:'default',customColor:null});
  assert.equal(legacy.MSHStorage.getState().calendar.events[0].id,'kept');
  assert.match(css,/\.msh-calendar-main\.has-calendar-accent/);
});

test('every restrained preset persists as a Calendar preference rather than event data',()=>{
  const app=runtime();
  assert.deepEqual([...app.MSHCalendarAppearance.PRESETS].map(item=>item.label),['Forest','Sage','Moss','Clay','Rose','Plum','Blue','Slate']);
  for(const option of app.MSHCalendarAppearance.PRESETS){
    app.MSHCalendarAppearance.savePreference({accentId:option.id});
    const state=app.MSHStorage.getState();
    assert.equal(state.calendar.settings.appearance.accentId,option.id);
    assert.equal(state.calendar.events.length,0);
  }
});

test('a valid custom color survives reload while invalid values are rejected',()=>{
  const app=runtime();
  app.MSHCalendarAppearance.savePreference({accentId:'custom',customColor:'#7b516f'});
  const saved=app.MSHStorage.getState();
  const reloaded=runtime(saved);
  assert.deepEqual({...reloaded.MSHCalendarAppearance.getPreference()},{accentId:'custom',customColor:'#7b516f'});
  assert.equal(reloaded.MSHCalendarAppearance.savePreference({accentId:'custom',customColor:'not-a-color'}),null);
  assert.deepEqual({...reloaded.MSHCalendarAppearance.getPreference()},{accentId:'custom',customColor:'#7b516f'});
});

test('reset restores the standard Calendar appearance without changing records',()=>{
  const app=runtime();
  app.MSHStorage.updateState(state=>{state.calendar.events.push({id:'movement-kept',category:'movement'});return state;});
  app.MSHCalendarAppearance.savePreference({accentId:'blue'});
  app.MSHCalendarAppearance.reset();
  assert.deepEqual({...app.MSHCalendarAppearance.getPreference()},{accentId:'default',customColor:null});
  assert.equal(app.MSHStorage.getState().calendar.events[0].id,'movement-kept');
});

test('runtime accent derivation maintains non-text contrast in light and dark themes',()=>{
  const app=runtime(),colors=[...app.MSHCalendarAppearance.PRESETS.map(item=>item.color),'#ffffff','#000000'];
  for(const color of colors){
    assert.ok(app.MSHCalendarAppearance.contrast(app.MSHCalendarAppearance.readableAccent(color,'light'),'#f7f3e8')>=3);
    assert.ok(app.MSHCalendarAppearance.contrast(app.MSHCalendarAppearance.readableAccent(color,'dark'),'#1b241d')>=3);
  }
});

test('Calendar control is accessible and semantic styling remains outside the personal accent layer',()=>{
  assert.match(calendarHtml,/js\/msh-calendar-appearance\.js/);
  assert.match(calendarSource,/Customize/);
  assert.match(calendarSource,/Appearance/);
  assert.match(calendarSource,/Calendar color/);
  assert.match(calendarSource,/Choose a restrained accent for this Calendar view/);
  assert.match(calendarSource,/aria-pressed/);
  assert.match(calendarSource,/Reset to default/);
  assert.match(css,/msh-calendar-customization-menu/);
  assert.match(css,/msh-calendar-custom-color/);
  assert.match(css,/\.msh-information-key \.recorded:before\{background:var\(--msh-cycle-clay\)/);
  assert.match(css,/\.msh-information-key \.estimated:before[\s\S]*var\(--msh-cycle-blue\)/);
  assert.match(css,/\.msh-date-events article\.is-movement[\s\S]*--msh-event-color:#527768/);
  assert.match(css,/not\(\.is-recorded-period\):not\(\.is-predicted-period\):not\(\.is-estimated-fertile\)/);
});
