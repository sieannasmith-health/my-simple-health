const navItems = ["Today", "Missions", "Human Actions", "Hello Workers", "Workstreams", "Journey", "Skills & Contribution", "Impact Portfolio", "Profile"];

const profiles = {
  siea: {
    id: "siea", name: "Siea Smith", role: "Founder & CEO", workstream: "Company + Product",
    level: "Builder", baseXp: 720, nextLevelXp: 1000, chapter: "Building MSH into an operating company",
    nextMilestone: "Operating Founder", milestoneAt: 1000,
    photo: localStorage.getItem("hellosimple-photo-siea") || "",
    skills: [["Product strategy","Consistent"],["AI workforce orchestration","Consistent"],["Founder decision-making","Demonstrated"],["UX/product judgment","Demonstrated"],["Company operations","Practiced"]]
  },
  brandon: {
    id: "brandon", name: "Brandon Smith", role: "Co-Founder, Growth & Commercial Strategy (Trial)", workstream: "Growth + Commercial",
    level: "Explorer", baseXp: 240, nextLevelXp: 500, chapter: "Co-Founder Trial Campaign · 90 days",
    nextMilestone: "Builder", milestoneAt: 500,
    photo: localStorage.getItem("hellosimple-photo-brandon") || "",
    skills: [["Growth strategy","Practiced"],["Analytics interpretation","Practiced"],["AI collaboration","Demonstrated"],["Commercial judgment","Observed"],["Lifecycle strategy","Observed"]]
  }
};

const companyObjective = {
  title: "Build and validate the HelloSimple employee operating experience",
  why: "Create a workforce system where each person can see today’s work, the AI work around them, the skills they are building, and the value they are adding.",
  horizon: "Pilot with Siea + Brandon"
};

const workers = [
  {name:"Nomy", role:"Product Orchestration", status:"working", activity:"Sequencing current objective and employee work"},
  {name:"Selah", role:"Software Engineering", status:"working", activity:"Implementing HelloSimple interface and integrations"},
  {name:"Mira", role:"Design & UX", status:"review", activity:"Reviewing clarity, hierarchy, accessibility, and flow"},
  {name:"Harper", role:"People & Hiring", status:"working", activity:"Mapping role development and onboarding progression"},
  {name:"Genesis", role:"Growth & Acquisition", status:"working", activity:"Preparing growth work for Brandon’s trial lane"},
  {name:"Atlas", role:"Data & Analytics", status:"ready", activity:"Contribution and outcome measurement ready"},
  {name:"Tessa", role:"Quality Engineering", status:"waiting", activity:"QA follows exact-head implementation evidence"}
];

const missionCatalog = {
  siea: [
    {id:"s1",title:"Test the HelloSimple employee interface",type:"Review",why:"Founder testing validates whether the workforce experience actually feels simple and useful.",skills:["Product strategy","UX/product judgment"],workers:["Nomy","Mira","Selah"],xp:80,evidence:"Founder usability findings",contribution:"Reviewed"},
    {id:"s2",title:"Confirm the next MSH company milestone",type:"Decision",why:"Keeps product, workforce, and launch activity aligned around one meaningful target.",skills:["Founder decision-making","AI workforce orchestration"],workers:["Nomy","Newton"],xp:120,evidence:"Accepted milestone + rationale",contribution:"Decided"},
    {id:"s3",title:"Review employee role and reward model",type:"Review",why:"Ensures progression reflects real capability and contribution instead of decorative gamification.",skills:["Company operations","Product strategy"],workers:["Harper","Nomy"],xp:90,evidence:"Founder-approved progression rules",contribution:"Approved"}
  ],
  brandon: [
    {id:"b1",title:"Review launch-channel recommendation",type:"Review",why:"Moves MSH toward a grounded acquisition plan using his growth expertise.",skills:["Growth strategy","Analytics interpretation"],workers:["Genesis","Atlas"],xp:90,evidence:"Recommendation review + decision",contribution:"Reviewed"},
    {id:"b2",title:"Draft the first lifecycle campaign objective",type:"Collaborative",why:"Turns MSH growth strategy into a measurable member-growth experiment.",skills:["Growth strategy","AI collaboration","Lifecycle strategy"],workers:["Genesis","Nomy"],xp:110,evidence:"Campaign objective + success measure",contribution:"Collaborated"},
    {id:"b3",title:"Complete TestFlight growth-lens review",type:"Human Action",why:"Adds real product and commercial judgment that the AI workforce cannot replace.",skills:["Commercial judgment","AI collaboration"],workers:["Mira","Tessa"],xp:70,evidence:"Founder-facing TestFlight findings",contribution:"Created"},
    {id:"b4",title:"Choose the next growth experiment",type:"Decision",why:"Demonstrates independent ownership of a meaningful growth decision.",skills:["Growth strategy","Commercial judgment"],workers:["Genesis","Atlas","Newton"],xp:130,evidence:"Chosen experiment + reasoning",contribution:"Decided"}
  ]
};

