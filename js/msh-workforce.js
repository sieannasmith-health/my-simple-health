const STORAGE_KEY = "msh-workforce-v0.1";

const executionMeta = {
  ai: { label: "AI", icon: "✦" },
  review: { label: "Review", icon: "◉" },
  collaborative: { label: "Collaborative", icon: "◇" },
  human_action: { label: "Human action", icon: "☝" },
  approval: { label: "Approval", icon: "✓" }
};

const initialState = {
  employee: {
    id: "brandon-smith",
    name: "Brandon",
    initials: "BS",
    role: "Growth Operations",
    department: "Growth",
    level: 2,
    xp: 420,
    nextLevelXp: 750,
    streakLabel: "3 meaningful contributions this week"
  },
  tasks: [
    {
      id: "campaign-review",
      title: "Review campaign recommendation",
      description: "Genesis completed the initial campaign analysis. Your judgment is needed on the recommended direction before anything advances.",
      campaign: "Daily work",
      executionType: "review",
      state: "ready_for_human",
      xp: 75,
      agent: "Genesis",
      dueLabel: "Today",
      evidence: "AI analysis complete",
      actionLabel: "Review & complete"
    },
    {
      id: "adobe-access",
      title: "Authorize creative workspace access",
      description: "This account authorization must be performed by you. AI can prepare the integration steps but cannot sign in as you.",
      campaign: "Onboarding",
      executionType: "human_action",
      state: "ready_for_human",
      xp: 40,
      agent: "Selah",
      dueLabel: "When convenient",
      evidence: "Setup instructions ready",
      actionLabel: "Mark action complete"
    },
    {
      id: "brand-direction",
      title: "Choose onboarding brand direction",
      description: "Mira prepared two employee-side visual directions. Select the direction that best fits MSH before implementation continues.",
      campaign: "Onboarding",
      executionType: "approval",
      state: "ready_for_human",
      xp: 60,
      agent: "Mira",
      dueLabel: "This week",
      evidence: "2 directions prepared",
      actionLabel: "Approve direction"
    },
    {
      id: "competitor-research",
      title: "Map competitor onboarding patterns",
      description: "Research is being synthesized into patterns MSH can use without copying conventional LMS busywork.",
      campaign: "Workforce discovery",
      executionType: "ai",
      state: "ai_working",
      xp: 0,
      agent: "Iris",
      dueLabel: "AI active",
      evidence: "Research in progress",
      actionLabel: null
    },
    {
      id: "activation-metrics",
      title: "Define onboarding activation measures",
      description: "Atlas is preparing a small measurement set focused on competency and successful handoffs rather than time online.",
      campaign: "Workforce discovery",
      executionType: "ai",
      state: "ai_working",
      xp: 0,
      agent: "Atlas",
      dueLabel: "AI active",
      evidence: "Metric draft in progress",
      actionLabel: null
    },
    {
      id: "role-context",
      title: "Learn your MSH role and authority",
      description: "Understand what you own, what your AI teammates can execute, and which decisions remain yours.",
      campaign: "Onboarding",
      executionType: "collaborative",
      state: "completed",
      xp: 100,
      agent: "Harper",
      dueLabel: "Completed",
      evidence: "Role orientation complete",
      actionLabel: null
    },
    {
      id: "meet-ai-team",
      title: "Meet your AI work crew",
      description: "Learn the specialists that support your workstream and how their handoffs reach you.",
      campaign: "Onboarding",
      executionType: "collaborative",
      state: "completed",
      xp: 100,
      agent: "Nomy",
      dueLabel: "Completed",
      evidence: "Crew orientation complete",
      actionLabel: null
    },
    {
      id: "first-ai-review",
      title: "Complete your first AI-assisted review",
      description: "Review an AI-produced deliverable, make the needed human decision, and close the loop with evidence.",
      campaign: "Onboarding",
      executionType: "review",
      state: "queued",
      xp: 125,
      agent: "Genesis",
      dueLabel: "Next mission",
      evidence: "Unlocks after current review",
      actionLabel: null
    }
  ],
  agents: [
    { id: "genesis", name: "Genesis", specialty: "Growth & Acquisition", state: "working", assignment: "Campaign recommendation and growth experiments" },
    { id: "atlas", name: "Atlas", specialty: "Data & Analytics", state: "working", assignment: "Onboarding activation measurement" },
    { id: "mira", name: "Mira", specialty: "Product Design", state: "ready", assignment: "Employee-side visual direction ready for approval" },
    { id: "nomy", name: "Nomy", specialty: "Product Orchestration", state: "ready", assignment: "Workforce objective coordination" }
  ],
  milestones: [
    { id: "arrival", title: "First Steps", description: "Completed the first MSH orientation mission.", earned: true, threshold: 1 },
    { id: "ai-collab", title: "AI Collaborator", description: "Completed a verified human + AI work loop.", earned: false, threshold: 1 },
    { id: "independent", title: "Independent", description: "Finished the onboarding campaign and role qualification.", earned: false, threshold: 100 },
    { id: "first-objective", title: "Objective Complete", description: "Closed a real MSH objective with evidence.", earned: false, threshold: 1 }
  ]
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return clone(initialState);
    const parsed = JSON.parse(saved);
    if (!parsed?.employee || !Array.isArray(parsed?.tasks)) return clone(initialState);
    return parsed;
  } catch {
    return clone(initialState);
  }
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function initials(name) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function humanTasks() {
  return state.tasks.filter((task) =>
    task.state === "ready_for_human" && ["review", "collaborative", "human_action", "approval"].includes(task.executionType)
  );
}

