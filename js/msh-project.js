/* My Simple Health — Path: Point A → milestone → Point B */
(function () {
  'use strict';
  const mount = document.querySelector('[data-msh-project]');
  const storage = window.MSHStorage;
  if (!mount || !storage) return;
  const requestedFocusId = new URLSearchParams(location.search).get('focus');
  let notice = '';
  function esc(v) { return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  function state() { return storage.getState(); }
  function active() { return storage.getActiveProject(state()); }
  function focus(st) {
    if (requestedFocusId) return st.focuses.find(x => x.id === requestedFocusId && x.status === 'active' && x.navigationState === 'develop') || null;
    const develop = st.focuses.filter(x => x.status === 'active' && x.navigationState === 'develop');
    if (develop.length === 1) return develop[0];
    return develop.length ? null : st.focuses.find(x => x.status === 'active' && !x.navigationState) || null;
  }
  function vision(st) { return storage.getCurrentVision(st); }
  function history(st) { return [...st.projects].filter(x => x.status !== 'active').sort((a,b) => new Date(b.updatedAt||0)-new Date(a.updatedAt||0)); }
  function statusLabel(value) { return ({paused:'Paused',completed:'Completed',historical:'Past'})[value] || value; }

  function render() {
    const st = state(); const project = active(); const past = history(st); const currentFocus = focus(st); const developChoices = st.focuses.filter(x => x.status === 'active' && x.navigationState === 'develop');
    mount.innerHTML = `<section class="msh-project-header"><p class="msh-eyebrow">Path · Point A → Point B</p><h1>${project ? 'Your path is visible.' : 'Choose one path worth walking.'}</h1><p>A Project turns a direction into a meaningful season of movement. It can pause, change, or complete without disappearing.</p>${notice ? `<div class="msh-lifecycle-notice" role="status">${esc(notice)}</div>` : ''}</section>
      ${project ? renderActive(project, st) : developChoices.length > 1 && !requestedFocusId ? renderFocusChoice(developChoices) : renderCreate(currentFocus, vision(st), past)}
      ${renderHistory(past)}`;
    activatePathCanvas();
  }

  function renderFocusChoice(items) {
    return `<section class="msh-project-builder"><div class="msh-project-context"><p class="msh-eyebrow">What fits now</p><h2>You have more than one thing you want to work on.</h2><p>Choose which one you have room to shape now. The others remain visible in My Health.</p></div><div class="msh-project-focus-choices">${items.map(item => `<a class="msh-button-secondary" href="my-project.html?focus=${encodeURIComponent(item.id)}">${esc(item.label)} →</a>`).join('')}<a class="msh-text-button" href="my-health.html">Not right now</a></div></section>`;
  }

  function renderCreate(f, v, past) {
    return `<section class="msh-project-builder">
      <div class="msh-project-context"><p class="msh-eyebrow">Before you begin</p><h2>${past.length ? 'Ready for a new direction?' : 'Is this worth actively working on right now?'}</h2><p>You can understand something, preserve it, or save it for later without making it a Project.</p>${f ? `<p><strong>Your chosen focus:</strong> ${esc(f.label)}</p>` : ''}${v ? `<p><strong>Your confirmed horizon:</strong> ${esc(v.synthesis.statement)}</p>` : ''}</div>
      <form data-project-form>
        <label class="msh-project-field"><span>Name this path</span><strong>What are you working on?</strong><input name="title" required placeholder="For example: Build a night rhythm that fits me"><small class="msh-voice-ready">Voice-ready input · typing for now</small></label>
        <div class="msh-path-builder"><label><span>Point A · Here</span><strong>What is true right now?</strong><textarea name="pointA" rows="4" required>${esc(f ? f.label : '')}</textarea></label><div aria-hidden="true" class="msh-path-route"><i></i><span>the path</span><i></i></div><label><span>Point B · Direction</span><strong>What would feel meaningfully different?</strong><textarea name="pointB" rows="4" required></textarea></label></div>
        <label class="msh-project-field"><span>First trail marker</span><strong>What small sign would tell you movement has begun?</strong><textarea name="milestone" rows="3" required></textarea></label>
        <label class="msh-project-field"><span>Why it matters</span><textarea name="why" rows="3"></textarea></label>
        <fieldset class="msh-project-capacity"><legend><span>My Plate</span><strong>How much room do you realistically have?</strong></legend><div>${['Very little','A little','A workable amount','Plenty'].map(x => `<label><input type="radio" name="capacity" value="${x.toLowerCase().replace(/ /g,'_')}"><span>${x}</span></label>`).join('')}</div></fieldset>
        <div class="msh-card-actions"><button class="msh-button" type="submit">Begin This Path →</button><a class="msh-button-secondary" href="my-health.html">Not right now</a></div>
      </form></section>`;
  }

  function projectProgress(p, st) {
    const practice = st.practices.find(item => item.projectId === p.id && item.status === 'active');
    const attempts = st.practiceAttempts.filter(item => item.projectId === p.id).length;
    const reflections = st.reflections.filter(item => item.projectId === p.id).length;
    const learning = st.learningEntries.filter(item => item.projectId === p.id && item.currentStatus === 'current').length;
    return Math.min(.9, .34 + (practice ? .14 : 0) + Math.min(attempts, 4) * .055 + (reflections ? .08 : 0) + (learning ? .08 : 0));
  }

  function renderActive(p, st) {
    const progress = projectProgress(p, st);
    return `<section class="msh-project-active"><div class="msh-project-title-row"><div><p class="msh-eyebrow">Active path</p><h2>${esc(p.title)}</h2></div><span class="msh-project-status">In progress</span></div>
      <figure class="msh-active-path-canvas" data-active-path data-progress="${progress}" aria-labelledby="active-path-caption">
        <figcaption id="active-path-caption" class="msh-visually-hidden">An open trail from where you are, past your first milestone, toward your chosen direction.</figcaption>
        <svg class="msh-active-path-art" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
          <defs><filter id="msh-trail-wobble"><feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="2" seed="7" result="noise"></feTurbulence><feDisplacementMap in="SourceGraphic" in2="noise" scale="2"></feDisplacementMap></filter></defs>
          <path class="msh-trail-sketch msh-trail-sketch-one" d="M40 470 C165 408 237 504 357 405 C490 295 586 385 710 260 C810 160 888 191 965 88"></path>
          <path class="msh-trail-sketch msh-trail-sketch-two" d="M52 480 C170 425 248 512 366 414 C502 302 592 395 720 270 C820 174 900 198 970 96"></path>
          <path class="msh-trail-base" data-trail-path pathLength="1" d="M46 475 C168 416 244 508 361 410 C496 298 590 391 716 264 C816 166 894 194 968 92"></path>
          <path class="msh-trail-established" pathLength="1" style="--path-progress:${progress}" d="M46 475 C168 416 244 508 361 410 C496 298 590 391 716 264 C816 166 894 194 968 92"></path>
          <path class="msh-horizon-mark" d="M827 104 C880 94 929 96 982 105"></path>
          <path class="msh-field-mark" d="M115 514 q18 -22 37 0 M138 519 q16 -28 33 -4 M520 373 q13 -20 28 -2"></path>
          <circle class="msh-path-position-halo" data-path-position-halo r="13"></circle>
          <circle class="msh-path-position" data-path-position r="5"></circle>
        </svg>
        <div class="msh-path-annotation msh-path-annotation-here" tabindex="0" data-path-stage="here"><span>Here</span><p>${esc(p.pointA)}</p></div>
        <div class="msh-path-annotation msh-path-annotation-milestone" tabindex="0" data-path-stage="milestone"><span>First milestone</span><i aria-hidden="true"></i><p>${esc(p.milestone || 'Notice the first sign of movement')}</p></div>
        <div class="msh-path-annotation msh-path-annotation-direction" tabindex="0" data-path-stage="direction"><span>Direction</span><p>${esc(p.pointB)}</p></div>
        <p class="msh-path-progress-note">The part you have lived is becoming more visible. What is ahead can remain open.</p>
      </figure>
      ${p.why ? `<div class="msh-project-detail"><span>Why this matters</span><p>${esc(p.why)}</p></div>` : ''}
      <div class="msh-project-next"><p class="msh-eyebrow">Next doorway</p><h3>What will you actually try?</h3><p>Choose a Practice small enough to meet real life.</p><a class="msh-button" href="my-practice.html">Choose a Practice →</a></div>
      <div class="msh-card-actions"><button class="msh-button-secondary" data-action="complete">Mark Project Complete</button><button class="msh-text-button" data-action="pause">Pause Project</button></div></section>`;
  }

  function activatePathCanvas() {
    const canvas = mount.querySelector('[data-active-path]');
    if (!canvas) return;
    requestAnimationFrame(() => {
      const path = canvas.querySelector('[data-trail-path]');
      const dot = canvas.querySelector('[data-path-position]');
      const halo = canvas.querySelector('[data-path-position-halo]');
      if (!path || !dot || !halo) return;
      const progress = Math.max(0, Math.min(1, Number(canvas.dataset.progress) || 0));
      const point = path.getPointAtLength(path.getTotalLength() * progress);
      [dot, halo].forEach(marker => { marker.setAttribute('cx', point.x); marker.setAttribute('cy', point.y); });
      canvas.classList.add('is-drawn');
    });
  }

  function renderHistory(past) {
    if (!past.length) return '';
    return `<section class="msh-project-history"><p class="msh-eyebrow">Path behind me</p><h2>Project history</h2><div>${past.map(p => `<article><span class="msh-project-status is-${esc(p.status)}">${esc(statusLabel(p.status))}</span><h3>${esc(p.title)}</h3><p>${esc(p.pointA)} <b>→</b> ${esc(p.pointB)}</p><small>${new Date(p.updatedAt || p.createdAt).toLocaleDateString()}</small>${p.status === 'paused' && !active() ? `<button class="msh-button-secondary" data-resume="${esc(p.id)}">Resume This Project</button>` : ''}</article>`).join('')}</div></section>`;
  }

  mount.addEventListener('submit', event => {
    if (!event.target.matches('[data-project-form]')) return;
    event.preventDefault(); const fd = new FormData(event.target); const createdAt = new Date().toISOString(); const id = storage.uid('project'); const selectedFocus = focus(state());
    storage.updateState(st => {
      st.projects.forEach(x => { if (x.status === 'active') { x.status = 'paused'; x.updatedAt = createdAt; } });
      st.projects.push({ id, status:'active', focusId:selectedFocus && selectedFocus.id || null, title:fd.get('title').trim(), pointA:fd.get('pointA').trim(), pointB:fd.get('pointB').trim(), why:fd.get('why').trim(), capacity:fd.get('capacity') || '', milestone:fd.get('milestone').trim(), createdAt, updatedAt:createdAt });
      storage.recordEvent(st, { progressType:'project_started', statement:`Started the Project “${fd.get('title').trim()}.”`, sourceType:'project', sourceId:id, projectId:id, dedupeKey:`project-started:${id}`, createdAt }); return st;
    });
    notice = 'Your Project is saved. The path stays here when you move between pages.'; render(); window.scrollTo({top:0,behavior:'smooth'});
  });

  mount.addEventListener('click', event => {
    const pathStage = event.target.closest('[data-path-stage]');
    if (pathStage) {
      const canvas = pathStage.closest('[data-active-path]');
      if (canvas) canvas.dataset.highlight = canvas.dataset.highlight === pathStage.dataset.pathStage ? '' : pathStage.dataset.pathStage;
      return;
    }
    const action = event.target.closest('[data-action]'); const resume = event.target.closest('[data-resume]');
    if (resume) {
      const updatedAt = new Date().toISOString();
      storage.updateState(st => { st.projects.forEach(x => { if (x.status === 'active') { x.status = 'paused'; x.updatedAt = updatedAt; } }); const p = st.projects.find(x => x.id === resume.dataset.resume); if (p) { p.status = 'active'; p.updatedAt = updatedAt; const pausedPractice = [...st.practices].filter(x => x.projectId === p.id && x.status === 'paused').sort((a,b) => new Date(b.updatedAt||0)-new Date(a.updatedAt||0))[0]; if (pausedPractice) { pausedPractice.status = 'active'; pausedPractice.updatedAt = updatedAt; } storage.recordEvent(st,{progressType:'project_resumed',statement:`Resumed the Project “${p.title}.”`,sourceType:'project',sourceId:p.id,projectId:p.id,createdAt:updatedAt}); } return st; });
      notice = 'Project resumed.'; render(); return;
    }
    if (!action) return; const p = active(); if (!p) return; const status = action.dataset.action === 'complete' ? 'completed' : 'paused'; const updatedAt = new Date().toISOString();
    storage.updateState(st => { const item = st.projects.find(x => x.id === p.id); item.status = status; item.updatedAt = updatedAt; if (status === 'completed') item.completedAt = updatedAt; st.practices.filter(x => x.projectId === p.id && x.status === 'active').forEach(x => { x.status = status === 'completed' ? 'completed' : 'paused'; x.updatedAt = updatedAt; }); storage.recordEvent(st,{progressType:`project_${status}`,statement:`${status === 'completed' ? 'Completed' : 'Paused'} the Project “${p.title}.”`,sourceType:'project',sourceId:p.id,projectId:p.id,dedupeKey:`project-${status}:${p.id}:${updatedAt}`,createdAt:updatedAt}); return st; });
    notice = status === 'completed' ? 'Project completed—and preserved in your journey.' : 'Project paused. Nothing was lost; you can resume it when it fits.'; render();
  });
  render();
})();
