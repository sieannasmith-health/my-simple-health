const navItems = ["Today", "Missions", "Human Actions", "Hello Workers", "Skills & Contribution", "Impact Portfolio", "Profile"];

const profiles = {
  siea: {
    id: "siea",
    name: "Siea Smith",
    role: "Founder & CEO",
    workstream: "Company + Product",
    level: "Builder",
    xp: 720,
    xpNext: 1000,
    chapter: "Building MSH into an operating company",
    photo: localStorage.getItem("hellosimple-photo-siea") || "",
    skills: [
      ["Product strategy", "Consistent"],
      ["AI workforce orchestration", "Consistent"],
      ["Founder decision-making", "Demonstrated"],
      ["UX/product judgment", "Demonstrated"]
    ]
  },
  brandon: {
    id: "brandon",
    name: "Brandon Smith",
    role: "Co-Founder, Growth & Commercial Strategy (Trial)",
    workstream: "Growth + Commercial",
    level: "Explorer",
    xp: 240,
    xpNext: 500,
    chapter: "Co-Founder Trial Campaign · 90 days",
    photo: localStorage.getItem("hellosimple-photo-brandon") || "",
    skills: [
      ["Growth strategy", "Practiced"],
      ["Analytics interpretation", "Practiced"],
      ["AI collaboration", "Demonstrated"],
      ["Commercial judgment", "Observed"]
    ]
  }
};

const workers = [
  ["Nomy", "Product Orchestration", "working", "Sequencing current objective"],
  ["Genesis", "Growth & Acquisition", "working", "Preparing acquisition options"],
  ["Atlas", "Data & Analytics", "done", "Campaign readout ready for review"],
  ["Mira", "Design & UX", "waiting", "Waiting for employee-interface review"],
  ["Tessa", "Quality Engineering", "waiting", "QA after implementation evidence"]
];

const missionCatalog = {
  siea: [
    { id: "s1", title: "Review HelloSimple MVP direction", type: "Review", why: "Keeps the employee operating system aligned with founder intent.", skills: ["Product strategy", "UX/product judgment"], workers: ["Nomy", "Mira"], xp: 80, evidence: "Founder review decision" },
    { id: "s2", title: "Define next company milestone", type: "Decision", why: "Gives the workforce one clear company-level target.", skills: ["Founder decision-making", "AI workforce orchestration"], workers: ["Nomy", "Newton"], xp: 120, evidence: "Accepted milestone + rationale" }
  ],
  brandon: [
    { id: "b1", title: "Review launch-channel recommendation", type: "Review", why: "Moves MSH toward a grounded acquisition plan.", skills: ["Growth strategy", "Analytics interpretation"], workers: ["Genesis", "Atlas"], xp: 90, evidence: "Recommendation review + decision" },
    { id: "b2", title: "Draft first lifecycle campaign objective", type: "Collaborative", why: "Turns strategy into a measurable member-growth experiment.", skills: ["Growth strategy", "AI collaboration"], workers: ["Genesis", "Nomy"], xp: 110, evidence: "Campaign objective + success measure" },
    { id: "b3", title: "Complete TestFlight growth-lens review", type: "Human Action", why: "Adds real user and commercial judgment to the product loop.", skills: ["Commercial judgment", "AI collaboration"], workers: ["Mira", "Tessa"], xp: 70, evidence: "Founder-facing TestFlight findings" }
  ]
};

const humanActions = {
  siea: ["Approve current Product priority", "Review founder-only decisions surfaced by Nomy"],
  brandon: ["Review Atlas campaign findings", "Approve preferred launch-channel direction", "Complete TestFlight feedback"]
};

let currentProfileId = localStorage.getItem("hellosimple-profile") || "siea";
let activeView = "Today";
let completed = JSON.parse(localStorage.getItem("hellosimple-completed") || "{}");
let impact = JSON.parse(localStorage.getItem("hellosimple-impact") || "{}");

const el = (id) => document.getElementById(id);
const profile = () => profiles[currentProfileId];
const missions = () => missionCatalog[currentProfileId];

function initials(name) { return name.split(/\s+/).map(p => p[0]).slice(0,2).join(""); }
function avatarHTML(p) { return p.photo ? `<img src="${p.photo}" alt="${p.name} profile photo">` : initials(p.name); }
function isDone(id) { return Boolean(completed[`${currentProfileId}:${id}`]); }

function renderNav() {
  el("nav").innerHTML = navItems.map(item => `<button data-view="${item}" ${item === activeView ? 'aria-current="page"' : ''}>${item}</button>`).join("");
  el("nav").querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
    activeView = button.dataset.view;
    render();
  }));
}

