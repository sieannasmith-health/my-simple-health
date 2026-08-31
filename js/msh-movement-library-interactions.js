/* My Simple Health — Movement Library item interactions */
(function () {
  'use strict';
  const directory = window.MSHMovementDirectory;
  const grid = document.getElementById('movement-library-grid');
  if (!directory || !grid) return;

  function closeDetail() {
    document.querySelector('[data-movement-detail]')?.remove();
  }

  function openDetail(item) {
    closeDetail();
    const wrap = document.createElement('div');
    wrap.dataset.movementDetail = '';
    wrap.className = 'movement-library-detail-backdrop';
    wrap.innerHTML = `<section class="movement-library-detail" role="dialog" aria-modal="true" aria-labelledby="movement-detail-title">
      <button type="button" class="movement-library-detail-close" data-close-movement-detail aria-label="Close">×</button>
      <p class="movement-library-eyebrow">${item.categoryLabel}</p>
      <h2 id="movement-detail-title">${item.label}</h2>
      <p>Use this movement when you record or plan Movement in MSH.</p>
      <div class="movement-library-detail-actions">
        <a class="playlist-action" href="calendar.html?view=movement&movement=${encodeURIComponent(item.id)}">Plan this movement</a>
        <button type="button" class="playlist-action playlist-secondary" data-close-movement-detail>Close</button>
      </div>
    </section>`;
    document.body.appendChild(wrap);
    wrap.querySelector('[data-close-movement-detail]')?.focus();
  }

  function enhance() {
    grid.querySelectorAll('.movement-library-item').forEach(chip => {
      if (chip.dataset.movementInteractive === 'true') return;
      const item = directory.items.find(entry => entry.label === chip.textContent.trim());
      if (!item) return;
      chip.dataset.movementInteractive = 'true';
      chip.dataset.movementId = item.id;
      chip.setAttribute('role','button');
      chip.setAttribute('tabindex','0');
      chip.setAttribute('aria-label',`Open ${item.label} details`);
    });
  }

  grid.addEventListener('click', event => {
    const chip = event.target.closest('[data-movement-id]');
    if (!chip) return;
    const item = directory.get(chip.dataset.movementId);
    if (item) openDetail(item);
  });

  grid.addEventListener('keydown', event => {
    const chip = event.target.closest('[data-movement-id]');
    if (!chip || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    const item = directory.get(chip.dataset.movementId);
    if (item) openDetail(item);
  });

  document.addEventListener('click', event => {
    if (event.target.closest('[data-close-movement-detail]')) closeDetail();
    else if (event.target.matches('[data-movement-detail]')) closeDetail();
  });

  const observer = new MutationObserver(enhance);
  observer.observe(grid,{childList:true,subtree:true});
  enhance();
})();
