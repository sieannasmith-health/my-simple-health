/* My Simple Health — kinetic journey card deck */
(function () {
  'use strict';

  const root = document.querySelector('[data-journey-deck]');
  if (!root) return;

  const viewport = root.querySelector('[data-journey-viewport]');
  const track = root.querySelector('[data-journey-track]');
  const cards = Array.from(root.querySelectorAll('[data-journey-card]'));
  const previous = root.querySelector('[data-journey-previous]');
  const next = root.querySelector('[data-journey-next]');
  const position = root.querySelector('[data-journey-position]');
  const progress = root.querySelector('[data-journey-progress]');
  const point = root.querySelector('[data-journey-point]');
  const desktop = window.matchMedia('(min-width: 901px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const heroDeck = !!(root.previousElementSibling && root.previousElementSibling.classList.contains('context-hero'));
  let activeIndex = 0;
  let frame = 0;
  let mobileTimer = 0;

  if (heroDeck) root.classList.add('journey-deck--hero');

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function usesScrollDrivenDesktop() {
    return desktop.matches && !reducedMotion.matches && !heroDeck;
  }

  function setActive(index, continuousProgress) {
    activeIndex = clamp(index, 0, cards.length - 1);
    cards.forEach(function (card, cardIndex) {
      const active = cardIndex === activeIndex;
      card.classList.toggle('is-active', active);
      card.setAttribute('aria-hidden', String(!active && heroDeck));
      if (active) card.setAttribute('aria-current', 'step');
      else card.removeAttribute('aria-current');
    });

    root.dataset.activeStage = cards[activeIndex].dataset.stage;
    position.textContent = String(activeIndex + 1);
    const normalized = typeof continuousProgress === 'number'
      ? clamp(continuousProgress, 0, 1)
      : activeIndex / Math.max(1, cards.length - 1);
    progress.style.width = `${normalized * 100}%`;
    point.style.left = `${normalized * 100}%`;
    previous.disabled = activeIndex === 0;
    next.disabled = activeIndex === cards.length - 1;
  }

  function maximumTrackOffset() {
    return Math.max(0, track.scrollWidth - window.innerWidth);
  }

  function desktopProgress() {
    const rect = root.getBoundingClientRect();
    const travel = Math.max(1, root.offsetHeight - window.innerHeight);
    return clamp(-rect.top / travel, 0, 1);
  }

  function updateDesktop() {
    frame = 0;
    if (!usesScrollDrivenDesktop()) return;
    const value = desktopProgress();
    track.style.transform = `translate3d(${-maximumTrackOffset() * value}px, 0, 0)`;
    setActive(Math.round(value * (cards.length - 1)), value);
  }

  function requestDesktopUpdate() {
    if (frame || !usesScrollDrivenDesktop()) return;
    frame = window.requestAnimationFrame(updateDesktop);
  }

  function closestCarouselCard() {
    if (heroDeck) return;
    const viewportCenter = viewport.scrollLeft + viewport.clientWidth / 2;
    let closestIndex = 0;
    let closestDistance = Infinity;
    cards.forEach(function (card, index) {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(cardCenter - viewportCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    setActive(closestIndex);
  }

  function goTo(index, moveFocus) {
    const targetIndex = clamp(index, 0, cards.length - 1);

    if (heroDeck) {
      setActive(targetIndex);
    } else if (usesScrollDrivenDesktop()) {
      const rootTop = window.scrollY + root.getBoundingClientRect().top;
      const travel = Math.max(1, root.offsetHeight - window.innerHeight);
      window.scrollTo({
        top: rootTop + (targetIndex / Math.max(1, cards.length - 1)) * travel,
        behavior: 'smooth'
      });
    } else {
      cards[targetIndex].scrollIntoView({
        behavior: reducedMotion.matches ? 'auto' : 'smooth',
        block: 'nearest',
        inline: 'center'
      });
      setActive(targetIndex);
    }

    if (moveFocus && !heroDeck) cards[targetIndex].focus({ preventScroll: true });
  }

  previous.addEventListener('click', function () { goTo(activeIndex - 1, false); });
  next.addEventListener('click', function () { goTo(activeIndex + 1, false); });

  viewport.addEventListener('scroll', function () {
    if (usesScrollDrivenDesktop() || heroDeck) return;
    window.clearTimeout(mobileTimer);
    mobileTimer = window.setTimeout(closestCarouselCard, 60);
  }, { passive: true });

  cards.forEach(function (card, index) {
    card.addEventListener('focus', function () { if (!heroDeck) setActive(index); });
    card.addEventListener('click', function (event) {
      if (event.target.closest('a')) return;
      if (!heroDeck) goTo(index, false);
    });
    card.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      goTo(index + (event.key === 'ArrowRight' ? 1 : -1), !heroDeck);
    });
  });

  window.addEventListener('scroll', requestDesktopUpdate, { passive: true });
  window.addEventListener('resize', function () {
    track.style.transform = '';
    if (usesScrollDrivenDesktop()) requestDesktopUpdate();
    else if (!heroDeck) closestCarouselCard();
  }, { passive: true });

  if (typeof desktop.addEventListener === 'function') desktop.addEventListener('change', function () {
    track.style.transform = '';
    if (usesScrollDrivenDesktop()) requestDesktopUpdate();
    else if (!heroDeck) closestCarouselCard();
  });
  if (typeof reducedMotion.addEventListener === 'function') reducedMotion.addEventListener('change', requestDesktopUpdate);

  setActive(0, 0);
  requestDesktopUpdate();
}());

/* Whole-health SVG v2: one coordinate system, GSAP owns only motion. */
(function () {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 560px)');
  let currentMode = null;
  let observer = null;
  let timeline = null;

  function loadGsap() {
    if (window.gsap) return Promise.resolve(window.gsap);
    return new Promise(function (resolve, reject) {
      const existing = document.querySelector('script[data-msh-gsap]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(window.gsap); }, { once:true });
        existing.addEventListener('error', reject, { once:true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js';
      script.async = true;
      script.dataset.mshGsap = 'true';
      script.onload = function () { resolve(window.gsap); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function nodeMarkup(cls, cx, cy, label, side) {
    const textX = side === 'left' ? cx + 31 : cx - 31;
    const anchorClass = side === 'right' ? ' wh-label-right' : '';
    return `<g class="wh-node ${cls}">
      <circle class="wh-node-ring" cx="${cx}" cy="${cy}" r="24"/>
      <circle class="wh-node-fill" cx="${cx}" cy="${cy}" r="19"/>
      <circle class="wh-node-dot" cx="${cx}" cy="${cy}" r="3.2"/>
      <text class="wh-label${anchorClass}" x="${textX}" y="${cy + 4}">${label}</text>
    </g>`;
  }

  function desktopSvg() {
    return `<svg class="whole-health-svg" viewBox="0 0 820 560" role="img" aria-labelledby="whole-health-title whole-health-desc">
      <title id="whole-health-title">Your whole Health</title>
      <desc id="whole-health-desc">Eight dimensions of health and life connect into one whole picture.</desc>
      <g class="wh-routes" aria-hidden="true">
        <path id="wh-route-1" class="wh-route" d="M105 92 C245 92 304 205 410 280 S585 142 690 95"/>
        <path id="wh-route-2" class="wh-route is-rose" d="M82 208 C235 205 305 240 410 280 S575 238 705 205"/>
        <path id="wh-route-3" class="wh-route is-plum" d="M84 323 C236 330 304 302 410 280 S574 353 705 330"/>
        <path id="wh-route-4" class="wh-route is-blue" d="M112 442 C250 438 312 330 410 280 S566 450 676 445"/>
        <path id="wh-route-5" class="wh-route is-blue" d="M105 92 C240 173 300 360 410 280 S578 152 705 205"/>
        <path id="wh-route-6" class="wh-route is-plum" d="M82 208 C235 240 305 390 410 280 S568 318 705 330"/>
        <path id="wh-route-7" class="wh-route" d="M84 323 C230 330 302 136 410 280 S575 220 690 95"/>
        <path id="wh-route-8" class="wh-route is-rose" d="M112 442 C236 385 315 142 410 280 S566 408 676 445"/>
      </g>
      <g class="wh-orbits" aria-hidden="true"><circle class="wh-orbit" cx="410" cy="280" r="116"/><circle class="wh-orbit" cx="410" cy="280" r="145"/></g>
      ${nodeMarkup('wh-node-physical',105,92,'Physical','left')}
      ${nodeMarkup('wh-node-emotional',82,208,'Emotional','left')}
      ${nodeMarkup('wh-node-social',84,323,'Social','left')}
      ${nodeMarkup('wh-node-environment',112,442,'Environment','left')}
      ${nodeMarkup('wh-node-meaning',690,95,'What matters','right')}
      ${nodeMarkup('wh-node-financial',705,205,'Financial','right')}
      ${nodeMarkup('wh-node-mental',705,330,'Mental engagement','right')}
      ${nodeMarkup('wh-node-work',676,445,'Work & responsibilities','right')}
      <g class="wh-travel" aria-hidden="true"><circle class="wh-travel-dot wh-dot-1" r="4"/><circle class="wh-travel-dot is-rose wh-dot-2" r="4"/><circle class="wh-travel-dot is-plum wh-dot-3" r="4"/><circle class="wh-travel-dot is-blue wh-dot-4" r="4"/></g>
      <g class="wh-core-group">
        <circle class="wh-core-shadow" cx="410" cy="293" r="93"/>
        <circle class="wh-core-outer" cx="410" cy="280" r="104"/>
        <circle class="wh-core" cx="410" cy="280" r="88"/>
        <text class="wh-core-word wh-your" x="410" y="248">your</text>
        <text class="wh-core-word wh-whole" x="410" y="282">whole</text>
        <text class="wh-core-word wh-health" x="410" y="317">Health</text>
      </g>
      <g class="wh-status" aria-hidden="true"><circle class="wh-status-dot is-active" cx="377" cy="523" r="3"/><circle class="wh-status-dot is-active" cx="390" cy="523" r="3"/><circle class="wh-status-dot" cx="403" cy="523" r="3"/><circle class="wh-status-dot" cx="416" cy="523" r="3"/><circle class="wh-status-dot" cx="429" cy="523" r="3"/><circle class="wh-status-dot" cx="442" cy="523" r="3"/><text class="wh-status-label" x="410" y="543">This is your whole picture.</text></g>
    </svg>`;
  }

  function mobileSvg() {
    return `<svg class="whole-health-svg" viewBox="0 0 390 520" role="img" aria-labelledby="whole-health-title whole-health-desc">
      <title id="whole-health-title">Your whole Health</title>
      <desc id="whole-health-desc">Eight dimensions of health and life connect into one whole picture.</desc>
      <g class="wh-routes" aria-hidden="true">
        <path id="wh-route-1" class="wh-route" d="M55 70 C110 78 138 176 195 260 S280 94 335 72"/>
        <path id="wh-route-2" class="wh-route is-rose" d="M48 170 C110 171 145 218 195 260 S280 205 342 170"/>
        <path id="wh-route-3" class="wh-route is-plum" d="M49 350 C112 348 146 306 195 260 S278 313 342 350"/>
        <path id="wh-route-4" class="wh-route is-blue" d="M60 449 C116 444 144 344 195 260 S280 430 332 448"/>
        <path id="wh-route-5" class="wh-route is-blue" d="M55 70 C121 145 132 325 195 260 S277 124 342 170"/>
        <path id="wh-route-6" class="wh-route is-plum" d="M48 170 C111 204 139 366 195 260 S278 310 342 350"/>
        <path id="wh-route-7" class="wh-route" d="M49 350 C109 330 144 150 195 260 S281 140 335 72"/>
        <path id="wh-route-8" class="wh-route is-rose" d="M60 449 C117 397 145 126 195 260 S278 400 332 448"/>
      </g>
      <g class="wh-orbits" aria-hidden="true"><circle class="wh-orbit" cx="195" cy="260" r="92"/><circle class="wh-orbit" cx="195" cy="260" r="116"/></g>
      ${nodeMarkup('wh-node-physical',55,70,'Physical','left')}
      ${nodeMarkup('wh-node-emotional',48,170,'Emotional','left')}
      ${nodeMarkup('wh-node-social',49,350,'Social','left')}
      ${nodeMarkup('wh-node-environment',60,449,'Environment','left')}
      ${nodeMarkup('wh-node-meaning',335,72,'What matters','right')}
      ${nodeMarkup('wh-node-financial',342,170,'Financial','right')}
      ${nodeMarkup('wh-node-mental',342,350,'Mental engagement','right')}
      ${nodeMarkup('wh-node-work',332,448,'Work & responsibilities','right')}
      <g class="wh-travel" aria-hidden="true"><circle class="wh-travel-dot wh-dot-1" r="3.6"/><circle class="wh-travel-dot is-rose wh-dot-2" r="3.6"/><circle class="wh-travel-dot is-plum wh-dot-3" r="3.6"/><circle class="wh-travel-dot is-blue wh-dot-4" r="3.6"/></g>
      <g class="wh-core-group">
        <circle class="wh-core-shadow" cx="195" cy="270" r="77"/>
        <circle class="wh-core-outer" cx="195" cy="260" r="88"/>
        <circle class="wh-core" cx="195" cy="260" r="74"/>
        <text class="wh-core-word wh-your" x="195" y="232">your</text>
        <text class="wh-core-word wh-whole" x="195" y="260">whole</text>
        <text class="wh-core-word wh-health" x="195" y="290">Health</text>
      </g>
      <g class="wh-status" aria-hidden="true"><circle class="wh-status-dot is-active" cx="164" cy="493" r="2.8"/><circle class="wh-status-dot is-active" cx="176" cy="493" r="2.8"/><circle class="wh-status-dot" cx="188" cy="493" r="2.8"/><circle class="wh-status-dot" cx="200" cy="493" r="2.8"/><circle class="wh-status-dot" cx="212" cy="493" r="2.8"/><circle class="wh-status-dot" cx="224" cy="493" r="2.8"/><text class="wh-status-label" x="195" y="514">This is your whole picture.</text></g>
    </svg>`;
  }

  function setFinal(svg) {
    if (!svg) return;
    svg.querySelectorAll('.wh-route,.wh-node,.wh-orbit,.wh-core-group,.wh-status').forEach(function (el) {
      el.style.opacity = '1';
      el.style.transform = '';
    });
    svg.querySelectorAll('.wh-travel-dot').forEach(function (el) { el.style.opacity = '0'; });
  }

  function animate(svg, gsap) {
    if (!svg || !gsap || reduced.matches) return setFinal(svg);
    if (timeline) timeline.kill();

    const nodes = svg.querySelectorAll('.wh-node');
    const routes = Array.from(svg.querySelectorAll('.wh-route'));
    const orbits = svg.querySelectorAll('.wh-orbit');
    const core = svg.querySelector('.wh-core-group');
    const words = svg.querySelectorAll('.wh-core-word');
    const status = svg.querySelector('.wh-status');
    const dots = Array.from(svg.querySelectorAll('.wh-travel-dot'));

    gsap.set(nodes, { opacity:0, scale:.88, transformOrigin:'center' });
    gsap.set(orbits, { opacity:0 });
    gsap.set(core, { opacity:0, scale:.72, transformOrigin:'center' });
    gsap.set(words, { opacity:0, y:8 });
    gsap.set(status, { opacity:0 });
    gsap.set(dots, { opacity:0 });
    routes.forEach(function (path) {
      const length = path.getTotalLength();
      gsap.set(path, { opacity:.55, strokeDasharray:length, strokeDashoffset:length });
    });

    timeline = gsap.timeline({ defaults:{ ease:'power2.out' } });
    timeline.to(nodes, { opacity:1, scale:1, duration:.55, stagger:.07 })
      .to(routes, { strokeDashoffset:0, opacity:1, duration:1.05, stagger:.05 }, '-=.18')
      .to(orbits, { opacity:1, duration:.7 }, '-=.55')
      .to(core, { opacity:1, scale:1, duration:.75, ease:'back.out(1.35)' }, '-=.35')
      .to(words, { opacity:1, y:0, duration:.42, stagger:.09 }, '-=.28')
      .to(status, { opacity:1, duration:.45 }, '-=.08');

    dots.forEach(function (dot, index) {
      const path = routes[index % routes.length];
      const proxy = { progress:0 };
      timeline.set(dot, { opacity:.9 }, .8 + index * .12);
      timeline.to(proxy, {
        progress:1,
        duration:1.45,
        ease:'none',
        onUpdate:function () {
          const point = path.getPointAtLength(path.getTotalLength() * proxy.progress);
          dot.setAttribute('cx', point.x);
          dot.setAttribute('cy', point.y);
        }
      }, .8 + index * .12);
      timeline.to(dot, { opacity:0, duration:.2 }, 2.18 + index * .12);
    });
  }

  function render() {
    const stage = document.querySelector('.story-landscape-art .landscape-whole');
    if (!stage) return;
    const mode = mobile.matches ? 'mobile' : 'desktop';
    if (currentMode === mode && stage.querySelector('.whole-health-svg')) return;
    currentMode = mode;
    if (timeline) { timeline.kill(); timeline = null; }
    stage.innerHTML = mode === 'mobile' ? mobileSvg() : desktopSvg();
    const svg = stage.querySelector('.whole-health-svg');

    if (observer) observer.disconnect();
    if (reduced.matches || !('IntersectionObserver' in window)) {
      setFinal(svg);
      return;
    }

    observer = new IntersectionObserver(function (entries) {
      if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
      observer.disconnect();
      loadGsap().then(function (gsap) { animate(svg, gsap); }).catch(function () { setFinal(svg); });
    }, { threshold:.28 });
    observer.observe(stage);
  }

  function boot() {
    render();
    if (typeof mobile.addEventListener === 'function') mobile.addEventListener('change', render);
    if (typeof reduced.addEventListener === 'function') reduced.addEventListener('change', render);
  }

  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot, { once:true });
}());
