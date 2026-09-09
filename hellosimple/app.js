const navItems = ["Today", "Work", "Workers", "Growth", "Impact"];

const profiles = {
  siea: { id:"siea", name:"Siea Smith", role:"Founder & CEO", workstream:"Company + Product", level:"Builder", baseXp:720, nextMilestone:"Operating Founder", milestoneAt:1000, skills:[["Product strategy","Consistent"],["AI workforce orchestration","Consistent"],["Founder decision-making","Demonstrated"],["UX/product judgment","Demonstrated"],["Company operations","Practiced"]]},
  brandon: { id:"brandon", name:"Brandon Smith", role:"Co-Founder, Growth & Commercial Strategy (Trial)", workstream:"Growth + Commercial", level:"Explorer", baseXp:240, nextMilestone:"Builder", milestoneAt:500, skills:[["Growth strategy","Practiced"],["Analytics interpretation","Practiced"],["AI collaboration","Demonstrated"],["Commercial judgment","Observed"],["Lifecycle strategy","Observed"]]}
};

const workers = [
  {name:"Nomy",role:"Product Orchestration",status:"working",activity:"Sequencing current objective and employee work"},
  {name:"Selah",role:"Software Engineering",status:"working",activity:"Implementing HelloSimple interface and integrations"},
  {name:"Mira",role:"Design & UX",status:"review",activity:"Reviewing clarity, hierarchy, accessibility, and flow"},
  {name:"Genesis",role:"Growth & Acquisition",status:"working",activity:"Preparing growth work for Brandon's trial lane"},
  {name:"Atlas",role:"Data & Analytics",status:"ready",activity:"Contribution and outcome measurement ready"},
  {name:"Tessa",role:"Quality Engineering",status:"waiting",activity:"QA follows implementation evidence"}
];

const missionCatalog = {
  siea: [
    {id:"s1",title:"Test the HelloSimple employee interface",type:"Review",why:"Founder testing validates whether the workforce experience actually feels simple and useful.",skills:["Product strategy","UX/product judgment"],workers:["Nomy","Mira","Selah"],xp:80,evidence:"Founder usability findings",definition:"Complete a focused usability pass and capture the highest-value friction, confusion, and missing-value findings.",steps:["Open Today and identify your next move","Complete one realistic work path","Record meaningful friction or confusion","Submit findings with evidence"],demo:"See how to run a 5-minute founder usability pass without turning it into an aesthetic review."},
    {id:"s2",title:"Confirm the next MSH company milestone",type:"Decision",why:"Keeps product, workforce, and launch activity aligned around one meaningful target.",skills:["Founder decision-making","AI workforce orchestration"],workers:["Nomy"],xp:120,evidence:"Accepted milestone + rationale",definition:"Choose one company milestone and record the rationale and decision boundary.",steps:["Review Nomy's recommendation","Check unresolved dependencies","Choose one milestone","Record rationale and what is explicitly not included"],demo:"See an example of a decision record that gives the AI workforce enough context to execute."}
  ],
  brandon: [
    {id:"b1",title:"Review launch-channel recommendation",type:"Review",why:"Moves MSH toward a grounded acquisition plan using your growth expertise.",skills:["Growth strategy","Analytics interpretation"],workers:["Genesis","Atlas"],xp:90,evidence:"Recommendation review + decision",definition:"Review the prepared channel analysis, identify the strongest launch path, and explain why it deserves testing.",steps:["Review Genesis' channel recommendation","Check Atlas' supporting evidence","Add your commercial judgment","Submit one recommendation with rationale"],demo:"Watch a 60-second guided example of how to review an AI-prepared recommendation without merely approving it."},
    {id:"b2",title:"Draft the first lifecycle campaign objective",type:"Collaborative",why:"Turns MSH growth strategy into a measurable member-growth experiment.",skills:["Growth strategy","AI collaboration","Lifecycle strategy"],workers:["Genesis","Nomy"],xp:110,evidence:"Campaign objective + success measure",definition:"Write one measurable lifecycle objective that ties member behavior to a clear success measure.",steps:["Review the growth objective","Choose the member behavior to influence","Define the measurable outcome","Submit the objective for review"],demo:"See how HelloSimple turns a broad growth goal into a measurable lifecycle objective."},
    {id:"b3",title:"Complete TestFlight growth-lens review",type:"Human Action",why:"Adds real product and commercial judgment that the AI workforce cannot replace.",skills:["Commercial judgment","AI collaboration"],workers:["Mira","Tessa"],xp:70,evidence:"Founder-facing TestFlight findings",definition:"Use the product as a prospective member and capture growth or trust friction that may affect activation.",steps:["Use the current TestFlight build","Note activation or trust friction","Separate product friction from preference","Submit the top three findings"],demo:"See what counts as a growth-lens finding versus a generic design preference."}
  ]
};