function aiTasks() {
  return state.tasks.filter((task) => task.executionType === "ai" && ["queued", "ai_working", "in_progress"].includes(task.state));
}

function onboardingTasks() {
  return state.tasks.filter((task) => task.campaign === "Onboarding");
}

function completedOnboardingTasks() {
  return onboardingTasks().filter((task) => task.state === "completed");
}

function typeChip(task) {
  const meta = executionMeta[task.executionType] || executionMeta.collaborative;
  return `<span class="type-chip">${meta.label}</span>`;
}

function taskCard(task) {
  const meta = executionMeta[task.executionType] || executionMeta.collaborative;
  return `
    <article class="task-card is-human" data-task-id="${task.id}" data-execution="${task.executionType}">
      <div class="task-icon" aria-hidden="true">${meta.icon}</div>
      <div class="task-copy">
        <div class="task-title-row"><h3>${task.title}</h3>${typeChip(task)}<span class="state-chip">Needs you</span></div>
        <p>${task.description}</p>
        <div class="task-meta"><span>${task.agent} prepared</span><span>•</span><span>${task.evidence}</span><span>•</span><span>+${task.xp} XP</span></div>
      </div>
      <button class="task-action" data-complete-task="${task.id}">${task.actionLabel || "Complete"}</button>
    </article>`;
}

function renderHumanTasks() {
  const host = document.querySelector("#humanTaskList");
  const tasks = humanTasks();
  host.innerHTML = tasks.length ? tasks.map(taskCard).join("") : `<div class="empty-state">Nothing needs you right now. Your AI team can keep moving the work.</div>`;
  document.querySelector("#needsYouCount").textContent = String(tasks.length);
}

function renderAiTasks() {
  const host = document.querySelector("#aiTaskList");
  const tasks = aiTasks();
  document.querySelector("#aiActiveCount").textContent = String(state.agents.filter((agent) => agent.state === "working").length);
  host.innerHTML = tasks.length ? tasks.map((task) => `
    <div class="activity-item">
      <span class="agent-mini">${initials(task.agent)}</span>
      <div class="activity-copy"><strong>${task.agent}</strong><span>${task.title}</span></div>
      <span class="activity-state">Working</span>
    </div>`).join("") : `<div class="empty-state">No AI-only work is active.</div>`;
}