const schedule = {
  siea: [
    {time:"9:00",title:"Founder operating brief",kind:"Brief",source:"Nomy",detail:"Review what moved, what needs you, and what can stay with the workforce."},
    {time:"11:00",title:"HelloSimple founder test",kind:"Human Action",source:"Mira + Selah",detail:"Use the current interface and capture friction, confusion, or missing value."},
    {time:"2:00",title:"Product decisions",kind:"Decision",source:"Nomy",detail:"Review only founder-level decisions that cannot be resolved by the colony."},
    {time:"4:00",title:"Progress check",kind:"Review",source:"Tessa",detail:"See what completed, what evidence exists, and what moved forward."}
  ],
  brandon: [
    {time:"9:30",title:"Growth operating brief",kind:"Brief",source:"Genesis + Nomy",detail:"Review current growth objective, AI work in progress, and decisions needed today."},
    {time:"11:30",title:"Channel recommendation review",kind:"Review",source:"Genesis + Atlas",detail:"Review evidence and choose what deserves further testing."},
    {time:"2:30",title:"Lifecycle mission",kind:"Collaborative",source:"Genesis",detail:"Shape a measurable campaign objective with AI support."},
    {time:"4:30",title:"Impact capture",kind:"Review",source:"HelloSimple",detail:"Confirm what you contributed, what skill evidence was created, and what comes next."}
  ]
};

const humanActions = {
  siea: ["Test the employee interface as a real user","Approve founder-only product decisions","Confirm the next company milestone"],
  brandon: ["Review launch-channel direction","Interpret Atlas findings and select the recommendation","Complete TestFlight feedback from a growth lens"]
};

const workstreams = {
  siea: [
    ["HelloSimple MVP","In progress","Create a usable employee operating experience"],
    ["MSH Core App","In progress","Continue member product build and TestFlight QA"],
    ["Agent Interoperability","Active","Keep the 17-worker system stable and evidence-driven"]
  ],
  brandon: [
    ["Co-Founder Trial Campaign","Active","Learn → contribute → own → Founder Review"],
    ["Growth & Acquisition","Active","Define and test credible acquisition paths"],
    ["Lifecycle Strategy","Starting","Build a measurable member communication strategy"]
  ]
};

const rewardTrack = {
  siea: [
    ["Explorer",250,"Completed"],["Builder",500,"Completed"],["Operating Founder",1000,"Next"],["Company Architect",1600,"Locked"]
  ],
  brandon: [
    ["Explorer",0,"Current"],["Builder",500,"Next"],["Operator",900,"Locked"],["Founding Operator",1500,"Locked"],["Founder Review",2000,"Locked"]
  ]
};

let currentProfileId = localStorage.getItem("hellosimple-profile") || "siea";
let activeView = "Today";
let completed = JSON.parse(localStorage.getItem("hellosimple-completed") || "{}");
let impact = JSON.parse(localStorage.getItem("hellosimple-impact") || "{}");

const el = id => document.getElementById(id);
const profile = () => profiles[currentProfileId];
const missions = () => missionCatalog[currentProfileId];
const earnedXp = () => missions().filter(m => isDone(m.id)).reduce((sum,m) => sum + m.xp, 0);
const totalXp = () => profile().baseXp + earnedXp();
function initials(name){return name.split(/\s+/).map(p=>p[0]).slice(0,2).join("");}
function avatarHTML(p){return p.photo ? `<img src="${p.photo}" alt="${p.name} profile photo">` : initials(p.name);}
function isDone(id){return Boolean(completed[`${currentProfileId}:${id}`]);}
function esc(text){return String(text).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}

function renderNav(){
  el("nav").innerHTML = navItems.map(item => `<button data-view="${item}" ${item===activeView?'aria-current="page"':''}><span>${item}</span></button>`).join("");
  el("nav").querySelectorAll("button").forEach(button => button.onclick = () => { activeView=button.dataset.view; render(); });
}

