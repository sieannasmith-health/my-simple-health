import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const environmentSource=await readFile(new URL('../js/msh-environment.js',import.meta.url),'utf8');
const soundSource=await readFile(new URL('../js/msh-sound.js',import.meta.url),'utf8');
const feedbackSource=await readFile(new URL('../js/msh-feedback.js',import.meta.url),'utf8');
const sensoryCss=await readFile(new URL('../css/msh-sensory.css',import.meta.url),'utf8');
const shellSource=await readFile(new URL('../js/msh-shell.js',import.meta.url),'utf8');
const calendarSource=await readFile(new URL('../js/msh-calendar.js',import.meta.url),'utf8');
const thoughtSource=await readFile(new URL('../js/msh-thought-capture.js',import.meta.url),'utf8');
const pages=await Promise.all(['my-health.html','calendar.html'].map(page=>readFile(new URL(`../${page}`,import.meta.url),'utf8')));
const foundationCss=await readFile(new URL('../css/msh-foundation.css',import.meta.url),'utf8');
const environmentCss=await readFile(new URL('../css/msh-environment.css',import.meta.url),'utf8');
const glassWorkspaceCss=await readFile(new URL('../css/msh-glass-workspace.css',import.meta.url),'utf8');
const thoughtCss=await readFile(new URL('../css/msh-thought-capture.css',import.meta.url),'utf8');
const exploreHtml=await readFile(new URL('../assessments.html',import.meta.url),'utf8');
const calendarHtml=await readFile(new URL('../calendar.html',import.meta.url),'utf8');

function environment(){
  const sandbox={Date,setInterval:()=>0};sandbox.globalThis=sandbox;
  vm.runInNewContext(environmentSource,sandbox,{filename:'msh-environment.js'});return sandbox.MSHEnvironment;
}

test('one environment clock resolves all seven continuous visual phases',()=>{
  const runtime=environment();
  const cases=[[5,30,'pre-dawn'],[7,0,'morning'],[13,0,'afternoon'],[17,30,'golden-hour'],[19,0,'sundown'],[20,30,'evening'],[23,0,'night']];
  for(const [hour,minute,phase] of cases){const state=runtime.resolve(new Date(2026,0,1,hour,minute));assert.equal(state.phase,phase);assert.ok(state.progress>=0&&state.progress<=1);}
  const state=runtime.resolve(new Date(2026,0,1,23,0));
  assert.deepEqual(Object.keys(state.sun),['visibility','progress','x','y']);
  assert.deepEqual(Object.keys(state.moon),['visibility','progress','x','y']);
  assert.equal(typeof state.motionTempo,'number');
  assert.equal(state.ambience.suggested,'night');
});

test('environment clock selects and crossfades only neighboring artwork anchors',()=>{
  const runtime=environment();
  const cases=[
    [8,[['morning',.85],['afternoon',.15]]],
    [13,[['afternoon',1]]],
    [17.75,[['afternoon',.4],['sundown',.6]]],
    [20.25,[['sundown',.35],['night',.65]]],
    [23.5,[['night',1]]]
  ];
  for(const [hour,expected] of cases){
    const layers=runtime.resolveScenery(hour).layers;
    assert.ok(layers.length<=2,'only the current and neighboring anchor are requested');
    assert.equal(layers.length,expected.length);
    layers.forEach((layer,index)=>{assert.equal(layer.id,expected[index][0]);assert.ok(Math.abs(layer.opacity-expected[index][1])<.002);});
    assert.ok(Math.abs(layers.reduce((sum,layer)=>sum+layer.opacity,0)-1)<.002);
  }
  assert.deepEqual(Object.keys(runtime.SCENES),['morning','afternoon','sundown','night']);
  for(const scene of Object.values(runtime.SCENES))assert.match(scene.src,/^assets\/environment\/msh-world-(?:morning|afternoon|sundown|night)\.webp$/);
});

test('1 PM is one coherent bright-afternoon state with no moon prominence',()=>{
  const runtime=environment();
  const state=runtime.resolve(new Date(2026,0,1,12,58));
  assert.equal(state.id,'afternoon');
  assert.equal(state.phase,'afternoon');
  assert.equal(state.scenery.primary,'afternoon');
  assert.ok(state.light>.95);
  assert.ok(state.warmth<.2);
  assert.equal(state.moon.visibility,0);
  assert.ok(state.sun.visibility>.9);
});

test('environment changes atmosphere independently from theme preference',()=>{
  const runtime=environment(),afternoon=runtime.resolve(new Date(2026,0,1,13)),night=runtime.resolve(new Date(2026,0,1,23));
  assert.equal(afternoon.id,'afternoon');assert.equal(night.id,'night');
  assert.equal('theme' in afternoon,false);assert.equal('theme' in night,false);
});

