/* My Simple Health — optional Google/YouTube account connection for private fitness playlists */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'youtubeFitnessPlaylist';
  const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
  let accessToken = '';
  let tokenClient = null;
  let configPromise = null;
  let gisPromise = null;

  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  function parseDuration(value) {
    const match = String(value || '').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    if (!match) return null;
    const seconds = Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
    return seconds ? Math.max(1, Math.round(seconds / 60)) : null;
  }

  function focusTags(title) {
    const value = String(title || '').toLowerCase();
    const tags = [];
    if (/full[ -]?body|total body/.test(value)) tags.push('full_body');
    if (/upper|arms?|shoulders?|chest|back/.test(value)) tags.push('upper_body');
    if (/lower|legs?|hamstring|quad/.test(value)) tags.push('lower_body');
    if (/glute|booty/.test(value)) tags.push('glutes');
    if (/core|abs?|abdominal/.test(value)) tags.push('core');
    if (/cardio|hiit|interval|dance|aerobic/.test(value)) tags.push('cardio');
    if (/mobility|stretch|yoga|recovery/.test(value)) tags.push('mobility');
    return tags.length ? [...new Set(tags)] : ['other'];
  }

  async function config() {
    if (!configPromise) configPromise = fetch('/api/youtube-config', {headers:{Accept:'application/json'}})
      .then(response => response.ok ? response.json() : {enabled:false})
      .catch(() => ({enabled:false}));
    return configPromise;
  }

  function loadGIS() {
    if (root.google?.accounts?.oauth2) return Promise.resolve();
    if (gisPromise) return gisPromise;
    gisPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-msh-google-identity]');
      if (existing) {
        existing.addEventListener('load', resolve, {once:true});
        existing.addEventListener('error', reject, {once:true});
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.mshGoogleIdentity = '';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Google sign-in could not be loaded.'));
      document.head.appendChild(script);
    });
    return gisPromise;
  }

  async function requestToken() {
    const cfg = await config();
    if (!cfg.enabled || !cfg.clientId) throw new Error('YouTube account connection still needs the Google OAuth client ID configured for MSH.');
    await loadGIS();
    return new Promise((resolve, reject) => {
      tokenClient = root.google.accounts.oauth2.initTokenClient({
        client_id: cfg.clientId,
        scope: cfg.scope || SCOPE,
        callback: response => {
          if (response.error) return reject(new Error(response.error_description || 'YouTube authorization was not completed.'));
          accessToken = response.access_token || '';
          if (!accessToken) return reject(new Error('YouTube did not return an access token.'));
          resolve(accessToken);
        },
        error_callback: () => reject(new Error('YouTube authorization was closed or could not be completed.'))
      });
      tokenClient.requestAccessToken({prompt:'consent'});
    });
  }

  async function youtube(path, params) {
    if (!accessToken) throw new Error('Connect your YouTube account first.');
    const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
    Object.entries(params || {}).forEach(([key,value]) => value != null && url.searchParams.set(key, String(value)));
    const response = await fetch(url.toString(), {headers:{Authorization:`Bearer ${accessToken}`,Accept:'application/json'}});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || 'YouTube data could not be loaded.');
    return data;
  }

  async function accountPlaylists() {
    const playlists = [];
    let pageToken = '';
    do {
      const data = await youtube('playlists', {part:'snippet,contentDetails,status',mine:'true',maxResults:50,pageToken:pageToken || undefined});
      playlists.push(...(data.items || []).map(item => ({
        id:item.id,
        title:item.snippet?.title || 'Untitled playlist',
        description:item.snippet?.description || '',
        thumbnail:item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
        count:item.contentDetails?.itemCount || 0,
        privacy:item.status?.privacyStatus || ''
      })));
      pageToken = data.nextPageToken || '';
    } while (pageToken && playlists.length < 200);
    return playlists;
  }

  async function playlistVideos(playlistId) {
    const items = [];
    let pageToken = '';
    do {
      const data = await youtube('playlistItems', {part:'snippet,contentDetails',playlistId,maxResults:50,pageToken:pageToken || undefined});
      items.push(...(data.items || []));
      pageToken = data.nextPageToken || '';
    } while (pageToken && items.length < 500);

    const ids = items.map(item => item.contentDetails?.videoId).filter(Boolean);
    const detailById = {};
    for (let index = 0; index < ids.length; index += 50) {
      const data = await youtube('videos', {part:'snippet,contentDetails,status',id:ids.slice(index,index+50).join(','),maxResults:50});
      (data.items || []).forEach(item => { detailById[item.id] = item; });
    }

    return items.map((item,index) => {
      const videoId = item.contentDetails?.videoId;
      const detail = detailById[videoId] || {};
      const snippet = detail.snippet || item.snippet || {};
      return {
        videoId,
        title:snippet.title || 'YouTube workout',
        thumbnailUrl:snippet.thumbnails?.medium?.url || snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        youtubeUrl:`https://www.youtube.com/watch?v=${videoId}`,
        durationMinutes:parseDuration(detail.contentDetails?.duration),
        position:Number(item.snippet?.position ?? index),
        focusTags:focusTags(snippet.title),
        privacyStatus:detail.status?.privacyStatus || ''
      };
    }).filter(video => video.videoId);
  }

  function savePlaylist(playlist, videos) {
    if (!root.MSHStorage) return;
    root.MSHStorage.updateState(state => {
      state.settings ||= {};
      state.settings.memory ||= {};
      state.settings.memory[STORAGE_KEY] = {
        playlistId:playlist.id,
        title:playlist.title,
        url:`https://www.youtube.com/playlist?list=${playlist.id}`,
        source:'youtube_oauth',
        limited:false,
        note:`Connected from your YouTube account · ${playlist.privacy || 'playlist'}`,
        videos:videos.slice(0,500),
        connectedAt:new Date().toISOString()
      };
      return state;
    });
  }

  function modal() { return document.querySelector('.msh-youtube-modal .msh-youtube-card'); }

  function accountPanelMarkup(playlists) {
    return `<section data-youtube-account-panel style="margin-top:18px;padding-top:18px;border-top:1px solid var(--msh-border,rgba(23,61,43,.14))">
      <p class="msh-eyebrow">Your YouTube account</p>
      <h3 style="margin:.25rem 0 1rem;font:400 26px Georgia,serif">Choose a fitness playlist</h3>
      <div class="msh-youtube-results">${playlists.map(item => `<button type="button" class="msh-youtube-result" data-youtube-account-playlist="${esc(item.id)}"><span style="display:block;min-width:0"><strong>${esc(item.title)}</strong><small>${esc(item.count)} videos · ${esc(item.privacy || 'playlist')}</small></span></button>`).join('')}</div>
      ${playlists.length ? '' : '<p>No YouTube playlists were found in this account.</p>'}
      <p data-youtube-account-status role="status" aria-live="polite"></p>
    </section>`;
  }

  async function openAccountPicker(button) {
    const host = modal();
    if (!host) return;
    button.disabled = true;
    button.textContent = 'Connecting…';
    try {
      await requestToken();
      const playlists = await accountPlaylists();
      host.querySelector('[data-youtube-account-panel]')?.remove();
      host.insertAdjacentHTML('beforeend', accountPanelMarkup(playlists));
    } catch (error) {
      const status = host.querySelector('[data-youtube-status]');
      if (status) status.textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = 'Connect YouTube account';
    }
  }

  async function choosePlaylist(button) {
    const host = modal();
    const status = host?.querySelector('[data-youtube-account-status]');
    button.disabled = true;
    if (status) status.textContent = 'Loading workouts from this playlist…';
    try {
      const playlists = await accountPlaylists();
      const selected = playlists.find(item => item.id === button.dataset.youtubeAccountPlaylist);
      if (!selected) throw new Error('That playlist could not be found.');
      const videos = await playlistVideos(selected.id);
      if (!videos.length) throw new Error('No playable videos were found in that playlist.');
      savePlaylist(selected, videos);
      root.MSHYouTubeMovement?.openPlanner(false);
    } catch (error) {
      if (status) status.textContent = error.message;
      button.disabled = false;
    }
  }

  async function enhancePlanner() {
    const host = modal();
    if (!host || host.querySelector('[data-youtube-account-connect]')) return;
    const connectForm = host.querySelector('[data-youtube-connect-form]');
    if (!connectForm) return;
    const cfg = await config();
    const actions = connectForm.querySelector('.msh-card-actions');
    if (!actions) return;
    const accountButton = document.createElement('button');
    accountButton.type = 'button';
    accountButton.className = 'msh-button-secondary';
    accountButton.dataset.youtubeAccountConnect = '';
    accountButton.textContent = 'Connect YouTube account';
    accountButton.disabled = !cfg.enabled;
    if (!cfg.enabled) accountButton.title = 'Google OAuth client ID needs to be configured for MSH first.';
    actions.appendChild(accountButton);
    const hint = document.createElement('p');
    hint.innerHTML = cfg.enabled
      ? '<small>Use Google sign-in for private playlists. MSH requests read-only YouTube access and does not store the access token.</small>'
      : '<small>Private playlist sign-in is coded, but the Google OAuth client ID still needs to be added to the MSH deployment.</small>';
    actions.insertAdjacentElement('afterend', hint);
  }

  document.addEventListener('click', event => {
    const connect = event.target.closest('[data-youtube-account-connect]');
    if (connect) { event.preventDefault(); openAccountPicker(connect); return; }
    const choice = event.target.closest('[data-youtube-account-playlist]');
    if (choice) { event.preventDefault(); choosePlaylist(choice); }
  });

  const observer = new MutationObserver(() => enhancePlanner());
  observer.observe(document.body, {childList:true, subtree:true});
  enhancePlanner();

  root.MSHYouTubeAccount = Object.freeze({requestToken,accountPlaylists,playlistVideos});
})(typeof window !== 'undefined' ? window : globalThis);
