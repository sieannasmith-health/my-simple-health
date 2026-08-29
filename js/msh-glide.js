/* My Simple Health — shared, accessible gliding-panel controller */
(function (root) {
  'use strict';

  let instanceCount = 0;

  function reducedMotion() {
    return typeof root.matchMedia === 'function' && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function currentIndex(track, items) {
    const position = track.scrollLeft;
    let closest = 0;
    let distance = Infinity;
    items.forEach((item, index) => {
      const itemPosition = item.offsetLeft - track.offsetLeft;
      const nextDistance = Math.abs(itemPosition - position);
      if (nextDistance < distance) {
        distance = nextDistance;
        closest = index;
      }
    });
    return closest;
  }

  function mount(track) {
    if (!track || track.dataset.mshGlideBound === 'true') return null;
    const items = Array.from(track.children);
    if (items.length < 2) return null;

    track.dataset.mshGlideBound = 'true';
    track.tabIndex = 0;
    track.setAttribute('role', 'region');
    track.setAttribute('aria-roledescription', 'carousel');

    const label = track.dataset.mshGlideLabel || 'Explore';
    const itemName = track.dataset.mshGlideItem || 'panel';
    track.setAttribute('aria-label', label);

    const shell = document.createElement('div');
    shell.className = 'msh-glide-shell';

    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'msh-glide-arrow msh-glide-arrow--previous';
    previous.setAttribute('aria-label', `Previous ${itemName}`);
    previous.textContent = '←';

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'msh-glide-arrow msh-glide-arrow--next';
    next.setAttribute('aria-label', `Next ${itemName}`);
    next.textContent = '→';

    const position = document.createElement('output');
    const positionId = `msh-glide-position-${++instanceCount}`;
    position.id = positionId;
    position.className = 'msh-glide-position';
    position.setAttribute('aria-live', 'polite');
    position.setAttribute('aria-atomic', 'true');
    const visiblePosition = document.createElement('span');
    visiblePosition.setAttribute('aria-hidden', 'true');
    const spokenPosition = document.createElement('span');
    spokenPosition.className = 'msh-visually-hidden';
    position.append(visiblePosition, spokenPosition);
    track.setAttribute('aria-describedby', positionId);

    track.parentNode.insertBefore(shell, track);
    shell.append(previous, track, next, position);

    items.forEach((item, index) => {
      item.setAttribute('aria-posinset', String(index + 1));
      item.setAttribute('aria-setsize', String(items.length));
    });

    let active = 0;
    let settleTimer = 0;

    function update(index) {
      active = Math.max(0, Math.min(items.length - 1, index));
      previous.disabled = active === 0;
      next.disabled = active === items.length - 1;
      items.forEach((item, itemIndex) => item.classList.toggle('is-current', itemIndex === active));
      visiblePosition.textContent = `${active + 1} / ${items.length}`;
      spokenPosition.textContent = `${itemName[0].toUpperCase()}${itemName.slice(1)} ${active + 1} of ${items.length}`;
    }

    function settle() {
      update(currentIndex(track, items));
      if (root.MSHFeedback) MSHFeedback.emit('settle', { source:'glide', target:items[active] });
    }

    function goTo(index, source) {
      const targetIndex = Math.max(0, Math.min(items.length - 1, index));
      if (targetIndex === active && source !== 'initial') return;
      if (root.MSHFeedback && source !== 'initial') MSHFeedback.emit('select', { source:'glide', target:source === 'previous' ? previous : next });
      update(targetIndex);
      track.scrollTo({
        left: items[targetIndex].offsetLeft - track.offsetLeft,
        behavior: reducedMotion() ? 'auto' : 'smooth'
      });
      root.clearTimeout(settleTimer);
      settleTimer = root.setTimeout(settle, reducedMotion() ? 0 : 280);
    }

    previous.addEventListener('click', () => goTo(active - 1, 'previous'));
    next.addEventListener('click', () => goTo(active + 1, 'next'));
    track.addEventListener('keydown', event => {
      if (event.target !== track || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      goTo(active + (event.key === 'ArrowRight' ? 1 : -1), event.key === 'ArrowRight' ? 'next' : 'previous');
    });
    track.addEventListener('scroll', () => {
      update(currentIndex(track, items));
      root.clearTimeout(settleTimer);
      settleTimer = root.setTimeout(settle, reducedMotion() ? 0 : 140);
    }, { passive:true });
    root.addEventListener('resize', () => update(currentIndex(track, items)), { passive:true });

    update(0);
    return Object.freeze({ track, previous, next, position, goTo, getIndex:() => active });
  }

  function mountAll(scope) {
    const context = scope && typeof scope.querySelectorAll === 'function' ? scope : document;
    return Array.from(context.querySelectorAll('.msh-glide')).map(mount).filter(Boolean);
  }

  function initialize() {
    mountAll(document);
    if (typeof root.MutationObserver !== 'function') return;
    const observer = new MutationObserver(records => {
      if (records.some(record => record.addedNodes.length)) mountAll(document);
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }

  root.MSHGlide = Object.freeze({ mount, mountAll, currentIndex });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once:true });
  else initialize();
})(typeof window !== 'undefined' ? window : globalThis);