function soundRuntime(stored=null){
  const values=new Map(stored?[['msh_sensory_preferences_v1',stored]]:[]),listeners={};
  const document={hidden:false,addEventListener(type,listener){listeners[type]=listener;},querySelector(){return null;}};
  const sandbox={Date,JSON,Set,document,localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value))},requestAnimationFrame:fn=>{fn();return 1;},cancelAnimationFrame(){},MSHEnvironment:{getCurrent:()=>({ambience:{suggested:'night'}})}};
  sandbox.window=sandbox;sandbox.globalThis=sandbox;
  vm.runInNewContext(soundSource,sandbox,{filename:'msh-sound.js'});return{...sandbox,values};
}

test('sound is off by default and phase changes never enable it',async()=>{
  const runtime=soundRuntime();assert.equal(runtime.MSHSound.getState().soundEnabled,false);
  await runtime.MSHSound.refreshEnvironment();assert.equal(runtime.MSHSound.getState().soundEnabled,false);
  assert.equal(runtime.values.has('msh_sensory_preferences_v1'),false);
});

test('sound enable, disable, and restrained volume persist without eager audio',()=>{
  const runtime=soundRuntime();runtime.MSHSound.enable();
  assert.equal(JSON.parse(runtime.values.get('msh_sensory_preferences_v1')).soundEnabled,true);
  runtime.MSHSound.setVolume(.3);assert.equal(JSON.parse(runtime.values.get('msh_sensory_preferences_v1')).volume,.3);
  runtime.MSHSound.disable();assert.equal(JSON.parse(runtime.values.get('msh_sensory_preferences_v1')).soundEnabled,false);
});

test('semantic feedback vocabulary is centralized and contains no scattered vibration',()=>{
  const sandbox={Date,Set,setTimeout(){},localStorage:{getItem(){return null},removeItem(){}}};sandbox.window=sandbox;sandbox.globalThis=sandbox;
  vm.runInNewContext(feedbackSource,sandbox,{filename:'msh-feedback.js'});
  assert.deepEqual([...sandbox.MSHFeedback.EVENTS],['touch','select','settle','record','reveal','return','attention','error']);
  assert.doesNotMatch(feedbackSource,/navigator\.vibrate/);
  assert.match(calendarSource,/MSHFeedback\.emit/);assert.match(thoughtSource,/MSHFeedback\.emit/);
});

test('representative surfaces share sound, feedback, environment, and sensory styling',()=>{
  for(const html of pages){assert.match(html,/js\/msh-environment\.js/);assert.match(html,/js\/msh-feedback\.js/);assert.match(html,/js\/msh-sound\.js/);assert.match(html,/css\/msh-sensory\.css/);}
  assert.match(shellSource,/data-msh-sound-toggle/);
  assert.match(calendarSource,/msh-kinetic-symbol--orbit/);
  assert.match(sensoryCss,/\.msh-glide/);
});