const schedule = {
  siea:[["9:00","Founder operating brief","Nomy"],["11:00","HelloSimple founder test","Mira + Selah"],["2:00","Product decisions","Nomy"],["4:00","Progress check","Tessa"]],
  brandon:[["9:30","Growth operating brief","Genesis + Nomy"],["11:30","Channel recommendation review","Genesis + Atlas"],["2:30","Lifecycle mission","Genesis"],["4:30","Impact capture","HelloSimple"]]
};

let currentProfileId = localStorage.getItem("hellosimple-profile") || "brandon";
let activeView = "Today";
let activeMissionId = null;
let completed = JSON.parse(localStorage.getItem("hellosimple-completed") || "{}");
let evidenceDrafts = JSON.parse(localStorage.getItem("hellosimple-evidence") || "{}");
let impact = JSON.parse(localStorage.getItem("hellosimple-impact") || "{}");

const el = id => document.getElementById(id);
const profile = () => profiles[currentProfileId];
const missions = () => missionCatalog[currentProfileId];
const isDone = id => Boolean(completed[`${currentProfileId}:${id}`]);
const earnedXp = () => missions().filter(m=>isDone(m.id)).reduce((s,m)=>s+m.xp,0);
const totalXp = () => profile().baseXp + earnedXp();
const esc = text => String(text).replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[c]));

function renderNav(){
  el("nav").innerHTML = navItems.map(item=>`<button data-view="${item}" ${item===activeView?'aria-current="page"':''}>${item}</button>`).join("");
  el("nav").querySelectorAll("button").forEach(b=>b.onclick=()=>{activeView=b.dataset.view;activeMissionId=null;render();});
}

function renderProfileControls(){
  el("profileSelect").innerHTML = Object.values(profiles).map(p=>`<option value="${p.id}" ${p.id===currentProfileId?'selected':''}>${p.name}</option>`).join("");
  el("profileSelect").onchange=e=>{currentProfileId=e.target.value;localStorage.setItem("hellosimple-profile",currentProfileId);activeView="Today";activeMissionId=null;render();};
  el("profileButton").textContent = profile().name.split(/\s+/).map(x=>x[0]).slice(0,2).join("");
}

function statePill(label, cls=""){return `<span class="state-pill ${cls}">${label}</span>`;}
function workerRow(w){return `<div class="worker-row"><span class="worker-dot ${w.status}" aria-hidden="true"></span><div><strong>${w.name}</strong><div class="meta">${w.role} · ${w.activity}</div></div>${statePill(w.status,w.status)}</div>`;}

