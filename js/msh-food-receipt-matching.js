/* My Simple Health — receipt product candidate matching */
(function (root) {
  'use strict';

  const page = document.querySelector('[data-msh-food]');
  if (!page) return;

  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  function normalize(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ');
  }

  function localCandidates(name) {
    const app = root.MSHFoodAcquisitionApp;
    if (!app) return [];
    const query = normalize(name);
    if (!query) return [];
    return app.repository.snapshot().products
      .map(product => {
        const candidate = normalize(`${product.brand || ''} ${product.canonicalName || ''}`);
        const exact = candidate === query || normalize(product.canonicalName) === query;
        const contains = candidate.includes(query) || query.includes(normalize(product.canonicalName));
        return { product, score:exact ? 1 : contains ? 0.88 : 0 };
      })
      .filter(item => item.score > 0)
      .sort((a,b) => b.score - a.score)
      .slice(0,3);
  }

  function addMatchControls() {
    page.querySelectorAll('[data-receipt-line]').forEach(line => {
      if (line.querySelector('[data-match-receipt-product]')) return;
      const index = line.dataset.receiptLine;
      const main = line.querySelector('.msh-receipt-line-main');
      if (!main) return;
      const controls = document.createElement('div');
      controls.className = 'msh-receipt-match-controls';
      controls.innerHTML = `<button type="button" class="msh-food-secondary" data-match-receipt-product="${esc(index)}">Find product match</button><div data-match-results="${esc(index)}"></div>`;
      main.appendChild(controls);
    });
  }

  function selectLocal(index, productId, label) {
    const line = page.querySelector(`[data-receipt-line="${CSS.escape(String(index))}"]`);
    if (!line) return;
    line.dataset.matchedProductId = productId;
    line.dataset.matchProvider = 'msh_local';
    line.dataset.matchConfirmed = 'true';
    const name = line.querySelector(`[name="name-${CSS.escape(String(index))}"]`);
    if (name && label) name.value = label;
    const target = line.querySelector(`[data-match-results="${CSS.escape(String(index))}"]`);
    if (target) target.innerHTML = `<p class="msh-food-acquisition-status">Matched to an existing MSH product: <strong>${esc(label)}</strong></p>`;
  }

  async function saveExternalCandidate(index, candidate) {
    const app = root.MSHFoodAcquisitionApp;
    if (!app) return;
    let product = null;
    if (candidate.gtin) {
      try { product = app.repository.findProductByIdentifier(candidate.gtin); } catch (_) {}
    }
    if (!product) {
      product = app.repository.addProduct({
        canonicalName:candidate.canonicalName,
        brand:candidate.brand || null,
        category:'Branded food'
      });
      if (candidate.gtin) {
        try { app.repository.addIdentifier(product.id, { scheme:`gtin_${candidate.gtin.length}`, value:candidate.gtin, source:'usda_fdc' }); } catch (_) {}
      }
    }
    const line = page.querySelector(`[data-receipt-line="${CSS.escape(String(index))}"]`);
    if (!line) return;
    line.dataset.matchedProductId = product.id;
    line.dataset.matchProvider = candidate.provider || 'usda_fdc';
    line.dataset.matchProviderId = candidate.providerId || '';
    line.dataset.matchConfirmed = 'true';
    const name = line.querySelector(`[name="name-${CSS.escape(String(index))}"]`);
    if (name) name.value = product.canonicalName;
    const target = line.querySelector(`[data-match-results="${CSS.escape(String(index))}"]`);
    if (target) target.innerHTML = `<p class="msh-food-acquisition-status">Matched to <strong>${esc(product.canonicalName)}</strong>${product.brand ? ` · ${esc(product.brand)}` : ''}</p>`;
  }

  async function findMatches(button) {
    const index = button.dataset.matchReceiptProduct;
    const line = page.querySelector(`[data-receipt-line="${CSS.escape(String(index))}"]`);
    const input = line && line.querySelector(`[name="name-${CSS.escape(String(index))}"]`);
    const target = line && line.querySelector(`[data-match-results="${CSS.escape(String(index))}"]`);
    if (!line || !input || !target) return;
    const name = input.value.trim();
    if (!name) return;

    button.disabled = true;
    button.textContent = 'Finding matches…';
    target.innerHTML = '';
    try {
      const locals = localCandidates(name);
      let external = [];
      const response = await fetch('/api/food-product-match', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ name, receiptText:name })
      });
      const payload = await response.json();
      if (response.ok && payload.success) external = Array.isArray(payload.candidates) ? payload.candidates : [];

      const localMarkup = locals.map(({product,score}) => `<button type="button" class="msh-food-secondary msh-receipt-match-option" data-local-match="${esc(index)}" data-product-id="${esc(product.id)}" data-product-label="${esc(product.canonicalName)}"><strong>${esc(product.canonicalName)}</strong>${product.brand ? ` · ${esc(product.brand)}` : ''}<small>Existing MSH product · ${Math.round(score*100)}% text match</small></button>`).join('');
      const externalMarkup = external.map((candidate, candidateIndex) => `<button type="button" class="msh-food-secondary msh-receipt-match-option" data-external-match="${esc(index)}" data-candidate-index="${candidateIndex}"><strong>${esc(candidate.canonicalName)}</strong>${candidate.brand ? ` · ${esc(candidate.brand)}` : ''}<small>USDA candidate · ${Math.round(Number(candidate.score || 0)*100)}% text match${candidate.gtin ? ` · ${esc(candidate.gtin)}` : ''}</small></button>`).join('');
      line._mshExternalCandidates = external;
      target.innerHTML = localMarkup || externalMarkup
        ? `<div class="msh-receipt-match-list">${localMarkup}${externalMarkup}</div><small>Choose a match only when it is clearly the same product.</small>`
        : `<p class="msh-food-acquisition-status is-empty">No confident candidates found. This line can stay as a user-confirmed generic food.</p>`;
    } catch (error) {
      target.innerHTML = `<p class="msh-food-acquisition-status is-error">Product matching is unavailable right now.</p>`;
    } finally {
      button.disabled = false;
      button.textContent = 'Find product match';
    }
  }

  page.addEventListener('click', event => {
    const match = event.target.closest('[data-match-receipt-product]');
    if (match) { findMatches(match); return; }

    const local = event.target.closest('[data-local-match]');
    if (local) {
      selectLocal(local.dataset.localMatch, local.dataset.productId, local.dataset.productLabel);
      return;
    }

    const external = event.target.closest('[data-external-match]');
    if (external) {
      const index = external.dataset.externalMatch;
      const line = page.querySelector(`[data-receipt-line="${CSS.escape(String(index))}"]`);
      const candidate = line && line._mshExternalCandidates && line._mshExternalCandidates[Number(external.dataset.candidateIndex)];
      if (candidate) saveExternalCandidate(index, candidate);
    }
  });

  page.addEventListener('submit', event => {
    if (!event.target.matches('[data-receipt-review-form]')) return;
    page.querySelectorAll('[data-receipt-line]').forEach(line => {
      const index = line.dataset.receiptLine;
      const productId = line.dataset.matchedProductId;
      if (!productId || line.dataset.matchConfirmed !== 'true') return;
      let hidden = event.target.querySelector(`[name="matchedProductId-${CSS.escape(String(index))}"]`);
      if (!hidden) {
        hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = `matchedProductId-${index}`;
        event.target.appendChild(hidden);
      }
      hidden.value = productId;
    });
  }, true);

  const observer = new MutationObserver(addMatchControls);
  observer.observe(page, { childList:true, subtree:true });
  addMatchControls();
})(window);
