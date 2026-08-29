/* My Simple Health — returning-user My Health entry */
(function () {
  'use strict';

  const route = (key, parameters) => window.MSHRoutes ? MSHRoutes.href(key, parameters) : ({
    health:'my-health.html', landscape:'health-landscape.html', horizon:'my-vision.html',
    path:'my-project.html', practice:'my-practice.html', discovery:'my-learning.html',
    journey:'my-progress.html', calendar:'calendar.html'
  })[key];

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
      const isLandscape = !isCalendar && (latest.progressType === 'landscape_mapped' || latest.sourceType === 'health_landscape');
      return {
        kicker:'Latest activity',
        title:textOf(latest, 'Recent activity'),
        meta:displayDate(latest),
        description:latest.notes || latest.description || (isCalendar ? 'This is part of your health in time.' : isLandscape ? 'Your current Health Landscape is available to revisit or explore.' : 'A recent part of your health journey.'),
        signals:movementSignals(latest),
        href:isCalendar ? route('calendar') : isLandscape ? route('landscape',{from:'my-health'}) : route('journey'),
        action:isCalendar ? 'View in Calendar' : isLandscape ? 'Open Landscape' : 'Open Journey'
      };
    }

    const practice = window.MSHStorage.getActivePractice(state);
    if (practice) return { kicker:'Continue', title:practice.title, meta:'Your current Practice', description:practice.description || 'Pick up what you are currently trying.', signals:[], href:route('practice'), action:'Continue Practice' };
    const project = window.MSHStorage.getActiveProject(state);
    if (project) return { kicker:'Current path', title:project.title, meta:'What matters now', description:project.description || 'Return to what you chose to work on.', signals:[], href:route('path'), action:'Open Path' };
    const landscape = window.MSHStorage.getCurrentLandscape(state);
    if (landscape || state.wellnessWheel && state.wellnessWheel.current) return { kicker:'Your landscape', title:'Your current picture', meta:'Health as a whole', description:'Return to the context you have already chosen to save.', signals:[], href:route('landscape',{from:'my-health'}), action:'Open Landscape' };
    return { kicker:'My Health', title:'Your health, in view.', meta:'Start anywhere', description:'Explore one part of your health when it becomes relevant. Nothing has to become a goal.', signals:[], href:route('landscape',{from:'my-health'}), action:'Explore my health' };
  }

  function continueDoor(state) {
    const practice = window.MSHStorage.getActivePractice(state);
    if (practice) return { href:route('practice'), preview:practice.title, action:'Continue Practice' };
    const project = window.MSHStorage.getActiveProject(state);
    if (project) return { href:route('path'), preview:project.title, action:'Continue Path' };
    const visionDraft = newest((state.visionEntries || []).filter(item => item.status === 'draft'));
    if (visionDraft) return { href:route('horizon'), preview:'Your direction is saved as a draft.', action:'Continue Horizon' };
    const landscapeDraft = newest((state.landscapes || []).filter(item => item.status === 'in_progress'));
    if (landscapeDraft) return { href:route('landscape',{from:'my-health'}), preview:'Your partial picture is waiting.', action:'Continue Landscape' };
    return { href:route('landscape',{from:'my-health'}), preview:'Explore whenever something feels relevant.', action:'Explore my health' };
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

  function storyCard(config, index) {
    return `<a class="msh-story-card" href="${esc(config.href)}" data-carousel-card role="listitem" aria-label="${esc(config.title)}: ${esc(config.action)}">
      <div class="msh-story-card__topline"><span class="msh-story-card__step">${String(index + 1).padStart(2, '0')}</span><span class="msh-story-card__icon" aria-hidden="true">${config.icon}</span></div>
      <div class="msh-story-card__body"><p class="msh-story-card__eyebrow">${esc(config.eyebrow)}</p><h3>${esc(config.title)}</h3><p>${esc(config.detail)}</p><p class="msh-story-card__preview">${esc(config.preview)}</p></div>
      <span class="msh-story-card__action">${esc(config.action)} <span aria-hidden="true">→</span></span>
    </a>`;
  }

  function initStoryCarousel(root) {
    const viewport = root.querySelector('[data-story-carousel]');
    if (!viewport) return;
    const cards = Array.from(viewport.querySelectorAll('[data-carousel-card]'));
    const prev = root.querySelector('[data-carousel-prev]');
    const next = root.querySelector('[data-carousel-next]');
    const status = root.querySelector('[data-carousel-status]');
    if (!cards.length) return;

    function activeIndex() {
      const left = viewport.scrollLeft;
      let winner = 0;
      let distance = Infinity;
      cards.forEach((card, index) => {
        const delta = Math.abs(card.offsetLeft - left);
        if (delta < distance) { distance = delta; winner = index; }
      });
      return winner;
    }

    function updateControls() {
      const index = activeIndex();
      cards.forEach((card, cardIndex) => card.classList.toggle('is-current', cardIndex === index));
      if (status) status.textContent = `${index + 1} / ${cards.length}`;
      if (prev) prev.disabled = index === 0;
      if (next) next.disabled = index === cards.length - 1;
    }

    function move(direction) {
      const index = Math.max(0, Math.min(cards.length - 1, activeIndex() + direction));
      cards[index].scrollIntoView({ behavior:'smooth', block:'nearest', inline:'start' });
    }

    if (prev) prev.addEventListener('click', () => move(-1));
    if (next) next.addEventListener('click', () => move(1));
    viewport.addEventListener('scroll', () => window.requestAnimationFrame(updateControls), { passive:true });
    viewport.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
    });
    updateControls();
  }

  function renderReturningEntry() {
    const root = document.querySelector('[data-msh-dashboard]');
    if (!root || !window.MSHStorage || !window.MSHFirstDoor) return;
    const params = new URLSearchParams(location.search);
    if (['tools','explore'].includes(params.get('view'))) return;
    const state = MSHStorage.getState();
    if (!MSHFirstDoor.hasMeaningfulContext(state) && params.get('view') !== 'workspace') return;

    const moment = window.MSHEnvironment ? MSHEnvironment.getCurrent() : { label:'My Health' };
    const feature = chooseFeature(state);
    const resume = continueDoor(state);
    const signals = feature.signals.map(signal => `<span class="msh-feature-board__signal">${esc(signal)}</span>`).join('');
    const story = [
      { icon:'◫', eyebrow:'Health in time', title:'Today', detail:'Start with what is happening now.', preview:todayDoor(state), href:'calendar.html', action:'Open Calendar' },
      { icon:'△', eyebrow:'See the whole', title:'Landscape', detail:'Your health makes more sense in context.', preview:state.wellnessWheel && state.wellnessWheel.current ? 'Your current picture is ready to revisit.' : 'Notice where things stand without turning your life into a score.', href:'my-landscape.html', action:'See your Landscape' },
      { icon:'○', eyebrow:'Choose direction', title:'Horizon', detail:'Name what better could look like for you.', preview:'Direction can exist without becoming pressure.', href:'my-vision.html', action:'Open Horizon' },
      { icon:'↗', eyebrow:'Make it workable', title:'Path', detail:'Turn what matters into something you can move toward.', preview:resume.href === 'my-project.html' ? resume.preview : 'A path connects where you are with where you want to go.', href:'my-project.html', action:'Open Path' },
      { icon:'◇', eyebrow:'Live it', title:'Practice', detail:'Try something in real life and see how it fits.', preview:resume.href === 'my-practice.html' ? resume.preview : 'Small experiments can become useful personal knowledge.', href:'my-practice.html', action:'Open Practice' },
      { icon:'✦', eyebrow:'Learn from experience', title:'Discovery', detail:'Notice patterns without forcing conclusions.', preview:discoveryDoor(state), href:'my-learning.html', action:'Open Discovery' },
      { icon:'⌁', eyebrow:'See change', title:'Journey', detail:'Look back at what has shifted over time.', preview:'Your history can show movement without reducing progress to a streak.', href:'my-progress.html', action:'Open Journey' }
    ];

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

      <section class="msh-story-carousel" aria-labelledby="my-health-story-title">
        <div class="msh-story-carousel__header">
          <div><p class="msh-story-carousel__eyebrow">Your health, connected</p><h2 id="my-health-story-title">Move through what matters.</h2></div>
          <div class="msh-story-carousel__controls" aria-label="Carousel controls"><button type="button" data-carousel-prev aria-label="Previous">←</button><span data-carousel-status aria-live="polite">1 / ${story.length}</span><button type="button" data-carousel-next aria-label="Next">→</button></div>
        </div>
        <div class="msh-story-carousel__viewport" data-story-carousel role="list" tabindex="0" aria-label="My Health journey">
          ${story.map(storyCard).join('')}
        </div>
      </section>

      <p class="msh-my-health-dashboard__quiet"><span aria-hidden="true">⌁</span>Understand patterns. Explore what matters. Make choices that fit your life.</p>
    </section>`;

    const world = root.querySelector('.msh-home-world');
    const worldContent = world && world.querySelector('.msh-home-world-content');
    if (world && worldContent) {
      world.classList.remove('is-first-door', 'msh-glass-world');
      world.classList.add('msh-returning-dashboard-world');
      worldContent.innerHTML = dashboardMarkup;
      initStoryCarousel(worldContent);
    } else {
      root.innerHTML = dashboardMarkup;
      initStoryCarousel(root);
    }
  }

  document.addEventListener('DOMContentLoaded', renderReturningEntry);
})();
