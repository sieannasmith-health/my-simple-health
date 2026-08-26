/* My Simple Health — environmental daypart runtime */
(function (root) {
  'use strict';
  const DAYPARTS = Object.freeze({
    dawn: { id:'dawn', greeting:'Good morning', label:'Dawn' },
    morning: { id:'morning', greeting:'Good morning', label:'Morning' },
    day: { id:'day', greeting:'Good afternoon', label:'Daytime' },
    golden: { id:'golden', greeting:'Good afternoon', label:'Golden hour' },
    evening: { id:'evening', greeting:'Good evening', label:'Evening' },
    night: { id:'night', greeting:'Good evening', label:'Nighttime' }
  });

  function resolve(input) {
    const date = input instanceof Date ? input : new Date(input == null ? Date.now() : input);
    const hour = date.getHours() + date.getMinutes() / 60;
    let id = 'night';
    let start = 21;
    let duration = 8;
    if (hour >= 5 && hour < 7) { id = 'dawn'; start = 5; duration = 2; }
    else if (hour >= 7 && hour < 11) { id = 'morning'; start = 7; duration = 4; }
    else if (hour >= 11 && hour < 16) { id = 'day'; start = 11; duration = 5; }
    else if (hour >= 16 && hour < 18) { id = 'golden'; start = 16; duration = 2; }
    else if (hour >= 18 && hour < 21) { id = 'evening'; start = 18; duration = 3; }
    const elapsed = id === 'night' && hour < 5 ? hour + 3 : hour - start;
    return { ...DAYPARTS[id], hour, progress:Math.max(0,Math.min(1,elapsed / duration)) };
  }

  function apply(input) {
    const state = resolve(input);
    const element = root.document && root.document.documentElement;
    if (element) {
      element.dataset.daypart = state.id;
      element.style.setProperty('--msh-daypart-progress',state.progress.toFixed(3));
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