test('kinetic vocabulary, direct tactility, and reduced-motion final states are shared',()=>{
  for(const name of ['orbit','focus','settle','open'])assert.match(sensoryCss,new RegExp(`msh-kinetic-symbol--${name}`));
  assert.match(sensoryCss,/data-msh-feedback/);
  assert.match(sensoryCss,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(sensoryCss,/animation:none!important/);
  assert.match(sensoryCss,/scroll-snap-type:x proximity/);
});

test('sensory implementation requests no sensitive device capabilities',()=>{
  const combined=[environmentSource,soundSource,feedbackSource].join('\n');
  assert.doesNotMatch(combined,/geolocation|getUserMedia|DeviceMotion|DeviceOrientation|navigator\.vibrate/);
});

function luminance(hex){return hex.match(/[a-f\d]{2}/gi).map(value=>parseInt(value,16)/255).map(value=>value<=.03928?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);}
function contrast(foreground,background){const values=[luminance(foreground),luminance(background)].sort((a,b)=>b-a);return(values[0]+.05)/(values[1]+.05);}

test('protected foreground tokens remain readable independently of environmental phase',()=>{
  const runtime=environment(),times=[[6,30],[9,0],[12,30],[17,30],[19,30],[22,30]];
  const themes={light:[['#252822','#f7f4ec'],['#484d47','#f7f4ec'],['#5b615b','#f7f4ec']],dark:[['#f5f1e7','#0d0f0e'],['#b6b3ab','#0d0f0e'],['#8f8d87','#0d0f0e']]};
  for(const [hour,minute] of times){
    const phase=runtime.resolve(new Date(2026,0,1,hour,minute)).phase;
    for(const [theme,pairs] of Object.entries(themes))for(const [foreground,background] of pairs)assert.ok(contrast(foreground,background)>=4.5,`${theme} ${foreground} on ${background} meets AA at ${phase}`);
  }
  assert.match(foundationCss,/--msh-text-primary:/);assert.match(foundationCss,/--msh-text-secondary:/);assert.match(foundationCss,/--msh-text-muted-protected:/);
  assert.doesNotMatch(foundationCss,/--msh-text-(?:primary|secondary|muted-protected):[^;]*--msh-environment/);
});

test('environmental app navigation uses stable light and dark glass contrast',()=>{
  assert.match(foundationCss,/\.msh-app-header\s*\{[^}]*background:\s*rgba\(245, 241, 231, \.72\)/s);
  assert.match(foundationCss,/-webkit-backdrop-filter:\s*blur\(18px\) saturate\(125%\)/);
  assert.match(foundationCss,/backdrop-filter:\s*blur\(18px\) saturate\(125%\)/);
  assert.match(foundationCss,/box-shadow:\s*0 4px 20px rgba\(0, 0, 0, \.05\)/);
  assert.match(environmentCss,/\.msh-environment-home \.msh-app-header\{[^}]*background:var\(--msh-glass-soft-bg\)[^}]*blur\(18px\) saturate\(125%\)/);
  assert.match(environmentCss,/\[data-theme="dark"\] \.msh-environment-home \.msh-app-header\{[^}]*background:rgba\(13,15,14,\.82\)/);
  assert.match(glassWorkspaceCss,/\.msh-landscape-workspace-page \.msh-app-header\{[^}]*background:rgba\(245,241,231,\.72\)[^}]*blur\(18px\) saturate\(125%\)/);
  assert.doesNotMatch(environmentCss,/\.msh-environment-home \.msh-app-header\{[^}]*linear-gradient/s);
});

test('purposeful glass separates environmental reading surfaces from photography',()=>{
  for(const token of ['soft-bg','reading-bg','overlay-bg','border','ink','ink-secondary','brand','blur','saturation','shadow'])assert.match(foundationCss,new RegExp(`--msh-glass-${token}:`));
  assert.match(environmentCss,/\.msh-home-world\.is-first-door \.msh-first-door\{[^}]*background:var\(--msh-glass-reading-bg\)[^}]*blur\(var\(--msh-glass-blur\)\)/);
  assert.match(glassWorkspaceCss,/\.msh-glass-workspace\{[^}]*background:var\(--msh-glass-reading-bg\)[^}]*color:var\(--msh-glass-ink\)[^}]*blur\(var\(--msh-glass-blur\)\)/);
  assert.match(thoughtCss,/\.msh-thought-launcher[\s\S]*background: var\(--msh-glass-soft-bg\)/);
  assert.match(thoughtCss,/\.msh-thought-panel[\s\S]*background: var\(--msh-glass-overlay-bg\)/);
  assert.match(environmentCss,/@supports not \(\(backdrop-filter:blur\(1px\)\)/);
  assert.match(glassWorkspaceCss,/@supports not \(\(backdrop-filter:blur\(1px\)\)/);
  assert.match(thoughtCss,/@supports not \(\(backdrop-filter:blur\(1px\)\)/);
});

test('environmental atmosphere responds to time while theme owns Glass and Calendar remains a precision surface',()=>{
  assert.match(environmentCss,/\[data-daypart="night"\]\{[^}]*--msh-world-ink:/);
  assert.doesNotMatch(environmentCss,/\[data-daypart=[^\]]+\][^{]*\{[^}]*--msh-glass-(?:soft|reading|panel|overlay|ink)/);
  assert.doesNotMatch(calendarHtml,/css\/msh-(?:environment|glass-workspace|thought-capture)\.css/);
  assert.doesNotMatch(calendarHtml,/msh-environment-home|msh-glass-world/);
});

test('Explore protects supporting and card copy while preserving expressive green hierarchy',()=>{
  assert.match(exploreHtml,/\.hero \.lede,\.hero \.copy,\.landscape-door>p/);
  assert.match(exploreHtml,/color:var\(--msh-text-secondary/);
  assert.match(exploreHtml,/\[data-theme="dark"\] \.hero/);
  assert.match(exploreHtml,/\.landscape-door \.action\{color:var\(--msh-page/);
  assert.doesNotMatch(exploreHtml,/\.hero\{[^}]*opacity:/);
  assert.doesNotMatch(exploreHtml,/\.landscape-door\{[^}]*opacity:/);
});