function renderEmployee() {
  const employee = state.employee;
  const percent = Math.max(0, Math.min(100, (employee.xp / employee.nextLevelXp) * 100));
  document.querySelector("#greeting").textContent = `${greetingForNow()}, ${employee.name}.`;
  document.querySelector("#employeeLevel").textContent = `Level ${employee.level}`;
  document.querySelector("#xpValue").textContent = `${employee.xp} XP`;
  document.querySelector("#xpProgress").style.width = `${percent}%`;
  document.querySelector("#xpRemaining").textContent = `${Math.max(0, employee.nextLevelXp - employee.xp)} XP to Level ${employee.level + 1}`;
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function renderCampaign() {
  const tasks = onboardingTasks();
  const done = completedOnboardingTasks();
  const percent = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
  document.querySelector("#onboardingPercent").textContent = `${percent}%`;
  document.querySelector("#onboardingRing").style.setProperty("--p", `${percent}%`);
  document.querySelector("#onboardingSummary").textContent = `${done.length} of ${tasks.length} missions`;
  document.querySelector("#missionPreview").innerHTML = tasks.slice(0, 4).map((task) => `
    <div class="mission-line ${task.state === "completed" ? "is-complete" : ""}">
      <span>${task.state === "completed" ? "✓" : "○"} ${task.title}</span>
      <span>${task.state === "completed" ? "Done" : `+${task.xp} XP`}</span>
    </div>`).join("");

  const independent = state.milestones.find((item) => item.id === "independent");
  if (independent) independent.earned = tasks.length > 0 && done.length === tasks.length;
}

function renderAgents() {
  document.querySelector("#agentGrid").innerHTML = state.agents.map((agent) => `
    <article class="agent-card">
      <div class="agent-card-top">
        <span class="agent-avatar">${initials(agent.name)}</span>
        <span class="agent-state"><span class="status-dot ${agent.state === "working" ? "working" : "ready"}"></span>${agent.state === "working" ? "Working" : "Ready"}</span>
      </div>
      <h3>${agent.name}</h3>
      <span class="agent-specialty">${agent.specialty}</span>
      <p class="agent-assignment">${agent.assignment}</p>
    </article>`).join("");
}

function renderMilestones() {
  document.querySelector("#milestoneGrid").innerHTML = state.milestones.map((milestone) => `
    <article class="milestone-card ${milestone.earned ? "is-earned" : ""}">
      <span class="milestone-icon" aria-hidden="true">${milestone.earned ? "★" : "◇"}</span>
      <span class="milestone-status">${milestone.earned ? "Earned" : "Locked"}</span>
      <h3>${milestone.title}</h3>
      <p>${milestone.description}</p>
    </article>`).join("");
}

function completeTask(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || task.state === "completed") return;
  task.state = "completed";
  state.employee.xp += task.xp;

  if (task.id === "campaign-review") {
    const firstReview = state.tasks.find((item) => item.id === "first-ai-review");
    if (firstReview && firstReview.state === "queued") {
      firstReview.state = "ready_for_human";
      firstReview.actionLabel = "Complete review";
      firstReview.evidence = "First review unlocked";
    }
    const collaborator = state.milestones.find((item) => item.id === "ai-collab");
    if (collaborator) collaborator.earned = true;
  }

  while (state.employee.xp >= state.employee.nextLevelXp) {
    state.employee.level += 1;
    state.employee.nextLevelXp += 500;
  }

  saveState();
  render();
  showToast(`Mission complete · +${task.xp} XP`);
}

