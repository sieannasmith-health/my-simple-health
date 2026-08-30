/* My Simple Health — YouTube fitness playlist planner for Calendar Movement */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'youtubeFitnessPlaylist';
  const FOCUS_LABELS = Object.freeze({
    full_body:'Full body', upper_body:'Upper body', lower_body:'Lower body', glutes:'Glutes', core:'Core', cardio:'Cardio', mobility:'Mobility', other:'Other'
  });

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function state() { return root.MSHStorage?.getState() || null; }
  function memory(source) { return source?.settings?.memory?.[STORAGE_KEY] || null; }
  function playlist() { return memory(state()); }

  function savePlaylist(data, url) {
    if (!root.MSHStorage) return null;
    const saved = {
      playlistId:data.playlistId,
      url:String(url || ''),
      source:data.source || 'youtube',
      limited:data.limited === true,
      note:data.note || '',
      videos:Array.isArray(data.videos) ? data.videos.slice(0,500) : [],
      connectedAt:new Date().toISOString()
    };
    root.MSHStorage.updateState(next => {
      next.settings ||= {};
      next.settings.memory ||= {};
      next.settings.memory[STORAGE_KEY] = saved;
      return next;
    });
    return saved;
  }

  function clearPlaylist() {
    if (!root.MSHStorage) return;
    root.MSHStorage.updateState(next => {
      if (next.settings?.memory) delete next.settings.memory[STORAGE_KEY];
      return next;
    });
  }

  async function connect(url) {
    const response = await fetch(`/api/youtube-playlist?url=${encodeURIComponent(url)}`, { headers:{Accept:'application/json'} });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Playlist could not be loaded.');
    if (!Array.isArray(data.videos) || !data.videos.length) throw new Error('No workout videos were found in this playlist.');
    return savePlaylist(data, url);
  }

  function matchWorkout(videos, duration, focus) {
    const target = Number(duration) || null;
    const wanted = String(focus || 'other');
    const ranked = (Array.isArray(videos) ? videos : []).map(video => {
      const tags = Array.isArray(video.focusTags) ? video.focusTags : ['other'];
      const focusScore = tags.includes(wanted) ? 0 : tags.includes('other') ? 2 : 4;
      const time = Number(video.durationMinutes);
      const durationScore = target && Number.isFinite(time) ? Math.abs(time - target) : target ? 3 : 0;
      return { video, score:focusScore * 10 + durationScore };
    }).sort((a,b) => a.score - b.score || Number(a.video.position || 0) - Number(b.video.position || 0));
    return ranked.slice(0,6).map(item => item.video);
  }

  function selectedDate() {
    return document.querySelector('[data-msh-calendar] [data-date].is-selected')?.dataset.date || new Date().toISOString().slice(0,10);
  }

  function addStyles() {
    if (document.getElementById('msh-youtube-movement-style')) return;
    const style = document.createElement('style');
    style.id = 'msh-youtube-movement-style';
    style.textContent = `
      .msh-youtube-planner-door{margin:18px 0;padding:18px;border:1px solid var(--msh-border,rgba(23,61,43,.14));border-radius:18px;background:color-mix(in srgb,var(--msh-surface,#fff) 78%,transparent)}
      .msh-youtube-planner-door p{margin:.35rem 0 0;color:var(--msh-text-muted,#626b63);line-height:1.55}
      .msh-youtube-planner-door .msh-card-actions{margin-top:12px;display:flex;gap:10px;flex-wrap:wrap}
      .msh-youtube-modal{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:18px;background:rgba(8,12,9,.48)}
      .msh-youtube-card{width:min(760px,100%);max-height:86vh;overflow:auto;box-sizing:border-box;padding:24px;border:1px solid var(--msh-border,rgba(23,61,43,.15));border-radius:28px;background:var(--msh-surface,#fff);color:var(--msh-text,#252822);box-shadow:0 30px 90px rgba(0,0,0,.2)}
      .msh-youtube-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.msh-youtube-card h2{margin:.35rem 0;font:400 clamp(30px,5vw,46px)/1 Georgia,serif;color:var(--msh-heading,var(--msh-forest,#173d2b))}
      .msh-youtube-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:18px 0}.msh-youtube-grid label,.msh-youtube-card .msh-cycle-field{display:grid;gap:7px;font-weight:700;font-size:13px}.msh-youtube-grid input,.msh-youtube-grid select,.msh-youtube-card input{min-height:44px;padding:0 12px;border:1px solid var(--msh-border-strong,rgba(23,61,43,.2));border-radius:12px;background:var(--msh-surface,#fff);color:inherit;font:inherit}
      .msh-youtube-results{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}.msh-youtube-result{display:grid;grid-template-columns:120px 1fr;gap:12px;align-items:center;padding:10px;border:1px solid var(--msh-border,rgba(23,61,43,.14));border-radius:16px;background:transparent;color:inherit;text-align:left;cursor:pointer}.msh-youtube-result img{width:120px;aspect-ratio:16/9;object-fit:cover;border-radius:10px}.msh-youtube-result strong{display:block}.msh-youtube-result small{display:block;margin-top:5px;color:var(--msh-text-muted,#626b63)}
      .msh-youtube-workout-thumb{display:block;margin:10px 0;width:min(320px,100%);border:0;padding:0;background:transparent;text-align:left;cursor:pointer}.msh-youtube-workout-thumb img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:14px}.msh-youtube-workout-thumb span{display:block;margin-top:7px;font-size:12px;font-weight:700;color:var(--msh-heading,var(--msh-forest,#173d2b))}
      .msh-calendar-day.has-youtube-workout{background-image:linear-gradient(rgba(255,255,255,.74),rgba(255,255,255,.74)),var(--msh-workout-thumb);background-size:cover;background-position:center}.msh-calendar-day.has-youtube-workout::after{content:'▶';font-size:10px;position:absolute;right:7px;bottom:5px}
      [data-theme="dark"] .msh-calendar-day.has-youtube-workout{background-image:linear-gradient(rgba(14,17,15,.72),rgba(14,17,15,.72)),var(--msh-workout-thumb)}
      @media(max-width:680px){.msh-youtube-grid,.msh-youtube-results{grid-template-columns:1fr}.msh-youtube-result{grid-template-columns:110px 1fr}.msh-youtube-modal{align-items:end;padding:0}.msh-youtube-card{border-radius:24px 24px 0 0;max-height:90vh}}
    `;
    document.head.appendChild(style);
  }

  function closeModal() { document.querySelector('.msh-youtube-modal')?.remove(); }

  function openWorkout(video, event) {
    closeModal();
    const wrap = document.createElement('div');
    wrap.className = 'msh-youtube-modal';
    wrap.innerHTML = `<section class="msh-youtube-card" role="dialog" aria-modal="true" aria-labelledby="msh-youtube-workout-title">
      <header><div><p class="msh-eyebrow">Movement · Planned workout</p><h2 id="msh-youtube-workout-title">${esc(video.title || event?.title || 'Workout')}</h2></div><button type="button" class="msh-text-button" data-youtube-close aria-label="Close">×</button></header>
      <img src="${esc(video.thumbnailUrl)}" alt="" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:18px;margin:12px 0 16px">
      <p>${event?.date ? `Planned for ${esc(event.date)}` : ''}${video.durationMinutes ? ` · ${esc(video.durationMinutes)} min` : ''}</p>
      <div class="msh-card-actions"><a class="msh-button" href="${esc(video.youtubeUrl)}" target="_blank" rel="noopener noreferrer">Start workout →</a>${event?.id ? `<button type="button" class="msh-button-secondary" data-youtube-record="${esc(event.id)}">Record how it went</button>` : ''}</div>
    </section>`;
    document.body.appendChild(wrap);
  }

  function schedule(video, options) {
    const saved = root.MSHMovement?.plan({
      movementLabel:video.title,
      movementType:'other',
      date:options.date,
      durationMinutes:video.durationMinutes || options.duration,
      notes:`From your YouTube fitness playlist · ${FOCUS_LABELS[options.focus] || options.focus}`,
      video:{
        provider:'youtube', videoId:video.videoId, title:video.title,
        thumbnailUrl:video.thumbnailUrl, youtubeUrl:video.youtubeUrl,
        playlistId:playlist()?.playlistId || null, durationMinutes:video.durationMinutes || null,
        focusTags:Array.isArray(video.focusTags) ? video.focusTags : []
      },
      focusArea:options.focus
    });
    if (saved) {
      closeModal();
      location.href = `calendar.html?view=calendar&workout=${encodeURIComponent(saved.id)}`;
    }
  }

  function plannerMarkup(saved) {
    const defaultDate = selectedDate();
    return `<section class="msh-youtube-card" role="dialog" aria-modal="true" aria-labelledby="msh-youtube-plan-title">
      <header><div><p class="msh-eyebrow">Movement · Fitness playlist</p><h2 id="msh-youtube-plan-title">Find a workout for the day.</h2><p>${saved ? `${saved.videos.length} workout${saved.videos.length===1?'':'s'} connected.` : 'Connect the YouTube fitness playlist you already use.'}</p></div><button type="button" class="msh-text-button" data-youtube-close aria-label="Close">×</button></header>
      ${saved ? `<form data-youtube-find-form><div class="msh-youtube-grid"><label>How long?<select name="duration"><option value="10">10 min</option><option value="20">20 min</option><option value="30" selected>30 min</option><option value="45">45 min</option><option value="60">60 min</option></select></label><label>What do you want to work on?<select name="focus">${Object.entries(FOCUS_LABELS).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><label>When?<input required type="date" name="date" value="${esc(defaultDate)}"></label></div><button class="msh-button" type="submit">Find me a workout</button><div data-youtube-results aria-live="polite"></div></form><div class="msh-card-actions"><button type="button" class="msh-text-button" data-youtube-change>Change playlist</button></div>${saved.note ? `<p><small>${esc(saved.note)}</small></p>` : ''}` : `<form data-youtube-connect-form><label class="msh-cycle-field">YouTube playlist URL<input required type="url" name="url" placeholder="https://www.youtube.com/playlist?list=…"></label><p>This version can read a public or unlisted playlist. Private playlist access will require Google sign-in later.</p><div class="msh-card-actions"><button class="msh-button" type="submit">Connect playlist</button></div><p data-youtube-status role="status" aria-live="polite"></p></form>`}
    </section>`;
  }

  function openPlanner(forceConnect) {
    closeModal();
    const saved = forceConnect ? null : playlist();
    const wrap = document.createElement('div');
    wrap.className = 'msh-youtube-modal';
    wrap.innerHTML = plannerMarkup(saved);
    document.body.appendChild(wrap);
    wrap.querySelector('input,select,button')?.focus();
  }

  function enhanceCalendar() {
    const calendar = document.querySelector('[data-msh-calendar]');
    if (!calendar || !root.MSHMovement || !root.MSHStorage) return;

    const planForm = calendar.querySelector('[data-movement-plan-form]');
    if (planForm && !planForm.querySelector('[data-youtube-planner-door]')) {
      const panel = document.createElement('section');
      panel.className = 'msh-youtube-planner-door';
      panel.dataset.youtubePlannerDoor = '';
      panel.innerHTML = `<strong>Use your fitness playlist</strong><p>Tell My Health how much time you have and what you want to work on, then choose a workout from your connected playlist.</p><div class="msh-card-actions"><button type="button" class="msh-button-secondary" data-youtube-plan>${playlist() ? 'Find from my playlist' : 'Connect my playlist'}</button></div>`;
      planForm.insertAdjacentElement('afterbegin', panel);
    }

    const events = root.MSHMovement.movementEvents(root.MSHStorage.getState());
    calendar.querySelectorAll('.msh-calendar-day[data-date]').forEach(day => {
      const event = events.find(item => item.date === day.dataset.date && item.movement?.video?.thumbnailUrl);
      if (!event) return;
      day.classList.add('has-youtube-workout');
      day.style.setProperty('--msh-workout-thumb', `url("${String(event.movement.video.thumbnailUrl).replace(/"/g,'%22')}")`);
      day.title = event.title || 'Planned workout';
    });

    const date = calendar.querySelector('.msh-calendar-day.is-selected')?.dataset.date;
    if (date) {
      const planned = events.filter(item => item.date === date && item.movement?.video);
      const cards = [...calendar.querySelectorAll('.msh-date-events article.is-movement')];
      planned.forEach((event, index) => {
        const card = cards[index];
        if (!card || card.querySelector('[data-youtube-workout]')) return;
        const video = event.movement.video;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'msh-youtube-workout-thumb';
        button.dataset.youtubeWorkout = event.id;
        button.innerHTML = `<img src="${esc(video.thumbnailUrl)}" alt=""><span>Open planned workout →</span>`;
        card.insertBefore(button, card.firstChild);
      });
    }
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-youtube-plan]')) { event.preventDefault(); openPlanner(false); return; }
    if (event.target.closest('[data-youtube-close]') || (event.target.classList.contains('msh-youtube-modal'))) { closeModal(); return; }
    if (event.target.closest('[data-youtube-change]')) { clearPlaylist(); openPlanner(true); return; }
    const workout = event.target.closest('[data-youtube-workout]');
    if (workout) {
      const item = root.MSHMovement?.getEvent(workout.dataset.youtubeWorkout);
      if (item?.movement?.video) openWorkout(item.movement.video, item);
      return;
    }
    const choice = event.target.closest('[data-youtube-choice]');
    if (choice) {
      const saved = playlist();
      const video = saved?.videos?.find(item => item.videoId === choice.dataset.youtubeChoice);
      if (!video) return;
      schedule(video, { duration:choice.dataset.duration, focus:choice.dataset.focus, date:choice.dataset.date });
      return;
    }
    const record = event.target.closest('[data-youtube-record]');
    if (record) {
      closeModal();
      const trigger = document.querySelector(`[data-complete-movement="${CSS.escape(record.dataset.youtubeRecord)}"]`);
      trigger?.click();
    }
  });

  document.addEventListener('submit', async event => {
    if (event.target.matches('[data-youtube-connect-form]')) {
      event.preventDefault();
      const status = event.target.querySelector('[data-youtube-status]');
      const button = event.target.querySelector('button[type="submit"]');
      button.disabled = true;
      status.textContent = 'Connecting your playlist…';
      try {
        await connect(new FormData(event.target).get('url'));
        openPlanner(false);
      } catch (error) {
        status.textContent = error.message;
        button.disabled = false;
      }
      return;
    }
    if (event.target.matches('[data-youtube-find-form]')) {
      event.preventDefault();
      const data = new FormData(event.target), duration = data.get('duration'), focus = data.get('focus'), date = data.get('date');
      const saved = playlist(), matches = matchWorkout(saved?.videos, duration, focus);
      const host = event.target.querySelector('[data-youtube-results]');
      host.innerHTML = matches.length ? `<div class="msh-youtube-results">${matches.map(video => `<button type="button" class="msh-youtube-result" data-youtube-choice="${esc(video.videoId)}" data-duration="${esc(duration)}" data-focus="${esc(focus)}" data-date="${esc(date)}"><img src="${esc(video.thumbnailUrl)}" alt=""><span><strong>${esc(video.title)}</strong><small>${video.durationMinutes ? `${esc(video.durationMinutes)} min · ` : ''}${(video.focusTags || []).map(tag => FOCUS_LABELS[tag] || tag).join(' · ')}</small></span></button>`).join('')}</div>` : '<p>No close match was found. Try another duration or body area.</p>';
    }
  });

  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });

  addStyles();
  enhanceCalendar();
  const calendar = document.querySelector('[data-msh-calendar]');
  if (calendar && root.MutationObserver) {
    const observer = new MutationObserver(() => enhanceCalendar());
    observer.observe(calendar, {childList:true, subtree:true});
  }

  root.MSHYouTubeMovement = Object.freeze({ connect, playlist, clearPlaylist, matchWorkout, openPlanner });
})(typeof window !== 'undefined' ? window : globalThis);