function renderToday(){
  const p=profile(); const next=missions().find(m=>!isDone(m.id)); const xp=totalXp(); const pct=Math.min(100,Math.round((xp/p.milestoneAt)*100));
  return `<div class="page-stack">
    <section class="welcome"><span class="eyebrow-label">Today</span><h2>Good ${new Date().getHours()<12?'morning':'afternoon'}, ${p.name.split(' ')[0]}</h2><p>Here is what needs you, what AI is handling, and what moves you forward.</p></section>
    <article class="card next-move kinetic-card"><div><span class="eyebrow-label">Your next move</span><h2>${next?next.title:'You cleared today’s assigned missions'}</h2><p>${next?next.definition:'Review your impact and choose what deserves your attention next.'}</p>${next?`<div class="mission-meta-line">${statePill(next.type)} ${next.workers.map(w=>statePill(w)).join(' ')}</div>`:''}</div>${next?`<button class="primary large" data-open-mission="${next.id}">Start mission →</button>`:`<button class="secondary" data-view-link="Impact">View impact</button>`}</article>
    <div class="grid two-balanced">
      <article class="card"><div class="section-head"><h2>Needs you</h2>${statePill(`${missions().filter(m=>!isDone(m.id)).length} open`,`human`)}</div><div class="list">${missions().filter(m=>!isDone(m.id)).map(m=>`<button class="task-row" data-open-mission="${m.id}"><span><strong>${m.title}</strong><span class="meta">${m.type} · ${m.workers.join(' + ')}</span></span><span>→</span></button>`).join('') || '<div class="empty">No human action waiting right now.</div>'}</div></article>
      <article class="card"><div class="section-head"><h2>AI working</h2>${statePill('Live activity','working')}</div><div class="list compact">${workers.slice(0,4).map(workerRow).join('')}</div><button class="text-link" data-view-link="Workers">See all workers →</button></article>
    </div>
    <div class="grid three">
      <article class="card"><span class="eyebrow-label">Today's schedule</span>${schedule[currentProfileId].map(s=>`<div class="schedule-line"><strong>${s[0]}</strong><span>${s[1]}</span><small>${s[2]}</small></div>`).join('')}</article>
      <article class="card journey-card"><span class="eyebrow-label">Your journey</span><h2>${p.level}</h2><div class="progress"><span style="width:${pct}%"></span></div><p><strong>${xp} XP</strong> · ${Math.max(0,p.milestoneAt-xp)} XP until ${p.nextMilestone}</p><button class="text-link inverse" data-view-link="Growth">See what ${p.nextMilestone} means →</button></article>
      <article class="card"><span class="eyebrow-label">Impact snapshot</span><div class="stat">${(impact[currentProfileId]||[]).length}</div><p class="meta">verified contributions recorded</p><button class="text-link" data-view-link="Impact">Open impact portfolio →</button></article>
    </div>
  </div>`;
}

function missionCard(m){return `<article class="card mission-card ${isDone(m.id)?'completed':''}"><div class="section-head">${statePill(m.type)}<strong>+${m.xp} XP</strong></div><h2>${m.title}</h2><p>${m.why}</p><div class="mission-footer"><span class="meta">${m.skills.join(' · ')}</span><button class="primary" data-open-mission="${m.id}">${isDone(m.id)?'Review evidence':'Open workspace'}</button></div></article>`;}

function renderWork(){
  if(activeMissionId){ const m=missions().find(x=>x.id===activeMissionId); return renderMissionWorkspace(m); }
  return `<div class="page-stack"><section class="welcome"><span class="eyebrow-label">Work</span><h2>Real work, with guidance when you need it.</h2><p>Every mission connects the company goal, your judgment, AI assistance, skill evidence, and impact.</p></section><div class="grid two-balanced">${missions().map(missionCard).join('')}</div></div>`;
}

function renderMissionWorkspace(m){
  const draft=evidenceDrafts[`${currentProfileId}:${m.id}`]||'';
  const done=isDone(m.id);
  return `<div class="page-stack mission-workspace">
    <button class="back-link" data-back-work>← Back to Work</button>
    <article class="card mission-hero"><div><span class="eyebrow-label">${m.type} mission</span><h2>${m.title}</h2><p>${m.definition}</p><div class="mission-meta-line">${m.workers.map(w=>statePill(w)).join(' ')} ${m.skills.map(s=>statePill(s,'accent')).join(' ')}</div></div><div class="xp-orb"><strong>+${m.xp}</strong><span>XP</span></div></article>
    <div class="grid mission-layout">
      <article class="card"><div class="section-head"><h2>Do the work</h2>${statePill(done?'Verified':'In progress',done?'ready':'working')}</div><ol class="step-list">${m.steps.map((s,i)=>`<li><span>${i+1}</span><div><strong>${s}</strong><p class="meta">Complete this step before moving to the next decision.</p></div></li>`).join('')}</ol>
      <label class="evidence-box"><span class="eyebrow-label">Your evidence / decision</span><textarea id="evidenceInput" rows="6" placeholder="What did you decide, create, review, or learn? Include enough context that another person can verify the contribution.">${esc(draft)}</textarea></label>
      <div class="mission-footer"><span class="meta">Required evidence: ${m.evidence}</span><button class="primary" data-submit-mission="${m.id}" ${done?'disabled':''}>${done?'Verified contribution':'Submit for completion'}</button></div></article>
      <aside class="assist-rail"><article class="card assist-card"><span class="eyebrow-label">Need help?</span><h2>Ask Hello</h2><p class="meta">Get help without leaving the mission.</p><div class="assist-actions"><button data-assist="ai" data-mission="${m.id}">Ask AI</button><button data-assist="demo" data-mission="${m.id}">Show me</button><button data-assist="steps" data-mission="${m.id}">Steps</button><button data-assist="troubleshoot" data-mission="${m.id}">Troubleshoot</button><button data-assist="support" data-mission="${m.id}">Contact support</button></div></article>
      <article class="card kinetic-status"><span class="eyebrow-label">Kinetic information</span><div class="loading-line"><span class="pulse-dot"></span><div><strong>${m.workers[0]} is ready</strong><p class="meta">Context for this mission is available. Ask for help when you need it.</p></div></div></article></aside>
    </div>
    <section id="assistPanel" aria-live="polite"></section>
  </div>`;
}

