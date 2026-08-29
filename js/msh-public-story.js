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

  if (lens) {
    lens.addEventListener('click', () => toggleMomentaryState(lens, 'is-active'));
  }

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
})();
