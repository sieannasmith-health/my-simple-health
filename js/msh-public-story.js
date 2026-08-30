/* My Simple Health — public story: quiet kinetic tactility */
(function () {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canObserve = 'IntersectionObserver' in window;

  /* Public homepage theme support. The app workspace already uses this same
     storage key, so appearance now stays consistent between desktop surfaces. */
  const THEME_KEY = 'msh_theme_preference';
  const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');

  function getThemePreference() {
    try {
      const stored = window.localStorage.getItem(THEME_KEY);
      return ['light', 'dark', 'system'].includes(stored) ? stored : 'system';
    } catch (_) {
      return 'system';
    }
  }

  function resolveTheme(preference) {
    return preference === 'system' ? (themeMedia.matches ? 'dark' : 'light') : preference;
  }

  function applyPublicTheme(preference, persist) {
    const next = ['light', 'dark', 'system'].includes(preference) ? preference : 'system';
    const resolved = resolveTheme(next);
    document.documentElement.dataset.themePreference = next;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    if (persist) {
      try { window.localStorage.setItem(THEME_KEY, next); } catch (_) {}
    }
    document.querySelectorAll('[data-public-theme-choice]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.publicThemeChoice === next));
    });
  }

  applyPublicTheme(getThemePreference(), false);
  if (typeof themeMedia.addEventListener === 'function') {
    themeMedia.addEventListener('change', () => {
      if (getThemePreference() === 'system') applyPublicTheme('system', false);
    });
  }

  const storyHeader = document.querySelector('.story-header');
  if (storyHeader) {
    const nav = storyHeader.querySelector('.story-nav');
    if (nav && !nav.querySelector('.story-theme-control')) {
      const control = document.createElement('details');
      control.className = 'story-theme-control';
      control.innerHTML = `
        <summary class="story-theme-trigger" aria-label="Appearance" title="Appearance"><span aria-hidden="true">◐</span></summary>
        <div class="story-theme-menu" role="group" aria-label="Appearance">
          <button type="button" data-public-theme-choice="light">Light</button>
          <button type="button" data-public-theme-choice="dark">Dark</button>
          <button type="button" data-public-theme-choice="system">System</button>
        </div>`;
      nav.appendChild(control);
      applyPublicTheme(getThemePreference(), false);
    }
  }

  document.addEventListener('click', event => {
    const choice = event.target.closest('[data-public-theme-choice]');
    if (!choice) return;
    applyPublicTheme(choice.dataset.publicThemeChoice, true);
    const details = choice.closest('details');
    if (details) details.open = false;
  });

  const revealItems = Array.from(document.querySelectorAll('.story-reveal'));
  const constellation = document.querySelector('[data-constellation]');
  const panels = Array.from(document.querySelectorAll('[data-story-panel]'));
  const hero = document.querySelector('[data-story-hero]');
  const lens = document.querySelector('[data-story-lens]');
  const door = document.querySelector('[data-story-door]');
  const freeform = document.querySelector('[data-story-freeform]');

  function showCompletedState() {
    revealItems.forEach(item => item.classList.add('is-visible'));
    if (constellation) constellation.classList.add('is-settled');
    panels.forEach((panel, index) => panel.classList.toggle('is-focused', index === 0));
  }

  if (reduced || !canObserve) {
    showCompletedState();
  } else {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin:'0px 0px -10% 0px', threshold:.08 });
    revealItems.forEach(item => revealObserver.observe(item));

    if (constellation) {
      const constellationObserver = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          constellation.classList.add('is-settled');
          constellationObserver.disconnect();
        }
      }, { threshold:.28 });
      constellationObserver.observe(constellation);
    }

    const panelObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const track = entry.target.closest('[data-panel-track]');
        if (!track) return;
        track.querySelectorAll('[data-story-panel]').forEach(panel => panel.classList.toggle('is-focused', panel === entry.target));
      });
    }, { rootMargin:'-38% 0px -38% 0px', threshold:.01 });
    panels.forEach(panel => panelObserver.observe(panel));
  }

  if (hero && !reduced) {
    hero.addEventListener('pointermove', event => {
      const bounds = hero.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width - .5) * 12;
      const y = ((event.clientY - bounds.top) / bounds.height - .5) * 9;
      hero.style.setProperty('--lens-x', `${x.toFixed(2)}px`);
      hero.style.setProperty('--lens-y', `${y.toFixed(2)}px`);
    }, { passive:true });
    hero.addEventListener('pointerleave', () => {
      hero.style.setProperty('--lens-x', '0px');
      hero.style.setProperty('--lens-y', '0px');
    });
  }

  function toggleMomentaryState(element, className) { if (element) element.classList.toggle(className); }
  if (lens) lens.addEventListener('click', () => toggleMomentaryState(lens, 'is-active'));
  if (door) {
    door.addEventListener('pointerdown', () => door.classList.add('is-open'));
    door.addEventListener('pointerup', () => door.classList.remove('is-open'));
    door.addEventListener('pointercancel', () => door.classList.remove('is-open'));
  }
  if (freeform) freeform.addEventListener('click', () => freeform.classList.toggle('is-active'));

  const landscapeArt = document.querySelector('.story-landscape-art');
  const firstDemo = landscapeArt ? landscapeArt.closest('.product-demo') : null;
  if (landscapeArt && firstDemo) {
    const oldWhole = landscapeArt.querySelector('.landscape-whole');
    if (oldWhole) oldWhole.innerHTML = `
      <svg class="landscape-network" viewBox="0 0 760 520" role="img" aria-label="Health information connecting into your whole Health">
        <g class="network-routes" aria-hidden="true">
          <path class="route route-1" d="M105 100 C250 108 300 214 380 260 S560 152 655 108"/><path class="route route-2" d="M92 190 C230 188 286 232 380 260 S530 252 675 205"/><path class="route route-3" d="M92 290 C230 298 290 280 380 260 S560 340 670 325"/><path class="route route-4" d="M130 390 C250 390 305 302 380 260 S520 408 625 410"/><path class="route route-5" d="M105 100 C230 180 270 330 380 260 S525 155 675 205"/><path class="route route-6" d="M92 190 C235 220 302 372 380 260 S515 310 670 325"/><path class="route route-7" d="M92 290 C230 300 310 135 380 260 S540 208 655 108"/><path class="route route-8" d="M130 390 C230 340 295 150 380 260 S545 380 625 410"/>
        </g>
        <g class="network-dots" aria-hidden="true"><circle class="travel-dot dot-1" r="4"/><circle class="travel-dot dot-2" r="4"/><circle class="travel-dot dot-3" r="4"/><circle class="travel-dot dot-4" r="4"/><circle class="travel-dot dot-5" r="3"/><circle class="travel-dot dot-6" r="3"/></g>
      </svg>
      <div class="network-node node-physical"><i>●</i><span>Physical</span></div><div class="network-node node-emotional"><i>●</i><span>Emotional</span></div><div class="network-node node-social"><i>●</i><span>Social</span></div><div class="network-node node-environment"><i>●</i><span>Environment</span></div><div class="network-node node-meaning"><i>●</i><span>What matters</span></div><div class="network-node node-financial"><i>●</i><span>Financial</span></div><div class="network-node node-mental"><i>●</i><span>Mental engagement</span></div><div class="network-node node-work"><i>●</i><span>Work & responsibilities</span></div>
      <div class="network-knot" aria-hidden="true"></div><div class="network-core" aria-label="Your whole Health"><span>your</span><span>whole</span><strong>Health</strong></div><div class="network-status" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><span>Building your picture…</span></div>`;
    if (!reduced && canObserve) {
      const kineticObserver = new IntersectionObserver(entries => entries.forEach(entry => landscapeArt.classList.toggle('is-running', entry.isIntersecting)), { threshold:.25 });
      kineticObserver.observe(landscapeArt);
    } else landscapeArt.classList.add('is-complete');
  }

  const storyFooter = document.querySelector('.story-footer');
  if (storyFooter) {
    const icon = {
      instagram:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.25"/><circle class="fill-dot" cx="17.4" cy="6.7" r="1.1"/></svg>',
      linkedin:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="9" width="3" height="11" class="fill-shape"/><circle cx="5.5" cy="5.5" r="1.6" class="fill-shape"/><path d="M11 20V9h3v1.7c1-1.3 2.2-2 3.8-2 3 0 4.2 2 4.2 5.2V20h-3v-5.5c0-1.9-.6-3-2.3-3-1.8 0-2.7 1.2-2.7 3.4V20z" class="fill-shape"/></svg>',
      pinterest:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5c-4.7 0-7.5 3.4-7.5 6.7 0 2.4.9 4.5 2.9 5.3-.1-.5-.1-1.3 0-1.8l.9-3.8s-.2-.6-.2-1.5c0-1.4.8-2.5 1.8-2.5.9 0 1.3.6 1.3 1.4 0 .9-.6 2.2-.8 3.4-.2 1 .5 1.8 1.5 1.8 1.8 0 3.2-1.9 3.2-4.6 0-2.4-1.7-4.1-4.2-4.1-2.9 0-4.6 2.1-4.6 4.4 0 .9.3 1.8.8 2.3.1.1.1.2.1.4l-.3 1.2c-.1.4-.4.5-.8.3-2.8-1.3-4.6-5.3-4.6-8.5C1.5 5.2 5.4 1 12.7 1 18.5 1 23 5.1 23 10.5c0 5.7-3.6 10.3-8.6 10.3-1.7 0-3.3-.9-3.8-1.9l-1 4c-.4 1.5-1.4 3.4-2.1 4.5"/></svg>',
      mail:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>'
    };
    storyFooter.innerHTML = `
      <div class="msh-footer-grid"><section class="msh-footer-intro"><a class="msh-footer-name" href="index.html">My Simple Health</a><p>Practical, evidence-informed<br>health education for everyday life.</p><div class="msh-footer-social" aria-label="Social links"><a href="#" aria-label="Instagram">${icon.instagram}</a><a href="#" aria-label="LinkedIn">${icon.linkedin}</a><a href="#" aria-label="Pinterest">${icon.pinterest}</a><a href="mailto:hello@mysimplehealth.org" aria-label="Email">${icon.mail}</a></div></section>
      <nav class="msh-footer-column" aria-label="Explore"><h2>Explore</h2><a href="resources.html">Topics</a><a href="recipes.html">Recipes</a><a href="resources.html">Resources</a><a href="blog.html">Blog</a></nav>
      <nav class="msh-footer-column" aria-label="About"><h2>About</h2><a href="about.html">About Me</a><a href="about.html">Mission & Values</a><a href="contact.html">Contact</a></nav>
      <section class="msh-footer-connect"><h2>Let's stay connected</h2><p>Join the community for new articles,<br>healthy recipes, and free resources.</p><form class="msh-footer-signup" action="contact.html" method="get"><label class="sr-only" for="footer-email">Email address</label><input id="footer-email" name="email" type="email" autocomplete="email" placeholder="Email address"><button type="submit" aria-label="Continue">→</button></form></section></div>
      <div class="msh-footer-bottom"><span></span><a href="index.html">mysimplehealth.org</a><span></span></div><p class="msh-footer-disclaimer">Educational support, not diagnosis or medical care.</p>`;
  }

  if (!reduced) {
    const waveTargets = [document.querySelector('.context-copy h1'),document.querySelector('.journey-deck-heading h2'),document.querySelector('.trust-strip > div:first-child h2'),document.querySelector('.story-ending h2')].filter(Boolean);
    function wrapWaveWords(element) {
      let wordIndex=0;
      Array.from(element.childNodes).forEach(node => {
        if (node.nodeType !== Node.TEXT_NODE) return;
        const fragment=document.createDocumentFragment();
        node.nodeValue.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) return fragment.appendChild(document.createTextNode(part));
          const span=document.createElement('span'); span.className='msh-wave-word'; span.textContent=part; span.style.setProperty('--msh-wave-delay',`${wordIndex*58}ms`); span.style.setProperty('--msh-wave-y',`${wordIndex%2===0?13:7}px`); fragment.appendChild(span); wordIndex++;
        }); node.replaceWith(fragment);
      }); element.classList.add('msh-wave-text');
    }
    waveTargets.forEach(wrapWaveWords);
    if (canObserve) { const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-wave-visible');observer.unobserve(entry.target);}}),{rootMargin:'0px 0px -8% 0px',threshold:.18}); waveTargets.forEach(target=>observer.observe(target)); }
    else waveTargets.forEach(target=>target.classList.add('is-wave-visible'));
  }
})();
