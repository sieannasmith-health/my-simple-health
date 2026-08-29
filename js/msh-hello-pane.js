/* My Simple Health — universal Hello interaction surface */
(function (root) {
  'use strict';

  const STATE_KEY = 'msh_hello_surface_state';
  const WIDTH_KEY = 'msh_hello_pane_width';
  const STATES = Object.freeze({ DOCKED:'docked', PANE:'pane', FULL:'full' });
  const MIN_WIDTH = 400;
  const DEFAULT_WIDTH = 460;
  const MAX_WIDTH = 620;
  const MOBILE_BREAKPOINT = 760;

  let elements = null;
  let state = STATES.DOCKED;
  let previousFocus = null;

  function isMobile() {
    return root.matchMedia && root.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
  }

  function normalizeState(value) {
    return Object.values(STATES).includes(value) ? value : STATES.DOCKED;
  }

  function paneBounds(viewportWidth) {
    const available = Math.max(0, Number(viewportWidth) || 0);
    return {
      min: Math.min(MIN_WIDTH, Math.max(320, available - 48)),
      max: Math.max(320, Math.min(MAX_WIDTH, available * 0.48))
    };
  }

  function clampWidth(value, viewportWidth) {
    const bounds = paneBounds(viewportWidth);
    return Math.round(Math.min(bounds.max, Math.max(bounds.min, Number(value) || DEFAULT_WIDTH)));
  }

  function savedWidth() {
    try { return clampWidth(root.localStorage.getItem(WIDTH_KEY), root.innerWidth); }
    catch (_) { return clampWidth(DEFAULT_WIDTH, root.innerWidth); }
  }

  function saveState(next) {
    try { root.sessionStorage.setItem(STATE_KEY, next); }
    catch (_) {}
  }

  function restoredState() {
    try { return normalizeState(root.sessionStorage.getItem(STATE_KEY)); }
    catch (_) { return STATES.DOCKED; }
  }

  function applyWidth(width) {
    const next = clampWidth(width, root.innerWidth);
    root.document.documentElement.style.setProperty('--msh-hello-pane-width', `${next}px`);
    try { root.localStorage.setItem(WIDTH_KEY, String(next)); }
    catch (_) {}
    return next;
  }

  function setBackgroundInert(inert) {
    const candidates = root.document.querySelectorAll('body > :not([data-msh-hello-surface])');
    candidates.forEach(element => {
      if (inert) element.setAttribute('inert', '');
      else element.removeAttribute('inert');
    });
  }

  function syncLaunchers() {
    root.document.querySelectorAll('[data-msh-hello-open]').forEach(button => {
      button.setAttribute('aria-expanded', String(state !== STATES.DOCKED));
      button.setAttribute('aria-controls', 'mshHelloSurface');
      button.classList.toggle('is-active', state !== STATES.DOCKED);
    });
  }

  function focusFirstControl() {
    if (!elements) return;
    const target = state === STATES.FULL ? elements.restore : elements.expand;
    if (target) target.focus({ preventScroll:true });
  }

  function setState(next, options) {
    if (!elements) return STATES.DOCKED;
    const requested = normalizeState(next);
    previousFocus = state === STATES.DOCKED && requested !== STATES.DOCKED
      ? root.document.activeElement
      : previousFocus;
    state = requested;
    saveState(state);
    elements.root.dataset.state = state;
    elements.root.dataset.mobile = String(isMobile());
    elements.surface.hidden = state === STATES.DOCKED;
    elements.surface.setAttribute('aria-modal', String(state === STATES.FULL));
    elements.expand.hidden = state === STATES.FULL;
    elements.restore.hidden = state !== STATES.FULL;
    root.document.documentElement.classList.toggle('msh-hello-pane-open', state === STATES.PANE && !isMobile());
    root.document.documentElement.classList.toggle('msh-hello-full-open', state === STATES.FULL);
    setBackgroundInert(state === STATES.FULL);
    syncLaunchers();
    if (state !== STATES.DOCKED && options && options.focus) focusFirstControl();
    if (state === STATES.DOCKED && previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus({ preventScroll:true });
      previousFocus = null;
    }
    return state;
  }

  function openPane() { return setState(STATES.PANE, { focus:true }); }
  function expand() { return setState(STATES.FULL, { focus:true }); }
  function restore() { return setState(STATES.PANE, { focus:true }); }
  function dock() { return setState(STATES.DOCKED); }

  function beginResize(event) {
    if (isMobile() || state !== STATES.PANE || event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    elements.root.classList.add('is-resizing');
  }

  function resize(event) {
    if (!elements || !elements.root.classList.contains('is-resizing')) return;
    applyWidth(root.innerWidth - event.clientX);
  }

  function endResize(event) {
    if (!elements || !elements.root.classList.contains('is-resizing')) return;
    elements.root.classList.remove('is-resizing');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function resizeByKeyboard(event) {
    if (isMobile() || state !== STATES.PANE || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = parseInt(root.getComputedStyle(root.document.documentElement).getPropertyValue('--msh-hello-pane-width'), 10) || savedWidth();
    const bounds = paneBounds(root.innerWidth);
    const next = event.key === 'Home' ? bounds.min
      : event.key === 'End' ? bounds.max
      : current + (event.key === 'ArrowLeft' ? 20 : -20);
    const applied = applyWidth(next);
    event.currentTarget.setAttribute('aria-valuenow', String(applied));
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && state !== STATES.DOCKED) {
      event.preventDefault();
      state === STATES.FULL ? restore() : dock();
    }
  }

  function handleViewportChange() {
    if (!elements) return;
    elements.root.dataset.mobile = String(isMobile());
    applyWidth(savedWidth());
    root.document.documentElement.classList.toggle('msh-hello-pane-open', state === STATES.PANE && !isMobile());
  }

  function template() {
    return `<div class="msh-hello-universal" id="mshHelloSurface" data-msh-hello-surface data-state="docked">
      <button class="msh-hello-dock" type="button" data-msh-hello-open aria-expanded="false" aria-controls="mshHelloSurface">
        <span class="msh-hello-dock-mark" aria-hidden="true">H</span><span>Hello</span>
      </button>
      <section class="msh-hello-surface" role="dialog" aria-label="Hello conversation" aria-modal="false" hidden>
        <div class="msh-hello-resize" role="separator" aria-label="Resize Hello pane" aria-orientation="vertical" aria-valuemin="400" aria-valuemax="620" tabindex="0"></div>
        <header class="msh-hello-pane-header">
          <div><span class="msh-hello-pane-kicker">Alongside you</span><strong>Hello</strong></div>
          <div class="msh-hello-pane-controls">
            <button type="button" data-hello-collapse aria-label="Collapse Hello">Collapse</button>
            <button type="button" data-hello-expand aria-label="Expand Hello to full screen">Expand</button>
            <button type="button" data-hello-restore aria-label="Return Hello to side pane" hidden>Pane</button>
            <button type="button" data-hello-close aria-label="Close Hello">Close</button>
          </div>
        </header>
        <iframe class="msh-hello-frame" title="Hello conversation" src="hello.html?embedded=1" allow="clipboard-write"></iframe>
      </section>
    </div>`;
  }

  function mount() {
    if (elements || !root.document || root.document.querySelector('[data-msh-hello-surface]')) return elements;
    if (new URLSearchParams(root.location.search).get('embedded') === '1' || root.document.body.dataset.mshPage === 'hello') return null;
    root.document.body.insertAdjacentHTML('beforeend', template());
    const surfaceRoot = root.document.querySelector('[data-msh-hello-surface]');
    elements = {
      root: surfaceRoot,
      surface: surfaceRoot.querySelector('.msh-hello-surface'),
      resize: surfaceRoot.querySelector('.msh-hello-resize'),
      expand: surfaceRoot.querySelector('[data-hello-expand]'),
      restore: surfaceRoot.querySelector('[data-hello-restore]')
    };
    applyWidth(savedWidth());
    surfaceRoot.querySelectorAll('[data-msh-hello-open]').forEach(button => button.addEventListener('click', openPane));
    root.document.addEventListener('click', event => {
      const launcher = event.target.closest('[data-msh-hello-open]');
      if (launcher && !surfaceRoot.contains(launcher)) openPane();
    });
    surfaceRoot.querySelector('[data-hello-collapse]').addEventListener('click', dock);
    surfaceRoot.querySelector('[data-hello-close]').addEventListener('click', dock);
    elements.expand.addEventListener('click', expand);
    elements.restore.addEventListener('click', restore);
    elements.resize.addEventListener('pointerdown', beginResize);
    elements.resize.addEventListener('pointermove', resize);
    elements.resize.addEventListener('pointerup', endResize);
    elements.resize.addEventListener('pointercancel', endResize);
    elements.resize.addEventListener('keydown', resizeByKeyboard);
    root.document.addEventListener('keydown', handleKeydown);
    root.addEventListener('resize', handleViewportChange, { passive:true });
    setState(restoredState());
    return elements;
  }

  root.MSHHelloPane = Object.freeze({ STATES, mount, setState, openPane, expand, restore, dock, clampWidth, paneBounds, getState:() => state });
})(typeof window !== 'undefined' ? window : globalThis);
