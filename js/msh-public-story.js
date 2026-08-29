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

  /* Restore the approved connected-journey carousel directly over the current hero landscape. */
  const currentHero = document.querySelector('.context-hero');
  const oldRail = currentHero && currentHero.querySelector('.context-feature-rail');
  if (currentHero && oldRail) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'css/msh-hero-journey.css';
    document.head.appendChild(css);
    currentHero.classList.add('has-journey-overlay');
    oldRail.outerHTML = `<section class="hero-journey-overlay" data-hero-journey aria-labelledby="hero-journey-title"><div class="hero-journey-heading"><div><p class="story-kicker">ONE CONNECTED JOURNEY</p><h2 id="hero-journey-title">A path that moves with you.</h2><p>Move through the cards to see how information becomes context, experience, learning, and a clearer picture over time.</p></div><div class="hero-journey-controls"><button type="button" data-hero-journey-prev aria-label="Previous journey stage">←</button><span class="hero-journey-position"><b data-hero-journey-position>1</b> / 6</span><button type="button" data-hero-journey-next aria-label="Next journey stage">→</button></div></div><div class="hero-journey-viewport" data-hero-journey-viewport><div class="hero-journey-track" data-hero-journey-track>${[
      ['01','Landscape','See where you are.','Bring the dimensions of your health and life together so your current picture has context.','What feels steady. What wants attention. What belongs together.','A clearer view of where you are now.','my-landscape.html'],
      ['02','Horizon','See where you want to go.','Bring the direction you care about into view without losing what you want to preserve.','What matters ahead. What you want to preserve.','A direction you have chosen and confirmed.','my-vision.html'],
      ['03','Path','Choose what matters now.','Shape one meaningful direction into movement that fits your actual capacity and life.','Your Point A and Point B. A realistic first milestone.','A visible path for what matters now.','my-project.html'],
      ['04','Practice','Try something in real life.','Try a small action in context, without making the outcome a test of your worth.','What fits your capacity. What happens when you try.','A practice grounded in real life.','my-practice.html'],
      ['05','Discovery','Notice what happened.','Notice what fits, what changed, and what your experience may be teaching you.','What you noticed. What seems worth testing.','Learning you can carry forward.','my-learning.html'],
      ['06','Journey',"See what you're learning.",'Look across events over time and see how your picture, choices, and understanding have moved.','Movement over time. What you want to continue.','A clearer picture of your health over time.','my-progress.html']
    ].map((c,i)=>`<article class="hero-journey-card${i===0?' is-active':''}" tabindex="0" data-hero-journey-card><span class="hero-card-number">${c[0]}</span><div class="hero-card-orbit" aria-hidden="true"><span></span></div><p class="hero-card-stage">${c[1]}</p><h3>${c[2]}</h3><p class="hero-card-support">${c[3]}</p><div class="hero-card-detail"><p class="hero-card-detail-label">Information in motion</p><p>${c[4]}</p><p class="hero-card-outcome"><span>You'll leave with</span>${c[5]}</p></div><a class="hero-card-cta" href="${c[6]}">Explore ${c[1]} →</a></article>`).join('')}</div></div></section>`;
    const behavior = document.createElement('script');
    behavior.src = 'js/msh-hero-journey.js';
    document.body.appendChild(behavior);
  }
})();
