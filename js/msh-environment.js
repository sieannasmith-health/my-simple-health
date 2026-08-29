/* My Simple Health — environmental daypart runtime */
(function (root) {
  'use strict';
  const DAYPARTS = Object.freeze({
    morning: { id:'morning', greeting:'Good morning', label:'Morning' },
    afternoon: { id:'afternoon', greeting:'Good afternoon', label:'Afternoon' },
    evening: { id:'evening', greeting:'Good evening', label:'Evening' },
    night: { id:'night', greeting:'Good evening', label:'Nighttime' }
  });

  const PHASES = Object.freeze([
    { id:'pre-dawn', start:5, end:6.5, ambience:'morning' },
    { id:'morning', start:6.5, end:11.5, ambience:'morning' },
    { id:'afternoon', start:11.5, end:16.5, ambience:'day' },
    { id:'golden-hour', start:16.5, end:18.5, ambience:'day' },
    { id:'sundown', start:18.5, end:20, ambience:'evening' },
    { id:'evening', start:20, end:21.5, ambience:'evening' },
    { id:'night', start:21.5, end:29, ambience:'night' }
  ].map(phase => Object.freeze(phase)));

  /*
   * One place, photographed at four anchor times. The runtime only requests the
   * one or two neighboring scenes needed for the current crossfade. The legacy
   * plate remains a temporary fallback until the approved matched set exists.
   */
  const SCENES = Object.freeze({
    morning:Object.freeze({ id:'morning', src:'assets/environment/msh-world-morning.webp' }),
    afternoon:Object.freeze({ id:'afternoon', src:'assets/environment/msh-world-afternoon.webp' }),
    sundown:Object.freeze({ id:'sundown', src:'assets/environment/msh-world-sundown.webp' }),
    night:Object.freeze({ id:'night', src:'assets/environment/msh-world-night.webp' })
  });
  const LEGACY_SCENE = 'assets/images/environment/my-health-world-v1.jpg';
  const loadedScenes = new Map();

  function clamp(value) { return Math.max(0,Math.min(1,value)); }
  function blend(from,to,progress) {
    const amount = clamp(progress);
    return Object.freeze([
      Object.freeze({ id:from, src:SCENES[from].src, opacity:1 - amount }),
      Object.freeze({ id:to, src:SCENES[to].src, opacity:amount })
    ]);
  }

  /* Linear opacity windows preserve the approved reference mixes exactly. */
  function resolveScenery(hour) {
    const value = ((Number(hour) % 24) + 24) % 24;
    let layers;
    if (value < 5) layers = [Object.freeze({ id:'night', src:SCENES.night.src, opacity:1 })];
    else if (value < 7) layers = blend('night','morning',(value - 5) / 2);
    else if (value < 7.7) layers = [Object.freeze({ id:'morning', src:SCENES.morning.src, opacity:1 })];
    else if (value < 9.7) layers = blend('morning','afternoon',(value - 7.7) / 2);
    else if (value < 15.75) layers = [Object.freeze({ id:'afternoon', src:SCENES.afternoon.src, opacity:1 })];
    else if (value < 19 + 1 / 12) layers = blend('afternoon','sundown',(value - 15.75) / (3 + 1 / 3));
    else if (value < 19.4375) layers = [Object.freeze({ id:'sundown', src:SCENES.sundown.src, opacity:1 })];
    else if (value < 20.6875) layers = blend('sundown','night',(value - 19.4375) / 1.25);
    else layers = [Object.freeze({ id:'night', src:SCENES.night.src, opacity:1 })];
    const visible = layers.filter(layer => layer.opacity > .001);
    return Object.freeze({
      layers:Object.freeze(visible),
      primary:visible.reduce((best,layer) => !best || layer.opacity > best.opacity ? layer : best,null).id
    });
  }

  /* One photographed world, graded continuously between environmental anchors. */
  const LIGHT_ANCHORS = Object.freeze([
    { hour:0, light:.04, warmth:.04, haze:.12, glass:.72, sun:0, moon:.88, stars:.82, tempo:.72 },
    { hour:5, light:.08, warmth:.18, haze:.44, glass:.7, sun:0, moon:.45, stars:.4, tempo:.82 },
    { hour:6.5, light:.58, warmth:.72, haze:.72, glass:.61, sun:.36, moon:.12, stars:0, tempo:.96 },
    { hour:10, light:.94, warmth:.22, haze:.34, glass:.5, sun:.82, moon:0, stars:0, tempo:1 },
    { hour:13.5, light:1, warmth:.08, haze:.18, glass:.46, sun:1, moon:0, stars:0, tempo:1 },
    { hour:16.5, light:.9, warmth:.38, haze:.22, glass:.5, sun:.78, moon:0, stars:0, tempo:.98 },
    { hour:18.5, light:.58, warmth:.9, haze:.34, glass:.58, sun:.38, moon:.08, stars:0, tempo:.9 },
    { hour:20, light:.26, warmth:.44, haze:.28, glass:.66, sun:0, moon:.38, stars:.16, tempo:.82 },
    { hour:21.5, light:.1, warmth:.18, haze:.2, glass:.7, sun:0, moon:.68, stars:.58, tempo:.74 },
    { hour:24, light:.04, warmth:.04, haze:.12, glass:.72, sun:0, moon:.88, stars:.82, tempo:.72 }
  ]);

  function interpolate(hour) {
    const upperIndex = Math.max(1,LIGHT_ANCHORS.findIndex(anchor => hour <= anchor.hour));
    const before = LIGHT_ANCHORS[upperIndex - 1];
    const after = LIGHT_ANCHORS[upperIndex];
    const ratio = Math.max(0,Math.min(1,(hour - before.hour) / (after.hour - before.hour || 1)));
    const between = key => before[key] + (after[key] - before[key]) * ratio;
    return { light:between('light'), warmth:between('warmth'), haze:between('haze'), glass:between('glass'), sun:between('sun'), moon:between('moon'), stars:between('stars'), tempo:between('tempo') };
  }

  function resolvePhase(hour) {
    const phaseHour = hour < 5 ? hour + 24 : hour;
    const phase = PHASES.find(item => phaseHour >= item.start && phaseHour < item.end) || PHASES[PHASES.length - 1];
    return { ...phase, progress:Math.max(0,Math.min(1,(phaseHour - phase.start) / (phase.end - phase.start || 1))) };
  }

  function resolve(input) {
    const date = input instanceof Date ? input : new Date(input == null ? Date.now() : input);
    const hour = date.getHours() + date.getMinutes() / 60;
    const phase = resolvePhase(hour);
    let id = 'night';
    let start = 21;
    let duration = 8;
    if (hour >= 5 && hour < 12) { id = 'morning'; start = 5; duration = 7; }
    else if (hour >= 12 && hour < 17) { id = 'afternoon'; start = 12; duration = 5; }
    else if (hour >= 17 && hour < 21) { id = 'evening'; start = 17; duration = 4; }
    const elapsed = id === 'night' && hour < 5 ? hour + 3 : hour - start;
    const light = interpolate(hour);
    const scenery = resolveScenery(hour);
    const sunProgress = clamp((hour - 5) / 15);
    const moonProgress = clamp(hour < 5 ? (hour + 2.5) / 10 : (hour - 18.5) / 10);
    return {
      ...DAYPARTS[id],
      localTime:date.toISOString(),
      hour,
      phase:phase.id,
      progress:phase.progress,
      daylight:light.light,
      warmth:light.warmth,
      haze:light.haze,
      glass:light.glass,
      light:light.light,
      scenery,
      sun:{ visibility:light.sun, progress:sunProgress, x:.1 + sunProgress * .78, y:.7 - Math.sin(Math.PI * sunProgress) * .5 },
      moon:{ visibility:light.moon, progress:moonProgress, x:.58 + moonProgress * .32, y:.25 - Math.sin(Math.PI * moonProgress) * .1 },
      stars:{ visibility:light.stars },
      motionTempo:light.tempo,
      ambience:{ suggested:phase.ambience }
    };
  }

  function apply(input) {
    const state = resolve(input);
    const element = root.document && root.document.documentElement;
    if (element) {
      element.dataset.daypart = state.id;
      element.dataset.environmentPhase = state.phase;
      element.dataset.environmentScene = state.scenery.primary;
      element.style.setProperty('--msh-daypart-progress',state.progress.toFixed(3));
      element.style.setProperty('--msh-environment-light',state.light.toFixed(3));
      element.style.setProperty('--msh-environment-warmth',state.warmth.toFixed(3));
      element.style.setProperty('--msh-environment-haze',state.haze.toFixed(3));
      element.style.setProperty('--msh-glass-opacity',state.glass.toFixed(3));
      element.style.setProperty('--msh-sun-visibility',state.sun.visibility.toFixed(3));
      element.style.setProperty('--msh-sun-progress',state.sun.progress.toFixed(3));
      element.style.setProperty('--msh-sun-x',`${(state.sun.x * 100).toFixed(2)}%`);
      element.style.setProperty('--msh-sun-y',`${(state.sun.y * 100).toFixed(2)}%`);
      element.style.setProperty('--msh-moon-visibility',state.moon.visibility.toFixed(3));
      element.style.setProperty('--msh-moon-progress',state.moon.progress.toFixed(3));
      element.style.setProperty('--msh-moon-x',`${(state.moon.x * 100).toFixed(2)}%`);
      element.style.setProperty('--msh-moon-y',`${(state.moon.y * 100).toFixed(2)}%`);
      element.style.setProperty('--msh-stars-visibility',state.stars.visibility.toFixed(3));
      element.style.setProperty('--msh-motion-tempo',state.motionTempo.toFixed(3));
    }
    return state;
  }

  function loadScene(scene) {
    if (loadedScenes.has(scene.id)) return loadedScenes.get(scene.id);
    if (typeof root.Image !== 'function') return Promise.resolve({ url:scene.src, fallback:false });
    const load = url => new Promise((resolve,reject) => {
      const image = new root.Image();
      image.decoding = 'async';
      image.onload = () => resolve(url);
      image.onerror = reject;
      image.src = url;
    });
    const request = load(scene.src)
      .then(url => ({ url, fallback:false }))
      .catch(() => load(LEGACY_SCENE).then(url => ({ url, fallback:true })))
      .catch(() => ({ url:'', fallback:true }));
    loadedScenes.set(scene.id,request);
    return request;
  }

  function ensureArtwork(environment) {
    const before = environment.querySelector('.msh-home-atmosphere');
    let first = environment.querySelector('[data-msh-scene-layer="a"]') || environment.querySelector('.msh-home-cinematic');
    if (!first) {
      first = root.document.createElement('span');
      environment.insertBefore(first,before || environment.firstChild);
    }
    first.classList.add('msh-home-cinematic','msh-home-scene');
    first.dataset.mshSceneLayer = 'a';
    let second = environment.querySelector('[data-msh-scene-layer="b"]');
    if (!second) {
      second = root.document.createElement('span');
      second.className = 'msh-home-scene';
      second.dataset.mshSceneLayer = 'b';
      environment.insertBefore(second,before || first.nextSibling);
    }
    const additions = [
      ['msh-environment-daylight','mshEnvironmentDaylight'],
      ['msh-environment-sun','mshEnvironmentSun'],
      ['msh-environment-moon','mshEnvironmentMoon']
    ];
    for (const [className,dataName] of additions) {
      if (environment.querySelector(`.${className}`)) continue;
      const layer = root.document.createElement('span');
      layer.className = className;
      layer.dataset[dataName] = '';
      environment.appendChild(layer);
    }
    if (!environment.querySelector('.msh-sensory-constellation')) {
      const stars = root.document.createElement('span');
      stars.className = 'msh-sensory-constellation';
      environment.appendChild(stars);
    }
    environment.dataset.mshEnvironmentArtwork = '';
    return [first,second];
  }

  function setSceneLayer(layer,scene) {
    layer.style.setProperty('--msh-scene-opacity',scene ? scene.opacity.toFixed(3) : '0');
    if (!scene) {
      layer.classList.remove('is-ready');
      layer.removeAttribute('data-environment-scene');
      return Promise.resolve();
    }
    if (layer.dataset.environmentScene === scene.id && layer.dataset.sceneReady === 'true') {
      return Promise.resolve();
    }
    layer.dataset.requestedScene = scene.id;
    layer.dataset.sceneReady = 'false';
    layer.classList.remove('is-ready');
    return loadScene(scene).then(asset => {
      if (layer.dataset.requestedScene !== scene.id) return;
      layer.style.backgroundImage = asset.url ? `url("${asset.url}")` : 'none';
      layer.dataset.environmentScene = scene.id;
      layer.dataset.environmentAsset = asset.fallback ? 'fallback' : 'anchor';
      layer.dataset.sceneReady = 'true';
      const reveal = () => layer.classList.add('is-ready');
      if (typeof root.requestAnimationFrame === 'function') root.requestAnimationFrame(reveal);
      else reveal();
    });
  }

  function updateArtwork(state) {
    if (!root.document || !root.document.querySelectorAll) return Promise.resolve([]);
    const environments = [...root.document.querySelectorAll('.msh-home-environment')];
    return Promise.all(environments.map(environment => {
      const layers = ensureArtwork(environment);
      const requested = state.scenery.layers;
      const existing = new Map(layers.map(layer => [layer.dataset.environmentScene,layer]));
      const assigned = new Set();
      const placements = requested.map(scene => {
        const reused = existing.get(scene.id);
        const layer = reused && !assigned.has(reused) ? reused : layers.find(item => !assigned.has(item));
        assigned.add(layer);
        return [layer,scene];
      });
      for (const layer of layers) if (!assigned.has(layer)) placements.push([layer,null]);
      return Promise.all(placements.map(([layer,scene]) => setSceneLayer(layer,scene))).then(() => {
        const active = layers.filter(layer => Number(layer.style.getPropertyValue('--msh-scene-opacity')) > .001);
        const fallback = active.some(layer => layer.dataset.environmentAsset === 'fallback');
        /* Two missing anchors resolve to the same legacy plate; show it once rather than creating a doubled/ghosted landscape. */
        if (active.length > 1 && active.every(layer => layer.dataset.environmentAsset === 'fallback')) {
          active[0].style.setProperty('--msh-scene-opacity','1');
          for (const layer of active.slice(1)) layer.style.setProperty('--msh-scene-opacity','0');
        }
        environment.dataset.environmentAsset = fallback ? 'fallback' : 'anchor';
        environment.dataset.environmentScenes = requested.map(scene => `${scene.id}:${scene.opacity.toFixed(3)}`).join(',');
      });
    }));
  }

  function mountArtwork() { return updateArtwork(current); }

  function localPreviewTime(input) {
    if (input != null || !root.location) return input;
    if (!/^(?:localhost|127\.0\.0\.1|\[::1\])$/.test(root.location.hostname || '')) return input;
    const value = new root.URLSearchParams(root.location.search).get('environmentTime');
    const match = value && value.match(/^(\d{1,2}):([0-5]\d)$/);
    if (!match || Number(match[1]) > 23) return input;
    const date = new Date();
    date.setHours(Number(match[1]),Number(match[2]),0,0);
    return date;
  }

  let current = apply(localPreviewTime());
  function refresh(input) {
    const previous = current;
    current = apply(localPreviewTime(input));
    if (root.document && typeof root.CustomEvent === 'function') root.document.dispatchEvent(new root.CustomEvent('msh:environment-change',{ detail:{ current, previous } }));
    return current;
  }
  function getCurrent() { return current; }

  function mountNorthStar() {
    if (!root.document || !root.matchMedia) return;
    const finePointer = root.matchMedia('(pointer: fine)').matches;
    const reduced = root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!finePointer || reduced || root.document.querySelector('[data-msh-north-star]')) return;
    const star = root.document.createElement('span');
    star.className = 'msh-north-star';
    star.dataset.mshNorthStar = '';
    star.setAttribute('aria-hidden','true');
    root.document.body.appendChild(star);
    let targetX = root.innerWidth / 2;
    let targetY = root.innerHeight / 2;
    let x = targetX;
    let y = targetY;
    let frame = 0;
    const draw = () => {
      x += (targetX - x) * .16;
      y += (targetY - y) * .16;
      star.style.transform = `translate3d(${x}px,${y}px,0)`;
      if (Math.abs(targetX - x) > .1 || Math.abs(targetY - y) > .1) frame = root.requestAnimationFrame(draw);
      else frame = 0;
    };
    root.document.addEventListener('pointermove',event => {
      targetX = event.clientX;
      targetY = event.clientY;
      star.classList.add('is-visible');
      if (!frame) frame = root.requestAnimationFrame(draw);
    },{ passive:true });
    root.document.addEventListener('pointerover',event => star.classList.toggle('is-active',Boolean(event.target.closest('a,button,input,textarea,summary'))));
  }
  if (root.document) {
    root.document.addEventListener('DOMContentLoaded',() => {
      mountNorthStar();
      /* Dashboard/activity renderers also settle on DOMContentLoaded. Mount after them. */
      if (typeof root.requestAnimationFrame === 'function') root.requestAnimationFrame(mountArtwork);
      else mountArtwork();
    },{ once:true });
    root.document.addEventListener('msh:environment-change',event => updateArtwork(event.detail.current));
    root.document.addEventListener('visibilitychange',() => { if (!root.document.hidden) { refresh(); mountNorthStar(); } });
    root.setInterval(refresh,60 * 1000);
  }
  root.MSHEnvironment = Object.freeze({ DAYPARTS, PHASES, LIGHT_ANCHORS, SCENES, LEGACY_SCENE, resolveScenery, resolve, apply, refresh, getCurrent, mountArtwork, updateArtwork, mountNorthStar });
})(typeof window !== 'undefined' ? window : globalThis);