function renderAssist(kind,m){
  const content={
    ai:["Ask AI","I can help you interpret the mission, compare options, draft a response, or explain the evidence. I will not make the final human judgment for you.",`Try: “Summarize the strongest evidence for ${m.title.toLowerCase()}.”`],
    demo:["Show me",m.demo,"You can replay this walkthrough anytime. It does not affect your progress."],
    steps:["Step-by-step help",`Start with step 1: ${m.steps[0]}. When that is clear, move to the next step.`,`HelloSimple keeps instructions beside the work so you do not have to memorize the process.`],
    troubleshoot:["Troubleshoot","If something is not working, first preserve your work. Then check whether the issue is mission content, access/permissions, a connection, or submission. Your evidence draft is saved locally while you work.","If the problem persists, escalate to support with the mission name and what you already tried."],
    support:["Support","This prototype routes unresolved issues to the appropriate MSH owner rather than pretending AI solved them.","Include: what you were trying to do, what happened, what you expected, and whether your work is blocked."]
  }[kind];
  return `<article class="card assist-response"><div><span class="eyebrow-label">${content[0]}</span><h2>${kind==='support'?'We will get you unstuck.':'Help in context'}</h2><p>${content[1]}</p><p class="meta">${content[2]}</p></div>${kind==='support'?'<button class="primary" data-create-support>Start support request</button>':''}</article>`;
}

function renderWorkers(){return `<div class="page-stack"><section class="welcome"><span class="eyebrow-label">Workers</span><h2>Your AI coworkers, not a mystery layer.</h2><p>See what each worker is doing, what they are waiting on, and where you can collaborate.</p></section><div class="grid two-balanced">${workers.map(w=>`<article class="card worker-card">${workerRow(w)}<div class="worker-actions"><button class="secondary" data-worker-help="${w.name}">Ask for help</button><button class="text-link">Review activity →</button></div></article>`).join('')}</div></div>`;}
function renderGrowth(){const p=profile(),xp=totalXp(),pct=Math.min(100,Math.round((xp/p.milestoneAt)*100));return `<div class="page-stack"><article class="card journey-card growth-hero"><span class="eyebrow-label">Your journey</span><h2>${p.level} → ${p.nextMilestone}</h2><div class="progress big"><span style="width:${pct}%"></span></div><p><strong>${xp} / ${p.milestoneAt} XP</strong></p><p>${p.nextMilestone} means greater ownership of meaningful work with evidence, not automatic sensitive authority.</p></article><div class="grid two-balanced"><article class="card"><h2>Skills in motion</h2>${p.skills.map(s=>`<div class="skill-row"><div><strong>${s[0]}</strong><span class="meta">${s[1]}</span></div>${statePill('Evidence-backed','accent')}</div>`).join('')}</article><article class="card"><h2>Why you are progressing</h2><p>Progress comes from verified contribution, demonstrated capability, responsible AI collaboration, and increasing independence.</p><p class="meta">Celebrations explain what you accomplished, why it mattered, and what it unlocked.</p></article></div></div>`;}
function renderImpact(){const items=impact[currentProfileId]||[];return `<div class="page-stack"><section class="welcome"><span class="eyebrow-label">Impact</span><h2>Your work should leave evidence.</h2><p>Results, decisions, and contributions become a professional record you can inspect and eventually export.</p></section><article class="card">${items.length?items.map(i=>`<div class="impact-row"><div><strong>${esc(i.title)}</strong><div class="meta">${esc(i.date)} · ${i.skills.map(esc).join(', ')}</div><div class="impact-evidence">${esc(i.evidence)}</div></div>${statePill(`+${i.xp} XP`,'accent')}</div>`).join(''):'<div class="empty">Complete a mission with evidence to create your first verified impact record.</div>'}</article></div>`;}

