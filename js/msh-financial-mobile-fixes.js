/* MSH Financial Health mobile QA fixes */
(function () {
  'use strict';
  const root = document.querySelector('[data-financial-health]');
  if (!root) return;

  root.addEventListener('click', event => {
    const button = event.target.closest('.msh-financial-dialog button');
    if (!button) return;

    const isCancel = button.value === 'cancel' || /^cancel$/i.test((button.textContent || '').trim());
    if (!isCancel) return;

    event.preventDefault();
    event.stopPropagation();
    button.closest('dialog')?.close();
  }, true);
})();
