/* My Simple Health — Horizon: progressive raw words → synthesis → confirmation */
(function () {
  'use strict';
  const mount = document.querySelector('[data-msh-vision]');
  const storage = window.MSHStorage;
  if (!mount || !storage) return;

  const prompts = [
    { key:'life', label:'The life I want to live', prompt:'When your life is fitting well, what does it feel like or make room for?' },
    { key:'protect', label:'What I want to protect', prompt:'What is already important or working well that you do not want change to crowd out?' },
    { key:'more', label:'What I want more room for', prompt:'What would you like to have more space, time, energy, or attention for?' },
    { key:'less', label:'What I want less of', prompt:'What would you like to carry less of, reduce, or simplify?' },
    { key:'becoming', label:'How I want to live', prompt:'What qualities or ways of living matter to you?' },
    { key:'future', label:'What I am building toward', prompt:'What do you hope becomes true, even if you do not know the path yet?' }
  ];
  let mode = 'intro';
  let promptIndex = 0;
  let pending = null;
  let working = null;

  function esc(value) { return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  function current() { return storage.getCurrentVision(storage.getState()); }
  function latestDraft() { return [...storage.getState().visionEntries].filter(x => x.status === 'draft').sort((a,b) => new Date(b.updatedAt||0)-new Date(a.updatedAt||0))[0] || null; }
  function sentence(value) { const text = String(value || '').trim().replace(/\s+/g,' '); return text ? text.replace(/[.!?]*$/,'.') : ''; }
  function responseCount() { return Object.values(working && working.responses || {}).filter(Boolean).length + (working && working.rawDirection ? 1 : 0); }
  function ensureWorking() {
    if (working) return working;
    const source = pending || latestDraft();
    const timestamp = new Date().toISOString();
    working = {
      id: source ? source.id : storage.uid('vision'), status:'draft',
      responses:{ ...(source && source.responses || {}) }, rawDirection:source && source.rawDirection || '',
      synthesis:source && source.synthesis || null,
      createdAt:source ? source.createdAt : timestamp, updatedAt:timestamp
    };
    return working;
  }
  function synthesize(responses, direction) {
    const sourceKeys = prompts.map(item => item.key).filter(key => responses[key]);
    const pieces = [];
    if (responses.life) pieces.push(sentence(responses.life));
    if (responses.protect) pieces.push(`I want to protect ${sentence(responses.protect).replace(/^I want to protect\s+/i,'').replace(/\.$/,'')}.`);
    if (responses.more) pieces.push(`I want more room for ${sentence(responses.more).replace(/^I want (more room )?for\s+/i,'').replace(/\.$/,'')}.`);
    if (responses.less) pieces.push(`I want to carry less of ${sentence(responses.less).replace(/^I want (to carry )?less (of )?/i,'').replace(/\.$/,'')}.`);
    if (responses.becoming) pieces.push(`I want to live with ${sentence(responses.becoming).replace(/^I (want to )?(live )?(with )?/i,'').replace(/\.$/,'')}.`);
    if (responses.future) pieces.push(`I am building toward ${sentence(responses.future).replace(/^I am (building )?(toward )?/i,'').replace(/\.$/,'')}.`);
    if (direction) pieces.push(sentence(direction));
    return { statement:pieces.join(' ').slice(0,1800), sourceKeys:direction ? [...sourceKeys,'direction'] : sourceKeys };
  }
  function persistDraft() {
    ensureWorking();
    working.updatedAt = new Date().toISOString();
    storage.updateState(state => {
      const index = state.visionEntries.findIndex(entry => entry.id === working.id);
      const saved = { ...working, responses:{ ...working.responses } };
      if (index >= 0) state.visionEntries[index] = saved; else state.visionEntries.push(saved);
      return state;
    });
  }
  function fragmentMarkup() {
    const fragments = prompts.filter(item => working.responses[item.key]).map(item => `<li title="${esc(working.responses[item.key])}">${esc(item.label)}</li>`);
    if (working.rawDirection) fragments.push(`<li title="${esc(working.rawDirection)}">Direction in my words</li>`);
    return `<div class="msh-horizon-fragments"><p>${fragments.length ? `${fragments.length} ${fragments.length === 1 ? 'fragment' : 'fragments'} held in your own words` : 'Your words will gather here as you explore.'}</p>${fragments.length ? `<ul>${fragments.join('')}</ul>` : ''}</div>`;
  }
  function horizonMapMarkup() {
    return `<aside class="msh-horizon-map" aria-label="Where I am to where I want to go"><div><p class="msh-eyebrow">Your direction forming</p><div class="msh-horizon-map-line" aria-hidden="true"><span class="msh-horizon-now">Where I am</span><span class="msh-horizon-there">Where I want to go</span></div></div>${fragmentMarkup()}<div class="msh-horizon-progress" aria-label="${Math.min(promptIndex + 1,prompts.length)} of ${prompts.length} reflection prompts visited">${prompts.map((_,index) => `<i class="${index <= promptIndex ? 'is-seen' : ''}"></i>`).join('')}</div></aside>`;
  }
  function stageHeader(vision) {
    return `<header class="msh-horizon-stage-header"><p class="msh-stage-name">Horizon · Where I want to go</p><h1>${vision ? 'Your direction can keep evolving.' : 'Let a direction come into view.'}</h1><p>Start with one thought. You can stop after any useful fragment, explore another prompt, or bring what you have into a direction to confirm.</p></header>${vision ? `<section class="msh-horizon-current"><p class="msh-eyebrow">Current direction · confirmed by you</p><blockquote>${esc(vision.synthesis.statement)}</blockquote><small>${new Date(vision.synthesis.confirmedAt || vision.updatedAt).toLocaleDateString()}</small></section>` : ''}`;
  }
  function renderIntro() {
    const vision = current();
    ensureWorking();
    mount.innerHTML = `<section class="msh-horizon-stage">${stageHeader(vision)}<div class="msh-horizon-workspace"><div class="msh-horizon-prompt"><p class="msh-eyebrow">One thought is enough to begin</p><h2>Would you rather explore a prompt or name a direction you already have?</h2><p>Your raw words remain the source. A synthesis cannot become your Current Vision until you confirm or correct it.</p><div class="msh-horizon-intro-choice"><button class="msh-button" type="button" data-action="begin-prompts">Explore one prompt →</button><button class="msh-button-secondary" type="button" data-action="direct">I already have a direction</button><a class="msh-text-button" href="my-health.html">Not now</a></div></div>${horizonMapMarkup()}</div></section>`;
  }
  function renderPrompt() {
    ensureWorking();
    const item = prompts[promptIndex];
    mount.innerHTML = `<section class="msh-horizon-stage"><header class="msh-horizon-stage-header"><p class="msh-stage-name">Horizon · Where I want to go</p><h1>Shape the direction in your own words.</h1><p>You are exploring one part at a time. Leave anything uncertain open.</p></header><div class="msh-horizon-workspace"><form class="msh-horizon-prompt" data-prompt-form><label for="vision-${item.key}"><span>${String(promptIndex + 1).padStart(2,'0')} · ${esc(item.label)}</span><strong>${esc(item.prompt)}</strong><textarea id="vision-${item.key}" name="response" rows="4" placeholder="Write what feels true right now...">${esc(working.responses[item.key] || '')}</textarea></label><small class="msh-voice-ready">Voice-ready input · typing for now</small><div class="msh-horizon-prompt-actions"><button class="msh-button" type="submit">Hold this thought →</button><button class="msh-button-secondary" type="button" data-action="not-sure">I’m not sure yet</button>${responseCount() ? '<button class="msh-text-button" type="button" data-action="synthesize">Bring my direction together</button>' : ''}${promptIndex ? '<button class="msh-text-button" type="button" data-action="previous">Back</button>' : ''}</div></form>${horizonMapMarkup()}</div></section>`;
  }
  function renderDirect() {
    ensureWorking();
    mount.innerHTML = `<section class="msh-horizon-stage"><header class="msh-horizon-stage-header"><p class="msh-stage-name">Horizon · Where I want to go</p><h1>Name the direction that feels clearest now.</h1><p>This can be brief and unfinished. You will review the result before anything is confirmed.</p></header><div class="msh-horizon-workspace"><form class="msh-horizon-prompt" data-direct-form><label for="vision-direction"><span>In your own words</span><strong>What direction feels clearest right now?</strong><textarea id="vision-direction" name="direction" rows="4" placeholder="The direction I want to move toward is...">${esc(working.rawDirection)}</textarea></label><div class="msh-horizon-prompt-actions"><button class="msh-button" type="submit">Bring my direction together →</button><button class="msh-button-secondary" type="button" data-action="begin-prompts">Explore a prompt instead</button><button class="msh-text-button" type="button" data-action="intro">Back</button></div></form>${horizonMapMarkup()}</div></section>`;
  }
  function beginSynthesis() {
    ensureWorking();
    if (!responseCount()) return;
    const now = new Date().toISOString();
    pending = { ...working, status:'draft', responses:{ ...working.responses }, synthesis:{ ...synthesize(working.responses,working.rawDirection), confirmationStatus:'pending', generatedAt:now }, updatedAt:now };
    working = pending;
    persistDraft();
    mode = 'confirm';
    render();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function renderConfirmation(draft) {
    mount.innerHTML = `<section class="msh-vision-confirm"><p class="msh-stage-name">Horizon · Your words brought together</p><h1>Does this direction feel like yours?</h1><p>This is a system synthesis of what you entered—not a new fact about you. Edit it until it sounds true.</p><div class="msh-horizon-line" aria-hidden="true"><span></span></div><form data-confirm-form><label for="vision-synthesis"><span>Proposed Current Vision</span><textarea id="vision-synthesis" name="synthesis" rows="8" required>${esc(draft.synthesis.statement)}</textarea></label><div class="msh-source-trail"><strong>Built from ${draft.synthesis.sourceKeys.length} part${draft.synthesis.sourceKeys.length === 1 ? '' : 's'} of what you shared</strong><p>${draft.synthesis.sourceKeys.map(key => key === 'direction' ? 'your current direction' : prompts.find(item => item.key === key).label.toLowerCase()).join(' · ')}</p></div><div class="msh-card-actions"><button class="msh-button" type="submit">Yes, keep this as my Current Vision</button><button class="msh-button-secondary" type="button" data-action="back-to-prompts">Keep exploring</button></div></form></section>`;
  }
  function render() {
    if (mode === 'confirm' && pending) { renderConfirmation(pending); return; }
    if (mode === 'prompt') { renderPrompt(); return; }
    if (mode === 'direct') { renderDirect(); return; }
    renderIntro();
  }

  mount.addEventListener('submit', event => {
    event.preventDefault();
    if (event.target.matches('[data-prompt-form]')) {
      const value = new FormData(event.target).get('response').trim();
      if (!value) return;
      working.responses[prompts[promptIndex].key] = value;
      persistDraft();
      if (promptIndex < prompts.length - 1) { promptIndex += 1; renderPrompt(); } else beginSynthesis();
      return;
    }
    if (event.target.matches('[data-direct-form]')) {
      const value = new FormData(event.target).get('direction').trim();
      if (!value) return;
      working.rawDirection = value;
      persistDraft();
      beginSynthesis();
      return;
    }
    if (event.target.matches('[data-confirm-form]')) {
      const statement = new FormData(event.target).get('synthesis').trim();
      const confirmedAt = new Date().toISOString();
      storage.updateState(state => {
        state.visionEntries.forEach(entry => { if (entry.status === 'current') entry.status = 'historical'; });
        const entry = state.visionEntries.find(item => item.id === pending.id);
        entry.status = 'current'; entry.statement = statement; entry.updatedAt = confirmedAt;
        entry.synthesis = { ...entry.synthesis, statement, confirmationStatus:'confirmed', confirmedAt, correctedByUser:statement !== pending.synthesis.statement };
        storage.recordEvent(state,{ progressType:'vision_clarified', statement:'Clarified and confirmed a Current Vision.', sourceType:'vision', sourceId:entry.id, dedupeKey:`vision-confirmed:${entry.id}:${confirmedAt}`, createdAt:confirmedAt });
        return state;
      });
      pending = null; working = null; mode = 'intro'; render(); window.scrollTo({top:0,behavior:'smooth'});
    }
  });
  mount.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'begin-prompts') { mode = 'prompt'; render(); }
    if (action === 'direct') { mode = 'direct'; render(); }
    if (action === 'intro') { mode = 'intro'; render(); }
    if (action === 'previous') { promptIndex = Math.max(0,promptIndex - 1); renderPrompt(); }
    if (action === 'not-sure') { if (promptIndex < prompts.length - 1) { promptIndex += 1; renderPrompt(); } else if (responseCount()) beginSynthesis(); else { mode = 'intro'; render(); } }
    if (action === 'synthesize') beginSynthesis();
    if (action === 'back-to-prompts') { mode = 'prompt'; pending = null; render(); }
  });
  render();
})();
