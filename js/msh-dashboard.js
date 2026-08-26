/* My Simple Health — calm personal workspace home */
(function () {
  'use strict';
  const root = document.querySelector('[data-msh-dashboard]');
  if (!root || !window.MSHStorage || !window.MSHFirstDoor) return;
  const requestedView = new URLSearchParams(location.search).get('view');
  let showWorkspace = requestedView === 'workspace';
  const showTools = requestedView === 'tools';
  let selectedIntent = null;
  let selectedHealthLayer = null;
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

  function renderTools() {
    renderGlass({
      state:'tools', manifestation:'workspace', eyebrow:'My Health / Tools',
      title:'Tools, when they are useful.',
      intro:'My Simple Health can support many kinds of health work. You choose what belongs in your experience; a capability does not become relevant merely because it exists.',
      body:`<div class="msh-tools-directory">
        <section aria-labelledby="womens-health-tools"><p class="msh-glass-category">Women’s Health</p><h2 id="womens-health-tools">Period Tracker</h2><p>Track your period, symptoms, and cycle patterns over time.</p><a href="calendar.html?from=tools">Open Period Tracker <span aria-hidden="true">→</span></a><small>This tool appears here for intentional exploration. My Simple Health does not assume it is relevant to you.</small></section>
        <section aria-labelledby="health-picture-tools"><p class="msh-glass-category">Health picture</p><h2 id="health-picture-tools">Assessments</h2><p>Explore a specific area or add measured context when it would help bring your Health Map into focus.</p><a href="assessments.html">Explore assessments <span aria-hidden="true">→</span></a></section>
      </div>`,
      footer:`<a class="msh-glass-back" href="my-health.html">← Back to My Health</a>`,
      status:'Broad platform / Personally relevant experience'
    });
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
        body:`<div class="msh-glass-answer"><p class="msh-glass-answer-lead">Sleep naturally becomes lighter several times overnight. Waking at a similar time can happen when that lighter sleep meets something else—such as stress, temperature, noise, alcohol, medication timing, pain, breathing symptoms, or the need to use the bathroom.</p><p>A repeated 3 AM wake-up does not point to one cause by itself. The useful next step is noticing what surrounds it and whether it is occasional, persistent, or affecting how you function during the day.</p><div class="msh-glass-answer-tools" aria-label="Answer comprehension"><span aria-current="true">Read</span><details class="msh-contextual-glass"><summary>Sources</summary><p>General orientation draws on established sleep physiology and common contributors to sleep-maintenance difficulty. It is education, not a conclusion about your body. Persistent sleep disruption, breathing concerns, severe symptoms, or safety concerns deserve discussion with a qualified clinician.</p></details></div></div>`,
        footer:`<div class="msh-glass-next" aria-label="Optional next directions"><button type="button" data-msh-hello-open>What can I try? <span aria-hidden="true">→</span></button><button type="button" data-msh-hello-open>Could something medical cause this? <span aria-hidden="true">→</span></button><a href="calendar.html">Help me track it <span aria-hidden="true">→</span></a><details class="msh-contextual-glass"><summary>Go deeper <span aria-hidden="true">＋</span></summary><p>Useful details can include when the waking began, how often it happens, how long you stay awake, what changed around the same time, and whether you notice snoring, breathing pauses, pain, hot flashes, mood changes, or medication effects.</p></details></div>${backButton('sleep','Back to sleep experiences')}`,
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

  function healthMapLayers(state) {
    const landscape = MSHStorage.getCurrentLandscape(state);
    const landscapeDraft = newest(state.landscapes.filter(item => item.status === 'in_progress'));
    const wheel = state.wellnessWheel.current;
    const vision = MSHStorage.getCurrentVision(state);
    const visionDraft = newest(state.visionEntries.filter(item => item.status === 'draft'));
    const project = MSHStorage.getActiveProject(state);
    const practice = MSHStorage.getActivePractice(state);
    const learning = MSHStorage.getCurrentLearning(state)[0] || null;
    return [
      {
        id:'landscape', label:'Landscape', meaning:'Where I am', href:'my-landscape.html', action:'Explore my Landscape',
        present:Boolean(landscape || landscapeDraft || wheel),
        preview:wheel ? 'Your Wellness Wheel is in view.' : landscape ? 'A saved view of where things stand.' : landscapeDraft ? 'An exploration is waiting for you.' : 'Open when you want to notice where things stand.',
        detail:wheel ? 'Your saved Wellness Wheel offers one view of where things stand across the areas you explored.' : landscape ? 'You have a saved Landscape to return to and revise when it is useful.' : landscapeDraft ? 'You began exploring your current Landscape. It is available whenever you want to continue.' : 'This space is available when you want a clearer view of where things stand. It does not need to be completed first.'
      },
      {
        id:'horizon', label:'Horizon', meaning:'Where I want to go', href:'my-vision.html', action:vision ? 'Open my Horizon' : 'Shape a direction',
        present:Boolean(vision || visionDraft),
        preview:vision ? vision.synthesis.statement : visionDraft ? 'A direction is beginning to take shape.' : 'Open when a direction feels useful.',
        detail:vision ? `You confirmed this direction: “${vision.synthesis.statement}”` : visionDraft ? 'You have words saved toward a direction, without needing to confirm them yet.' : 'This space is available when you want to name a direction. Not knowing yet is also a valid place to be.'
      },
      {
        id:'path', label:'Path', meaning:'What matters now / what I’ve chosen', href:'my-project.html', action:project ? 'Open my Path' : 'Consider what matters now',
        present:Boolean(project),
        preview:project ? project.title : 'Open when something feels worth working on.',
        detail:project ? `Your active Project is “${project.title}.” It connects where you are now with what you want to make different.` : 'This space is available when something feels worth actively working on. Understanding, preserving, or leaving something alone do not require a Project.'
      },
      {
        id:'practice', label:'Practice', meaning:'What I’m trying', href:'my-practice.html', action:practice ? 'Open my Practice' : 'Explore a small experiment',
        present:Boolean(practice),
        preview:practice ? practice.title : 'Open when you want to try something.',
        detail:practice ? `You are currently trying “${practice.title}.” Your engagement and reflections remain connected to it.` : 'This space is available when a small, realistic experiment would help you learn. Nothing needs to become a routine automatically.'
      },
      {
        id:'discovery', label:'Discovery', meaning:'What I’m learning', href:'my-learning.html', action:learning ? 'Open my Discovery' : 'Notice what I’m learning',
        present:Boolean(learning),
        preview:learning ? learning.statement : 'Open when something becomes worth noticing.',
        detail:learning ? `A current learning says: “${learning.statement}”` : 'This space remains open for what you notice through experience. A possibility does not become established learning unless the evidence and your confirmation support it.'
      }
    ];
  }

  function healthMapMarkup(layers) {
    const connections = layers.map(layer => `<path class="msh-health-map-connection${layer.present ? ' has-context' : ''}" data-map-connection="${layer.id}" d="${({landscape:'M50 50 C38 45 28 30 18 20',horizon:'M50 50 C62 43 72 27 82 18',path:'M50 50 C67 50 77 50 89 50',practice:'M50 50 C60 61 67 75 65 88',discovery:'M50 50 C39 61 29 74 25 86'})[layer.id]}"></path>`).join('');
    const nodes = layers.map(layer => `<button class="msh-health-map-layer is-${layer.id}${layer.present ? ' has-context' : ''}" type="button" data-health-map-layer="${layer.id}" aria-describedby="health-map-preview-${layer.id}"><span class="msh-health-map-point" aria-hidden="true"></span><span class="msh-health-map-label"><strong>${esc(layer.label)}</strong><small>${esc(layer.meaning)}</small></span><span class="msh-health-map-preview" id="health-map-preview-${layer.id}">${esc(layer.preview)}</span><span class="msh-health-map-state">${layer.present ? 'Context in view' : 'Open to explore'}</span></button>`).join('');
    return `<div class="msh-health-map-board" data-health-map-board><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${connections}</svg><div class="msh-health-map-you"><span>YOU</span><small>Your context, held together</small></div>${nodes}</div>`;
  }

  function renderHealthMap(layers) {
    renderGlass({
      state:'health-map', manifestation:'workspace', eyebrow:'My Health / Health Map',
      title:'Your health, in view.',
      intro:'Five connected ways to understand where you are, what matters, what you are trying, and what you are learning. Open any part without following a required sequence.',
      body:healthMapMarkup(layers),
      status:'Select any part of your map'
    });
  }

  function renderHealthLayer(layer) {
    renderGlass({
      state:`health-map-${layer.id}`, manifestation:'workspace', eyebrow:`My Health / ${layer.label}`,
      context:layer.meaning, title:layer.label, intro:layer.detail,
      body:`<div class="msh-health-layer-context ${layer.present ? 'has-context' : 'is-open'}"><span aria-hidden="true"></span><p>${layer.present ? 'This part of your Health Map is connected to context you have chosen to save.' : 'This part of your Health Map is open. You can leave it open or explore it when it becomes relevant.'}</p></div>`,
      footer:`<button class="msh-glass-back" type="button" data-health-map-back>← Back to the whole map</button><a class="msh-health-layer-action" href="${layer.href}">${esc(layer.action)} <span aria-hidden="true">→</span></a>`,
      status:layer.present ? 'Current context / Available to revisit' : 'Open / No action required'
    });
  }

  function render() {
    const state = MSHStorage.getState();
    if (showTools) {
      renderTools();
      return;
    }
    if (!MSHFirstDoor.hasMeaningfulContext(state) && !showWorkspace) {
      renderFirstDoor(state);
      return;
    }

    const layers = healthMapLayers(state);
    const selected = layers.find(layer => layer.id === selectedHealthLayer);
    if (selected) renderHealthLayer(selected);
    else renderHealthMap(layers);
  }

  root.addEventListener('click', event => {
    const mapLayer = event.target.closest('[data-health-map-layer]');
    if (mapLayer) {
      selectedHealthLayer = mapLayer.dataset.healthMapLayer;
      render();
      return;
    }
    if (event.target.closest('[data-health-map-back]')) {
      selectedHealthLayer = null;
      render();
      return;
    }
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
