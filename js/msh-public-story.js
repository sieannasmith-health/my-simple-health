/* My Simple Health — public story progressive reveal */
(function () {
  'use strict';
  const items = Array.from(document.querySelectorAll('.story-reveal'));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) {
    items.forEach(item => item.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { rootMargin:'0px 0px -10% 0px', threshold:.08 });
  items.forEach(item => observer.observe(item));
})();