function renderProfileControls(){
  el("profileSelect").innerHTML = Object.values(profiles).map(p=>`<option value="${p.id}" ${p.id===currentProfileId?"selected":""}>${p.name}</option>`).join("");
  el("profileButton").innerHTML = avatarHTML(profile());
  el("profileSelect").onchange = event => { currentProfileId=event.target.value; localStorage.setItem("hellosimple-profile",currentProfileId); activeView="Today"; render(); };
  el("profileButton").onclick = () => { activeView="Profile"; render(); };
}

function renderObjective(){
  return `<article class="card objective-card"><div><span class="eyebrow-label">Current company objective</span><h2>${companyObjective.title}</h2><p>${companyObjective.why}</p></div><span class="chip accent">${companyObjective.horizon}</span></article>`;
}

function renderToday(){
  const p=profile(); const remaining=missions().filter(m=>!isDone(m.id)); const priority=remaining[0]; const xp=totalXp(); const pct=Math.min(100,Math.round((xp/p.milestoneAt)*100));
  return `<div class="page-stack">
    ${renderObjective()}
    <div class="hero-grid">
      <article class="card journey-card"><span class="eyebrow-label">Your journey</span><h2>${p.chapter}</h2><p class="meta">${p.role} · ${p.workstream}</p><div class="progress"><span style="width:${pct}%"></span></div><div class="progress-row"><strong>${xp} XP</strong><span>${p.nextMilestone} at ${p.milestoneAt}</span></div></article>
      <article class="card priority-card"><div class="section-head"><h2>Your priority</h2><span class="badge">Today</span></div>${priority?`<h3>${priority.title}</h3><p>${priority.why}</p><div class="mission-footer"><span class="chip">${priority.type}</span><button class="primary" data-open-mission="${priority.id}">Open mission</button></div>`:`<div class="empty">Today’s assigned missions are complete.</div>`}</article>
    </div>
    <div class="grid two-balanced">
      <article class="card"><div class="section-head"><h2>Today's schedule</h2><span class="badge">Dynamic work</span></div><div class="timeline">${schedule[currentProfileId].map(s=>`<div class="timeline-row"><div class="time">${s.time}</div><div><strong>${s.title}</strong><div class="meta">${s.detail}</div><div class="source">${s.kind} · ${s.source}</div></div></div>`).join("")}</div></article>
      <div class="grid">
        <article class="card human-card"><div class="section-head"><h2>Needs you</h2><span class="badge">Human lane</span></div><div class="list">${humanActions[currentProfileId].map(x=>`<div class="item"><div><strong>${x}</strong><span class="meta">Human judgment, review, approval, relationship, or action</span></div></div>`).join("")}</div></article>
        <article class="card"><div class="section-head"><h2>Hello Workers</h2><button class="secondary" data-view-link="Hello Workers">View all</button></div><div class="list compact">${workers.slice(0,4).map(workerRow).join("")}</div></article>
      </div>
    </div>
    <div class="grid three">
      <article class="card"><span class="eyebrow-label">Skills in motion</span><h2>${p.skills[0][0]}</h2><p class="meta">${p.skills[0][1]} · strengthened by today’s real work</p><button class="text-link" data-view-link="Skills & Contribution">See skill evidence →</button></article>
      <article class="card"><span class="eyebrow-label">Contribution</span><h2>${(impact[currentProfileId]||[]).length} impact records</h2><p class="meta">Completed work becomes an evidence-backed record of value created.</p><button class="text-link" data-view-link="Impact Portfolio">Open portfolio →</button></article>
      <article class="card"><span class="eyebrow-label">Next reward</span><h2>${p.nextMilestone}</h2><p class="meta">Rewards unlock progression and responsibility, not sensitive authority.</p><button class="text-link" data-view-link="Journey">View reward track →</button></article>
    </div>
  </div>`;
}

