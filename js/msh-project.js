/* My Simple Health — My Project */
(function(){
'use strict';
const mount=document.querySelector('[data-msh-project]'); const storage=window.MSHStorage; if(!mount||!storage)return;
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
function uid(){return window.crypto&&crypto.randomUUID?`project_${crypto.randomUUID()}`:`project_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}
function active(){return storage.getActiveProject(storage.getState())}
function focus(){return storage.getState().focuses.find(x=>x.status==='active')||null}
function vision(){return [...storage.getState().visionEntries].filter(x=>x.status==='current').sort((a,b)=>new Date(b.updatedAt||0)-new Date(a.updatedAt||0))[0]||null}
function render(){const p=active(),f=focus(),v=vision(); mount.innerHTML=`
<section class="msh-project-header"><p class="msh-eyebrow">Point A → Point B</p><h1>My Project</h1><p>A Project is something you choose to actively work toward. It turns a direction into a clear experiment in your real life without making your whole wellbeing a project.</p></section>
${p?renderActive(p):renderCreate(f,v)}`}
function renderCreate(f,v){return `<section class="msh-project-builder">
<div class="msh-project-context"><p class="msh-eyebrow">Before you begin</p><h2>Is this worth actively working on right now?</h2><p>You can understand something, care about something, or save it for later without turning it into a Project.</p>${f?`<p><strong>Your current focus:</strong> ${esc(f.label)}</p>`:''}${v&&v.statement?`<p><strong>Your Vision:</strong> ${esc(v.statement)}</p>`:''}</div>
<form data-project-form>
<label class="msh-project-field"><span>Name this Project</span><strong>What are you working on?</strong><input name="title" required placeholder="For example: Build a night rhythm that fits me"></label>
<label class="msh-project-field"><span>Point A · Now</span><strong>What is true right now?</strong><textarea name="pointA" rows="4" required placeholder="Describe the starting point without judging it.">${esc(f?f.label:'')}</textarea><small>What is happening now? What makes this worth working on?</small></label>
<label class="msh-project-field"><span>Point B · Direction</span><strong>What would you like to become different?</strong><textarea name="pointB" rows="4" required placeholder="Describe a direction that would feel meaningfully better or more fitting."></textarea><small>This can be specific without pretending you already know exactly how to get there.</small></label>
<label class="msh-project-field"><span>Why this matters</span><strong>Why is this worth your attention?</strong><textarea name="why" rows="3" placeholder="Optional, but useful when motivation changes."></textarea></label>
<fieldset class="msh-project-capacity"><legend><span>My Plate</span><strong>How much room do you realistically have for this right now?</strong></legend><div>${['Very little','A little','A workable amount','Plenty'].map(x=>`<label><input type="radio" name="capacity" value="${x.toLowerCase().replace(/ /g,'_')}"><span>${x}</span></label>`).join('')}</div><p>This does not determine whether you are allowed to have the Project. It helps the plan fit your actual capacity.</p></fieldset>
<label class="msh-project-field"><span>First milestone</span><strong>What would tell you that you are beginning to move?</strong><textarea name="milestone" rows="3" placeholder="A small sign of movement, not the final destination."></textarea></label>
<div class="msh-card-actions"><button class="msh-button" type="submit">Start My Project</button><a class="msh-button-secondary" href="my-health.html">Not right now</a></div>
</form></section>`}
function renderActive(p){return `<section class="msh-project-active"><div class="msh-project-title-row"><div><p class="msh-eyebrow">Active Project</p><h2>${esc(p.title)}</h2></div><span class="msh-project-status">In progress</span></div>
<div class="msh-project-path"><article><span>Point A · Now</span><p>${esc(p.pointA)}</p></article><b>→</b><article><span>Point B · Where I'm headed</span><p>${esc(p.pointB)}</p></article></div>
${p.why?`<div class="msh-project-detail"><span>Why this matters</span><p>${esc(p.why)}</p></div>`:''}
<div class="msh-project-detail"><span>My Plate when I started</span><p>${esc((p.capacity||'Not recorded').replace(/_/g,' '))}</p></div>
${p.milestone?`<div class="msh-project-detail"><span>First milestone</span><p>${esc(p.milestone)}</p></div>`:''}
<div class="msh-project-next"><p class="msh-eyebrow">Next layer</p><h3>What will you actually try?</h3><p>Practices turn this Project into something small enough to test in everyday life. We build that next.</p></div>
<div class="msh-card-actions"><button class="msh-button-secondary" data-action="complete">Mark Project complete</button><button class="msh-text-button" data-action="pause">Pause this Project</button></div></section>`}
mount.addEventListener('submit',e=>{if(!e.target.matches('[data-project-form]'))return;e.preventDefault();const fd=new FormData(e.target),now=new Date().toISOString();storage.updateState(state=>{state.projects.forEach(x=>{if(x.status==='active')x.status='historical'});state.projects.push({id:uid(),status:'active',title:fd.get('title').trim(),pointA:fd.get('pointA').trim(),pointB:fd.get('pointB').trim(),why:fd.get('why').trim(),capacity:fd.get('capacity')||'',milestone:fd.get('milestone').trim(),createdAt:now,updatedAt:now});return state});render();window.scrollTo({top:0,behavior:'smooth'})});
mount.addEventListener('click',e=>{const t=e.target.closest('[data-action]');if(!t)return;const p=active();if(!p)return;storage.updateState(state=>{const x=state.projects.find(i=>i.id===p.id);x.status=t.dataset.action==='complete'?'completed':'paused';x.updatedAt=new Date().toISOString();return state});render()});
render();
})();
