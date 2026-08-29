/* My Simple Health — returning-user My Health entry */
(function () {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function dateValue(item) {
    return new Date(item && (item.occurredAt || item.startAt || item.date || item.createdAt || item.updatedAt) || 0).getTime() || 0;
  }

  function newest(items) {
    return (Array.isArray(items) ? items : []).filter(Boolean).slice().sort((a, b) => dateValue(b) - dateValue(a))[0] || null;
  }

  function hasOccurred(item) {
    const value = dateValue(item);
    return value > 0 && value <= Date.now();
  }

  function displayDate(item) {
    const value = item && (item.occurredAt || item.startAt || item.date || item.createdAt || item.updatedAt);
    if (!value) return 'Recent';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recent';
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return `Today · ${date.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })}`;
    return date.toLocaleDateString([], { month:'short', day:'numeric' });
  }

  function textOf(item, fallback) {
    return item && (item.title || item.statement || item.label || item.name) || fallback;
  }

  function movementSignals(item) {
    const movement = item && (item.movement || item.experience || item.details) || {};
    const signals = [];
    const rpe = movement.rpe != null ? movement.rpe : item && item.rpe;
    const energy = movement.energy || movement.experience && movement.experience.energy || item && item.energy;
    const duration = movement.durationMinutes || item && item.durationMinutes;
    if (duration) signals.push(`${duration} min`);
    if (rpe != null) signals.push(`Effort ${rpe}/10`);
    if (energy) signals.push(`Energy ${String(energy).replace(/-/g, ' ')}`);
    return signals.slice(0, 3);
  }

  function chooseFeature(state) {
    const calendarEvents = state.calendar && Array.isArray(state.calendar.events) ? state.calendar.events : [];
    const progressEvents = Array.isArray(state.progressEvents) ? state.progressEvents : [];
    const latestCalendar = newest(calendarEvents.filter(hasOccurred));
    const latestProgress = newest(progressEvents);
    const latest = [latestCalendar, latestProgress].filter(Boolean).sort((a,b) => dateValue(b) - dateValue(a))[0];

    if (latest) {
      const isCalendar = calendarEvents.includes(latest);
      return {
        kicker:'Latest activity',
        title:textOf(latest, 'Recent activity'),
        meta:displayDate(latest),
        description:latest.notes || latest.description || (isCalendar ? 'This is part of your health in time.' : 'A recent part of your health journey.'),
        signals:movementSignals(latest),
        href:isCalendar ? 'calendar.html' : 'my-progress.html',
        action:isCalendar ? 'View in Calendar' : 'Open Journey'
      };
    }

    const practice = window.MSHStorage.getActivePractice(state);
    if (practice) return { kicker:'Continue', title:practice.title, meta:'Your current Practice', description:practice.description || 'Pick up what you are currently trying.', signals:[], href:'my-practice.html', action:'Continue Practice' };
    const project = window.MSHStorage.getActiveProject(state);
    if (project) return { kicker:'Current path', title:project.title, meta:'What matters now', description:project.description || 'Return to what you chose to work on.', signals:[], href:'my-project.html', action:'Open Path' };
    const landscape = window.MSHStorage.getCurrentLandscape(state);
    if (landscape || state.wellnessWheel && state.wellnessWheel.current) return { kicker:'Your landscape', title:'Your current picture', meta:'Health as a whole', description:'Return to the context you have already chosen to save.', signals:[], href:'my-landscape.html', action:'Open Landscape' };
    return { kicker:'My Health', title:'Your health, in view.', meta:'Start anywhere', description:'Explore one part of your health when it becomes relevant. Nothing has to become a goal.', signals:[], href:'my-landscape.html', action:'Explore my health' };
  }

  function continueDoor(state) {
    const practice = window.MSHStorage.getActivePractice(state);
    if (practice) return { href:'my-practice.html', preview:practice.title, action:'Continue Practice' };
    const project = window.MSHStorage.getActiveProject(state);
    if (project) return { href:'my-project.html', preview:project.title, action:'Continue Path' };
    const visionDraft = newest((state.visionEntries || []).filter(item => item.status === 'draft'));
    if (visionDraft) return { href:'my-vision.html', preview:'Your direction is saved as a draft.', action:'Continue Horizon' };
    const landscapeDraft = newest((state.landscapes || []).filter(item => item.status === 'in_progress'));
    if (landscapeDraft) return { href:'my-landscape.html', preview:'Your partial picture is waiting.', action:'Continue Landscape' };
    return { href:'my-landscape.html', preview:'Explore whenever something feels relevant.', action:'Explore my health' };
  }

  function todayDoor(state) {
    const events = state.calendar && Array.isArray(state.calendar.events) ? state.calendar.events : [];
    const today = new Date().toDateString();
    const item = events.filter(event => {
      const raw = event.startAt || event.date || event.occurredAt;
      return raw && new Date(raw).toDateString() === today;
    }).sort((a,b) => dateValue(a) - dateValue(b))[0];
    return item ? textOf(item, 'Something is on your Calendar today.') : 'See what is happening in your health today.';
  }

  function discoveryDoor(state) {
    const learning = window.MSHStorage.getCurrentLearning(state);
    const item = learning && learning[0];
    return item ? textOf(item, 'A recent observation is available.') : 'A place for what becomes worth noticing.';
  }

  function door(config) {
    return `<a class="msh-dashboard-door" href="${esc(config.href)}"><div><span class="msh-dashboard-door__icon" aria-hidden="true">${config.icon}</span><h3>${esc(config.title)}</h3><p>${esc(config.detail)}</p><p class="msh-dashboard-door__preview">${esc(config.preview)}</p></div><span class="msh-dashboard-door__action">${esc(config.action)} <span aria-hidden="true">→</span></span></a>`;
  }

  function renderReturningEntry() {
    const root = document.querySelector('[data-msh-dashboard]');
    if (!root || !window.MSHStorage || !window.MSHFirstDoor) return;
    const params = new URLSearchParams(location.search);
    if (params.get('view') === 'tools') return;
    const state = MSHStorage.getState();
    if (!MSHFirstDoor.hasMeaningfulContext(state) && params.get('view') !== 'workspace') return;

    const moment = window.MSHEnvironment ? MSHEnvironment.getCurrent() : { label:'My Health' };
    const feature = chooseFeature(state);
    const resume = continueDoor(state);
    const signals = feature.signals.map(signal => `<span class="msh-feature-board__signal">${esc(signal)}</span>`).join('');

    const dashboardMarkup = `<section class="msh-my-health-dashboard" aria-labelledby="my-health-title">
      <header class="msh-my-health-dashboard__intro">
        <p class="msh-my-health-dashboard__eyebrow">${esc(moment.label)} / My Health</p>
        <h1 id="my-health-title">My Health</h1>
        <p>Understand your health. Live your life.</p>
      </header>

      <a class="msh-feature-board" href="${esc(feature.href)}" aria-label="${esc(feature.action)}: ${esc(feature.title)}">
        <div class="msh-feature-board__content">
          <div>
            <span class="msh-feature-board__kicker">${esc(feature.kicker)}</span>
            <h2>${esc(feature.title)}</h2>
            <p class="msh-feature-board__meta">${esc(feature.meta)}</p>
            <p class="msh-feature-board__description">${esc(feature.description)}</p>
            ${signals ? `<div class="msh-feature-board__signals">${signals}</div>` : ''}
          </div>
          <span class="msh-feature-board__action">${esc(feature.action)} <span aria-hidden="true">→</span></span>
        </div>
        <div class="msh-feature-board__visual" aria-hidden="true"><span class="msh-feature-board__orb"></span></div>
      </a>

      <nav class="msh-dashboard-doors" aria-label="My Health open doors">
        ${door({ icon:'◫', title:'Today', detail:'Your day at a glance', preview:todayDoor(state), href:'calendar.html', action:'Open Calendar' })}
        ${door({ icon:'△', title:'Your Landscape', detail:'See your health as a whole', preview:state.wellnessWheel && state.wellnessWheel.current ? 'Your Wellness Wheel is in view.' : 'See where things stand without needing to score your health.', href:'my-landscape.html', action:'Open Landscape' })}
        ${door({ icon:'◷', title:'Continue', detail:'Pick up where you left off', preview:resume.preview, href:resume.href, action:resume.action })}
        ${door({ icon:'◇', title:'Discover', detail:'Recent observations and learning', preview:discoveryDoor(state), href:'my-learning.html', action:'Open Discovery' })}
      </nav>

      <p class="msh-my-health-dashboard__quiet"><span aria-hidden="true">⌁</span>Understand patterns. Explore what matters. Make choices that fit your life.</p>
    </section>`;

    const world = root.querySelector('.msh-home-world');
    const worldContent = world && world.querySelector('.msh-home-world-content');
    if (world && worldContent) {
      world.classList.remove('is-first-door', 'msh-glass-world');
      world.classList.add('msh-returning-dashboard-world');
      worldContent.innerHTML = dashboardMarkup;
    } else {
      root.innerHTML = dashboardMarkup;
    }
  }

  document.addEventListener('DOMContentLoaded', renderReturningEntry);
})();