function missionCard(m){const done=isDone(m.id);return `<article class="card mission ${done?'completed':''}"><div class="section-head"><span class="chip">${m.type}</span><strong>+${m.xp} XP</strong></div><div><h2>${m.title}</h2><p>${m.why}</p></div><div class="mission-meta"><div><span class="meta-label">Skills you'll build</span>${m.skills.map(s=>`<span class="chip accent">${s}</span>`).join(" ")}</div><div><span class="meta-label">Hello Workers</span>${m.workers.map(w=>`<span class="chip">${w}</span>`).join(" ")}</div><div><span class="meta-label">Completion evidence</span><p class="meta">${m.evidence}</p></div></div><div class="mission-footer"><span class="badge">${done?"Completed · added to Impact Portfolio":"Ready"}</span>${done?"":`<button class="primary" data-complete="${m.id}">Complete mission</button>`}</div></article>`;}
function renderMissions(){return `<div class="page-stack"><div class="intro"><span class="eyebrow-label">Real work, not training busywork</span><h2>Complete missions that move MSH and build your professional evidence.</h2></div><div class="grid two-balanced">${missions().map(missionCard).join("")}</div></div>`;}
function renderHumanActions(){return `<div class="page-stack"><article class="card human-card"><div class="section-head"><h2>Human Actions</h2><span class="badge">Only where you are needed</span></div><p class="meta">HelloSimple separates human judgment from work the AI workforce can appropriately execute.</p><div class="list">${humanActions[currentProfileId].map(x=>`<div class="item"><div><strong>${x}</strong><div class="meta">Your direct involvement creates the evidence.</div></div><span class="chip">Human Action</span></div>`).join("")}</div></article><article class="card guidance"><span class="eyebrow-label">Guidance pattern</span><h2>Need help doing one of these?</h2><p>Procedural help should appear inside the mission in a Scribe-style step flow, with Guidde-style contextual walkthroughs when demonstration is more useful.</p></article></div>`;}
function workerRow(w){return `<div class="worker-row"><span class="worker-dot ${w.status}"></span><div><strong>${w.name}</strong><div class="meta">${w.activity}</div></div><span class="badge">${w.status}</span></div>`;}
function renderWorkers(){return `<div class="page-stack"><div class="intro"><span class="eyebrow-label">Your AI workforce</span><h2>See what the colony is handling and where it needs you.</h2></div><div class="grid two-balanced">${workers.map(w=>`<article class="card worker-card">${workerRow(w)}<div class="role-line">${w.role}</div></article>`).join("")}</div></div>`;}
function renderWorkstreams(){return `<div class="page-stack">${renderObjective()}<div class="grid three">${workstreams[currentProfileId].map(w=>`<article class="card"><span class="badge">${w[1]}</span><h2 class="spaced-title">${w[0]}</h2><p>${w[2]}</p><div class="progress subtle"><span style="width:${w[1]==='Active'?'68%':w[1]==='In progress'?'52%':'28%'}"></span></div></article>`).join("")}</div></div>`;}
function renderJourney(){const xp=totalXp();return `<div class="page-stack"><article class="card reward-hero"><span class="eyebrow-label">Progression system</span><h2>${profile().level} · ${xp} XP</h2><p>Whiteout Survival-style progression mechanics, presented as a calm professional journey: clear milestones, visible rewards, and increasing ownership with no game animation.</p></article><div class="reward-track">${rewardTrack[currentProfileId].map((r,i)=>{const reached=xp>=r[1];return `<article class="reward-step ${reached?'reached':''}"><div class="reward-index">${i+1}</div><div><strong>${r[0]}</strong><div class="meta">${r[1]} XP · ${reached?'Reached':r[2]}</div><p class="reward-copy">${i===0?'Learn the system and complete real work.':i===1?'Demonstrate consistent contribution and AI collaboration.':i===2?'Take ownership of meaningful workstreams with evidence.':i===3?'Operate with broad role-level independence inside approved authority.':'Unlock Founder Review based on the full trial record.'}</p></div></article>`;}).join("")}</div><article class="card"><h2>What rewards mean here</h2><p class="meta">Rewards can unlock new mission types, broader responsibility, visible milestones, and more independent work. XP never automatically grants admin, secrets, production, legal, financial, or founder authority.</p></article></div>`;}
function renderSkills(){const p=profile();const completedCount=missions().filter(m=>isDone(m.id)).length;return `<div class="page-stack"><div class="grid two-balanced"><article class="card"><h2>Skills</h2><div class="list">${p.skills.map(s=>`<div class="item"><div><strong>${s[0]}</strong><span class="meta">${s[1]}</span></div><span class="chip accent">Evidence-backed</span></div>`).join("")}</div></article><article class="card"><h2>Contribution</h2><div class="metric-grid"><div class="metric"><span class="stat">${completedCount}</span><div class="meta">missions completed</div></div><div class="metric"><span class="stat">${(impact[currentProfileId]||[]).length}</span><div class="meta">impact records</div></div><div class="metric"><span class="stat">${earnedXp()}</span><div class="meta">XP from verified work</div></div></div><p class="meta note">Skill gained → contribution made → evidence recorded. Training completion alone does not equal demonstrated skill.</p></article></div><article class="card"><h2>Development states</h2><div class="state-row">${["Observed","Practiced","Demonstrated","Consistent","Advanced"].map(s=>`<span class="state-pill">${s}</span>`).join("")}</div></article></div>`;}
function renderImpact(){const items=impact[currentProfileId]||[];return `<div class="page-stack"><article class="card"><div class="section-head"><div><span class="eyebrow-label">Career evidence</span><h2>Impact Portfolio</h2></div><span class="badge">Results, not activity</span></div>${items.length?`<div class="impact-list">${items.map(i=>`<article class="impact-row"><div><strong>${esc(i.title)}</strong><div class="meta">${esc(i.contribution)} · ${i.skills.map(esc).join(", ")} · ${esc(i.date)}</div><div class="impact-evidence">Evidence: ${esc(i.evidence||"Mission completion record")}</div></div><span class="chip accent">+${i.xp} XP</span></article>`).join("")}</div>`:`<div class="empty">Complete a meaningful mission to create the first evidence-backed accomplishment.</div>`}</article><article class="card"><h2>Eventually export this</h2><p class="meta">Resume accomplishments, LinkedIn experience, performance summaries, project portfolio, skill record, and a full employment experience archive should all be generated from verified evidence.</p></article></div>`;}
function renderProfile(){const p=profile();return `<div class="page-stack"><article class="card profile-hero"><div class="avatar">${avatarHTML(p)}</div><div><span class="eyebrow-label">Employee identity</span><h2>${p.name}</h2><p class="meta">${p.role}<br>${p.workstream}</p><button id="changePhoto" class="secondary">Change profile photo</button></div></article><div class="metric-grid four"><div class="metric"><span class="stat">${totalXp()}</span><div class="meta">XP</div></div><div class="metric"><span class="stat small-stat">${p.level}</span><div class="meta">current level</div></div><div class="metric"><span class="stat">${p.skills.length}</span><div class="meta">tracked skills</div></div><div class="metric"><span class="stat">${(impact[currentProfileId]||[]).length}</span><div class="meta">impact records</div></div></div><article class="card"><h2>Current role</h2><p>${p.role}</p><p class="meta">The role is stable. Today’s schedule and activities adapt as MSH objectives, workstreams, and Hello Worker activity change.</p></article></div>`;}

