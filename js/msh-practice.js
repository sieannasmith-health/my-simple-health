/* My Simple Health — Practice: engagement over perfection */
(function () {
  'use strict';
  const mount = document.querySelector('[data-msh-practice]'); const storage = window.MSHStorage;
  if (!mount || !storage) return;
  let mode = 'home'; let selectedOutcome = '';
  const outcomes = [
    ['tried','Tried','I gave it a real try.'], ['done','Done','It happened as planned.'],
    ['changed','Changed','I adapted it to fit.'], ['skipped','Skipped','It did not happen—and I can notice why.'],
    ['reflected','Reflected','I want to capture what I learned.']
  ];
  function esc(v) { return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  function project(st) { return storage.getActiveProject(st); }
  function practice(st) { return storage.getActivePractice(st); }
  function attempts(st, p) { return p ? st.practiceAttempts.filter(a => a.practiceId === p.id).sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)) : []; }
  function label(v) { const found = outcomes.find(x => x[0] === v); return found ? found[1] : ({did_it:'Done',partly:'Tried',reflection:'Reflected'})[v] || v; }

  function render() {
    const st = storage.getState(), path = project(st), active = practice(st);
    if (!path) {
      const paused = [...st.projects].filter(x => x.status === 'paused').sort((a,b) => new Date(b.updatedAt)-new Date(a.updatedAt))[0];
      mount.innerHTML = `<section class="msh-practice-header"><p class="msh-eyebrow">Practice · What I’m trying</p><h1>${paused ? 'Your path is paused, so your Practice is resting too.' : 'Practice comes after choice.'}</h1><p>${paused ? 'Nothing is broken or gone. Resume the Project when it fits, and its Practice will be available again.' : 'Choose a Project first, then decide whether there is something small worth trying.'}</p><div class="msh-card-actions"><a class="msh-button" href="my-project.html">${paused ? 'View Project History' : 'Go to My Project'} →</a></div></section>${renderHistory(st)}`; return;
    }
    if (mode === 'create' || (!active && mode !== 'saved')) return renderForm(path);
    if (mode === 'reflect' && active) return renderReflection(path, active);
    renderHome(st, path, active);
  }

  function renderHome(st, path, active) {
    const logs = attempts(st, active);
    mount.innerHTML = `<section class="msh-practice-header"><p class="msh-eyebrow">Practice · What I’m trying</p><h1>Meet the day you actually have.</h1><p>A Practice is a small experiment—not a test of discipline. Every honest interaction can teach you something.</p></section>
      <section class="msh-practice-project"><span>Your path</span><strong>${esc(path.title)}</strong><p>${esc(path.pointA)} <b>→</b> ${esc(path.pointB)}</p></section>
      ${active ? `<section class="msh-practice-active"><div class="msh-practice-title"><p class="msh-card-kicker">Active Practice</p><h2>${esc(active.title)}</h2><p>${esc(active.description)}</p>${active.when ? `<small>${esc(active.when)}</small>` : ''}</div>
        <div class="msh-practice-pulse" aria-hidden="true"><span></span><span></span><span></span></div>
        <h3>How did you engage with this today?</h3><p class="msh-practice-gentle">No streaks. No grades. Just a useful record of experience.</p>
        <div class="msh-engagement-choices">${outcomes.map(x => `<button data-outcome="${x[0]}"><strong>${x[1]}</strong><span>${x[2]}</span></button>`).join('')}</div>
        ${logs.length ? `<div class="msh-attempt-history"><h3>Your recent rhythm</h3>${logs.slice(0,7).map(x => `<div><strong>${esc(label(x.outcome))}</strong><time>${new Date(x.createdAt).toLocaleDateString()}</time>${x.note ? `<p>${esc(x.note)}</p>` : ''}</div>`).join('')}</div>` : ''}</section>` : `<section class="msh-practice-empty"><h2>What feels small enough to try?</h2><p>Choose something realistic enough to teach you something.</p><button class="msh-button" data-action="create">Activate a Practice</button></section>`}
      ${renderHistory(st)}`;
  }

  function renderForm(path) {
    mount.innerHTML = `<section class="msh-practice-header"><p class="msh-eyebrow">Current path · ${esc(path.title)}</p><h1>What feels light enough to try?</h1><p>Make it concrete, flexible, and small enough to meet an imperfect day.</p></section><form class="msh-practice-form" data-form><label><span>Practice</span><strong>What are you going to try?</strong><input name="title" required><small class="msh-voice-ready">Voice-ready input · typing for now</small></label><label><span>The experiment</span><strong>What do you hope this helps you learn or move toward?</strong><textarea name="description" rows="4" required></textarea></label><label><span>A gentle cue</span><strong>When or where might this fit?</strong><input name="when"></label><fieldset><legend>How does this fit your current plate?</legend><div class="msh-capacity-options"><label><input type="radio" name="fit" value="easy"><span>Easy to fit</span></label><label><input type="radio" name="fit" value="workable" checked><span>Workable</span></label><label><input type="radio" name="fit" value="stretch"><span>A stretch</span></label></div></fieldset><div class="msh-card-actions"><button class="msh-button" type="submit">Activate This Practice</button><button class="msh-button-secondary" type="button" data-action="cancel">Not right now</button></div></form>`;
  }

  function renderReflection(path, active) {
    mount.innerHTML = `<section class="msh-practice-header"><p class="msh-eyebrow">${esc(label(selectedOutcome))} · Notice, don’t judge</p><h1>What happened?</h1><p>The useful question is not “Was I good?” It is “What did this experience show me?”</p></section><form class="msh-practice-form" data-reflection><label><span>${esc(active.title)}</span><strong>What helped, got in the way, surprised you, or changed?</strong><textarea name="note" rows="5" ${selectedOutcome === 'reflected' ? 'required' : ''}></textarea><small class="msh-voice-ready">Voice-ready reflection · typing for now</small></label><fieldset><legend>What feels right next?</legend><div class="msh-reflection-options"><label><input type="radio" name="next" value="keep" checked><span>Keep trying</span></label><label><input type="radio" name="next" value="modify"><span>Modify it</span></label><label><input type="radio" name="next" value="pause"><span>Pause it</span></label><label><input type="radio" name="next" value="done"><span>Learning complete</span></label></div></fieldset><div class="msh-card-actions"><button class="msh-button" type="submit">Save This Experience</button><button class="msh-button-secondary" type="button" data-action="cancel">Back</button></div></form>`;
  }

  function renderHistory(st) {
    const past = st.practices.filter(x => x.status !== 'active').sort((a,b) => new Date(b.updatedAt||0)-new Date(a.updatedAt||0));
    return past.length ? `<details class="msh-practice-history"><summary>Past and paused Practices (${past.length})</summary>${past.map(x => `<article><span>${esc(x.status)}</span><strong>${esc(x.title)}</strong><p>${esc(x.description)}</p></article>`).join('')}</details>` : '';
  }

  mount.addEventListener('click', event => {
    const outcome = event.target.closest('[data-outcome]'); if (outcome) { selectedOutcome = outcome.dataset.outcome; mode = 'reflect'; render(); return; }
    const action = event.target.closest('[data-action]'); if (!action) return; mode = action.dataset.action === 'create' ? 'create' : 'home'; render();
  });

  mount.addEventListener('submit', event => {
    event.preventDefault(); const fd = new FormData(event.target); const now = new Date().toISOString();
    if (event.target.matches('[data-form]')) {
      const st = storage.getState(), path = project(st), id = storage.uid('practice');
      storage.updateState(data => { data.practices.filter(x => x.projectId === path.id && x.status === 'active').forEach(x => { x.status = 'historical'; x.updatedAt = now; }); data.practices.push({id,projectId:path.id,title:fd.get('title').trim(),description:fd.get('description').trim(),when:fd.get('when').trim(),capacityFit:fd.get('fit'),status:'active',createdAt:now,updatedAt:now}); storage.recordEvent(data,{progressType:'practice_started',statement:`Activated the Practice “${fd.get('title').trim()}.”`,sourceType:'practice',sourceId:id,projectId:path.id,practiceId:id,dedupeKey:`practice-started:${id}`,createdAt:now}); return data; }); mode='home'; render(); return;
    }
    if (event.target.matches('[data-reflection]')) {
      const st = storage.getState(), active = practice(st), next = fd.get('next'), note = fd.get('note').trim();
      storage.updateState(data => { data.practiceAttempts.push({id:storage.uid('attempt'),practiceId:active.id,projectId:active.projectId,outcome:selectedOutcome,note,createdAt:now}); if (note || selectedOutcome === 'reflected') data.reflections.push({id:storage.uid('reflection'),projectId:active.projectId,practiceId:active.id,statement:note || `I reflected on ${active.title}.`,nextStep:next,createdAt:now}); if (next === 'pause' || next === 'done') { const item = data.practices.find(x => x.id === active.id); item.status = next === 'pause' ? 'paused' : 'completed'; item.updatedAt = now; } storage.recordEvent(data,{progressType:selectedOutcome === 'changed' ? 'practice_changed' : selectedOutcome === 'reflected' || note ? 'reflection_recorded' : `practice_${selectedOutcome}`,statement:`${label(selectedOutcome)}: ${active.title}${note ? ` — ${note}` : ''}`,sourceType:'practice_attempt',projectId:active.projectId,practiceId:active.id,createdAt:now}); return data; }); mode='home'; selectedOutcome=''; render();
    }
  });
  render();
})();
