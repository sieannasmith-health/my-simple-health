/* My Simple Health — user-facing Self-Insight language for the legacy assessments route */
(function () {
  'use strict';

  function applySelfInsightCopy(scope) {
    const root = scope && scope.querySelectorAll ? scope : document;

    root.querySelectorAll('[data-msh-route="assessments"]').forEach(link => {
      const section = link.closest('section');
      const heading = section && section.querySelector('h2');
      if (heading && /^Assessments$/i.test(heading.textContent.trim())) heading.textContent = 'Self-Insight';

      const textNode = [...link.childNodes].find(node => node.nodeType === Node.TEXT_NODE && /assessments/i.test(node.textContent || ''));
      if (textNode) textNode.textContent = textNode.textContent.replace(/Explore assessments/i, 'Open Self-Insight').replace(/Assessments/gi, 'Self-Insight');

      if (/^Assessments$/i.test(link.textContent.trim())) link.textContent = 'Self-Insight';
      if (link.getAttribute('aria-label')) link.setAttribute('aria-label', link.getAttribute('aria-label').replace(/assessments/gi, 'Self-Insight'));
      if (link.getAttribute('title')) link.setAttribute('title', link.getAttribute('title').replace(/assessments/gi, 'Self-Insight'));
    });
  }

  function mount() {
    applySelfInsightCopy(document);
    const target = document.querySelector('[data-msh-dashboard]') || document.body;
    if (!target || !window.MutationObserver) return;
    const observer = new MutationObserver(() => applySelfInsightCopy(target));
    observer.observe(target, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
