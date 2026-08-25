/* My Simple Health — Horizon: raw words → synthesis → confirmation */
(function () {
  'use strict';
  const mount = document.querySelector('[data-msh-vision]');
  const storage = window.MSHStorage;
  if (!mount || !storage) return;

  const prompts = [
    { key: 'life', label: 'The life I want to live', prompt: 'When life is fitting well, what does it feel like or make room for?' },
    { key: 'protect', label: 'What I want to protect', prompt: 'What is already important or working well that you do not want change to crowd out?' },
    { key: 'more', label: 'What I want more room for', prompt: 'What would you like to have more space, time, energy, or attention for?' },
    { key: 'less', label: 'What I want less of', prompt: 'What would you like to carry less of, reduce, or simplify?' },
    { key: 'becoming', label: 'Who I am becoming', prompt: 'What qualities or ways of living matter to you?' },
    { key: 'future', label: 'What I am building toward', prompt: 'What do you hope becomes true, even if you do not know the path yet?' }
  ];
  let mode = 'explore';
  let pending = null;

  function esc(value) { return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  function current() { return storage.getCurrentVision(storage.getState()); }
  function latestDraft() { return [...storage.getState().visionEntries].filter(x => x.status === 'draft').sort((a,b) => new Date(b.updatedAt||0)-new Date(a.updatedAt||0))[0] || null; }
  function sentence(value) { const text = String(value || '').trim().replace(/\s+/g, ' '); return text ? text.replace(/[.!?]*$/, '.') : ''; }
  function synthesize(responses, direction) {
    const sourceKeys = prompts.map(item => item.key).filter(key => responses[key]);
    const pieces = [];
    if (responses.life) pieces.push(sentence(responses.life));
    if (responses.protect) pieces.push(`I want to protect ${sentence(responses.protect).replace(/^I want to protect\s+/i, '').replace(/\.$/, '')}.`);
    if (responses.more) pieces.push(`I want more room for ${sentence(responses.more).replace(/^I want (more room )?for\s+/i, '').replace(/\.$/, '')}.`);
    if (responses.less) pieces.push(`I want to carry less of ${sentence(responses.less).replace(/^I want (to carry )?less (of )?/i, '').replace(/\.$/, '')}.`);
    if (responses.becoming) pieces.push(`I am becoming someone who ${sentence(responses.becoming).replace(/^I am (becoming )?(someone who )?/i, '').replace(/\.$/, '')}.`);
    if (responses.future) pieces.push(`I am building toward ${sentence(responses.future).replace(/^I am (building )?(toward )?/i, '').replace(/\.$/, '')}.`);
    if (direction) pieces.push(sentence(direction));
    return { statement: pieces.join(' ').slice(0, 1800), sourceKeys: direction ? [...sourceKeys, 'direction'] : sourceKeys };
  }

  function render() {
    const vision = current();
    const draft = pending || latestDraft() || vision;
    if (mode === 'confirm' && draft) return renderConfirmation(draft);
    mount.innerHTML = `
      <section class="msh-vision-horizon">
        <div class="msh-horizon-glow" aria-hidden="true"></div>
        <p class="msh-eyebrow">Horizon · Where I’m headed</p>
        <h1>${vision ? 'Your horizon can keep changing.' : 'Let the horizon come into view.'}</h1>
        <p>Begin with fragments, feelings, and possibilities. My Simple Health will bring your words together, then ask you whether the picture is true.</p>
        ${vision ? `<blockquote>${esc(vision.synthesis.statement)}</blockquote><small>Confirmed by you · ${new Date(vision.synthesis.confirmedAt || vision.updatedAt).toLocaleDateString()}</small>` : ''}
      </section>
      <form class="msh-vision-editor msh-horizon-prompts" data-vision-form>
        <div class="msh-vision-intro-card"><strong>You do not need to answer everything.</strong><p>Your own words remain the source. A synthesis will never become your Current Vision until you confirm or correct it.</p></div>
        ${prompts.map((item, index) => `<label class="msh-vision-prompt" for="vision-${item.key}"><span>${String(index + 1).padStart(2,'0')} · ${esc(item.label)}</span><strong>${esc(item.prompt)}</strong><textarea id="vision-${item.key}" data-vision-field="${item.key}" rows="3" placeholder="Speak or write what feels true right now...">${esc(draft && draft.responses ? draft.responses[item.key] || '' : '')}</textarea><small class="msh-voice-ready">Voice-ready input · typing for now</small></label>`).join('')}
        <label class="msh-vision-statement" for="vision-direction"><span>In your own words, if you already know</span><strong>What direction feels clearest right now?</strong><textarea id="vision-direction" data-vision-direction rows="3" placeholder="Optional — this is one source among all of your reflections.">${esc(draft && draft.rawDirection || '')}</textarea></label>
        <div class="msh-card-actions"><button class="msh-button" type="submit">Bring My Horizon Into View →</button><a class="msh-button-secondary" href="my-health.html">Return to My Health</a></div>
      </form>`;
  }

  function renderConfirmation(draft) {
    mount.innerHTML = `<section class="msh-vision-confirm">
      <p class="msh-eyebrow">Your words, brought together</p><h1>Does this horizon feel like yours?</h1>
      <p>This is a system synthesis of everything you entered—not a new fact about you. Edit it until it sounds true.</p>
      <div class="msh-horizon-line" aria-hidden="true"><span></span></div>
      <form data-confirm-form>
        <label for="vision-synthesis"><span>Proposed Current Vision</span><textarea id="vision-synthesis" name="synthesis" rows="9" required>${esc(draft.synthesis.statement)}</textarea></label>
        <div class="msh-source-trail"><strong>Built from ${draft.synthesis.sourceKeys.length} part${draft.synthesis.sourceKeys.length === 1 ? '' : 's'} of what you shared</strong><p>${draft.synthesis.sourceKeys.map(key => key === 'direction' ? 'your current direction' : prompts.find(x => x.key === key).label.toLowerCase()).join(' · ')}</p></div>
        <div class="msh-card-actions"><button class="msh-button" type="submit">Yes, This Is My Current Vision</button><button class="msh-button-secondary" type="button" data-action="back">Keep Exploring</button></div>
      </form>
    </section>`;
  }

  mount.addEventListener('submit', event => {
    event.preventDefault();
    if (event.target.matches('[data-vision-form]')) {
      const responses = {};
      prompts.forEach(item => { responses[item.key] = mount.querySelector(`[data-vision-field="${item.key}"]`).value.trim(); });
      const rawDirection = mount.querySelector('[data-vision-direction]').value.trim();
      if (!rawDirection && !Object.values(responses).some(Boolean)) return;
      const now = new Date().toISOString();
      const previousDraft = latestDraft();
      pending = { id: previousDraft ? previousDraft.id : storage.uid('vision'), status: 'draft', responses, rawDirection, synthesis: { ...synthesize(responses, rawDirection), confirmationStatus: 'pending', generatedAt: now }, createdAt: previousDraft ? previousDraft.createdAt : now, updatedAt: now };
      storage.updateState(state => { const index = state.visionEntries.findIndex(x => x.id === pending.id); if (index >= 0) state.visionEntries[index] = pending; else state.visionEntries.push(pending); return state; });
      mode = 'confirm'; render(); window.scrollTo({top:0,behavior:'smooth'}); return;
    }
    if (event.target.matches('[data-confirm-form]')) {
      const statement = new FormData(event.target).get('synthesis').trim();
      const confirmedAt = new Date().toISOString();
      storage.updateState(state => {
        state.visionEntries.forEach(entry => { if (entry.status === 'current') entry.status = 'historical'; });
        const entry = state.visionEntries.find(x => x.id === pending.id);
        entry.status = 'current'; entry.statement = statement; entry.updatedAt = confirmedAt;
        entry.synthesis = { ...entry.synthesis, statement, confirmationStatus: 'confirmed', confirmedAt, correctedByUser: statement !== pending.synthesis.statement };
        storage.recordEvent(state, { progressType:'vision_clarified', statement:'Clarified and confirmed a Current Vision.', sourceType:'vision', sourceId:entry.id, dedupeKey:`vision-confirmed:${entry.id}:${confirmedAt}`, createdAt:confirmedAt });
        return state;
      });
      pending = null; mode = 'explore'; render(); window.scrollTo({top:0,behavior:'smooth'});
    }
  });
  mount.addEventListener('click', event => { if (event.target.closest('[data-action="back"]')) { mode = 'explore'; render(); } });
  render();
})();
