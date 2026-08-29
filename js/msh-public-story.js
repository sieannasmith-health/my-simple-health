/* My Simple Health — public story: quiet kinetic tactility */
(function () {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canObserve = 'IntersectionObserver' in window;
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
        track.querySelectorAll('[data-story-panel]').forEach(panel => {
          panel.classList.toggle('is-focused', panel === entry.target);
        });
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

    let scrollQueued = false;
    window.addEventListener('scroll', () => {
      if (scrollQueued) return;
      scrollQueued = true;
      window.requestAnimationFrame(() => {
        hero.classList.toggle('is-settled', window.scrollY > 24);
        scrollQueued = false;
      });
    }, { passive:true });
  }

  function toggleMomentaryState(element, className) {
    if (!element) return;
    element.classList.toggle(className);
  }

  if (lens) lens.addEventListener('click', () => toggleMomentaryState(lens, 'is-active'));

  if (door) {
    door.addEventListener('pointerdown', () => door.classList.add('is-open'));
    door.addEventListener('pointerup', () => door.classList.remove('is-open'));
    door.addEventListener('pointercancel', () => door.classList.remove('is-open'));
  }

  if (freeform) {
    freeform.addEventListener('click', () => {
      freeform.classList.toggle('is-active');
      const prompt = freeform.closest('.story-prompt');
      if (prompt) prompt.classList.toggle('is-active', freeform.classList.contains('is-active'));
    });
  }

  /* Information visibly interconnects before the whole picture appears. */
  const landscapeArt = document.querySelector('.story-landscape-art');
  const firstDemo = landscapeArt ? landscapeArt.closest('.product-demo') : null;

  if (landscapeArt && firstDemo) {
    const oldWhole = landscapeArt.querySelector('.landscape-whole');
    if (oldWhole) {
      oldWhole.innerHTML = `
        <svg class="landscape-network" viewBox="0 0 760 520" role="img" aria-label="Physical, emotional, social, environmental, work, financial, mental engagement and what matters information connecting into your whole Health">
          <g class="network-routes" aria-hidden="true">
            <path class="route route-1" d="M105 100 C250 108 300 214 380 260 S560 152 655 108" />
            <path class="route route-2" d="M92 190 C230 188 286 232 380 260 S530 252 675 205" />
            <path class="route route-3" d="M92 290 C230 298 290 280 380 260 S560 340 670 325" />
            <path class="route route-4" d="M130 390 C250 390 305 302 380 260 S520 408 625 410" />
            <path class="route route-5" d="M105 100 C230 180 270 330 380 260 S525 155 675 205" />
            <path class="route route-6" d="M92 190 C235 220 302 372 380 260 S515 310 670 325" />
            <path class="route route-7" d="M92 290 C230 300 310 135 380 260 S540 208 655 108" />
            <path class="route route-8" d="M130 390 C230 340 295 150 380 260 S545 380 625 410" />
          </g>
          <g class="network-dots" aria-hidden="true">
            <circle class="travel-dot dot-1" r="4" />
            <circle class="travel-dot dot-2" r="4" />
            <circle class="travel-dot dot-3" r="4" />
            <circle class="travel-dot dot-4" r="4" />
            <circle class="travel-dot dot-5" r="3" />
            <circle class="travel-dot dot-6" r="3" />
          </g>
        </svg>
        <div class="network-node node-physical"><i>●</i><span>Physical</span></div>
        <div class="network-node node-emotional"><i>●</i><span>Emotional</span></div>
        <div class="network-node node-social"><i>●</i><span>Social</span></div>
        <div class="network-node node-environment"><i>●</i><span>Environment</span></div>
        <div class="network-node node-meaning"><i>●</i><span>What matters</span></div>
        <div class="network-node node-financial"><i>●</i><span>Financial</span></div>
        <div class="network-node node-mental"><i>●</i><span>Mental engagement</span></div>
        <div class="network-node node-work"><i>●</i><span>Work & responsibilities</span></div>
        <div class="network-knot" aria-hidden="true"></div>
        <div class="network-core" aria-label="Your whole Health"><span>your</span><span>whole</span><strong>Health</strong></div>
        <div class="network-status" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><span>Building your picture…</span></div>
      `;
    }

    if (!reduced && canObserve) {
      const kineticObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          landscapeArt.classList.toggle('is-running', entry.isIntersecting);
        });
      }, { threshold:.25 });
      kineticObserver.observe(landscapeArt);
    } else {
      landscapeArt.classList.add('is-complete');
    }
  }

  /* Restore the fuller editorial footer used by the earlier MSH site. */
  const storyFooter = document.querySelector('.story-footer');
  if (storyFooter) {
    storyFooter.innerHTML = `
      <div class="msh-footer-grid">
        <section class="msh-footer-intro">
          <a class="msh-footer-name" href="index.html">My Simple Health</a>
          <p>Practical, evidence-informed<br>health education for everyday life.</p>
          <div class="msh-footer-social" aria-label="Social links">
            <a href="contact.html" aria-label="Instagram">◎</a>
            <a href="contact.html" aria-label="LinkedIn">in</a>
            <a href="contact.html" aria-label="Pinterest">p</a>
            <a href="contact.html" aria-label="Email">✉</a>
          </div>
        </section>
        <nav class="msh-footer-column" aria-label="Explore">
          <h2>Explore</h2>
          <a href="resources.html">Resources</a>
          <a href="recipes.html">Recipes</a>
          <a href="calendar.html">Calendar</a>
          <a href="my-health.html">My Health</a>
        </nav>
        <nav class="msh-footer-column" aria-label="About">
          <h2>About</h2>
          <a href="about.html">About My Simple Health</a>
          <a href="support.html">Help & Support</a>
          <a href="contact.html">Contact</a>
        </nav>
        <section class="msh-footer-connect">
          <h2>Let's stay connected</h2>
          <p>Stay close to new articles, resources, and updates from My Simple Health.</p>
          <form class="msh-footer-signup" action="contact.html" method="get">
            <label class="sr-only" for="footer-email">Email address</label>
            <input id="footer-email" name="email" type="email" autocomplete="email" placeholder="Email address">
            <button type="submit" aria-label="Continue">→</button>
          </form>
        </section>
      </div>
      <div class="msh-footer-bottom">
        <span></span>
        <a href="index.html">mysimplehealth.org</a>
        <span></span>
      </div>
      <p class="msh-footer-disclaimer">Educational support, not diagnosis or medical care.</p>
    `;
  }

  /* Subtle staggered word-wave reveals for high-value storytelling moments. */
  if (!reduced) {
    const waveTargets = [
      document.querySelector('.context-copy h1'),
      document.querySelector('.journey-deck-heading h2'),
      document.querySelector('.trust-strip > div:first-child h2'),
      document.querySelector('.story-ending h2')
    ].filter(Boolean);

    function wrapWaveWords(element) {
      let wordIndex = 0;

      function wrapTextNode(node) {
        const parts = node.nodeValue.split(/(\s+)/);
        const fragment = document.createDocumentFragment();

        parts.forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            fragment.appendChild(document.createTextNode(part));
            return;
          }

          const span = document.createElement('span');
          span.className = 'msh-wave-word';
          span.textContent = part;
          span.style.setProperty('--msh-wave-delay', `${wordIndex * 58}ms`);
          span.style.setProperty('--msh-wave-y', `${wordIndex % 2 === 0 ? 13 : 7}px`);
          fragment.appendChild(span);
          wordIndex += 1;
        });

        node.replaceWith(fragment);
      }

      Array.from(element.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) wrapTextNode(node);
      });
      element.classList.add('msh-wave-text');
    }

    waveTargets.forEach(wrapWaveWords);

    if (canObserve) {
      const waveObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-wave-visible');
          waveObserver.unobserve(entry.target);
        });
      }, { rootMargin:'0px 0px -8% 0px', threshold:.18 });
      waveTargets.forEach(target => waveObserver.observe(target));
    } else {
      waveTargets.forEach(target => target.classList.add('is-wave-visible'));
    }
  }
})();
