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

  function nutrientSummary(nutrition) {
    if (!nutrition || typeof nutrition !== 'object') return '';
    const parts = [];
    if (nutrition.caloriesKcal != null) parts.push(`${nutrition.caloriesKcal} kcal`);
    if (nutrition.proteinG != null) parts.push(`${nutrition.proteinG}g protein`);
    if (nutrition.carbohydrateG != null) parts.push(`${nutrition.carbohydrateG}g carbs`);
    if (nutrition.fatG != null) parts.push(`${nutrition.fatG}g fat`);
    return parts.join(' · ');
  }

  function servingLabel(candidate) {
    const serving = candidate && candidate.serving || {};
    if (serving.household) return serving.household;
    if (serving.size != null && serving.unit) return `${serving.size} ${serving.unit}`;
    if (candidate && candidate.packageWeight) return candidate.packageWeight;
    return '';
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

  function saveSpecificity(productId, candidate) {
    if (!root.MSHStorage || !productId || !candidate) return;
    root.MSHStorage.updateState(state => {
      state.food = state.food || { foods:[], onHand:[], meals:[], recipes:[], groceries:[] };
      state.food.productSpecifics = state.food.productSpecifics && typeof state.food.productSpecifics === 'object'
        ? state.food.productSpecifics : {};
      state.food.productSpecifics[productId] = {
        productId,
        specificity:'exact_branded',
        provider:candidate.provider || 'usda_fdc',
        providerId:candidate.providerId || null,
        gtin:candidate.gtin || null,
        brand:candidate.brand || null,
        brandOwner:candidate.brandOwner || null,
        packageWeight:candidate.packageWeight || null,
        category:candidate.category || null,
        ingredients:candidate.ingredients || null,
        serving:candidate.serving || { size:null, unit:null, household:null },
        nutrition:candidate.nutrition || null,
        confirmedAt:new Date().toISOString(),
        provenance:'USER_CONFIRMED'
      };
      return state;
    });
  }

  function addMatchControls() {
    page.querySelectorAll('[data-receipt-line]').forEach(line => {
      if (line.querySelector('[data-match-receipt-product]')) return;
      const index = line.dataset.receiptLine;
      const main = line.querySelector('.msh-receipt-line-main');
      if (!main) return;
      const controls = document.createElement('div');
      controls.className = 'msh-receipt-match-controls';
      controls.innerHTML = `<div class="msh-receipt-specificity-choice"><span>Product detail</span><button type="button" class="msh-food-secondary" data-use-generic="${esc(index)}">Keep general</button><button type="button" class="msh-food-secondary" data-match-receipt-product="${esc(index)}">Choose exact product</button></div><div data-match-results="${esc(index)}"></div>`;
      main.appendChild(controls);
    });
  }

  function useGeneric(index) {
    const line = page.querySelector(`[data-receipt-line="${CSS.escape(String(index))}"]`);
    if (!line) return;
    delete line.dataset.matchedProductId;
    delete line.dataset.matchProvider;
    delete line.dataset.matchProviderId;
    delete line.dataset.matchConfirmed;
    const target = line.querySelector(`[data-match-results="${CSS.escape(String(index))}"]`);
    if (target) target.innerHTML = '<p class="msh-food-acquisition-status is-empty">General food selected. MSH will keep the confirmed food name without forcing a branded match.</p>';
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
        description:candidate.packageWeight || null,
        category:candidate.category || 'Branded food'
      });
      if (candidate.gtin) {
        try { app.repository.addIdentifier(product.id, { scheme:`gtin_${candidate.gtin.length}`, value:candidate.gtin, source:'usda_fdc' }); } catch (_) {}
      }
    }
    saveSpecificity(product.id, candidate);
    const line = page.querySelector(`[data-receipt-line="${CSS.escape(String(index))}"]`);
    if (!line) return;
    line.dataset.matchedProductId = product.id;
    line.dataset.matchProvider = candidate.provider || 'usda_fdc';
    line.dataset.matchProviderId = candidate.providerId || '';
    line.dataset.matchConfirmed = 'true';
    const name = line.querySelector(`[name="name-${CSS.escape(String(index))}"]`);
    if (name) name.value = product.canonicalName;
    const target = line.querySelector(`[data-match-results="${CSS.escape(String(index))}"]`);
    const serving = servingLabel(candidate);
    const nutrients = nutrientSummary(candidate.nutrition);
    if (target) target.innerHTML = `<div class="msh-food-acquisition-status"><strong>Exact product selected</strong><br>${esc(product.canonicalName)}${product.brand ? ` · ${esc(product.brand)}` : ''}${candidate.gtin ? `<br>UPC/GTIN ${esc(candidate.gtin)}` : ''}${serving ? `<br>Serving: ${esc(serving)}` : ''}${nutrients ? `<br>Per 100 g: ${esc(nutrients)}` : ''}</div>`;
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
    button.textContent = 'Finding exact products…';
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

      const localMarkup = locals.map(({product,score}) => `<button type="button" class="msh-food-secondary msh-receipt-match-option" data-local-match="${esc(index)}" data-product-id="${esc(product.id)}" data-product-label="${esc(product.canonicalName)}"><strong>${esc(product.canonicalName)}</strong>${product.brand ? ` · ${esc(product.brand)}` : ''}<small>Already in MSH · ${Math.round(score*100)}% text match</small></button>`).join('');
      const externalMarkup = external.map((candidate, candidateIndex) => {
        const serving = servingLabel(candidate);
        const nutrients = nutrientSummary(candidate.nutrition);
        return `<button type="button" class="msh-food-secondary msh-receipt-match-option msh-receipt-match-specific" data-external-match="${esc(index)}" data-candidate-index="${candidateIndex}"><strong>${esc(candidate.canonicalName)}</strong>${candidate.brand ? `<span>${esc(candidate.brand)}</span>` : ''}<small>${candidate.gtin ? `UPC/GTIN ${esc(candidate.gtin)}` : 'USDA branded food'}${candidate.packageWeight ? ` · Package ${esc(candidate.packageWeight)}` : ''}${serving ? ` · Serving ${esc(serving)}` : ''}</small>${nutrients ? `<small>${esc(nutrients)} per 100 g</small>` : ''}<small>${Math.round(Number(candidate.score || 0)*100)}% receipt-text match</small></button>`;
      }).join('');
      line._mshExternalCandidates = external;
      target.innerHTML = localMarkup || externalMarkup
        ? `<div class="msh-receipt-match-list"><div class="msh-receipt-match-help"><strong>Choose how specific you want to be.</strong><span>Exact products retain brand, UPC/GTIN, package/serving information and available nutrition for later food logging.</span></div>${localMarkup}${externalMarkup}</div><small>Only select an exact product when it is clearly the item you bought. Otherwise keep the general food.</small>`
        : `<p class="msh-food-acquisition-status is-empty">No exact branded candidates found. You can keep this as a general food.</p>`;
    } catch (error) {
      target.innerHTML = `<p class="msh-food-acquisition-status is-error">Product matching is unavailable right now. You can still keep the general food.</p>`;
    } finally {
      button.disabled = false;
      button.textContent = 'Choose exact product';
    }
  }

  page.addEventListener('click', event => {
    const generic = event.target.closest('[data-use-generic]');
    if (generic) { useGeneric(generic.dataset.useGeneric); return; }

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
