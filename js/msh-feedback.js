/* My Simple Health — semantic interaction feedback, haptic-ready without fake haptics */
(function (root) {
  'use strict';
  const EVENTS = Object.freeze(['touch','select','settle','record','reveal','return','attention','error']);
  const ACCENT_KEY = 'msh_personal_accent_v1';
  const isHex = value => /^#[0-9a-f]{6}$/i.test(String(value || ''));

  function applyAccent(value) {
    const accent=isHex(value)?String(value).toLowerCase():null;
    const element=root.document && root.document.documentElement;
    if(element){if(accent)element.style.setProperty('--msh-personal-accent',accent);else element.style.removeProperty('--msh-personal-accent');}
    return accent;
  }
  function getAccent(){try{return applyAccent(root.localStorage.getItem(ACCENT_KEY));}catch(_){return null;}}
  function setAccent(value){const accent=isHex(value)?String(value).toLowerCase():null;try{if(accent)root.localStorage.setItem(ACCENT_KEY,accent);else root.localStorage.removeItem(ACCENT_KEY);}catch(_){}return applyAccent(accent);}

  function emit(type, detail) {
    if (!EVENTS.includes(type)) return false;
    const payload = { type, at:new Date().toISOString(), ...(detail && typeof detail === 'object' ? detail : {}) };
    if (root.document && typeof root.CustomEvent === 'function') {
      root.document.dispatchEvent(new root.CustomEvent(`msh:${type}`, { detail:payload }));
      const target = root.Element && detail && detail.target instanceof root.Element ? detail.target : null;
      if (target) {
        target.dataset.mshFeedback = type;
        root.setTimeout(() => { if (target.dataset.mshFeedback === type) delete target.dataset.mshFeedback; }, 420);
      }
    }
    return payload;
  }

  function bind() {
    if (!root.document || root.document.documentElement.dataset.mshFeedbackBound) return;
    root.document.documentElement.dataset.mshFeedbackBound = 'true';
    getAccent();
    root.document.addEventListener('pointerdown', event => {
      const target = event.target.closest('button,a,[role="button"],[data-msh-interaction]');
      if (target) emit('touch',{ source:target.dataset.mshInteraction || target.tagName.toLowerCase(), target });
    },{ passive:true });
    root.document.addEventListener('change', event => {
      const target = event.target.closest('input,select,textarea');
      if (target) emit('select',{ source:target.name || target.id || 'control', target });
    });
  }

  if (root.document) root.document.addEventListener('DOMContentLoaded',bind,{ once:true });
  root.MSHFeedback = Object.freeze({ EVENTS, ACCENT_KEY, emit, bind, getAccent, setAccent });
})(typeof window !== 'undefined' ? window : globalThis);
