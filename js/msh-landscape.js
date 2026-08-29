/* My Simple Health — Dimensions of Health V2 progressive self-discovery flow */
(function () {
  'use strict';

  const mount = document.querySelector('[data-msh-landscape]');
  const config = window.MSHLandscapeConfig;
  const dimensions = window.MSHDimensionsV2;
  const storage = window.MSHStorage;
  if (!mount || !config || !dimensions || !storage) return;

  let screen = 'landing';
  let currentIndex = 0;
  let draft = null;
  let expandedWhy = false;
  let lastObservation = null;
  let resultsDraft = null;
  let selectedSubject = null;
  let pendingDisposition = null;
  let savedFocus = null;

  function uid(prefix) { return storage.uid ? storage.uid(prefix) : `${prefix}_${Date.now()}`; }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function domainFor(id) { return config.domains.find(domain => domain.id === id); }
  function itemFor(id) { return config.items.find(item => item.id === id); }
  function currentResponse(itemId) { return draft && draft.responses.find(response => response.itemId === itemId) || null; }

  const dispositionCopy = Object.freeze({
    develop: { label:'I want to work on this', detail:'I want to name a change and decide whether to shape it.' },
    preserve: { label:'I want to protect what is working', detail:'Keep this visible without turning it into something to improve.' },
    explore: { label:'I want to understand this better', detail:'Stay curious without deciding what it means yet.' },
    prepare: { label:'I want to keep an eye on this', detail:'Hold it for later without creating a reminder.' },
    adapt: { label:'I need to adapt around this', detail:'Work with a real constraint without treating it as failure.' },
    no_action: { label:'I want to leave this alone for now', detail:'No action, reminder, or continued pressure.' }
  });

  function environmentMarkup() {
    return '<div class="msh-home-environment" aria-hidden="true"><span class="msh-home-cinematic"></span><span class="msh-home-atmosphere"></span></div>';
  }

  function ensureWorkspace() {
    let workspace = mount.querySelector('[data-landscape-workspace]');
    if (workspace) return workspace;
    mount.innerHTML = `<section class="msh-home-world is-first-door msh-glass-world msh-landscape-world">${environmentMarkup()}<div class="msh-home-world-content"><section class="msh-glass-workspace msh-workspace-glass msh-landscape-glass" data-landscape-workspace data-glass-state="landing" aria-labelledby="msh-landscape-title"><div class="msh-glass-edge" aria-hidden="true"></div><div class="msh-landscape-subject-thread" data-landscape-subject hidden><span aria-hidden="true"></span><p></p></div><div class="msh-landscape-workspace-content" data-landscape-content></div><p class="msh-glass-status" data-landscape-status aria-live="polite"></p></section></div></section>`;
    return mount.querySelector('[data-landscape-workspace]');
  }

  function renderWorkspace(content, options) {
    const workspace = ensureWorkspace();
    const config = options || {};
    workspace.dataset.glassState = config.state || screen;
    const subject = workspace.querySelector('[data-landscape-subject]');
    const subjectLabel = config.subject || (selectedSubject && selectedSubject.label) || '';
    subject.hidden = !subjectLabel;
    subject.querySelector('p').textContent = subjectLabel ? `${subjectLabel} · what has my attention` : '';
    workspace.querySelector('[data-landscape-status]').textContent = config.status || '';
    const contentRoot = workspace.querySelector('[data-landscape-content]');
    contentRoot.classList.add('is-changing');
    contentRoot.innerHTML = content;
    requestAnimationFrame(() => {
      contentRoot.classList.remove('is-changing');
      if (config.focusHeading) contentRoot.querySelector('h1')?.focus({ preventScroll:true });
    });
  }

  function saveDraft() {
    if (!draft) return;
    draft.updatedAt = new Date().toISOString();
    draft.currentItemIndex = currentIndex;
    storage.updateState(state => {
      const index = state.landscapes.findIndex(item => item.id === draft.id);
      if (index >= 0) state.landscapes[index] = draft;
      else state.landscapes.push(draft);
      return state;
    });
  }

  function newestLandscape(predicate) {
    return storage.getState().landscapes.filter(predicate).sort((a, b) =>
      new Date(b.updatedAt || b.completedAt || b.startedAt || 0) - new Date(a.updatedAt || a.completedAt || a.startedAt || 0)
    )[0] || null;
  }

  function getInProgress() {
    return newestLandscape(item => item.status === 'in_progress' && item.instrumentVersion === config.version);
  }

  function startNew(startIndex) {
    const timestamp = new Date().toISOString();
    draft = {
      id: uid('landscape'), type: 'progressive', instrumentVersion: config.version,
      experienceVersion: dimensions.EXPERIENCE_VERSION,
      healthMapRole: 'canonical_measurement_record', selfMapRole: 'derived_visualization_only',
      status: 'in_progress', startedAt: timestamp, updatedAt: timestamp, currentItemIndex: Number.isInteger(startIndex) ? startIndex : 0,
      responses: [], finalContext: '', confirmation: null, correction: ''
    };
    currentIndex = Number.isInteger(startIndex) ? startIndex : 0;
    saveDraft();
    screen = 'question';
    render();
  }

  function resume(existing) {
    draft = existing;
    const next = dimensions.nextUnexploredIndex(config, draft.responses, (existing.currentItemIndex || 0) - 1);
    currentIndex = next < 0 ? Math.min(existing.currentItemIndex || 0, config.items.length - 1) : next;
    screen = next < 0 ? 'summary' : 'question';
    render();
  }

  function exploreDomain(startIndex) {
    const existing = getInProgress();
    if (!existing) { startNew(startIndex); return; }
    draft = existing;
    const domainId = config.items[startIndex] && config.items[startIndex].domain;
    const nextInDomain = config.items.findIndex((item, index) => index >= startIndex && item.domain === domainId && !currentResponse(item.id));
    currentIndex = nextInDomain < 0 ? startIndex : nextInDomain;
    saveDraft();
    screen = 'question';
    render();
  }

  function saveObservation(item, selection, missingReason) {
    const existing = currentResponse(item.id);
    const observation = dimensions.createObservation(config, item, selection, {
      observationId: existing && existing.observationId,
      context: existing && existing.context || '', missingReason
    });
    draft.responses = draft.responses.filter(response => response.itemId !== item.id);
    draft.responses.push(observation);
    lastObservation = observation;
    saveDraft();
    screen = 'discovery';
    render();
  }

  function skipArea(item) {
    const domainItems = config.items.filter(candidate => candidate.domain === item.domain);
    domainItems.forEach(candidate => {
      if (currentResponse(candidate.id)) return;
      draft.responses.push(dimensions.createObservation(config, candidate, null, { missingReason: 'SKIPPED_AREA' }));
    });
    lastObservation = currentResponse(item.id);
    saveDraft();
    screen = 'discovery';
    render();
  }

  function setContext(itemId, text) {
    const response = currentResponse(itemId);
    if (!response) return;
    response.context = text;
    response.contextProvenance = storage.createProvenance(storage.PROVENANCE.USER_STATED, {
      sourceId: response.observationId, recordedAt: new Date().toISOString()
    });
    saveDraft();
  }

  function continueExploring() {
    const next = dimensions.nextUnexploredIndex(config, draft.responses, currentIndex);
    if (next < 0) { completeAssessment(); return; }
    currentIndex = next;
    expandedWhy = false;
    saveDraft();
    screen = 'question';
    render();
  }

  function completeAssessment() {
    draft.status = 'completed';
    draft.completedAt = draft.completedAt || new Date().toISOString();
    draft.domainSummaries = config.domains.map(domain => dimensions.summarizeDomain(config, draft.responses, domain.id));
    saveDraft();
    storage.updateState(state => {
      storage.recordEvent(state, {
        progressType: 'landscape_mapped', statement: 'Brought a current Dimensions of Health picture into focus.',
        sourceType: 'landscape', sourceId: draft.id,
        dedupeKey: `landscape-completed:${draft.id}`, createdAt: draft.completedAt
      });
      return state;
    });
    resultsDraft = draft.domainSummaries;
    screen = 'summary';
    render();
  }

  function showPartialSummary() {
    saveDraft();
    resultsDraft = config.domains.map(domain => dimensions.summarizeDomain(config, draft.responses, domain.id));
    screen = 'summary';
    render();
  }

  function summarySentence(summary) {
    const domain = domainFor(summary.domainId);
    const observed = summary.responses.filter(response => response.value != null);
    if (!observed.length) return 'You left this part open. Nothing has been assumed in its place.';
    if (summary.state === 'Fits well') return `The ${domain.label.toLowerCase()} signals explored so far generally fit well right now.`;
    if (summary.state === 'More than fits right now') return 'You described the amount here as more than feels right at the moment.';
    if (summary.state === 'Less than fits right now') return 'You described the amount here as less than feels right at the moment.';
    if (summary.state === 'Worth noticing') return `Something in ${domain.label.toLowerCase()} came into view as worth noticing. That does not mean it needs to become a goal.`;
    return `The ${domain.label.toLowerCase()} signals explored so far are mixed. More context may change the picture.`;
  }

  function selfMapMarkup(compact) {
    const map = dimensions.buildSelfMap(config, draft ? draft.responses : []);
    const exploredDomains = map.domains.filter(domain => domain.responses.length).length;
    return `<section class="msh-self-map ${compact ? 'msh-self-map-compact' : ''}" aria-label="Self Map: ${exploredDomains} of ${map.domains.length} areas explored">
      <div class="msh-self-map-heading"><div><p class="msh-eyebrow">Self Map</p><h2>Your picture is coming into focus.</h2></div><p><strong>${exploredDomains}</strong> ${exploredDomains === 1 ? 'area' : 'areas'} explored</p></div>
      <div class="msh-self-map-grid">${map.domains.map(domain => {
        const percent = Math.round(domain.resolution * 100);
        const label = domain.observedCount ? `${domain.observedCount} ${domain.observedCount === 1 ? 'signal' : 'signals'}` : domain.missingCount ? 'Open for later' : 'Not explored';
        return `<article class="msh-self-map-area ${domain.responses.length ? 'is-emerging' : ''}" data-map-domain="${domain.id}"><span class="msh-map-mark" aria-hidden="true"></span><h3>${escapeHtml(domain.label)}</h3><p>${escapeHtml(label)}</p><span class="msh-resolution-line" aria-hidden="true"><i style="width:${percent}%"></i></span></article>`;
      }).join('')}</div>
      <p class="msh-map-method">The Self Map is a view over your saved Health Map responses. It does not add facts or infer relationships.</p>
    </section>`;
  }

  function wellnessWheelVisual() {
    const wheel = storage.getState().wellnessWheel && storage.getState().wellnessWheel.current;
    const scores = wheel && wheel.scores;
    if (!scores) return `<section class="msh-signature-wheel msh-wheel-empty"><div class="msh-wheel-orbit" aria-hidden="true"><i></i><i></i><i></i></div><div><p class="msh-eyebrow">Signature Landscape</p><h2>Your Wellness Wheel</h2><p>Eight dimensions become one calm, explorable picture of where you are now.</p><a class="msh-button" href="wellness-wheel.html">Map My Wellness Wheel →</a></div></section>`;
    const keys = ['physical','emotional','social','occupational','financial','environmental','intellectual','spiritual'];
    const labels = ['Physical','Emotional','Social','Purpose','Financial','Environment','Learning','Meaning'];
    const points = keys.map((key, index) => { const angle = -Math.PI / 2 + index * Math.PI / 4; const radius = 20 + (Number(scores[key]) || 0) * 5.5; return `${100 + Math.cos(angle) * radius},${100 + Math.sin(angle) * radius}`; }).join(' ');
    return `<section class="msh-signature-wheel"><div class="msh-wheel-visual"><svg viewBox="0 0 200 200" role="img" aria-label="Your Wellness Wheel across eight dimensions"><g class="grid"><circle cx="100" cy="100" r="75"></circle><circle cx="100" cy="100" r="50"></circle><circle cx="100" cy="100" r="25"></circle>${keys.map((_, i) => { const a = -Math.PI / 2 + i * Math.PI / 4; return `<line x1="100" y1="100" x2="${100 + Math.cos(a) * 75}" y2="${100 + Math.sin(a) * 75}"></line>`; }).join('')}</g><polygon points="${points}"></polygon></svg></div><div><p class="msh-eyebrow">Signature Landscape · ${new Date(wheel.completedAt).toLocaleDateString()}</p><h2>Your Wellness Wheel is alive with context.</h2><p>Touch any dimension below to reconnect the shape with what you shared.</p><div class="msh-wheel-legend">${keys.map((key, i) => `<button type="button" data-wheel-key="${key}"><span>${labels[i]}</span><strong>${escapeHtml(scores[key])}/10</strong></button>`).join('')}</div><p class="msh-wheel-insight" data-wheel-insight>Choose a dimension to explore it.</p><a class="msh-text-button" href="wellness-wheel.html">Reassess the Wheel →</a></div></section>`;
  }

  function renderLanding() {
    const inProgress = getInProgress();
    const current = storage.getCurrentLandscape();
    renderWorkspace(`<section class="msh-landscape-landing msh-v2-landing">
      <div class="msh-landscape-stage-header"><div><p class="msh-stage-name">Where I am · Landscape</p><h1 id="msh-landscape-title" tabindex="-1">Bring one part of your picture into focus.</h1><p>Choose an area that feels relevant today. One response is enough to reveal something useful, and you can decide whether to keep exploring.</p>
        <div class="msh-landscape-entry-actions">${inProgress ? '<button class="msh-button" type="button" data-action="resume">Continue where I left off →</button><button class="msh-button-secondary" type="button" data-action="view-partial">See my picture so far</button>' : '<span class="msh-eyebrow">Choose an area on the map</span>'}${current ? '<button class="msh-text-button" type="button" data-action="view-results">View completed picture</button>' : ''}</div>
        ${inProgress ? '<p class="msh-landscape-resume-note">Your partial picture is saved. Stopping was not a failure.</p>' : ''}</div>
        <div class="msh-landscape-terrain" aria-label="Choose a health area to explore">${config.domains.map(domain => {
          const firstIndex = config.items.findIndex(item => item.domain === domain.id);
          return `<button class="msh-terrain-domain" type="button" data-action="start-domain" data-start-index="${firstIndex}">${escapeHtml(domain.label)}</button>`;
        }).join('')}</div></div>
      <details class="msh-landscape-explainer"><summary>How this exploration works</summary><div><section><strong>Understanding arrives as you go.</strong><p>You do not need to finish everything before this becomes useful.</p></section><section><strong>Uncertainty can stay visible.</strong><p>“Not sure” and skipping are recorded without filling in the blanks.</p></section><section><strong>Your meaning stays yours.</strong><p>A signal never automatically becomes an identity, problem, or goal.</p></section></div></details>
      ${wellnessWheelVisual()}
      <p class="msh-local-note">For this prototype, your My Health information is stored in this browser on this device. Clearing site data may remove it.</p></section>`, { state:'landing', status:'Where I am / choose one area' });
  }

  function renderQuestion() {
    const item = config.items[currentIndex];
    const domain = domainFor(item.domain);
    const map = dimensions.buildSelfMap(config, draft.responses);
    const domainSummary = map.domains.find(candidate => candidate.id === item.domain);
    const scaleStyle = dimensions.scaleIdFor(config, item) === 'amountFit5' ? 'continuum' : 'choices';
    if (storage.setHelloActivity) storage.setHelloActivity({ page: 'landscape', activity: 'dimension_assessment', dimension: item.domain, questionId: item.id, questionText: item.prompt, currentResponse: null, contextId: draft.id, contextLabel: `${domain.label} Dimensions of Health question` });
    renderWorkspace(`<section class="msh-v2-explore-shell"><div class="msh-v2-topline"><button type="button" class="msh-text-button" data-action="partial-summary">See my picture so far</button><span>${map.exploredCount ? `${map.exploredCount} reflections held` : 'A fresh picture'}</span></div><div class="msh-v2-question-layout"><div class="msh-v2-question-stage">
      <div class="msh-question-domain"><p class="msh-eyebrow">Where I am · ${escapeHtml(domain.label)}</p><h1 id="msh-landscape-title" tabindex="-1">${escapeHtml(item.prompt)}</h1><p>${escapeHtml(domain.description)}</p></div>
      <fieldset class="msh-response-fieldset" data-scale-style="${scaleStyle}"><legend class="msh-sr-only">Choose the response that fits best</legend><div class="msh-response-options">${item.options.map(option => `<label class="msh-response-option"><input type="radio" name="landscape-response" value="${escapeHtml(option.value)}"><span>${escapeHtml(option.label)}</span></label>`).join('')}</div></fieldset>
      <div class="msh-question-tools"><button type="button" class="msh-text-button" data-action="not-sure">I’m not sure</button><button type="button" class="msh-text-button" data-action="toggle-why">${expandedWhy ? 'Hide why this is asked' : 'Why are you asking this?'}</button></div>
      ${expandedWhy ? `<div class="msh-optional-panel msh-why-panel"><strong>Why this question?</strong><p>${escapeHtml(item.why)}</p></div>` : ''}<div class="msh-v2-skip-row"><button type="button" class="msh-text-button" data-action="skip-area">Leave the rest of ${escapeHtml(domain.label)} open for now</button></div></div>
      <aside class="msh-v2-map-glimpse" aria-label="Current area resolution"><p class="msh-eyebrow">Your map</p><span class="msh-map-mark is-active"></span><h2>${escapeHtml(domain.label)}</h2><p>${domainSummary.observedCount ? `${domainSummary.observedCount} signals already in view` : 'Ready for its first signal'}</p><span class="msh-resolution-line"><i style="width:${Math.round(domainSummary.resolution * 100)}%"></i></span></aside></div></section>`, { state:'question', status:'Landscape exploration', focusHeading:true });
  }

  function renderDiscovery() {
    const observation = lastObservation || currentResponse(config.items[currentIndex].id);
    const item = itemFor(observation.itemId);
    const domain = domainFor(item.domain);
    const next = dimensions.nextUnexploredIndex(config, draft.responses, currentIndex);
    renderWorkspace(`<section class="msh-v2-discovery"><header><p class="msh-eyebrow">A signal · ${escapeHtml(domain.label)}</p><h1 id="msh-landscape-title" tabindex="-1">A little more of your picture is in focus.</h1></header>
      <div class="msh-v2-discovery-card"><span class="msh-map-mark is-active" aria-hidden="true"></span><div><p class="msh-card-kicker">${escapeHtml(observation.label)}</p><h2>${escapeHtml(item.construct.replace(/_/g, ' '))}</h2><p>${escapeHtml(dimensions.interpretationFor(observation, item))}</p></div></div>
      ${observation.value != null ? `<label class="msh-v2-context-label" for="msh-context"><strong>Add context, if it would make this signal more accurate.</strong><span>The response remains the measurement; your words stay alongside it as user-stated context.</span></label><textarea id="msh-context" data-item-context data-item-id="${escapeHtml(item.id)}" rows="3" placeholder="Anything the response alone does not capture...">${escapeHtml(observation.context || '')}</textarea>` : ''}
      ${selfMapMarkup(true)}<div class="msh-v2-choice-gate"><div><p class="msh-eyebrow">Choose</p><h2>${next < 0 ? 'Your full picture is ready.' : 'Would you like to keep exploring?'}</h2></div><div class="msh-card-actions"><button class="msh-button" type="button" data-action="continue">${next < 0 ? 'See my full picture' : 'Explore another question'} →</button><button class="msh-button-secondary" type="button" data-action="partial-summary">Stop here with a useful picture</button></div></div></section>`, { state:'understanding', status:'Observation / not personal meaning', focusHeading:true });
  }

  function renderSummary() {
    if (!draft) draft = storage.getCurrentLandscape() || getInProgress();
    if (!draft) { screen = 'landing'; render(); return; }
    resultsDraft = config.domains.map(domain => dimensions.summarizeDomain(config, draft.responses, domain.id));
    const isComplete = draft.status === 'completed';
    const explored = resultsDraft.filter(summary => summary.responses.length);
    renderWorkspace(`<section class="msh-landscape-results msh-v2-summary"><header class="msh-results-header"><p class="msh-eyebrow">${isComplete ? 'Where I am · current picture' : 'Where I am · picture so far'}</p><h1 id="msh-landscape-title" tabindex="-1">${isComplete ? 'Your current picture has come into focus.' : 'What you explored is already useful.'}</h1><p>${isComplete ? 'This reflects what you shared. It does not decide what should matter or what should happen next.' : 'This partial picture keeps what you answered, what you left open, and what remains unexplored distinct.'}</p></header>
      ${selfMapMarkup(false)}<div class="msh-landscape-summary-lines">${explored.map(summary => { const domain = domainFor(summary.domainId); const contexts = summary.responses.filter(response => response.context).slice(0, 1); return `<section data-domain="${escapeHtml(domain.id)}"><div><p class="msh-card-kicker">${escapeHtml(summary.state)}</p><h2>${escapeHtml(domain.label)}</h2></div><div><p>${escapeHtml(summarySentence(summary))}</p><small>${summary.observedCount} measured · ${summary.missingCount} left open</small>${contexts.length ? `<details><summary>Your context</summary><p>“${escapeHtml(contexts[0].context)}”</p></details>` : ''}</div></section>`; }).join('')}</div>
      <details class="msh-v2-boundary-note"><summary>How this was determined</summary><p>These are summaries of the responses you recorded. No relationships have been inferred. More responses increase resolution; they do not establish causes, correlations, personal meaning, or a need to act.</p></details>
      ${isComplete ? renderConfirmation() : ''}
      <section class="msh-v2-choice-gate msh-attention-doorway"><div><p class="msh-eyebrow">Your read matters</p><h2>Looking at this picture, what stands out to you, if anything?</h2><p>You may name something, leave everything open, continue exploring, or stop.${!isComplete ? ' Your unfinished picture is saved as in progress—not failed.' : ''}</p></div><div class="msh-card-actions"><button class="msh-button" type="button" data-action="attention">Choose what has my attention →</button>${!isComplete ? '<button class="msh-button-secondary" type="button" data-action="resume-current">Continue exploring</button>' : ''}<a class="msh-text-button" href="my-health.html">That’s enough for now</a></div></section></section>`, { state:'summary', status:'Landscape summary / your meaning remains open', focusHeading:true });
  }

  function renderConfirmation() {
    return `<details class="msh-landscape-accuracy"><summary>Does this picture feel accurate enough to keep?</summary><p>The map remains a measurement whether or not you confirm it. A correction stays alongside the original responses.</p><div class="msh-confirmation-options"><button type="button" data-confirm="yes" class="${draft.confirmation === 'yes' ? 'selected' : ''}">Yes</button><button type="button" data-confirm="mostly" class="${draft.confirmation === 'mostly' ? 'selected' : ''}">Mostly</button><button type="button" data-confirm="no" class="${draft.confirmation === 'no' ? 'selected' : ''}">Not really</button></div>${draft.confirmation && draft.confirmation !== 'yes' ? `<label class="msh-large-text-label" for="msh-correction">What is missing or different?</label><textarea id="msh-correction" data-landscape-correction rows="4">${escapeHtml(draft.correction || '')}</textarea><button type="button" class="msh-button-secondary" data-action="save-confirmation">Save correction</button>` : ''}</details>`;
  }

  function saveConfirmation(value) {
    draft.confirmation = value;
    const correction = document.querySelector('[data-landscape-correction]');
    draft.correction = correction ? correction.value.trim() : draft.correction || '';
    draft.confirmationProvenance = storage.createProvenance(storage.PROVENANCE.USER_CONFIRMED, { sourceId: draft.id });
    saveDraft();
    render();
  }

  function exploredSubjects() {
    const source = resultsDraft || config.domains.map(domain => dimensions.summarizeDomain(config, draft.responses, domain.id));
    return source.filter(summary => summary.responses.length).map(summary => {
      const domain = domainFor(summary.domainId);
      return { id:domain.id, label:domain.label, summary:summarySentence(summary) };
    });
  }

  function renderAttention() {
    const subjects = exploredSubjects();
    renderWorkspace(`<section class="msh-what-matters-state"><div class="msh-what-matters-copy"><p class="msh-eyebrow">What has my attention</p><h1 id="msh-landscape-title" tabindex="-1">Looking at this picture, what stands out to you, if anything?</h1><p>The Landscape stays behind this decision. It does not choose for you.</p><div class="msh-receding-landscape" aria-label="Landscape remains available">${subjects.map(subject => `<span>${escapeHtml(subject.label)}</span>`).join('')}</div></div><div class="msh-editorial-choices" role="list" aria-label="Choose what has your attention">${subjects.map(subject => `<button type="button" role="listitem" data-subject="${escapeHtml(subject.id)}"><span>${escapeHtml(subject.label)}</span><small>${escapeHtml(subject.summary)}</small><i aria-hidden="true">○</i></button>`).join('')}<button type="button" role="listitem" data-subject="other"><span>Something else</span><small>Name it in your own words.</small><i aria-hidden="true">○</i></button><button type="button" role="listitem" data-action="nothing-stands-out"><span>Nothing needs my attention right now</span><small>This is a complete and valid outcome.</small><i aria-hidden="true">○</i></button></div><div class="msh-workspace-footer"><button class="msh-text-button" type="button" data-action="summary">← Back to my picture</button><a class="msh-text-button" href="my-health.html">That’s enough for now</a></div></section>`, { state:'attention', status:'The system does not choose what matters', focusHeading:true });
  }

  function renderOtherSubject() {
    renderWorkspace(`<section class="msh-what-matters-state msh-subject-entry"><div class="msh-what-matters-copy"><p class="msh-eyebrow">What has my attention</p><h1 id="msh-landscape-title" tabindex="-1">Name what stands out in your own words.</h1><p>This will be held as something you chose—not as a conclusion drawn from your scores.</p></div><form data-subject-form><label for="msh-subject-label">What has your attention?</label><input id="msh-subject-label" name="subject" maxlength="240" required autocomplete="off"><div class="msh-card-actions"><button class="msh-button" type="submit">Continue →</button><button class="msh-text-button" type="button" data-action="attention">Back</button></div></form></section>`, { state:'subject-entry', status:'Your words / user stated', focusHeading:true });
  }

  function renderDisposition() {
    pendingDisposition = null;
    renderWorkspace(`<section class="msh-what-matters-state"><div class="msh-what-matters-copy"><p class="msh-eyebrow">${escapeHtml(selectedSubject.label)}</p><h1 id="msh-landscape-title" tabindex="-1">What matters about this right now?</h1><p>Choose the relationship that fits. This is not a label, score, or automatic goal.</p><div class="msh-receding-landscape is-subject"><span>${escapeHtml(selectedSubject.summary || 'Something you chose from your Landscape')}</span></div></div><div><div class="msh-editorial-choices" role="list" aria-label="Choose what this subject means for now">${Object.entries(dispositionCopy).map(([id, choice]) => `<button type="button" role="listitem" data-disposition="${id}"><span>${escapeHtml(choice.label)}</span><small>${escapeHtml(choice.detail)}</small><i aria-hidden="true">○</i></button>`).join('')}</div><div class="msh-disposition-confirm" data-disposition-confirm hidden><p>Your choice is not saved until you confirm it.</p><button class="msh-button" type="button" data-action="confirm-disposition">Keep this relationship →</button></div></div><div class="msh-workspace-footer"><button class="msh-text-button" type="button" data-action="attention">← Choose something else</button><a class="msh-text-button" href="my-health.html">That’s enough for now</a></div></section>`, { state:'disposition', subject:selectedSubject.label, status:'Choose first / confirm before saving', focusHeading:true });
  }

  function activeDevelopFocuses() {
    return (storage.getCurrentFocuses ? storage.getCurrentFocuses() : storage.getState().focuses.filter(item => item.status === 'active'))
      .filter(item => item.navigationState === 'develop');
  }

  function saveDisposition() {
    if (!selectedSubject || !pendingDisposition) return;
    savedFocus = storage.saveFocusDecision({
      label:selectedSubject.label,
      navigationState:pendingDisposition,
      subjectType:selectedSubject.type || 'landscape_domain',
      subjectId:selectedSubject.id,
      sourceType:'landscape',
      sourceId:draft.id
    });
    if (!savedFocus) return;
    if (pendingDisposition === 'develop' && activeDevelopFocuses().length > 1) screen = 'capacity';
    else screen = pendingDisposition === 'develop' ? 'doorway' : 'relationship';
    render();
  }

  function renderCapacity() {
    const otherDevelop = activeDevelopFocuses().filter(item => item.id !== savedFocus.id);
    renderWorkspace(`<section class="msh-what-matters-state"><div class="msh-what-matters-copy"><p class="msh-eyebrow">Room for what matters</p><h1 id="msh-landscape-title" tabindex="-1">You already have something else you want to work on.</h1><p>Both can remain meaningful. Choose what fits your capacity before opening a change doorway.</p><div class="msh-receding-landscape is-subject"><span>${otherDevelop.map(item => escapeHtml(item.label)).join(' · ')}</span></div></div><div class="msh-editorial-choices" role="list"><button type="button" role="listitem" data-capacity="shape_this_now"><span>Shape ${escapeHtml(savedFocus.label)} next</span><small>Keep the other subject visible; make this the one you are actively shaping.</small><i aria-hidden="true">○</i></button><button type="button" role="listitem" data-capacity="keep_both_visible"><span>Keep both in view</span><small>Save this choice and return without opening another change.</small><i aria-hidden="true">○</i></button></div><div class="msh-workspace-footer"><a class="msh-text-button" href="my-health.html?from=what-matters&id=${encodeURIComponent(savedFocus.id)}">Return to My Health</a></div></section>`, { state:'capacity', subject:savedFocus.label, status:'Explicit capacity choice required', focusHeading:true });
  }

  function renderDoorway() {
    renderWorkspace(`<section class="msh-what-matters-state msh-change-doorway"><div class="msh-what-matters-copy"><p class="msh-eyebrow">You chose · work on this</p><h1 id="msh-landscape-title" tabindex="-1">Would it help to name a change you want to make?</h1><p>Your desire to work on ${escapeHtml(savedFocus.label)} opens this doorway. Reaching it has not created a Project.</p><div class="msh-receding-landscape is-subject"><span>${escapeHtml(savedFocus.label)} · develop</span></div></div><div class="msh-doorway-actions"><a class="msh-button" href="my-project.html?focus=${encodeURIComponent(savedFocus.id)}">Shape the change →</a><a class="msh-button-secondary" href="my-health.html?from=what-matters&id=${encodeURIComponent(savedFocus.id)}">Keep this in My Health</a><p>You can return without changing anything else.</p></div></section>`, { state:'doorway', subject:savedFocus.label, status:'Doorway only / no Project created', focusHeading:true });
  }

  function renderRelationship() {
    const copy = dispositionCopy[savedFocus.navigationState];
    const quiet = savedFocus.navigationState === 'no_action';
    renderWorkspace(`<section class="msh-what-matters-state msh-relationship-kept"><div class="msh-what-matters-copy"><p class="msh-eyebrow">Kept in My Health</p><h1 id="msh-landscape-title" tabindex="-1">${quiet ? 'Nothing else needs to happen.' : `${escapeHtml(savedFocus.label)} can stay visible this way.`}</h1><p>${escapeHtml(copy.label)}. ${quiet ? 'No reminder, Project, or continued workspace pressure has been created.' : 'This relationship is saved without changing another lifecycle state.'}</p></div><div class="msh-doorway-actions"><a class="msh-button" href="my-health.html?from=what-matters&id=${encodeURIComponent(savedFocus.id)}">Return to My Health →</a><button class="msh-text-button" type="button" data-action="attention">Choose something else</button></div></section>`, { state:'relationship', subject:savedFocus.label, status:'Relationship saved / no automatic action', focusHeading:true });
  }

  function renderNothingStandsOut() {
    renderWorkspace(`<section class="msh-what-matters-state msh-relationship-kept"><div class="msh-what-matters-copy"><p class="msh-eyebrow">Your read matters</p><h1 id="msh-landscape-title" tabindex="-1">Nothing needs your attention right now.</h1><p>Your Landscape remains available. No “what matters now” record, Project, reminder, or next-step pressure has been created.</p></div><div class="msh-doorway-actions"><a class="msh-button" href="my-health.html">Return to My Health →</a><button class="msh-text-button" type="button" data-action="summary">Look at my picture again</button></div></section>`, { state:'nothing', status:'No relationship recorded', focusHeading:true });
  }

  function render() {
    if (screen === 'landing') renderLanding();
    if (screen === 'question') renderQuestion();
    if (screen === 'discovery') renderDiscovery();
    if (screen === 'summary') renderSummary();
    if (screen === 'attention') renderAttention();
    if (screen === 'other-subject') renderOtherSubject();
    if (screen === 'disposition') renderDisposition();
    if (screen === 'capacity') renderCapacity();
    if (screen === 'doorway') renderDoorway();
    if (screen === 'relationship') renderRelationship();
    if (screen === 'nothing') renderNothingStandsOut();
  }

  mount.addEventListener('change', event => {
    if (!event.target.matches('input[name="landscape-response"]')) return;
    const item = config.items[currentIndex];
    const option = item.options.find(candidate => candidate.value === event.target.value);
    if (option) saveObservation(item, option, null);
  });
  mount.addEventListener('input', event => { if (event.target.matches('[data-item-context]')) setContext(event.target.dataset.itemId, event.target.value); });
  mount.addEventListener('submit', event => {
    if (!event.target.matches('[data-subject-form]')) return;
    event.preventDefault();
    const label = new FormData(event.target).get('subject').trim();
    if (!label) return;
    selectedSubject = { id:`other:${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)}`, type:'user_named_subject', label, summary:'Named in your own words.' };
    screen = 'disposition';
    render();
  });
  mount.addEventListener('click', event => {
    const actionTarget = event.target.closest('[data-action]');
    const confirmTarget = event.target.closest('[data-confirm]');
    const wheelTarget = event.target.closest('[data-wheel-key]');
    const subjectTarget = event.target.closest('[data-subject]');
    const dispositionTarget = event.target.closest('[data-disposition]');
    const capacityTarget = event.target.closest('[data-capacity]');
    if (subjectTarget) {
      if (subjectTarget.dataset.subject === 'other') { screen = 'other-subject'; render(); return; }
      selectedSubject = exploredSubjects().find(subject => subject.id === subjectTarget.dataset.subject) || null;
      if (selectedSubject) { screen = 'disposition'; render(); }
      return;
    }
    if (dispositionTarget) {
      pendingDisposition = dispositionTarget.dataset.disposition;
      mount.querySelectorAll('[data-disposition]').forEach(button => {
        const selected = button === dispositionTarget;
        button.classList.toggle('selected', selected);
        button.setAttribute('aria-pressed', String(selected));
        const mark = button.querySelector('i');
        if (mark) mark.textContent = selected ? '●' : '○';
      });
      const confirmation = mount.querySelector('[data-disposition-confirm]');
      if (confirmation) confirmation.hidden = false;
      return;
    }
    if (capacityTarget) {
      const decision = capacityTarget.dataset.capacity;
      storage.saveFocusCapacityDecision(savedFocus.id, decision);
      savedFocus = storage.getState().focuses.find(item => item.id === savedFocus.id) || savedFocus;
      screen = decision === 'shape_this_now' ? 'doorway' : 'relationship';
      render();
      return;
    }
    if (wheelTarget) {
      const wheel = storage.getState().wellnessWheel.current;
      const insight = mount.querySelector('[data-wheel-insight]');
      const name = wheelTarget.querySelector('span').textContent;
      if (insight && wheel) insight.textContent = `${name} is ${wheel.scores[wheelTarget.dataset.wheelKey]}/10 in the picture you created. The score is your reflection, not a diagnosis or instruction.`;
      mount.querySelectorAll('[data-wheel-key]').forEach(button => button.classList.toggle('selected', button === wheelTarget));
      return;
    }
    if (confirmTarget) { saveConfirmation(confirmTarget.dataset.confirm); return; }
    if (!actionTarget) return;
    const action = actionTarget.dataset.action;
    if (action === 'start') startNew();
    if (action === 'start-domain') exploreDomain(Number(actionTarget.dataset.startIndex));
    if (action === 'resume') resume(getInProgress());
    if (action === 'resume-current') resume(draft);
    if (action === 'view-partial') { draft = getInProgress(); showPartialSummary(); }
    if (action === 'view-results') { draft = storage.getCurrentLandscape(); screen = 'summary'; render(); }
    if (action === 'partial-summary') showPartialSummary();
    if (action === 'continue') continueExploring();
    if (action === 'not-sure') saveObservation(config.items[currentIndex], null, 'NOT_SURE');
    if (action === 'skip-area') skipArea(config.items[currentIndex]);
    if (action === 'toggle-why') { expandedWhy = !expandedWhy; render(); }
    if (action === 'save-confirmation') saveConfirmation(draft.confirmation);
    if (action === 'landing') { screen = 'landing'; render(); }
    if (action === 'summary') { screen = 'summary'; render(); }
    if (action === 'attention') { selectedSubject = null; pendingDisposition = null; screen = 'attention'; render(); }
    if (action === 'nothing-stands-out') { selectedSubject = null; pendingDisposition = null; screen = 'nothing'; render(); }
    if (action === 'confirm-disposition') saveDisposition();
  });
  const routeParams = new URLSearchParams(location.search);
  const capacityFocusId = routeParams.get('capacityFocus');
  if (capacityFocusId) {
    savedFocus = storage.getState().focuses.find(item => item.id === capacityFocusId && item.status === 'active' && item.navigationState === 'develop') || null;
    screen = savedFocus && activeDevelopFocuses().length > 1 ? 'capacity' : savedFocus ? 'doorway' : 'landing';
    render();
  } else if (routeParams.get('start') === 'dimensions' && !getInProgress() && !storage.getCurrentLandscape()) {
    startNew();
  } else {
    render();
  }
})();