function renderProfileControls() {
  el("profileSelect").innerHTML = Object.values(profiles).map(p => `<option value="${p.id}" ${p.id === currentProfileId ? "selected" : ""}>${p.name}</option>`).join("");
  el("profileButton").innerHTML = avatarHTML(profile());
  el("profileSelect").onchange = (event) => {
    currentProfileId = event.target.value;
    localStorage.setItem("hellosimple-profile", currentProfileId);
    activeView = "Today";
    render();
  };
  el("profileButton").onclick = () => { activeView = "Profile"; render(); };
}

function renderToday() {
  const p = profile();
  const remaining = missions().filter(m => !isDone(m.id));
  const priority = remaining[0];
  const pct = Math.min(100, Math.round((p.xp / p.xpNext) * 100));
  return `
    <div class="grid two">
      <div class="grid">
        <article class="card soft">
          <span class="chip accent">Current journey</span>
          <h2 style="margin-top:12px">${p.chapter}</h2>
          <p class="meta">${p.role} · ${p.workstream}</p>
          <div class="progress" aria-label="Level progress"><span style="width:${pct}%"></span></div>
          <p class="meta" style="margin:8px 0 0">${p.xp} / ${p.xpNext} XP · ${p.level}</p>
        </article>
        <article class="card">
          <div class="section-head"><h2>Your priority</h2><span class="badge">Today</span></div>
          ${priority ? `<h3>${priority.title}</h3><p>${priority.why}</p><div class="mission-footer"><span class="chip">${priority.type}</span><button class="primary" data-open-mission="${priority.id}">Open mission</button></div>` : `<div class="empty">Today’s assigned missions are complete.</div>`}
        </article>
        <article class="card">
          <div class="section-head"><h2>Needs you</h2><span class="badge">Human lane</span></div>
          <div class="list">${humanActions[currentProfileId].map(x => `<div class="item"><div><strong>${x}</strong><span class="meta">Human judgment, review, approval, or action</span></div></div>`).join("")}</div>
        </article>
      </div>
      <div class="grid">
        <article class="card">
          <div class="section-head"><h2>Hello Workers</h2><button class="secondary" data-view-link="Hello Workers">View all</button></div>
          <div class="list">${workers.slice(0,4).map(w => `<div class="worker-row"><span class="worker-dot ${w[2]}"></span><div><strong>${w[0]}</strong><div class="meta">${w[3]}</div></div><span class="badge">${w[2]}</span></div>`).join("")}</div>
        </article>
        <article class="card">
          <div class="section-head"><h2>Skills you’re building</h2><button class="secondary" data-view-link="Skills & Contribution">Details</button></div>
          <div class="list">${p.skills.slice(0,4).map(s => `<div class="item"><div><strong>${s[0]}</strong><span class="meta">${s[1]}</span></div></div>`).join("")}</div>
        </article>
        <article class="card warning"><h2>Why today matters</h2><p style="margin-bottom:0">Your work is tied to current MSH objectives, not a generic training checklist. Finished work becomes skill and impact evidence.</p></article>
      </div>
    </div>`;
}

function missionCard(m) {
  const done = isDone(m.id);
  return `<article class="card mission">
    <div class="section-head"><div><span class="chip">${m.type}</span></div><strong>+${m.xp} XP</strong></div>
    <div><h2>${m.title}</h2><p>${m.why}</p></div>
    <div><span class="meta">Skills</span><div style="margin-top:7px">${m.skills.map(s => `<span class="chip accent">${s}</span>`).join(" ")}</div></div>
    <div><span class="meta">Hello Workers</span><div style="margin-top:7px">${m.workers.map(w => `<span class="chip">${w}</span>`).join(" ")}</div></div>
    <div class="meta">Evidence: ${m.evidence}</div>
    <div class="mission-footer"><span class="badge">${done ? "Completed · added to Impact Portfolio" : "Ready"}</span>${done ? "" : `<button class="primary" data-complete="${m.id}">Complete mission</button>`}</div>
  </article>`;
}

function renderMissions() { return `<div class="grid two">${missions().map(missionCard).join("")}</div>`; }
function renderHumanActions() { return `<article class="card"><div class="section-head"><h2>Human Actions</h2><span class="badge">Only where you are needed</span></div><div class="list">${humanActions[currentProfileId].map(x => `<div class="item"><div><strong>${x}</strong><div class="meta">Kept separate from work Hello Workers can appropriately execute.</div></div><span class="chip">Human Action</span></div>`).join("")}</div></article>`; }
function renderWorkers() { return `<div class="grid two">${workers.map(w => `<article class="card worker-row"><span class="worker-dot ${w[2]}"></span><div><h2 style="margin-bottom:3px">${w[0]}</h2><div class="meta">${w[1]} · ${w[3]}</div></div><span class="badge">${w[2]}</span></article>`).join("")}</div>`; }

