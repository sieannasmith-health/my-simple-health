/* My Simple Health — resizable universal Hello workspace */
(function (root) {
  'use strict';

  const STATE_KEY = 'msh_hello_surface_state';
  const OPEN_KEY = 'msh_hello_surface_open';
  const GEOMETRY_KEY = 'msh_hello_pane_geometry';
  const STATES = Object.freeze({ DOCKED:'docked', FLOATING:'floating', FULL:'full' });
  const SIDES = Object.freeze({ LEFT:'left', RIGHT:'right' });
  const MOBILE_BREAKPOINT = 760;
  const EDGE_GAP = 12;
  const DEFAULT_WIDTH = 460;
  const DEFAULT_HEIGHT = 720;
  const MIN_WIDTH = 400;
  const MAX_WIDTH = 720;
  const MIN_HEIGHT = 420;

  let elements = null;
  let state = STATES.DOCKED;
  let open = false;
  let dockSide = SIDES.RIGHT;
  let geometry = null;
  let previousState = STATES.DOCKED;
  let previousFocus = null;
  let interaction = null;

  function isMobile() {
    return Boolean(root.matchMedia && root.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches);
  }

  function normalizeState(value) {
    if (value === 'pane') return STATES.DOCKED;
    return Object.values(STATES).includes(value) ? value : STATES.DOCKED;
  }

  function normalizeSide(value) { return value === SIDES.LEFT ? SIDES.LEFT : SIDES.RIGHT; }

  function viewportSize(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      width:Math.max(320, Number(source.width) || Number(root.innerWidth) || 1280),
      height:Math.max(480, Number(source.height) || Number(root.innerHeight) || 800)
    };
  }

  function paneBounds(viewportWidth, mode) {
    const available = Math.max(320, Number(viewportWidth) || 0);
    const floating = mode === STATES.FLOATING;
    return {
      min:Math.min(MIN_WIDTH, Math.max(320, available - EDGE_GAP * 2)),
      max:Math.max(320, Math.min(floating ? 760 : MAX_WIDTH, available - EDGE_GAP * 2, floating ? available * .78 : available * .62))
    };
  }

  function heightBounds(viewportHeight) {
    const available = Math.max(480, Number(viewportHeight) || 0);
    return { min:Math.min(MIN_HEIGHT, available - EDGE_GAP * 2), max:Math.max(320, available - EDGE_GAP * 2) };
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
  }

  function clampWidth(value, viewportWidth, mode) {
    const bounds = paneBounds(viewportWidth, mode || STATES.DOCKED);
    return Math.round(clampNumber(value, bounds.min, bounds.max, DEFAULT_WIDTH));
  }

  function clampGeometry(value, viewport, mode) {
    const size = viewportSize(viewport);
    const source = value && typeof value === 'object' ? value : {};
    const width = clampWidth(source.width, size.width, mode || STATES.FLOATING);
    const hBounds = heightBounds(size.height);
    const height = Math.round(clampNumber(source.height, hBounds.min, hBounds.max, Math.min(DEFAULT_HEIGHT, hBounds.max)));
    const maxLeft = Math.max(EDGE_GAP, size.width - width - EDGE_GAP);
    const maxTop = Math.max(EDGE_GAP, size.height - height - EDGE_GAP);
    return {
      width,
      height,
      left:Math.round(clampNumber(source.left, EDGE_GAP, maxLeft, Math.max(EDGE_GAP, size.width - width - 28))),
      top:Math.round(clampNumber(source.top, EDGE_GAP, maxTop, Math.max(EDGE_GAP, (size.height - height) / 2))),
      side:normalizeSide(source.side)
    };
  }

  function moveGeometry(start, deltaX, viewport) {
    const source = clampGeometry(start, viewport, STATES.FLOATING);
    return clampGeometry({ ...source, left:source.left + Number(deltaX || 0) }, viewport, STATES.FLOATING);
  }

  function resizeGeometry(start, deltaX, deltaY, handle, viewport) {
    const size = viewportSize(viewport);
    const source = clampGeometry(start, size, STATES.FLOATING);
    const right = source.left + source.width;
    const bottom = source.top + source.height;
    let next = { ...source };
    if (handle === 'left' || handle === 'corner') {
      next.left = source.left + Number(deltaX || 0);
      next.width = right - next.left;
    }
    if (handle === 'top' || handle === 'corner') {
      next.top = source.top + Number(deltaY || 0);
      next.height = bottom - next.top;
    }
    next = clampGeometry(next, size, STATES.FLOATING);
    if (handle === 'left' || handle === 'corner') next.left = Math.max(EDGE_GAP, Math.min(right - next.width, size.width - next.width - EDGE_GAP));
    if (handle === 'top' || handle === 'corner') next.top = Math.max(EDGE_GAP, Math.min(bottom - next.height, size.height - next.height - EDGE_GAP));
    return clampGeometry(next, size, STATES.FLOATING);
  }

  function defaultGeometry() {
    const size = viewportSize();
    let legacyWidth = null;
    try { legacyWidth = root.localStorage.getItem('msh_hello_pane_width'); }
    catch (_) {}
    return clampGeometry({ width:legacyWidth || DEFAULT_WIDTH, height:Math.min(DEFAULT_HEIGHT, size.height - 48), side:SIDES.RIGHT }, size, STATES.FLOATING);
  }

  function readSession() {
    let storedGeometry = null;
    let rawState = null;
    try {
      rawState = root.sessionStorage.getItem(STATE_KEY);
      state = normalizeState(rawState);
      open = root.sessionStorage.getItem(OPEN_KEY) === 'true' || rawState === 'pane';
      storedGeometry = JSON.parse(root.sessionStorage.getItem(GEOMETRY_KEY) || 'null');
    } catch (_) {}
    geometry = clampGeometry(storedGeometry || defaultGeometry(), viewportSize(), STATES.FLOATING);
    dockSide = normalizeSide(geometry.side);
  }

  function persistSession() {
    try {
      root.sessionStorage.setItem(STATE_KEY, state);
      root.sessionStorage.setItem(OPEN_KEY, String(open));
      root.sessionStorage.setItem(GEOMETRY_KEY, JSON.stringify({ ...geometry, side:dockSide }));
    } catch (_) {}
  }

  function applyGeometry(next) {
    geometry = clampGeometry(next || geometry || defaultGeometry(), viewportSize(), STATES.FLOATING);
    dockSide = normalizeSide(geometry.side || dockSide);
    const style = root.document.documentElement.style;
    style.setProperty('--msh-hello-pane-width', `${geometry.width}px`);
    style.setProperty('--msh-hello-pane-height', `${geometry.height}px`);
    style.setProperty('--msh-hello-pane-left', `${geometry.left}px`);
    style.setProperty('--msh-hello-pane-top', `${geometry.top}px`);
    persistSession();
    return { ...geometry };
  }

  function setBackgroundInert(inert) {
    root.document.querySelectorAll('body > :not([data-msh-hello-surface])').forEach(element => {
      if (inert) element.setAttribute('inert', '');
      else element.removeAttribute('inert');
    });
  }

  function syncLaunchers() {
    root.document.querySelectorAll('[data-msh-hello-open]').forEach(button => {
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-controls', 'mshHelloSurface');
      button.classList.toggle('is-active', open);
    });
  }

  function syncPresentation(options) {
    if (!elements) return;
    const mobile = isMobile();
    if (mobile && state === STATES.FLOATING) state = STATES.DOCKED;
    elements.root.dataset.state = state;
    elements.root.dataset.open = String(open);
    elements.root.dataset.mobile = String(mobile);
    elements.root.dataset.side = dockSide;
    elements.surface.hidden = !open;
    elements.surface.setAttribute('aria-modal', String(open && state === STATES.FULL));
    elements.expand.hidden = state === STATES.FULL;
    elements.restore.hidden = state !== STATES.FULL;
    elements.float.hidden = state === STATES.FLOATING || mobile;
    elements.dockLeft.hidden = mobile;
    elements.dockRight.hidden = mobile;
    root.document.documentElement.classList.toggle('msh-hello-pane-open', open && state === STATES.DOCKED && !mobile);
    root.document.documentElement.classList.toggle('msh-hello-pane-left', open && state === STATES.DOCKED && dockSide === SIDES.LEFT && !mobile);
    root.document.documentElement.classList.toggle('msh-hello-full-open', open && state === STATES.FULL);
    setBackgroundInert(open && state === STATES.FULL);
    syncLaunchers();
    persistSession();
    if (open && options && options.focus) {
      const target = state === STATES.FULL ? elements.restore : elements.expand;
      if (target) target.focus({ preventScroll:true });
    }
  }

  function setState(next, options) {
    if (!elements) return STATES.DOCKED;
    const requested = normalizeState(next);
    if (!open) previousFocus = root.document.activeElement;
    if (requested === STATES.FULL && state !== STATES.FULL) previousState = state;
    state = isMobile() && requested === STATES.FLOATING ? STATES.DOCKED : requested;
    open = true;
    if (state === STATES.FLOATING && options && options.center) {
      const size = viewportSize();
      geometry = clampGeometry({ ...geometry, left:(size.width - geometry.width) / 2, top:(size.height - geometry.height) / 2 }, size, STATES.FLOATING);
    }
    applyGeometry(geometry);
    syncPresentation(options);
    return state;
  }

  function openPane() { return setState(state === STATES.FULL ? previousState : state, { focus:true }); }
  function expand() { return setState(STATES.FULL, { focus:true }); }
  function restore() { return setState(previousState === STATES.FULL ? STATES.DOCKED : previousState, { focus:true }); }
  function floatPane(center) { return setState(STATES.FLOATING, { focus:true, center:center !== false }); }
  function dock(side) {
    dockSide = normalizeSide(side || dockSide);
    geometry.side = dockSide;
    return setState(STATES.DOCKED, { focus:true });
  }

  function collapse() {
    if (!elements) return;
    open = false;
    if (state === STATES.FULL) state = previousState;
    syncPresentation();
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll:true });
    previousFocus = null;
  }

  function interactionStart(event, type, handle) {
    if (isMobile() || !open || state === STATES.FULL || event.button !== 0) return;
    if (type === 'move') {
      if (state !== STATES.FLOATING || event.target.closest('button,a,input,textarea,select,[role="button"]')) return;
      if (root.getSelection && root.getSelection().toString()) return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    interaction = { type, handle, pointerId:event.pointerId, startX:event.clientX, startY:event.clientY, geometry:{ ...geometry } };
    elements.root.classList.toggle('is-resizing', type === 'resize');
    elements.root.classList.toggle('is-moving', type === 'move');
  }

  function interactionMove(event) {
    if (!interaction || event.pointerId !== interaction.pointerId) return;
    const dx = event.clientX - interaction.startX;
    const dy = event.clientY - interaction.startY;
    if (interaction.type === 'move') {
      applyGeometry(moveGeometry(interaction.geometry, dx, viewportSize()));
    } else if (state === STATES.DOCKED) {
      const width = dockSide === SIDES.RIGHT ? root.innerWidth - event.clientX : event.clientX;
      applyGeometry({ ...geometry, width, side:dockSide });
    } else {
      applyGeometry(resizeGeometry(interaction.geometry, dx, dy, interaction.handle, viewportSize()));
    }
  }

  function interactionEnd(event) {
    if (!interaction || event.pointerId !== interaction.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    elements.root.classList.remove('is-resizing', 'is-moving');
    interaction = null;
    persistSession();
  }

  function resizeByKeyboard(event) {
    if (isMobile() || !open || state === STATES.FULL || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
    const handle = event.currentTarget.dataset.resizeHandle;
    const horizontal = ['inline','left','corner'].includes(handle);
    const vertical = ['top','corner'].includes(handle);
    if ((event.key.includes('Left') || event.key.includes('Right')) && !horizontal) return;
    if ((event.key.includes('Up') || event.key.includes('Down')) && !vertical) return;
    event.preventDefault();
    const step = event.shiftKey ? 50 : 20;
    if (state === STATES.DOCKED) {
      const bounds = paneBounds(root.innerWidth, STATES.DOCKED);
      const direction = dockSide === SIDES.RIGHT ? (event.key === 'ArrowLeft' ? step : -step) : (event.key === 'ArrowRight' ? step : -step);
      const width = event.key === 'Home' ? bounds.min : event.key === 'End' ? bounds.max : geometry.width + direction;
      applyGeometry({ ...geometry, width, side:dockSide });
    } else {
      const widthBounds = paneBounds(root.innerWidth, STATES.FLOATING);
      const verticalBounds = heightBounds(root.innerHeight);
      const targetWidth = event.key === 'Home' ? widthBounds.min : event.key === 'End' ? widthBounds.max : geometry.width;
      const targetHeight = event.key === 'Home' ? verticalBounds.min : event.key === 'End' ? verticalBounds.max : geometry.height;
      const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step
        : horizontal ? geometry.width - targetWidth : 0;
      const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step
        : vertical ? geometry.height - targetHeight : 0;
      applyGeometry(resizeGeometry(geometry, dx, dy, handle === 'inline' ? 'left' : handle, viewportSize()));
    }
    event.currentTarget.setAttribute('aria-valuenow', String(handle === 'top' ? geometry.height : geometry.width));
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      state === STATES.FULL ? restore() : collapse();
    }
  }

  function handleViewportChange() {
    if (!elements) return;
    applyGeometry(geometry);
    syncPresentation();
  }

  function template() {
    return `<div class="msh-hello-universal" id="mshHelloSurface" data-msh-hello-surface data-state="docked" data-open="false" data-side="right">
      <button class="msh-hello-dock" type="button" data-msh-hello-open aria-expanded="false" aria-controls="mshHelloSurface"><span class="msh-hello-dock-mark" aria-hidden="true">H</span><span>Hello</span></button>
      <section class="msh-hello-surface" role="dialog" aria-label="Hello conversation" aria-modal="false" hidden>
        <div class="msh-hello-resize msh-hello-resize-inline" data-resize-handle="inline" role="separator" aria-label="Resize Hello width" aria-orientation="vertical" aria-valuemin="400" aria-valuemax="720" tabindex="0"></div>
        <div class="msh-hello-resize msh-hello-resize-top" data-resize-handle="top" role="separator" aria-label="Resize Hello height" aria-orientation="horizontal" aria-valuemin="420" tabindex="0"></div>
        <div class="msh-hello-resize msh-hello-resize-corner" data-resize-handle="corner" role="separator" aria-label="Resize Hello width and height" tabindex="0"></div>
        <header class="msh-hello-pane-header" data-hello-drag>
          <div><span class="msh-hello-pane-kicker">Alongside you</span><strong>Hello</strong></div>
          <div class="msh-hello-pane-controls">
            <button type="button" data-hello-dock-left aria-label="Dock Hello on the left">Left</button>
            <button type="button" data-hello-float aria-label="Float Hello in the center">Float</button>
            <button type="button" data-hello-dock-right aria-label="Dock Hello on the right">Right</button>
            <button type="button" data-hello-expand aria-label="Expand Hello to full screen">Full</button>
            <button type="button" data-hello-restore aria-label="Return Hello to previous pane" hidden>Pane</button>
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
      root:surfaceRoot, surface:surfaceRoot.querySelector('.msh-hello-surface'),
      inline:surfaceRoot.querySelector('[data-resize-handle="inline"]'), top:surfaceRoot.querySelector('[data-resize-handle="top"]'),
      corner:surfaceRoot.querySelector('[data-resize-handle="corner"]'), header:surfaceRoot.querySelector('[data-hello-drag]'),
      expand:surfaceRoot.querySelector('[data-hello-expand]'), restore:surfaceRoot.querySelector('[data-hello-restore]'),
      float:surfaceRoot.querySelector('[data-hello-float]'), dockLeft:surfaceRoot.querySelector('[data-hello-dock-left]'),
      dockRight:surfaceRoot.querySelector('[data-hello-dock-right]')
    };
    readSession();
    applyGeometry(geometry);
    surfaceRoot.querySelectorAll('[data-msh-hello-open]').forEach(button => button.addEventListener('click', openPane));
    root.document.addEventListener('click', event => {
      const launcher = event.target.closest('[data-msh-hello-open]');
      if (launcher && !surfaceRoot.contains(launcher)) openPane();
    });
    surfaceRoot.querySelector('[data-hello-close]').addEventListener('click', collapse);
    elements.expand.addEventListener('click', expand);
    elements.restore.addEventListener('click', restore);
    elements.float.addEventListener('click', () => floatPane(true));
    elements.dockLeft.addEventListener('click', () => dock(SIDES.LEFT));
    elements.dockRight.addEventListener('click', () => dock(SIDES.RIGHT));
    [elements.inline, elements.top, elements.corner].forEach(handle => {
      handle.addEventListener('pointerdown', event => interactionStart(event, 'resize', handle.dataset.resizeHandle === 'inline' ? 'left' : handle.dataset.resizeHandle));
      handle.addEventListener('pointermove', interactionMove);
      handle.addEventListener('pointerup', interactionEnd);
      handle.addEventListener('pointercancel', interactionEnd);
      handle.addEventListener('keydown', resizeByKeyboard);
    });
    elements.header.addEventListener('pointerdown', event => interactionStart(event, 'move'));
    elements.header.addEventListener('pointermove', interactionMove);
    elements.header.addEventListener('pointerup', interactionEnd);
    elements.header.addEventListener('pointercancel', interactionEnd);
    root.document.addEventListener('keydown', handleKeydown);
    root.addEventListener('resize', handleViewportChange, { passive:true });
    syncPresentation();
    return elements;
  }

  root.MSHHelloPane = Object.freeze({
    STATES, SIDES, mount, setState, openPane, expand, restore, floatPane, dock, collapse,
    clampWidth, paneBounds, heightBounds, clampGeometry, moveGeometry, resizeGeometry,
    getState:() => state, isOpen:() => open, getGeometry:() => ({ ...geometry, side:dockSide })
  });
})(typeof window !== 'undefined' ? window : globalThis);
