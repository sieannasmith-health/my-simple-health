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

  const trustStrip = document.querySelector('.trust-strip');
  if (trustStrip) {
    const trustPrinciples = [
      {
        name: 'Evidence',
        card: 'See what the science supports. And how strongly.',
        heading: 'You should be able to see what supports what you’re being told.',
        body: 'MSH distinguishes established knowledge from emerging evidence, estimates, and ideas that are still uncertain. When evidence matters, we show where information comes from and help you understand how much confidence to place in it.',
        links: ['Evidence standards']
      },
      {
        name: 'Context',
        card: 'Your health doesn’t happen in isolation. Your life is part of the picture.',
        heading: 'Health information means more when your life is considered with it.',
        body: 'Your experiences, environment, routines, resources, priorities, and circumstances can all shape health. MSH helps you consider those connections without reducing your health to a number, diagnosis, or single behavior. Your context helps build the picture. It does not define you.',
        links: ['How MSH uses context']
      },
      {
        name: 'Uncertainty',
        card: 'We won’t pretend to know what we don’t. Uncertainty stays visible.',
        heading: 'Sometimes the most trustworthy answer is: we don’t know yet.',
        body: 'Health science is not always certain, and neither is information about you. MSH distinguishes what is known, observed, estimated, predicted, or still unclear rather than presenting everything with the same confidence. As better information becomes available, your picture can change.',
        links: ['How MSH communicates uncertainty']
      },
      {
        name: 'Privacy',
        card: 'Your health information is yours. You should know what happens to it.',
        heading: 'Understanding your health shouldn’t require giving up control of your information.',
        body: 'MSH is designed to make it clear what information is collected, why it is used, where it belongs in your health experience, and what choices you have over it. Privacy should not be something you have to assume. You should be able to inspect it.',
        links: ['Privacy', 'Information protection']
      },
      {
        name: 'Choice',
        card: 'You decide what belongs in My Health. Your health remains yours to navigate.',
        heading: 'MSH can help you understand your health without taking ownership of the journey.',
        body: 'You decide what to explore, what to share, what to save, what to change, and when to stop. Guidance can offer possibilities, but it should not quietly turn those possibilities into decisions for you. Your choices remain visible and reversible wherever possible.',
        links: ['How MSH protects user choice']
      }
    ];

    const intro = trustStrip.firstElementChild;
    if (intro) {
      const introCopy = intro.querySelector('p');
      if (introCopy) introCopy.textContent = 'These principles guide how MSH handles your health, your information, and what we don’t yet know.';
    }

    const principleCells = Array.from(trustStrip.children).slice(1);
    principleCells.forEach((cell, index) => {
      const principle = trustPrinciples[index];
      if (!principle) return;
      cell.classList.add('trust-principle');
      cell.innerHTML = '';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'trust-principle-button';
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', `trust-detail-${index}`);
      button.innerHTML = `<strong>${principle.name}</strong><span>${principle.card}</span><i aria-hidden="true">+</i>`;
      cell.appendChild(button);
    });

    const detail = document.createElement('section');
    detail.className = 'trust-detail';
    detail.hidden = true;
    detail.setAttribute('aria-live', 'polite');
    trustStrip.insertAdjacentElement('afterend', detail);

    const styles = document.createElement('style');
    styles.textContent = `
      .trust-principle{padding:0!important}.trust-principle-button{width:100%;height:100%;min-height:150px;padding:24px;border:0;background:#fbf9f3;color:#252822;text-align:left;cursor:pointer;font:inherit;position:relative}.trust-principle-button strong{display:block;font-size:12px;margin-bottom:10px}.trust-principle-button span{display:block;font-size:11px;line-height:1.5;max-width:20ch}.trust-principle-button i{position:absolute;right:18px;bottom:16px;font:400 18px Georgia,serif;color:#6f8656}.trust-principle-button:hover,.trust-principle-button:focus-visible{background:#fff}.trust-principle-button:focus-visible{outline:2px solid #173d2b;outline-offset:-3px}.trust-principle-button[aria-expanded="true"]{background:#f3f1e9}.trust-principle-button[aria-expanded="true"] i{transform:rotate(45deg)}.trust-detail{width:min(1180px,100%);box-sizing:border-box;margin:10px auto 0;padding:clamp(26px,4vw,46px);border:1px solid rgba(23,61,43,.12);border-radius:22px;background:rgba(251,249,243,.96);color:#252822}.trust-detail[hidden]{display:none}.trust-detail-top{display:flex;align-items:flex-start;justify-content:space-between;gap:24px}.trust-detail-label{margin:0 0 10px;font:700 11px/1.2 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#6f8656}.trust-detail h3{max-width:760px;margin:0;font:400 clamp(24px,3vw,36px)/1.12 Georgia,serif;color:#173d2b}.trust-detail-body{max-width:760px;margin:20px 0 0;font-size:14px;line-height:1.7}.trust-detail-close{flex:0 0 auto;width:44px;height:44px;border:1px solid rgba(23,61,43,.14);border-radius:50%;background:transparent;color:#173d2b;font-size:22px;cursor:pointer}.trust-detail-close:hover,.trust-detail-close:focus-visible{background:#fff}.trust-detail-links{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}.trust-detail-links span{display:inline-flex;align-items:center;min-height:42px;padding:0 16px;border:1px solid rgba(23,61,43,.14);border-radius:999px;font-size:12px;color:#596159}.trust-document-note{margin:18px 0 0;font-size:11px;line-height:1.5;color:#6a716c}.trust-document-note strong{font-size:inherit}.trust-detail-footer{width:min(1180px,100%);box-sizing:border-box;margin:14px auto 0;padding:0 4px;font-size:11px;line-height:1.5;color:#596159}.trust-detail-footer strong{color:#173d2b}.trust-detail-footer span{white-space:normal}@media(max-width:800px){.trust-principle-button{min-height:132px}.trust-detail{margin-top:8px}}@media(max-width:520px){.trust-principle-button{min-height:auto;padding:22px}.trust-principle-button span{max-width:32ch;padding-right:26px}.trust-detail-top{gap:12px}.trust-detail{padding:24px 20px}.trust-detail-links{display:grid}.trust-detail-links span{border-radius:14px}}`;
    document.head.appendChild(styles);

    const footer = document.createElement('p');
    footer.className = 'trust-detail-footer';
    footer.innerHTML = '<strong>Trust should be inspectable.</strong> <span>Privacy · Information Protection · Safety · Governance · Accountability</span>';
    detail.insertAdjacentElement('afterend', footer);

    let activeButton = null;

    function closeTrustDetail(returnFocus) {
      detail.hidden = true;
      principleCells.forEach(cell => {
        const button = cell.querySelector('.trust-principle-button');
        if (button) button.setAttribute('aria-expanded', 'false');
      });
      if (returnFocus && activeButton) activeButton.focus();
      activeButton = null;
    }

    function openTrustDetail(principle, button, index) {
      const wasOpen = button.getAttribute('aria-expanded') === 'true';
      if (wasOpen) {
        closeTrustDetail(false);
        return;
      }

      principleCells.forEach(cell => {
        const other = cell.querySelector('.trust-principle-button');
        if (other) other.setAttribute('aria-expanded', 'false');
      });
      button.setAttribute('aria-expanded', 'true');
      activeButton = button;
      detail.id = `trust-detail-${index}`;
      detail.innerHTML = `<div class="trust-detail-top"><div><p class="trust-detail-label">${principle.name}</p><h3>${principle.heading}</h3></div><button class="trust-detail-close" type="button" aria-label="Close ${principle.name} details">×</button></div><p class="trust-detail-body">${principle.body}</p><div class="trust-detail-links" aria-label="Related trust documentation">${principle.links.map(link => `<span>${link} →</span>`).join('')}</div><p class="trust-document-note"><strong>Documentation doorway:</strong> deeper policy and governance pages will link here as they are published.</p>`;
      detail.hidden = false;
      detail.querySelector('.trust-detail-close').addEventListener('click', () => closeTrustDetail(true));
    }

    principleCells.forEach((cell, index) => {
      const button = cell.querySelector('.trust-principle-button');
      if (!button) return;
      button.addEventListener('click', () => openTrustDetail(trustPrinciples[index], button, index));
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !detail.hidden) closeTrustDetail(true);
    });
  }
})();
