/* My Simple Health — calm personal workspace home */
(function () {
  'use strict';
  const root = document.querySelector('[data-msh-dashboard]');
  if (!root || !window.MSHStorage || !window.MSHFirstDoor) return;
  let showWorkspace = new URLSearchParams(location.search).get('view') === 'workspace';
  let selectedIntent = null;
  let firstDoorStep = 'intent';
  let firstDoorInitialized = false;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function newest(items) {
    return [...items].sort((a, b) =>
      new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0)
    )[0] || null;
  }

  function environmentMarkup() {
    return `<div class="msh-home-environment" aria-hidden="true"><span class="msh-home-cinematic"></span><span class="msh-home-atmosphere"></span></div>`;
  }

  function worldMarkup(content, firstDoor) {
    return `<section class="msh-home-world${firstDoor ? ' is-first-door msh-glass-world' : ''}">${environmentMarkup()}<div class="msh-home-world-content">${content}</div></section>`;
  }

  function daypart() {
    return window.MSHEnvironment ? MSHEnvironment.getCurrent() : { greeting:'Hello', label:'Today' };
  }

  function arrow() { return '<span class="msh-action-arrow" aria-hidden="true">→</span>'; }
  function daypartLine(moment) {
    if (moment.id === 'dawn' || moment.id === 'morning') return 'A clear place to notice what is emerging and choose what matters this morning.';
    if (moment.id === 'day') return 'A clear place to see what is happening and choose what matters today.';
    if (moment.id === 'golden' || moment.id === 'evening') return 'A quieter place to see what is happening and decide what matters this evening.';
    return 'A quiet place to see what is happening and decide what matters tonight.';
  }

  function wheelSvg(wheel) {
    if (!wheel || !wheel.scores) return '';
    const keys = ['physical','emotional','social','occupational','financial','environmental','intellectual','spiritual'];
    const points = keys.map((key, index) => {
      const angle = -Math.PI / 2 + index * Math.PI / 4;
      const radius = 15 + (Number(wheel.scores[key]) || 0) * 3.4;
      return `${55 + Math.cos(angle) * radius},${55 + Math.sin(angle) * radius}`;
    }).join(' ');
    return `<svg class="msh-dashboard-wheel" viewBox="0 0 110 110" role="img" aria-label="Your populated Wellness Wheel"><g><circle cx="55" cy="55" r="42"></circle><circle cx="55" cy="55" r="27"></circle><circle cx="55" cy="55" r="12"></circle></g><polygon points="${points}"></polygon></svg>`;
  }

  function sectionHeading(title, action, href) {
    return `<header class="msh-dashboard-section-heading"><h2>${esc(title)}</h2>${action && href ? `<a href="${href}">${esc(action)} <span aria-hidden="true">→</span></a>` : ''}</header>`;
  }

  function initializeFirstDoor(state) {
    const entry = MSHStorage.getFirstDoor(state);
    if (!entry || !MSHFirstDoor.getIntent(entry.intent)) return;
    selectedIntent = entry.intent;
    if (entry.intent === 'not_working') {
      if (/waking during the night/i.test(entry.context || '')) firstDoorStep = 'sleep-answer';
      else if (/^sleep/i.test(entry.context || '')) firstDoorStep = 'sleep';
      else firstDoorStep = 'not-working';
      return;
    }
    firstDoorStep = entry.context || !MSHFirstDoor.getIntent(entry.intent).prompt ? 'orientation' : 'context';
  }

  const firstDoorDetails = {
    health_question:'Get a clear explanation or ask what something means.',
    not_working:'Begin by understanding what feels difficult.',
    work_on_something:'Start with the change or direction that matters now.',
    care_support:'Think through care, professional support, or a future visit.',
    clearer_picture:'Explore one part of your health at a time.',
    exploring:'Look around without sharing personal information.'
  };

  function renderGlass(config) {
    const current = root.querySelector('[data-msh-glass]');
    if (current && window.MSHGlassWorkspace) {
      MSHGlassWorkspace.update(current, config);
      return;
    }
    root.innerHTML = worldMarkup(MSHGlassWorkspace.markup(config), true);
  }

  function backButton(step, label) {
    return `<button class="msh-glass-back" type="button" data-glass-back="${esc(step)}">← ${esc(label)}</button>`;
  }

  function renderFirstDoor(state) {
    if (!firstDoorInitialized) {
      initializeFirstDoor(state);
      firstDoorInitialized = true;
    }
    const intent = MSHFirstDoor.getIntent(selectedIntent);
    if (firstDoorStep === 'intent' && !intent) {
      renderGlass({
        state:'intent', eyebrow:'My Health / Start here', title:'What brings you here today?',
        intro:'Choose what feels closest. You can begin without completing an intake or understanding the My Simple Health framework.',
        choices:MSHFirstDoor.intents.map(item => ({ id:`intent:${item.id}`, label:item.label, detail:firstDoorDetails[item.id] })),
        footer:`<button class="msh-glass-back" type="button" data-first-door-workspace>Explore without choosing</button>`,
        status:'Choose one starting point'
      });
      return;
    }
    if (firstDoorStep === 'not-working' && intent) {
      renderGlass({
        state:'not-working', eyebrow:'My Health / What matters now', context:intent.label,
        title:'What feels hardest right now?', intro:'Choose the area that feels closest. This is a starting point, not a diagnosis or a decision that something must be fixed.',
        choices:[
          { id:'area:sleep', label:'Sleep', detail:'Falling asleep, staying asleep, timing, or rest.' },
          { id:'area:energy', label:'Energy', detail:'Changes in energy, stamina, or recovery.' },
          { id:'area:stress', label:'Stress', detail:'Pressure, overload, or difficulty settling.' },
          { id:'area:eating', label:'Eating', detail:'Patterns, appetite, access, or nourishment.' },
          { id:'area:movement', label:'Movement', detail:'Comfort, activity, strength, or consistency.' },
          { id:'area:other', label:'Pain or something else', detail:'Begin with what does not fit the other areas.' }
        ],
        footer:backButton('intent','Choose another reason'), status:'Step 2 of 4'
      });
      return;
    }
    if (firstDoorStep === 'sleep' && intent) {
      renderGlass({
        state:'sleep', eyebrow:'My Health / Sleep', context:intent.label,
        title:'What has your sleep been like?', intro:'Choose one experience to bring into focus. You can keep this general and decide later whether you want to track or act on it.',
        choices:[
          { id:'sleep:waking', label:'I keep waking during the night', detail:'Sleep starts, but is interrupted.' },
          { id:'sleep:falling', label:'It is hard to fall asleep', detail:'Getting to sleep takes longer than you want.' },
          { id:'sleep:early', label:'I wake earlier than I intend', detail:'Sleep ends before you feel ready.' },
          { id:'sleep:rest', label:'I sleep, but do not feel rested', detail:'Time asleep does not feel restorative.' },
          { id:'sleep:timing', label:'My sleep timing keeps changing', detail:'Your schedule or rhythm feels difficult to protect.' },
          { id:'sleep:other', label:'Something else', detail:'Describe it in your own way with Hello.' }
        ],
        footer:backButton('not-working','Back to areas'), status:'Step 3 of 4'
      });
      return;
    }
    if (firstDoorStep === 'sleep-answer' && intent) {
      renderGlass({
        state:'answer', eyebrow:'My Health / Understanding', context:'Sleep · Waking during the night', title:'Waking during the night',
        intro:'A first explanation, with more depth only when you want it.',
        body:`<div class="msh-glass-answer"><p class="msh-glass-answer-lead">Sleep naturally becomes lighter several times overnight. Waking at a similar time can happen when that lighter sleep meets something else—such as stress, temperature, noise, alcohol, medication timing, pain, breathing symptoms, or the need to use the bathroom.</p><p>A repeated 3 AM wake-up does not point to one cause by itself. The useful next step is noticing what surrounds it and whether it is occasional, persistent, or affecting how you function during the day.</p><div class="msh-glass-answer-tools" aria-label="Answer comprehension"><span aria-current="true">Read</span><details><summary>Sources</summary><p>General orientation draws on established sleep physiology and common contributors to sleep-maintenance difficulty. It is education, not a conclusion about your body. Persistent sleep disruption, breathing concerns, severe symptoms, or safety concerns deserve discussion with a qualified clinician.</p></details></div></div>`,
        footer:`<div class="msh-glass-next" aria-label="Optional next directions"><button type="button" data-msh-hello-open>What can I try? <span aria-hidden="true">→</span></button><button type="button" data-msh-hello-open>Could something medical cause this? <span aria-hidden="true">→</span></button><a href="calendar.html">Help me track it <span aria-hidden="true">→</span></a><details><summary>Go deeper <span aria-hidden="true">＋</span></summary><p>Useful details can include when the waking began, how often it happens, how long you stay awake, what changed around the same time, and whether you notice snoring, breathing pauses, pain, hot flashes, mood changes, or medication effects.</p></details></div>${backButton('sleep','Back to sleep experiences')}`,
        status:'Answer / Depth on demand'
      });
      return;
    }
    if (firstDoorStep === 'context' && intent) {
      root.innerHTML = worldMarkup(`<section class="msh-first-door" data-first-door>
        <div class="msh-first-door-progress" aria-label="First-use progress"><span>Welcome</span><span class="is-current">A little context</span><span>Your starting point</span></div>
        <header><p class="msh-stage-name">First use · What matters now</p><h1>${esc(intent.prompt)}</h1><p>Share only what helps with this starting point. You can leave this open or choose another direction.</p></header>
        <form class="msh-first-door-context" data-first-door-context>
          <label for="first-door-context"><span>${esc(intent.label)}</span><textarea id="first-door-context" name="context" rows="5" placeholder="${esc(intent.placeholder)}">${esc(MSHStorage.getFirstDoor(state)?.context || '')}</textarea></label>
          <details><summary>Why we’re asking</summary><p>This helps My Simple Health open the most relevant existing tool and carry your starting point with you. It does not create a diagnosis, profile, or goal.</p></details>
          <div class="msh-card-actions"><button class="msh-button" type="submit">Continue →</button><button class="msh-button-secondary" type="button" data-first-door-skip>Skip for now</button><button class="msh-text-button" type="button" data-first-door-back>Choose another reason</button></div>
        </form>
      </section>`, true);
      return;
    }
    if (firstDoorStep === 'orientation' && intent) {
      const entry = MSHStorage.getFirstDoor(state);
      root.innerHTML = worldMarkup(`<section class="msh-first-door" data-first-door>
        <div class="msh-first-door-progress" aria-label="First-use progress"><span>Welcome</span><span>A little context</span><span class="is-current">Your starting point</span></div>
        <header><p class="msh-stage-name">First use · Your next useful step</p><h1>Here’s a useful way to begin.</h1><p>You can take this next step, choose another direction, or stop here. Nothing has been turned into a goal.</p></header>
        <article class="msh-first-door-orientation"><p class="msh-card-kicker">${esc(intent.label)}</p>${entry && entry.context ? `<blockquote>${esc(entry.context)}</blockquote>` : ''}<p>${esc(intent.orientation)}</p></article>
        <div class="msh-first-door-routes"><a class="msh-button" data-first-door-route href="${esc(intent.primary.href)}">${esc(intent.primary.label)} →</a>${intent.secondary ? `<a class="msh-button-secondary" data-first-door-route href="${esc(intent.secondary.href)}">${esc(intent.secondary.label)}</a>` : ''}<button class="msh-text-button" type="button" data-first-door-back>Choose another direction</button></div>
      </section>`, true);
      return;
    }
    root.innerHTML = worldMarkup(`<section class="msh-first-door" data-first-door>
      <div class="msh-first-door-progress" aria-label="First-use progress"><span class="is-current">Welcome</span><span>A little context</span><span>Your starting point</span></div>
      <header><p class="msh-stage-name">Welcome to My Simple Health</p><h1>What brings you here today?</h1><p>Choose what feels closest. You do not need to understand the My Simple Health framework or complete a health intake to begin.</p></header>
      <div class="msh-first-door-choices" role="list">${MSHFirstDoor.intents.map(item => `<button type="button" role="listitem" data-first-door-intent="${item.id}"><strong>${esc(item.label)}</strong><span>${esc(firstDoorDetails[item.id])}</span></button>`).join('')}</div>
      <div class="msh-first-door-secondary"><button class="msh-text-button" type="button" data-first-door-workspace>I already know where I want to go</button><p>Your information stays in this browser on this device during the prototype.</p></div>
    </section>`, true);
  }

  function saveEntry(intent, context, status, route) {
    const previous = MSHStorage.getFirstDoor();
    return MSHStorage.saveFirstDoor({
      id: previous && previous.intent === intent ? previous.id : MSHStorage.uid('entry'),
      intent,
      context: context == null ? previous && previous.intent === intent ? previous.context : '' : context,
      status,
      route: route || '',
      createdAt: previous && previous.intent === intent ? previous.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      provenance: MSHStorage.createProvenance(MSHStorage.PROVENANCE.USER_STATED, { sourceId:'first-door' })
    });
  }

  function prepareProjectFocus(entry) {
    if (!entry || entry.intent !== 'work_on_something' || !entry.context) return;
    MSHStorage.updateState(state => {
      const existing = state.focuses.find(item => item.sourceType === 'first_door' && item.sourceId === entry.id);
      state.focuses.forEach(item => { if (item.status === 'active' && item !== existing) item.status = 'historical'; });
      if (existing) {
        existing.label = entry.context;
        existing.status = 'active';
        existing.updatedAt = new Date().toISOString();
      } else {
        state.focuses.push({ id:MSHStorage.uid('focus'), label:entry.context, status:'active', sourceType:'first_door', sourceId:entry.id, provenance:entry.provenance, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
      }
      return state;
    });
  }

  function render() {
    const state = MSHStorage.getState();
    const landscape = MSHStorage.getCurrentLandscape(state);
    const wheel = state.wellnessWheel.current;
    const vision = MSHStorage.getCurrentVision(state);
    const project = MSHStorage.getActiveProject(state);
    const practice = MSHStorage.getActivePractice(state);
    const learning = MSHStorage.getCurrentLearning(state);
    const latestLearning = learning[0];
    const latestReflection = newest(state.reflections);
    const events = [...state.progressEvents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const latestEvent = events[0];
    const focus = state.focuses.find(item => item.status === 'active') || null;
    const cycleStatus = window.MSHCycle && state.calendar.privacy.workspace
      ? MSHCycle.estimatedStatus(state, MSHCycle.toDateKey(new Date())) : null;
    const projectHistory = state.projects.filter(item => item.status !== 'active');
    const started = MSHFirstDoor.hasMeaningfulContext(state);
    if (!MSHFirstDoor.hasMeaningfulContext(state) && !showWorkspace) {
      renderFirstDoor(state);
      return;
    }

    const landscapeDraft = [...state.landscapes].filter(item => item.status === 'in_progress').sort((a,b) => new Date(b.updatedAt||0)-new Date(a.updatedAt||0))[0] || null;
    const visionDraft = [...state.visionEntries].filter(item => item.status === 'draft').sort((a,b) => new Date(b.updatedAt||0)-new Date(a.updatedAt||0))[0] || null;
    const entry = MSHStorage.getFirstDoor(state);
    const primary = practice
      ? { label:'Continue my Practice', href:'my-practice.html', context:practice.title }
      : project
        ? { label:'Continue my Path', href:'my-project.html', context:project.title }
        : visionDraft
          ? { label:'Continue shaping my direction', href:'my-vision.html', context:'Your Horizon is saved as a draft.' }
          : landscapeDraft
            ? { label:'Continue exploring my Landscape', href:'my-landscape.html', context:'Your partial picture is waiting.' }
            : entry && entry.route
              ? { label:'Continue where I left off', href:entry.route, context:entry.context || 'Return to your last chosen starting point.' }
              : { label:'Explore my health', href:'my-landscape.html', context:'Begin with one area that feels relevant now.' };
    const moments = [];
    if (practice) moments.push({ label:'What I’m trying', title:practice.title, text:practice.description || 'Your active Practice is ready when it fits.', href:'my-practice.html', action:'Open Practice' });
    if (cycleStatus && cycleStatus.cycleDay) moments.push({ label:'Today', title:`Cycle day ${cycleStatus.cycleDay}`, text:cycleStatus.phase ? `Estimated ${cycleStatus.phase} phase, based on recorded dates.` : 'Cycle context is available in Calendar.', href:'calendar.html', action:'Open Calendar' });
    if (!moments.length && latestEvent) moments.push({ label:'Recent movement', title:latestEvent.statement, text:new Date(latestEvent.createdAt).toLocaleDateString(undefined,{month:'long',day:'numeric'}), href:'my-progress.html', action:'See the Journey' });
    const momentMarkup = moments.slice(0,2).map(moment => `<article class="msh-home-moment msh-reveal"><span>${esc(moment.label)}</span><div><h3>${esc(moment.title)}</h3><p>${esc(moment.text)}</p></div><a class="msh-premium-action" href="${moment.href}">${esc(moment.action)} ${arrow()}</a></article>`).join('');
    const signals = [
      { label:'Landscape', present:Boolean(landscape || landscapeDraft) },
      { label:'Horizon', present:Boolean(vision || visionDraft) },
      { label:'Path', present:Boolean(project) },
      { label:'Practice', present:Boolean(practice) },
      { label:'Discovery', present:Boolean(latestLearning) }
    ];
    const signalCount = signals.filter(signal => signal.present).length;
    const dots = `<div class="msh-kinetic-dots" role="img" aria-label="${signalCount} of 5 current parts of your health picture have saved context">${signals.map(signal => `<i class="${signal.present ? 'is-resolved' : 'is-open'}" title="${signal.label}"></i>`).join('')}</div>`;
    const orbit = `<div class="msh-orbit" aria-hidden="true"><i></i><i></i><i></i><span></span></div>`;
    const moment = daypart();
    root.innerHTML = `${worldMarkup(`<div class="msh-home-orientation msh-reveal"><p class="msh-home-time">${esc(moment.label)} / My Health</p><h1>${esc(moment.greeting)}.</h1><p>${esc(primary.context)}</p><div class="msh-home-primary"><a class="msh-button msh-premium-action" href="${esc(primary.href)}">${esc(primary.label)} ${arrow()}</a><a class="msh-text-button" href="my-landscape.html">Explore my health</a></div><p class="msh-home-presence">Hello is nearby to help connect your health information and experience when you want it.</p></div><span class="msh-home-scroll-cue">A little context below</span>`, false)}
      <section class="msh-home-context"><div class="msh-home-context-inner">
        <header class="msh-reveal"><p class="msh-stage-name">What is in view</p><h2>${signalCount ? 'Your current picture is resolving.' : 'Your picture can stay open.'}</h2><p>${signalCount ? 'This shows where current information exists—not whether anything is good, complete, or successful.' : 'Nothing has to be filled in before My Simple Health can be useful.'}</p></header>
        <section class="msh-information-composition" aria-labelledby="msh-context-resolution"><div class="msh-constellation">${orbit}${dots}</div><div class="msh-editorial-metric"><strong>${signalCount}<span>/5</span></strong><p id="msh-context-resolution">current parts of your picture have saved context</p></div><p class="msh-information-note">Resolved points contain information you chose to save. Open points remain unknown—not negative.</p></section>
        <div class="msh-section-transition" aria-hidden="true"><span></span></div>
        <section class="msh-insight-statement"><p class="msh-stage-name">What may matter now</p><h2>${moments.length ? 'A small view of today.' : 'Nothing needs your attention here.'}</h2><p>${moments.length ? 'Only current, useful context is surfaced. Everything else stays available deeper in My Health.' : 'You can explore when something becomes relevant. The environment does not measure success or demand action.'}</p></section>
        ${momentMarkup}<div class="msh-home-quiet-end"><p>Your full Landscape, Horizon, Path, Practice, Discovery, Journey, and Calendar remain available through navigation.</p></div><p class="msh-local-note"><strong>Prototype privacy:</strong> My Health data is stored in this browser on this device. Clearing site data may remove it.</p>
      </div></section>`;
  }

  root.addEventListener('click', event => {
    const glassBack = event.target.closest('[data-glass-back]');
    if (glassBack) {
      firstDoorStep = glassBack.dataset.glassBack;
      if (firstDoorStep === 'intent') selectedIntent = null;
      render();
      return;
    }
    const glassChoice = event.target.closest('[data-glass-choice]');
    if (glassChoice) {
      const [kind, value] = glassChoice.dataset.glassChoice.split(':');
      if (kind === 'intent') {
        selectedIntent = value;
        const chosen = MSHFirstDoor.getIntent(value);
        saveEntry(value, '', 'intent_selected');
        firstDoorStep = value === 'not_working' ? 'not-working' : chosen && chosen.prompt ? 'context' : 'orientation';
      } else if (kind === 'area') {
        if (value === 'sleep') {
          saveEntry('not_working', 'Sleep', 'context_added');
          firstDoorStep = 'sleep';
        } else {
          saveEntry('not_working', value === 'other' ? 'Pain or something else' : value[0].toUpperCase() + value.slice(1), 'context_added');
          firstDoorStep = 'orientation';
        }
      } else if (kind === 'sleep') {
        if (value === 'waking') {
          saveEntry('not_working', 'Sleep — waking during the night', 'context_added');
          firstDoorStep = 'sleep-answer';
        } else if (value === 'other') {
          saveEntry('not_working', 'Sleep — something else', 'context_added');
          firstDoorStep = 'orientation';
        } else {
          saveEntry('not_working', `Sleep — ${value}`, 'context_added');
          firstDoorStep = 'orientation';
        }
      }
      render();
      return;
    }
    if (event.target.closest('[data-first-door-begin]')) {
      firstDoorStep = 'intent';
      render();
      return;
    }
    const choice = event.target.closest('[data-first-door-intent]');
    if (choice) {
      selectedIntent = choice.dataset.firstDoorIntent;
      const intent = MSHFirstDoor.getIntent(selectedIntent);
      saveEntry(selectedIntent, '', 'intent_selected');
      firstDoorStep = intent && intent.prompt ? 'context' : 'orientation';
      render();
      return;
    }
    if (event.target.closest('[data-first-door-back]')) {
      selectedIntent = null;
      firstDoorStep = 'intent';
      render();
      return;
    }
    if (event.target.closest('[data-first-door-skip]')) {
      saveEntry(selectedIntent, '', 'context_added');
      firstDoorStep = 'orientation';
      render();
      return;
    }
    if (event.target.closest('[data-first-door-workspace]')) {
      showWorkspace = true;
      render();
      return;
    }
    const route = event.target.closest('[data-first-door-route]');
    if (route) {
      const entry = saveEntry(selectedIntent, null, 'routed', route.getAttribute('href'));
      prepareProjectFocus(entry);
    }
  });

  root.addEventListener('submit', event => {
    if (!event.target.matches('[data-first-door-context]')) return;
    event.preventDefault();
    const context = new FormData(event.target).get('context').trim();
    saveEntry(selectedIntent, context, 'context_added');
    firstDoorStep = 'orientation';
    render();
  });

  document.addEventListener('DOMContentLoaded', () => {
    render();
    requestAnimationFrame(() => document.body.classList.add('msh-home-ready'));
  });
})();