function renderSkills() {
  const p = profile();
  const completedCount = missions().filter(m => isDone(m.id)).length;
  return `<div class="grid two"><article class="card"><h2>Skills</h2><div class="list">${p.skills.map(s => `<div class="item"><div><strong>${s[0]}</strong><span class="meta">${s[1]}</span></div><span class="chip accent">Evidence-backed progression</span></div>`).join("")}</div></article><article class="card"><h2>Contribution</h2><div class="metric-grid"><div class="metric"><span class="stat">${completedCount}</span><div class="meta">missions completed</div></div><div class="metric"><span class="stat">${(impact[currentProfileId] || []).length}</span><div class="meta">impact records</div></div></div><p class="meta" style="margin-top:16px">Skill gained → contribution made → evidence recorded. Training completion alone does not equal demonstrated skill.</p></article></div>`;
}

function renderImpact() {
  const items = impact[currentProfileId] || [];
  return `<article class="card"><div class="section-head"><h2>Impact Portfolio</h2><span class="badge">Results, not activity</span></div>${items.length ? `<div class="list">${items.map(i => `<div class="item"><div><strong>${i.title}</strong><div class="meta">${i.contribution} · ${i.skills.join(", ")} · ${i.date}</div></div><span class="chip accent">${i.xp} XP earned</span></div>`).join("")}</div>` : `<div class="empty">Complete a meaningful mission to create the first evidence-backed accomplishment.</div>`}</article>`;
}

function renderProfile() {
  const p = profile();
  return `<div class="grid"><article class="card profile-hero"><div class="avatar">${avatarHTML(p)}</div><div><h2>${p.name}</h2><p class="meta">${p.role}<br>${p.workstream}</p><button id="changePhoto" class="secondary">Change profile photo</button></div></article><article class="card"><div class="metric-grid"><div class="metric"><span class="stat">${p.xp}</span><div class="meta">XP</div></div><div class="metric"><span class="stat">${p.level}</span><div class="meta">current level</div></div><div class="metric"><span class="stat">${p.skills.length}</span><div class="meta">tracked skills</div></div><div class="metric"><span class="stat">${(impact[currentProfileId] || []).length}</span><div class="meta">impact records</div></div></div></article></div>`;
}

function completeMission(id) {
  const mission = missions().find(m => m.id === id);
  if (!mission || isDone(id)) return;
  completed[`${currentProfileId}:${id}`] = true;
  profiles[currentProfileId].xp += mission.xp;
  impact[currentProfileId] ||= [];
  impact[currentProfileId].push({ title: mission.title, contribution: mission.type, skills: mission.skills, xp: mission.xp, date: new Date().toLocaleDateString() });
  localStorage.setItem("hellosimple-completed", JSON.stringify(completed));
  localStorage.setItem("hellosimple-impact", JSON.stringify(impact));
  render();
}

function wireActions() {
  document.querySelectorAll("[data-view-link]").forEach(b => b.onclick = () => { activeView = b.dataset.viewLink; render(); });
  document.querySelectorAll("[data-open-mission]").forEach(b => b.onclick = () => { activeView = "Missions"; render(); setTimeout(() => document.querySelector(`[data-complete='${b.dataset.openMission}']`)?.focus(), 0); });
  document.querySelectorAll("[data-complete]").forEach(b => b.onclick = () => completeMission(b.dataset.complete));
  const change = el("changePhoto");
  if (change) change.onclick = () => el("photoInput").click();
}

function render() {
  renderNav();
  renderProfileControls();
  el("todayLabel").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  el("pageTitle").textContent = activeView;
  const views = {
    "Today": renderToday,
    "Missions": renderMissions,
    "Human Actions": renderHumanActions,
    "Hello Workers": renderWorkers,
    "Skills & Contribution": renderSkills,
    "Impact Portfolio": renderImpact,
    "Profile": renderProfile
  };
  el("view").innerHTML = views[activeView]();
  wireActions();
}

el("photoInput").addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const value = String(reader.result || "");
    profiles[currentProfileId].photo = value;
    localStorage.setItem(`hellosimple-photo-${currentProfileId}`, value);
    render();
  };
  reader.readAsDataURL(file);
});

render();
