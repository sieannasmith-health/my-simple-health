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

  function uid(prefix) { return storage.uid ? storage.uid(prefix) : `${prefix}_${Date.now()}`; }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function domainFor(id) { return config.domains.find(domain => domain.id === id); }
  function itemFor(id) { return config.items.find(item => item.id === id); }
  function currentResponse(itemId) { return draft && draft.responses.find(response => response.itemId === itemId) || null; }

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

  function startNew() {
    const timestamp = new Date().toISOString();
    draft = {
      id: uid('landscape'), type: 'progressive', instrumentVersion: config.version,
      experienceVersion: dimensions.EXPERIENCE_VERSION,
      healthMapRole: 'canonical_measurement_record', selfMapRole: 'derived_visualization_only',
      status: 'in_progress', startedAt: timestamp, updatedAt: timestamp, currentItemIndex: 0,
      responses: [], finalContext: '', confirmation: null, correction: ''
    };
    currentIndex = 0;
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
    mount.innerHTML = `<section class="msh-landscape-landing msh-v2-landing"><p class="msh-eyebrow">Dimensions of Health</p><h1>Bring your picture into focus.</h1><p class="msh-landscape-lede">Explore one part of life at a time. Every response adds a signal to your Health Map and gives you something useful to notice now.</p>
      <div class="msh-discovery-loop" aria-label="Explore, answer, discover, map, then choose whether to continue"><span>Explore</span><i></i><span>Answer</span><i></i><span>Discover</span><i></i><span>Map</span><i></i><span>Choose</span></div>
      ${wellnessWheelVisual()}
      <div class="msh-landscape-principles"><article><strong>Understanding arrives as you go.</strong><span>You do not need to finish everything before this becomes useful.</span></article><article><strong>Uncertainty can stay visible.</strong><span>“Not sure” and skipping are recorded without filling in the blanks.</span></article><article><strong>Your meaning stays yours.</strong><span>A signal never automatically becomes an identity, problem, or goal.</span></article></div>
      <div class="msh-card-actions">${inProgress ? '<button class="msh-button" type="button" data-action="resume">Continue exploring</button><button class="msh-button-secondary" type="button" data-action="view-partial">See my picture so far</button>' : '<button class="msh-button" type="button" data-action="start">Explore my dimensions</button>'}${current ? '<button class="msh-button-secondary" type="button" data-action="view-results">View completed picture</button>' : ''}</div>
      ${inProgress ? '<p class="msh-landscape-resume-note">Your partial picture is saved. Stopping was not a failure.</p>' : ''}<p class="msh-local-note">For this prototype, your My Health information is stored in this browser on this device. Clearing site data may remove it.</p></section>`;
  }

  function renderQuestion() {
    const item = config.items[currentIndex];
    const domain = domainFor(item.domain);
    const map = dimensions.buildSelfMap(config, draft.responses);
    const domainSummary = map.domains.find(candidate => candidate.id === item.domain);
    const scaleStyle = dimensions.scaleIdFor(config, item) === 'amountFit5' ? 'continuum' : 'choices';
    if (storage.setHelloActivity) storage.setHelloActivity({ page: 'landscape', activity: 'dimension_assessment', dimension: item.domain, questionId: item.id, questionText: item.prompt, currentResponse: null, contextId: draft.id, contextLabel: `${domain.label} Dimensions of Health question` });
    mount.innerHTML = `<section class="msh-v2-explore-shell"><div class="msh-v2-topline"><button type="button" class="msh-text-button" data-action="partial-summary">See my picture so far</button><span>${map.exploredCount ? `${map.exploredCount} reflections held` : 'A fresh picture'}</span></div><div class="msh-v2-question-layout"><div class="msh-v2-question-stage">
      <div class="msh-question-domain"><p class="msh-eyebrow">Exploring · ${escapeHtml(domain.label)}</p><h1>${escapeHtml(item.prompt)}</h1><p>${escapeHtml(domain.description)}</p></div>
      <fieldset class="msh-response-fieldset" data-scale-style="${scaleStyle}"><legend class="msh-sr-only">Choose the response that fits best</legend><div class="msh-response-options">${item.options.map(option => `<label class="msh-response-option"><input type="radio" name="landscape-response" value="${escapeHtml(option.value)}"><span>${escapeHtml(option.label)}</span></label>`).join('')}</div></fieldset>
      <div class="msh-question-tools"><button type="button" class="msh-text-button" data-action="not-sure">I’m not sure</button><button type="button" class="msh-text-button" data-action="toggle-why">${expandedWhy ? 'Hide why this is asked' : 'Why are you asking this?'}</button></div>
      ${expandedWhy ? `<div class="msh-optional-panel msh-why-panel"><strong>Why this question?</strong><p>${escapeHtml(item.why)}</p></div>` : ''}<div class="msh-v2-skip-row"><button type="button" class="msh-text-button" data-action="skip-area">Leave the rest of ${escapeHtml(domain.label)} open for now</button></div></div>
      <aside class="msh-v2-map-glimpse" aria-label="Current area resolution"><p class="msh-eyebrow">Your map</p><span class="msh-map-mark is-active"></span><h2>${escapeHtml(domain.label)}</h2><p>${domainSummary.observedCount ? `${domainSummary.observedCount} signals already in view` : 'Ready for its first signal'}</p><span class="msh-resolution-line"><i style="width:${Math.round(domainSummary.resolution * 100)}%"></i></span></aside></div></section>`;
  }

  function renderDiscovery() {
    const observation = lastObservation || currentResponse(config.items[currentIndex].id);
    const item = itemFor(observation.itemId);
    const domain = domainFor(item.domain);
    const next = dimensions.nextUnexploredIndex(config, draft.responses, currentIndex);
    mount.innerHTML = `<section class="msh-v2-discovery"><header><p class="msh-eyebrow">Discover · ${escapeHtml(domain.label)}</p><h1>A little more of your picture is in focus.</h1></header>
      <div class="msh-v2-discovery-card"><span class="msh-map-mark is-active" aria-hidden="true"></span><div><p class="msh-card-kicker">${escapeHtml(observation.label)}</p><h2>${escapeHtml(item.construct.replace(/_/g, ' '))}</h2><p>${escapeHtml(dimensions.interpretationFor(observation, item))}</p></div></div>
      ${observation.value != null ? `<label class="msh-v2-context-label" for="msh-context"><strong>Add context, if it would make this signal more accurate.</strong><span>The response remains the measurement; your words stay alongside it as user-stated context.</span></label><textarea id="msh-context" data-item-context data-item-id="${escapeHtml(item.id)}" rows="3" placeholder="Anything the response alone does not capture...">${escapeHtml(observation.context || '')}</textarea>` : ''}
      ${selfMapMarkup(true)}<div class="msh-v2-choice-gate"><div><p class="msh-eyebrow">Choose</p><h2>${next < 0 ? 'Your full picture is ready.' : 'Would you like to keep exploring?'}</h2></div><div class="msh-card-actions"><button class="msh-button" type="button" data-action="continue">${next < 0 ? 'See my full picture' : 'Explore another question'} →</button><button class="msh-button-secondary" type="button" data-action="partial-summary">Stop here with a useful picture</button></div></div></section>`;
  }

  function renderSummary() {
    if (!draft) draft = storage.getCurrentLandscape() || getInProgress();
    if (!draft) { screen = 'landing'; render(); return; }
    resultsDraft = config.domains.map(domain => dimensions.summarizeDomain(config, draft.responses, domain.id));
    const isComplete = draft.status === 'completed';
    const explored = resultsDraft.filter(summary => summary.responses.length);
    mount.innerHTML = `<section class="msh-landscape-results msh-v2-summary"><header class="msh-results-header"><p class="msh-eyebrow">${isComplete ? 'Your Dimensions of Health' : 'Your picture so far'}</p><h1>${isComplete ? 'Your current picture has come into focus.' : 'What you explored is already useful.'}</h1><p>${isComplete ? 'This is a reflection of what you shared—not a diagnosis, grade, or instruction.' : 'This partial picture keeps what you answered, what you left open, and what remains unexplored distinct.'}</p></header>
      ${selfMapMarkup(false)}<div class="msh-domain-results">${explored.map(summary => { const domain = domainFor(summary.domainId); const contexts = summary.responses.filter(response => response.context).slice(0, 2); return `<article class="msh-domain-card" data-domain="${domain.id}"><p class="msh-card-kicker">${escapeHtml(summary.state)}</p><h2>${escapeHtml(domain.label)}</h2><p>${escapeHtml(summarySentence(summary))}</p><small>${summary.observedCount} measured · ${summary.missingCount} left open</small>${contexts.length ? `<details><summary>Your context</summary>${contexts.map(response => `<p>“${escapeHtml(response.context)}”</p>`).join('')}</details>` : ''}</article>`; }).join('')}</div>
      <aside class="msh-v2-boundary-note"><strong>No relationships have been inferred.</strong><p>More responses increase resolution. They do not by themselves establish correlations, causes, or personal meaning.</p></aside>
      ${isComplete ? renderConfirmation() : `<section class="msh-v2-choice-gate"><div><p class="msh-eyebrow">Choose</p><h2>You can continue now or return later.</h2><p>Your unfinished picture is saved as in progress—not failed.</p></div><div class="msh-card-actions"><button class="msh-button" type="button" data-action="resume-current">Continue exploring →</button><button class="msh-button-secondary" type="button" data-action="landing">Done for now</button></div></section>`}</section>`;
  }

  function renderConfirmation() {
    return `<section class="msh-confirmation-card"><p class="msh-eyebrow">Your read matters</p><h2>Does this picture feel accurate enough to keep?</h2><p>The map is based on your responses. You can confirm it, add a correction, or simply leave it as a measurement without choosing any action.</p><div class="msh-confirmation-options"><button type="button" data-confirm="yes" class="${draft.confirmation === 'yes' ? 'selected' : ''}">Yes</button><button type="button" data-confirm="mostly" class="${draft.confirmation === 'mostly' ? 'selected' : ''}">Mostly</button><button type="button" data-confirm="no" class="${draft.confirmation === 'no' ? 'selected' : ''}">Not really</button></div>${draft.confirmation && draft.confirmation !== 'yes' ? `<label class="msh-large-text-label" for="msh-correction">What is missing or different?</label><textarea id="msh-correction" data-landscape-correction rows="4">${escapeHtml(draft.correction || '')}</textarea><button type="button" class="msh-button-secondary" data-action="save-confirmation">Save correction</button>` : ''}${draft.confirmation ? `<div class="msh-card-actions"><a class="msh-button" href="my-health.html">Keep this in My Health →</a><button class="msh-button-secondary" type="button" data-action="landing">Done for now</button></div>` : ''}</section>`;
  }

  function saveConfirmation(value) {
    draft.confirmation = value;
    const correction = document.querySelector('[data-landscape-correction]');
    draft.correction = correction ? correction.value.trim() : draft.correction || '';
    draft.confirmationProvenance = storage.createProvenance(storage.PROVENANCE.USER_CONFIRMED, { sourceId: draft.id });
    saveDraft();
    render();
  }

  function render() {
    if (screen === 'landing') renderLanding();
    if (screen === 'question') renderQuestion();
    if (screen === 'discovery') renderDiscovery();
    if (screen === 'summary') renderSummary();
  }

  mount.addEventListener('change', event => {
    if (!event.target.matches('input[name="landscape-response"]')) return;
    const item = config.items[currentIndex];
    const option = item.options.find(candidate => candidate.value === event.target.value);
    if (option) saveObservation(item, option, null);
  });
  mount.addEventListener('input', event => { if (event.target.matches('[data-item-context]')) setContext(event.target.dataset.itemId, event.target.value); });
  mount.addEventListener('click', event => {
    const actionTarget = event.target.closest('[data-action]');
    const confirmTarget = event.target.closest('[data-confirm]');
    const wheelTarget = event.target.closest('[data-wheel-key]');
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
  });
  render();
})();