function renderSecondaryView(view) {
  const host = document.querySelector("#secondaryView");
  const mainSections = document.querySelectorAll(".hero-grid, #needs-you-section, .two-column-grid, .workforce-main > .section-block:not(#secondaryView)");

  if (view === "home") {
    host.hidden = true;
    mainSections.forEach((section) => { section.hidden = false; });
    return;
  }

  mainSections.forEach((section) => { section.hidden = true; });
  host.hidden = false;

  const titles = {
    missions: ["Missions", "Campaigns turn onboarding and role development into meaningful, verifiable progress."],
    tasks: ["Tasks", "The full objective queue, with AI work and human-required work clearly separated."],
    team: ["AI Team", "The MSH specialists supporting this employee workstream and what they are handling."],
    progress: ["Progress", "Competency, contribution, milestones, and role growth without activity surveillance."],
    knowledge: ["Knowledge", "The approved guides and operating context humans and AI should share."]
  };
  const [title, description] = titles[view] || titles.tasks;
  let content = "";

  if (view === "missions") {
    content = onboardingTasks().map((task) => `<div class="knowledge-card"><h3>${task.state === "completed" ? "✓" : "○"} ${task.title}</h3><p>${task.description} · ${executionMeta[task.executionType].label} · ${task.xp} XP</p></div>`).join("");
  } else if (view === "tasks") {
    content = state.tasks.map((task) => `<div class="knowledge-card"><h3>${task.title}</h3><p>${executionMeta[task.executionType].label} · ${task.state.replaceAll("_", " ")} · ${task.agent} · ${task.campaign}</p></div>`).join("");
  } else if (view === "team") {
    content = state.agents.map((agent) => `<div class="knowledge-card"><h3>${agent.name} · ${agent.specialty}</h3><p>${agent.state}: ${agent.assignment}</p></div>`).join("");
  } else if (view === "progress") {
    content = `<div class="knowledge-card"><h3>Level ${state.employee.level} · ${state.employee.xp} XP</h3><p>${state.employee.streakLabel}. Progress represents verified contribution and competency, never hours online.</p></div>` + state.milestones.map((item) => `<div class="knowledge-card"><h3>${item.earned ? "★" : "◇"} ${item.title}</h3><p>${item.description} · ${item.earned ? "Earned" : "Not yet earned"}</p></div>`).join("");
  } else {
    content = `
      <div class="knowledge-card"><h3>How MSH work is classified</h3><p>AI · Review · Collaborative · Human action · Approval. Every task declares who should actually perform the work.</p></div>
      <div class="knowledge-card"><h3>Human-in-the-loop standard</h3><p>AI performs automatable work. Employees are pulled in for judgment, accountability, creativity, relationships, approval, and truly human-only actions.</p></div>
      <div class="knowledge-card"><h3>Source of truth</h3><p>Approved Workforce procedures should eventually resolve to durable MSH knowledge rather than isolated SaaS documentation.</p></div>`;
  }

  host.innerHTML = `<div class="view-header"><p class="eyebrow">MSH Workforce</p><h2>${title}</h2><p>${description}</p></div><div class="view-grid">${content}</div>`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function selectView(view) {
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
  renderSecondaryView(view);
}

let toastTimer;
function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function render() {
  renderEmployee();
  renderHumanTasks();
  renderAiTasks();
  renderCampaign();
  renderAgents();
  renderMilestones();
}

document.addEventListener("click", (event) => {
  const completeButton = event.target.closest("[data-complete-task]");
  if (completeButton) {
    completeTask(completeButton.dataset.completeTask);
    return;
  }

  const navButton = event.target.closest("[data-view]");
  if (navButton) {
    selectView(navButton.dataset.view);
    return;
  }

  const jumpButton = event.target.closest("[data-jump]");
  if (jumpButton) {
    selectView(jumpButton.dataset.jump);
    return;
  }

  const filterButton = event.target.closest("[data-filter='needs-you']");
  if (filterButton) document.querySelector("#needs-you-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelector("#resetDemo")?.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  state = clone(initialState);
  saveState();
  selectView("home");
  render();
  showToast("Workforce demo reset");
});

render();