function completeMission(id){
  const m=missions().find(x=>x.id===id); if(!m||isDone(id))return;
  const input=el("evidenceInput"); const value=(input?.value||'').trim();
  if(value.length<12){el("assistPanel").innerHTML=`<article class="card assist-response warning"><div><span class="eyebrow-label">Evidence needed</span><h2>Explain what you actually contributed.</h2><p>A verified contribution needs enough context for another person to understand what changed or what you decided.</p></div></article>`;return;}
  evidenceDrafts[`${currentProfileId}:${id}`]=value; localStorage.setItem("hellosimple-evidence",JSON.stringify(evidenceDrafts));
  completed[`${currentProfileId}:${id}`]=true; localStorage.setItem("hellosimple-completed",JSON.stringify(completed));
  impact[currentProfileId] ||= []; impact[currentProfileId].push({title:m.title,skills:m.skills,xp:m.xp,evidence:value,date:new Date().toLocaleDateString()}); localStorage.setItem("hellosimple-impact",JSON.stringify(impact));
  el("assistPanel").innerHTML=`<article class="card celebration"><span class="eyebrow-label">That mattered</span><h2>You moved MSH forward.</h2><p>${m.why}</p><div class="celebration-row">${statePill(`+${m.xp} XP`,'accent')}${m.skills.map(s=>statePill(`${s} strengthened`)).join('')}</div><p class="meta">Your contribution is now recorded in Impact. Next: keep building toward ${profile().nextMilestone}.</p></article>`;
  setTimeout(()=>render(),1400);
}

function wireActions(){
  document.querySelectorAll("[data-view-link]").forEach(b=>b.onclick=()=>{activeView=b.dataset.viewLink;activeMissionId=null;render();});
  document.querySelectorAll("[data-open-mission]").forEach(b=>b.onclick=()=>{activeView="Work";activeMissionId=b.dataset.openMission;render();});
  document.querySelectorAll("[data-back-work]").forEach(b=>b.onclick=()=>{activeMissionId=null;render();});
  document.querySelectorAll("[data-submit-mission]").forEach(b=>b.onclick=()=>completeMission(b.dataset.submitMission));
  document.querySelectorAll("[data-assist]").forEach(b=>b.onclick=()=>{const m=missions().find(x=>x.id===b.dataset.mission);el("assistPanel").innerHTML=renderAssist(b.dataset.assist,m);wireActions();el("assistPanel").scrollIntoView({behavior:"smooth",block:"nearest"});});
  document.querySelectorAll("[data-worker-help]").forEach(b=>b.onclick=()=>{alert(`${b.dataset.workerHelp} help entry point is wired in the prototype. Mission-scoped help uses the full Ask Hello panel.`);});
  const input=el("evidenceInput"); if(input) input.oninput=e=>{evidenceDrafts[`${currentProfileId}:${activeMissionId}`]=e.target.value;localStorage.setItem("hellosimple-evidence",JSON.stringify(evidenceDrafts));};
}

function render(){
  renderNav(); renderProfileControls();
  el("todayLabel").textContent=new Intl.DateTimeFormat(undefined,{weekday:"long",month:"long",day:"numeric"}).format(new Date());
  el("pageTitle").textContent=activeMissionId?"Mission":activeView;
  const views={Today:renderToday,Work:renderWork,Workers:renderWorkers,Growth:renderGrowth,Impact:renderImpact};
  el("view").innerHTML=views[activeView](); wireActions();
}
render();
