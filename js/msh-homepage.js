/* My Simple Health — Homepage Journey V1 */
(function () {
  'use strict';

  const menuButton = document.querySelector('[data-home-menu]');
  const navigation = document.querySelector('[data-home-navigation]');
  if (menuButton && navigation) {
    menuButton.addEventListener('click', function () {
      const open = !navigation.classList.contains('is-open');
      navigation.classList.toggle('is-open', open);
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.querySelector('.sr-only').textContent = open ? 'Close navigation' : 'Open navigation';
    });
    navigation.addEventListener('click', function (event) {
      if (!event.target.closest('a')) return;
      navigation.classList.remove('is-open');
      menuButton.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || !navigation.classList.contains('is-open')) return;
      navigation.classList.remove('is-open');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.focus();
    });
  }

  const journey = document.querySelector('[data-journey]');
  if (journey) createJourney(journey);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const revealItems = Array.from(document.querySelectorAll('.home-reveal'));
  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    revealItems.forEach(item => item.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin:'0px 0px -12% 0px', threshold:.12 });
    revealItems.forEach(item => observer.observe(item));
  }

  function createJourney(root) {
    const viewport = root.querySelector('[data-journey-viewport]');
    const track = root.querySelector('[data-journey-track]');
    const cards = Array.from(root.querySelectorAll('[data-journey-card]'));
    const previous = root.querySelector('[data-journey-previous]');
    const next = root.querySelector('[data-journey-next]');
    const position = root.querySelector('[data-journey-position]');
    const progress = root.querySelector('[data-journey-progress]');
    const point = root.querySelector('[data-journey-point]');
    const desktop = window.matchMedia('(min-width: 901px)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let activeIndex = 0;
    let frame = 0;

    function clamp(value, minimum, maximum) {
      return Math.min(maximum, Math.max(minimum, value));
    }

    function maxTrackOffset() {
      return Math.max(0, track.scrollWidth - window.innerWidth);
    }

    function setActive(index, continuousProgress) {
      activeIndex = clamp(index, 0, cards.length - 1);
      cards.forEach(function (card, cardIndex) {
        const active = cardIndex === activeIndex;
        card.classList.toggle('is-active', active);
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

    function desktopProgress() {
      const rect = root.getBoundingClientRect();
      const travel = Math.max(1, root.offsetHeight - window.innerHeight);
      return clamp(-rect.top / travel, 0, 1);
    }

    function updateDesktop() {
      frame = 0;
      if (!desktop.matches || reduce.matches) return;
      const value = desktopProgress();
      track.style.transform = `translate3d(${-maxTrackOffset() * value}px,0,0)`;
      setActive(Math.round(value * (cards.length - 1)), value);
    }

    function requestDesktopUpdate() {
      if (frame) return;
      frame = window.requestAnimationFrame(updateDesktop);
    }

    function closestMobileCard() {
      const viewportCenter = viewport.scrollLeft + viewport.clientWidth / 2;
      let closestIndex = 0;
      let closestDistance = Infinity;
      cards.forEach(function (card, index) {
        const center = card.offsetLeft + card.offsetWidth / 2;
        const distance = Math.abs(center - viewportCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      setActive(closestIndex);
    }

    function goTo(index, moveFocus) {
      const target = clamp(index, 0, cards.length - 1);
      if (desktop.matches && !reduce.matches) {
        const rootTop = window.scrollY + root.getBoundingClientRect().top;
        const travel = Math.max(1, root.offsetHeight - window.innerHeight);
        window.scrollTo({ top:rootTop + (target / Math.max(1, cards.length - 1)) * travel, behavior:'smooth' });
      } else {
        cards[target].scrollIntoView({ behavior:reduce.matches ? 'auto' : 'smooth', block:'nearest', inline:'center' });
        setActive(target);
      }
      if (moveFocus) cards[target].focus({ preventScroll:true });
    }

    previous.addEventListener('click', function () { goTo(activeIndex - 1, false); });
    next.addEventListener('click', function () { goTo(activeIndex + 1, false); });
    viewport.addEventListener('scroll', function () {
      if (desktop.matches && !reduce.matches) return;
      window.clearTimeout(viewport._mshScrollTimer);
      viewport._mshScrollTimer = window.setTimeout(closestMobileCard, 50);
    }, { passive:true });

    cards.forEach(function (card, index) {
      card.addEventListener('focus', function () { setActive(index); });
      card.addEventListener('click', function (event) {
        if (event.target.closest('a')) return;
        goTo(index, false);
      });
      card.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        goTo(index + (event.key === 'ArrowRight' ? 1 : -1), true);
      });
    });

    window.addEventListener('scroll', requestDesktopUpdate, { passive:true });
    window.addEventListener('resize', function () {
      track.style.transform = '';
      if (desktop.matches && !reduce.matches) requestDesktopUpdate();
      else closestMobileCard();
    }, { passive:true });
    if (typeof desktop.addEventListener === 'function') desktop.addEventListener('change', requestDesktopUpdate);
    if (typeof reduce.addEventListener === 'function') reduce.addEventListener('change', requestDesktopUpdate);
    setActive(0, 0);
    requestDesktopUpdate();
  }
})();