function completeMission(id){const mission=missions().find(m=>m.id===id);if(!mission||isDone(id))return;completed[`${currentProfileId}:${id}`]=true;impact[currentProfileId] ||= [];impact[currentProfileId].push({title:mission.title,contribution:mission.contribution,skills:mission.skills,xp:mission.xp,evidence:mission.evidence,date:new Date().toLocaleDateString()});localStorage.setItem("hellosimple-completed",JSON.stringify(completed));localStorage.setItem("hellosimple-impact",JSON.stringify(impact));render();}

function wireActions(){document.querySelectorAll("[data-view-link]").forEach(b=>b.onclick=()=>{activeView=b.dataset.viewLink;render();});document.querySelectorAll("[data-open-mission]").forEach(b=>b.onclick=()=>{activeView="Missions";render();setTimeout(()=>document.querySelector(`[data-complete='${b.dataset.openMission}']`)?.focus(),0);});document.querySelectorAll("[data-complete]").forEach(b=>b.onclick=()=>completeMission(b.dataset.complete));const change=el("changePhoto");if(change)change.onclick=()=>el("photoInput").click();}

function render(){renderNav();renderProfileControls();el("todayLabel").textContent=new Intl.DateTimeFormat(undefined,{weekday:"long",month:"long",day:"numeric"}).format(new Date());el("pageTitle").textContent=activeView;const views={"Today":renderToday,"Missions":renderMissions,"Human Actions":renderHumanActions,"Hello Workers":renderWorkers,"Workstreams":renderWorkstreams,"Journey":renderJourney,"Skills & Contribution":renderSkills,"Impact Portfolio":renderImpact,"Profile":renderProfile};el("view").innerHTML=views[activeView]();wireActions();}

el("photoInput").addEventListener("change",event=>{const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{const value=String(reader.result||"");profiles[currentProfileId].photo=value;localStorage.setItem(`hellosimple-photo-${currentProfileId}`,value);render();};reader.readAsDataURL(file);});

render();