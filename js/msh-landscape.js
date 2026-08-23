/* My Simple Health — Wellbeing Landscape prototype flow */
(function () {
  'use strict';

  const mount = document.querySelector('[data-msh-landscape]');
  const config = window.MSHLandscapeConfig;
  const storage = window.MSHStorage;

  if (!mount || !config || !storage) return;

  let screen = 'landing';
  let currentIndex = 0;
  let draft = null;
  let expandedContext = false;
  let expandedWhy = false;
  let resultsDraft = null;

  function uid(prefix) {
    if (window.crypto && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function domainFor(id) {
    return config.domains.find(domain => domain.id === id);
  }

  function itemFor(id) {
    return config.items.find(item => item.id === id);
  }

  function currentResponse(itemId) {
    if (!draft) return null;
    return draft.responses.find(response => response.itemId === itemId) || null;
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

  function getInProgress() {
    const state = storage.getState();
    return [...state.landscapes]
      .filter(item => item.status === 'in_progress' && item.instrumentVersion === config.version)
      .sort((a, b) => new Date(b.updatedAt || b.startedAt || 0) - new Date(a.updatedAt || a.startedAt || 0))[0] || null;
  }

  function startNew() {
    draft = {
      id: uid('landscape'),
      type: 'full',
      instrumentVersion: config.version,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentItemIndex: 0,
      responses: [],
      finalContext: '',
      confirmation: null,
      correction: ''
    };
    currentIndex = 0;
    saveDraft();
    screen = 'question';
    render();
  }

  function resume(existing) {
    draft = existing;
    currentIndex = Math.min(existing.currentItemIndex || 0, config.items.length - 1);
    screen = 'question';
    render();
  }

  function setAnswer(item, option) {
    const response = currentResponse(item.id);
    if (response) {
      response.value = option.value;
      response.label = option.label;
      response.signal = option.signal;
      response.direction = option.direction || null;
      response.answeredAt = new Date().toISOString();
    } else {
      draft.responses.push({
        itemId: item.id,
        domain: item.domain,
        construct: item.construct,
        value: option.value,
        label: option.label,
        signal: option.signal,
        direction: option.direction || null,
        context: '',
        answeredAt: new Date().toISOString()
      });
    }
    saveDraft();
    render();
  }

  function setContext(itemId, text) {
    const response = currentResponse(itemId);
    if (!response) return;
    response.context = text;
    saveDraft();
  }

  function nextQuestion() {
    if (!currentResponse(config.items[currentIndex].id)) return;
    if (currentIndex < config.items.length - 1) {
      currentIndex += 1;
      expandedContext = false;
      expandedWhy = false;
      saveDraft();
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    saveDraft();
    screen = 'final-context';
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function previousQuestion() {
    if (currentIndex > 0) {
      currentIndex -= 1;
      expandedContext = false;
      expandedWhy = false;
      saveDraft();
      render();
    } else {
      screen = 'landing';
      render();
    }
  }

  function summarizeDomain(domainId) {
    const responses = draft.responses.filter(response => response.domain === domainId);
    const attention = responses.filter(response => response.signal === 'attention').length;
    const mixed = responses.filter(response => response.signal === 'mixed').length;
    const fit = responses.filter(response => response.signal === 'fit').length;
    const directional = responses.filter(response => response.direction && response.direction !== 'fit');

    let state = 'Fits well';
    if (attention > 0) state = 'Worth noticing';
    else if (mixed > 0) state = 'Mixed';

    if (responses.length && directional.length === responses.length && fit === 0) {
      const low = directional.filter(response => response.direction === 'low').length;
      const high = directional.filter(response => response.direction === 'high').length;
      if (low === directional.length) state = 'Less than fits right now';
      if (high === directional.length) state = 'More than fits right now';
    }

    return { domainId, state, responses, attention, mixed, fit };
  }

  function summarySentence(summary) {
    const domain = domainFor(summary.domainId);
    const attentionItems = summary.responses.filter(response => response.signal === 'attention').map(response => itemFor(response.itemId).construct.replace(/_/g, ' '));
    const mixedItems = summary.responses.filter(response => response.signal === 'mixed').map(response => itemFor(response.itemId).construct.replace(/_/g, ' '));

    if (summary.state === 'Fits well') {
      return `Your responses suggest that the parts of ${domain.label.toLowerCase()} reflected here are generally fitting well right now.`;
    }
    if (summary.state === 'More than fits right now') {
      return `You described the amount here as more than feels right for you at the moment.`;
    }
    if (summary.state === 'Less than fits right now') {
      return `You described the amount here as less than feels right for you at the moment.`;
    }
    if (summary.state === 'Worth noticing') {
      const named = attentionItems.slice(0, 2).join(' and ');
      return `Some parts of this area may deserve a closer look${named ? `, particularly ${named}` : ''}. That does not mean you need to work on them.`;
    }
    const named = mixedItems.slice(0, 2).join(' and ');
    return `Your responses are mixed${named ? ` around ${named}` : ''}. The details may matter more than a single overall label.`;
  }

  function buildResults() {
    return config.domains.map(domain => summarizeDomain(domain.id));
  }

  function completeAssessment() {
    const finalInput = document.querySelector('[data-final-context]');
    draft.finalContext = finalInput ? finalInput.value.trim() : '';
    draft.status = 'completed';
    draft.completedAt = new Date().toISOString();
    draft.currentItemIndex = config.items.length - 1;
    draft.domainSummaries = buildResults();
    saveDraft();
    resultsDraft = draft.domainSummaries;
    screen = 'results';
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function saveConfirmation(value) {
    draft.confirmation = value;
    const correction = document.querySelector('[data-landscape-correction]');
    draft.correction = correction ? correction.value.trim() : draft.correction || '';
    saveDraft();
    render();
  }

  function saveFocus(domainId, navigationState) {
    const domain = domainFor(domainId);
    storage.updateState(state => {
      state.focuses.forEach(focus => {
        if (focus.status === 'active') focus.status = 'historical';
      });
      state.focuses.push({
        id: uid('focus'),
        sourceType: 'landscape',
        sourceId: draft.id,
        domain: domainId,
        label: domain.label,
        navigationState,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return state;
    });
    screen = 'done';
    render();
  }

  function renderLanding() {
    const inProgress = getInProgress();
    const current = storage.getCurrentLandscape();

    mount.innerHTML = `
      <section class="msh-landscape-landing">
        <p class="msh-eyebrow">My Wellbeing Landscape</p>
        <h1>Understand where you are right now.</h1>
        <p class="msh-landscape-lede">Look across different parts of your life, notice what is working, and identify anything that may deserve more attention.</p>

        <div class="msh-landscape-principles" aria-label="How the Landscape works">
          <article><strong>There is no ideal Landscape.</strong><span>Your answers are not being compared with an ideal person.</span></article>
          <article><strong>Context is optional.</strong><span>Explain an answer when it helps, or leave it alone.</span></article>
          <article><strong>You choose what happens next.</strong><span>A difficult area does not automatically become a Project.</span></article>
        </div>

        <div class="msh-card-actions">
          ${inProgress ? '<button class="msh-button" type="button" data-action="resume">Continue My Landscape</button>' : '<button class="msh-button" type="button" data-action="start">Explore My Landscape</button>'}
          ${current ? '<button class="msh-button-secondary" type="button" data-action="view-results">View Current Landscape</button>' : ''}
        </div>
        ${inProgress ? `<p class="msh-landscape-resume-note">${inProgress.responses.length} of ${config.items.length} reflections saved.</p>` : ''}
        <p class="msh-local-note">For this prototype, your My Health information is stored in this browser on this device. Clearing site data may remove it.</p>
      </section>`;
  }

  function renderQuestion() {
    const item = config.items[currentIndex];
    const domain = domainFor(item.domain);
    const response = currentResponse(item.id);
    const domainItems = config.items.filter(candidate => candidate.domain === item.domain);
    const domainPosition = domainItems.findIndex(candidate => candidate.id === item.id) + 1;
    const percent = Math.round(((currentIndex + 1) / config.items.length) * 100);

    mount.innerHTML = `
      <section class="msh-landscape-question-shell">
        <div class="msh-assessment-topline">
          <button type="button" class="msh-text-button" data-action="back">← Back</button>
          <span>${currentIndex + 1} of ${config.items.length}</span>
          <button type="button" class="msh-text-button" data-action="save-exit">Save & finish later</button>
        </div>
        <div class="msh-assessment-progress" aria-label="Assessment progress"><span style="width:${percent}%"></span></div>

        <div class="msh-question-domain">
          <p class="msh-eyebrow">${escapeHtml(domain.label)} · ${domainPosition} of ${domainItems.length}</p>
          <h1>${escapeHtml(item.prompt)}</h1>
        </div>

        <fieldset class="msh-response-fieldset">
          <legend class="msh-sr-only">Choose the response that fits best</legend>
          <div class="msh-response-options">
            ${item.options.map(option => `
              <label class="msh-response-option ${response && response.value === option.value ? 'selected' : ''}">
                <input type="radio" name="landscape-response" value="${escapeHtml(option.value)}" ${response && response.value === option.value ? 'checked' : ''}>
                <span>${escapeHtml(option.label)}</span>
              </label>`).join('')}
          </div>
        </fieldset>

        <div class="msh-question-tools">
          <button type="button" class="msh-text-button" data-action="toggle-context">${expandedContext ? '− Hide context' : '+ Add context, if you want'}</button>
          <button type="button" class="msh-text-button" data-action="toggle-why">${expandedWhy ? '− Hide explanation' : 'Why are you asking this?'}</button>
        </div>

        ${expandedContext ? `
          <div class="msh-optional-panel">
            <label for="msh-context"><strong>Anything about this answer that would help put it in context?</strong></label>
            <textarea id="msh-context" data-item-context rows="4" placeholder="For example, when this tends to happen, what affects it, or anything the answer alone doesn't capture.">${escapeHtml(response ? response.context : '')}</textarea>
          </div>` : ''}

        ${expandedWhy ? `<div class="msh-optional-panel msh-why-panel"><strong>Why this question?</strong><p>${escapeHtml(item.why)}</p></div>` : ''}

        <div class="msh-assessment-actions">
          <button type="button" class="msh-button" data-action="next" ${response ? '' : 'disabled'}>${currentIndex === config.items.length - 1 ? 'Continue' : 'Next'} <span aria-hidden="true">→</span></button>
        </div>
      </section>`;
  }

  function renderFinalContext() {
    mount.innerHTML = `
      <section class="msh-landscape-final">
        <p class="msh-eyebrow">Before we show your Landscape</p>
        <h1>Is there anything important these questions didn't capture?</h1>
        <p>This is optional. The questionnaire does not get to define the boundaries of your experience.</p>
        <label class="msh-large-text-label" for="msh-final-context">Add anything you want us to keep with this Landscape.</label>
        <textarea id="msh-final-context" data-final-context rows="6" placeholder="Anything important that would help this picture make more sense...">${escapeHtml(draft.finalContext || '')}</textarea>
        <div class="msh-card-actions">
          <button class="msh-button-secondary" type="button" data-action="back-to-last">← Back</button>
          <button class="msh-button" type="button" data-action="complete">Show My Landscape →</button>
        </div>
      </section>`;
  }

  function renderResults() {
    if (!draft) draft = storage.getCurrentLandscape();
    if (!draft) { screen = 'landing'; render(); return; }
    resultsDraft = draft.domainSummaries || buildResults();

    mount.innerHTML = `
      <section class="msh-landscape-results">
        <header class="msh-results-header">
          <p class="msh-eyebrow">Your Wellbeing Landscape</p>
          <h1>Here's how different parts of life seem to be fitting right now.</h1>
          <p>This is a starting point for reflection, not a diagnosis or grade. It is based only on what you shared.</p>
        </header>

        <div class="msh-domain-results">
          ${resultsDraft.map(summary => {
            const domain = domainFor(summary.domainId);
            const contexts = summary.responses.filter(response => response.context).slice(0, 2);
            return `
              <article class="msh-domain-card" data-domain="${domain.id}">
                <p class="msh-card-kicker">${escapeHtml(summary.state)}</p>
                <h2>${escapeHtml(domain.label)}</h2>
                <p>${escapeHtml(summarySentence(summary))}</p>
                ${contexts.length ? `<details><summary>Your context</summary>${contexts.map(response => `<p>“${escapeHtml(response.context)}”</p>`).join('')}</details>` : ''}
              </article>`;
          }).join('')}
        </div>

        ${draft.finalContext ? `<aside class="msh-final-context-card"><strong>You also wanted this Landscape to include:</strong><p>${escapeHtml(draft.finalContext)}</p></aside>` : ''}

        <section class="msh-confirmation-card">
          <p class="msh-eyebrow">Your read matters</p>
          <h2>Does this feel like you?</h2>
          <p>Before using this Landscape to decide what comes next, you can confirm or correct the picture.</p>
          <div class="msh-confirmation-options">
            <button type="button" data-confirm="yes" class="${draft.confirmation === 'yes' ? 'selected' : ''}">Yes</button>
            <button type="button" data-confirm="mostly" class="${draft.confirmation === 'mostly' ? 'selected' : ''}">Mostly</button>
            <button type="button" data-confirm="no" class="${draft.confirmation === 'no' ? 'selected' : ''}">Not really</button>
          </div>
          ${draft.confirmation && draft.confirmation !== 'yes' ? `
            <label class="msh-large-text-label" for="msh-correction">What's missing or different?</label>
            <textarea id="msh-correction" data-landscape-correction rows="4" placeholder="You can correct the picture here.">${escapeHtml(draft.correction || '')}</textarea>
            <button type="button" class="msh-button-secondary msh-save-correction" data-action="save-confirmation">Save correction</button>` : ''}
        </section>

        ${draft.confirmation === 'yes' || draft.confirmation === 'mostly' ? renderFocusChooser() : draft.confirmation === 'no' ? `
          <section class="msh-focus-card">
            <h2>Let's not use this to push you somewhere it doesn't fit.</h2>
            <p>Your correction stays with this Landscape. You can revisit your answers or leave the assessment here for now.</p>
            <div class="msh-card-actions"><button class="msh-button-secondary" type="button" data-action="landing">Done for now</button></div>
          </section>` : ''}
      </section>`;
  }

  function renderFocusChooser() {
    const candidates = resultsDraft.filter(summary => summary.state !== 'Fits well');
    const choices = candidates.length ? candidates : resultsDraft;
    return `
      <section class="msh-focus-card">
        <p class="msh-eyebrow">What matters to you right now?</p>
        <h2>You choose what happens next.</h2>
        <p>Nothing here automatically needs to become something you work on.</p>
        <div class="msh-focus-options">
          ${choices.map(summary => {
            const domain = domainFor(summary.domainId);
            return `<button type="button" data-focus-domain="${domain.id}"><strong>${escapeHtml(domain.label)}</strong><span>${escapeHtml(summary.state)}</span></button>`;
          }).join('')}
          <button type="button" data-action="no-focus"><strong>Nothing right now</strong><span>Keep the Landscape without choosing an active focus.</span></button>
        </div>
      </section>`;
  }

  function renderNavigation(domainId) {
    const domain = domainFor(domainId);
    mount.innerHTML = `
      <section class="msh-navigation-choice">
        <p class="msh-eyebrow">${escapeHtml(domain.label)}</p>
        <h1>What would you like to do with this?</h1>
        <div class="msh-navigation-options">
          <button data-nav="preserve"><strong>Keep what is working</strong><span>Protect or maintain what fits.</span></button>
          <button data-nav="explore"><strong>Understand this better</strong><span>Stay curious before deciding what to change.</span></button>
          <button data-nav="develop"><strong>Work toward something different</strong><span>Choose a direction you want to actively work toward.</span></button>
          <button data-nav="adapt"><strong>Change something I'm already doing</strong><span>Adjust an existing approach.</span></button>
          <button data-nav="prepare"><strong>Save for later</strong><span>Keep this visible without working on it now.</span></button>
          <button data-nav="no_action"><strong>Leave it alone for now</strong><span>No action is a valid choice.</span></button>
        </div>
        <button type="button" class="msh-text-button" data-action="back-results">← Back to results</button>
      </section>`;
    mount.dataset.selectedDomain = domainId;
  }

  function renderDone() {
    mount.innerHTML = `
      <section class="msh-landscape-done">
        <p class="msh-eyebrow">Landscape saved</p>
        <h1>Your Landscape is a starting point, not an assignment.</h1>
        <p>You can return to it when something changes, when you want to understand an area better, or when you simply want to notice what is still working.</p>
        <div class="msh-card-actions">
          <a class="msh-button" href="my-health.html">Return to My Health →</a>
          <button class="msh-button-secondary" type="button" data-action="view-results">Review My Landscape</button>
        </div>
      </section>`;
  }

  function render() {
    if (screen === 'landing') renderLanding();
    if (screen === 'question') renderQuestion();
    if (screen === 'final-context') renderFinalContext();
    if (screen === 'results') renderResults();
    if (screen === 'done') renderDone();
  }

  mount.addEventListener('change', event => {
    if (event.target.matches('input[name="landscape-response"]')) {
      const item = config.items[currentIndex];
      const option = item.options.find(candidate => candidate.value === event.target.value);
      if (option) setAnswer(item, option);
    }
  });

  mount.addEventListener('input', event => {
    if (event.target.matches('[data-item-context]')) setContext(config.items[currentIndex].id, event.target.value);
  });

  mount.addEventListener('click', event => {
    const actionTarget = event.target.closest('[data-action]');
    const confirmTarget = event.target.closest('[data-confirm]');
    const focusTarget = event.target.closest('[data-focus-domain]');
    const navTarget = event.target.closest('[data-nav]');

    if (confirmTarget) {
      draft.confirmation = confirmTarget.dataset.confirm;
      saveDraft();
      render();
      return;
    }

    if (focusTarget) {
      renderNavigation(focusTarget.dataset.focusDomain);
      return;
    }

    if (navTarget) {
      const domainId = mount.dataset.selectedDomain;
      saveFocus(domainId, navTarget.dataset.nav);
      return;
    }

    if (!actionTarget) return;
    const action = actionTarget.dataset.action;

    if (action === 'start') startNew();
    if (action === 'resume') resume(getInProgress());
    if (action === 'view-results') {
      draft = storage.getCurrentLandscape();
      screen = 'results';
      render();
    }
    if (action === 'back') previousQuestion();
    if (action === 'next') nextQuestion();
    if (action === 'save-exit') { saveDraft(); screen = 'landing'; render(); }
    if (action === 'toggle-context') { expandedContext = !expandedContext; render(); }
    if (action === 'toggle-why') { expandedWhy = !expandedWhy; render(); }
    if (action === 'back-to-last') { screen = 'question'; currentIndex = config.items.length - 1; render(); }
    if (action === 'complete') completeAssessment();
    if (action === 'save-confirmation') saveConfirmation(draft.confirmation);
    if (action === 'landing') { screen = 'landing'; render(); }
    if (action === 'back-results') { delete mount.dataset.selectedDomain; screen = 'results'; render(); }
    if (action === 'no-focus') { screen = 'done'; render(); }
  });

  render();
})();
