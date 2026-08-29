/* My Simple Health — environmental daypart runtime */
(function (root) {
  'use strict';
  const DAYPARTS = Object.freeze({
    morning: { id:'morning', greeting:'Good morning', label:'Morning' },
    afternoon: { id:'afternoon', greeting:'Good afternoon', label:'Afternoon' },
    evening: { id:'evening', greeting:'Good evening', label:'Evening' },
    night: { id:'night', greeting:'Good evening', label:'Nighttime' }
  });

  /* One photographed world, graded continuously between environmental anchors. */
  const LIGHT_ANCHORS = Object.freeze([
    { hour:0, light:.04, warmth:.04, haze:.12, glass:.72 },
    { hour:5, light:.08, warmth:.18, haze:.44, glass:.7 },
    { hour:7.5, light:.72, warmth:.82, haze:.72, glass:.58 },
    { hour:10, light:.94, warmth:.22, haze:.34, glass:.5 },
    { hour:13.5, light:1, warmth:.08, haze:.18, glass:.46 },
    { hour:16.5, light:.9, warmth:.38, haze:.22, glass:.5 },
    { hour:18.5, light:.58, warmth:.9, haze:.34, glass:.58 },
    { hour:21, light:.1, warmth:.18, haze:.2, glass:.7 },
    { hour:24, light:.04, warmth:.04, haze:.12, glass:.72 }
  ]);

  function interpolate(hour) {
    const upperIndex = Math.max(1,LIGHT_ANCHORS.findIndex(anchor => hour <= anchor.hour));
    const before = LIGHT_ANCHORS[upperIndex - 1];
    const after = LIGHT_ANCHORS[upperIndex];
    const ratio = Math.max(0,Math.min(1,(hour - before.hour) / (after.hour - before.hour || 1)));
    const between = key => before[key] + (after[key] - before[key]) * ratio;
    return { light:between('light'), warmth:between('warmth'), haze:between('haze'), glass:between('glass') };
  }

  function resolve(input) {
    const date = input instanceof Date ? input : new Date(input == null ? Date.now() : input);
    const hour = date.getHours() + date.getMinutes() / 60;
    let id = 'night';
    let start = 21;
    let duration = 8;
    if (hour >= 5 && hour < 12) { id = 'morning'; start = 5; duration = 7; }
    else if (hour >= 12 && hour < 17) { id = 'afternoon'; start = 12; duration = 5; }
    else if (hour >= 17 && hour < 21) { id = 'evening'; start = 17; duration = 4; }
    const elapsed = id === 'night' && hour < 5 ? hour + 3 : hour - start;
    return { ...DAYPARTS[id], hour, progress:Math.max(0,Math.min(1,elapsed / duration)), ...interpolate(hour) };
  }

  function apply(input) {
    const state = resolve(input);
    const element = root.document && root.document.documentElement;
    if (element) {
      element.dataset.daypart = state.id;
      element.style.setProperty('--msh-daypart-progress',state.progress.toFixed(3));
      element.style.setProperty('--msh-environment-light',state.light.toFixed(3));
      element.style.setProperty('--msh-environment-warmth',state.warmth.toFixed(3));
      element.style.setProperty('--msh-environment-haze',state.haze.toFixed(3));
      element.style.setProperty('--msh-glass-opacity',state.glass.toFixed(3));
    }
    return state;
  }

  let current = apply();
  function refresh() { current = apply(); return current; }
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
    root.document.addEventListener('DOMContentLoaded',mountNorthStar,{ once:true });
    root.document.addEventListener('visibilitychange',() => { if (!root.document.hidden) { refresh(); mountNorthStar(); } });
    root.setInterval(refresh,60 * 1000);
  }
  root.MSHEnvironment = Object.freeze({ DAYPARTS, resolve, apply, refresh, getCurrent, mountNorthStar });
})(typeof window !== 'undefined' ? window : globalThis);
