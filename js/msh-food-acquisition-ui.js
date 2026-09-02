/* My Simple Health — Food Acquisition progressive UI */
(function (root) {
  'use strict';

  const page = document.querySelector('[data-msh-food]');
  const lookup = root.MSHFoodProductLookup;
  const storage = root.MSHStorage;
  if (!page || !lookup || !storage) return;

  let lastLookup = null;
  let scanner = null;
  let stream = null;
  const nativeBarcodePending = new Map();
  let nativeBarcodeReceiverInstalled = false;

  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  function dialog() { return page.querySelector('[data-food-dialog]'); }

  function closeScanner() {
    if (scanner) {
      cancelAnimationFrame(scanner);
      scanner = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
  }

  function nativeBarcodeAvailable() {
    return Boolean(root.MSH_NATIVE_SHELL && root.webkit?.messageHandlers?.mshNotifications);
  }

  function installNativeBarcodeReceiver() {
    if (nativeBarcodeReceiverInstalled) return;
    const previous = root.MSHNotificationsReceive;
    root.MSHNotificationsReceive = response => {
      if (response?.action === 'scanBarcode' && response.requestId && nativeBarcodePending.has(response.requestId)) {
        const pending = nativeBarcodePending.get(response.requestId);
        nativeBarcodePending.delete(response.requestId);
        if (response.error) pending.reject(new Error(response.error));
        else if (response.barcode) pending.resolve(response.barcode);
        else pending.reject(new Error('No barcode was returned.'));
      }
      if (typeof previous === 'function') previous(response);
    };
    nativeBarcodeReceiverInstalled = true;
  }

  function scanBarcodeNatively() {
    installNativeBarcodeReceiver();
    return new Promise((resolve, reject) => {
      const requestId = `barcode-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      nativeBarcodePending.set(requestId, { resolve, reject });
      try {
        root.webkit.messageHandlers.mshNotifications.postMessage({ action:'scanBarcode', requestId });
      } catch (error) {
        nativeBarcodePending.delete(requestId);
        reject(error);
      }
    });
  }

  function enhanceAddMenu() {
    const actions = page.querySelector('[data-food-dialog] .msh-food-actions');
    if (!actions || actions.querySelector('[data-food-barcode]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'msh-food-action';
    button.dataset.foodBarcode = '';
    button.innerHTML = '▥ <strong>Scan barcode</strong><br><small>Use your iPhone camera or enter a UPC / GTIN.</small>';
    actions.prepend(button);
  }

  function barcodeDialog(message) {
    closeScanner();
    lastLookup = null;
    const target = dialog();
    if (!target) return;
    const canNativeScan = nativeBarcodeAvailable();
    const canWebScan = 'BarcodeDetector' in root && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    target.innerHTML = `<div class="msh-food-dialog-card msh-food-barcode-card">
      <div class="msh-food-dialog-head"><div><h2>Scan a barcode</h2><p>Scan with your iPhone camera, or enter the UPC / GTIN printed below the barcode.</p></div><button class="msh-food-close" type="button" data-acquisition-close aria-label="Close">×</button></div>
      ${message ? `<p class="msh-food-acquisition-message">${esc(message)}</p>` : ''}
      <form class="msh-food-form" data-barcode-form>
        <label>UPC / GTIN<input name="code" inputmode="numeric" autocomplete="off" placeholder="e.g. 036000291452" required></label>
        <div class="msh-food-acquisition-actions">
          ${(canNativeScan || canWebScan) ? '<button class="msh-food-secondary" type="button" data-start-barcode-camera>Scan with camera</button>' : ''}
          <button class="msh-food-primary" type="submit">Look up product</button>
        </div>
      </form>
      <div data-barcode-camera hidden><video playsinline muted></video><p>Hold the barcode inside the camera view.</p></div>
      <div data-barcode-result aria-live="polite"></div>
    </div>`;
    target.hidden = false;
  }

  function showStatus(text, kind) {
    const region = page.querySelector('[data-barcode-result]');
    if (!region) return;
    region.innerHTML = `<p class="msh-food-acquisition-status${kind ? ` is-${esc(kind)}` : ''}">${esc(text)}</p>`;
  }

  function showProduct(result) {
    lastLookup = result;
    const product = result.product || {};
    const region = page.querySelector('[data-barcode-result]');
    if (!region) return;
    const identifier = product.identifier || result.identifier || {};
    region.innerHTML = `<article class="msh-food-product-result">
      ${product.imageUrl ? `<img src="${esc(product.imageUrl)}" alt="" loading="lazy">` : ''}
      <div><span>${esc(product.brand || 'Product')}</span><h3>${esc(product.canonicalName || 'Unnamed product')}</h3>
      <p>${esc([product.packageQuantity, product.packageUnit].filter(value => value != null && value !== '').join(' ') || identifier.value || '')}</p>
      <small>Source: ${esc(result.source === 'local' ? 'My Food' : 'Open Food Facts')}</small></div>
    </article>
    <div class="msh-food-acquisition-actions"><button class="msh-food-primary" type="button" data-save-barcode-product>Add to Your Food</button></div>`;
  }

  function projectIntoYourFood(product) {
    let projected = null;
    storage.updateState(state => {
      if (!state.food || typeof state.food !== 'object') state.food = { foods:[], onHand:[], meals:[], recipes:[], groceries:[] };
      if (!Array.isArray(state.food.foods)) state.food.foods = [];
      const linked = state.food.foods.find(item => item.productId === product.id);
      if (linked) {
        linked.status = 'active';
        linked.updatedAt = new Date().toISOString();
        projected = linked;
        return state;
      }
      const sameName = state.food.foods.find(item =>
        String(item.name || '').trim().toLowerCase() === String(product.canonicalName || '').trim().toLowerCase() && item.status !== 'archived'
      );
      if (sameName) {
        sameName.productId = product.id;
        sameName.source = sameName.source || 'user';
        sameName.productSource = 'product_lookup';
        sameName.updatedAt = new Date().toISOString();
        projected = sameName;
        return state;
      }
      projected = {
        id:storage.uid('food'),
        productId:product.id,
        name:product.canonicalName || 'Unnamed product',
        category:product.category || 'Packaged foods',
        status:'active',
        source:'product_lookup',
        createdAt:new Date().toISOString(),
        updatedAt:new Date().toISOString()
      };
      state.food.foods.push(projected);
      return state;
    });
    return projected;
  }

  async function performLookup(code) {
    showStatus('Looking up product…');
    try {
      const result = await lookup.lookup(code);
      if (!result.found) {
        lastLookup = null;
        showStatus('This barcode is valid, but the product is not in the connected product source yet. You can still add it manually.', 'empty');
        return;
      }
      showProduct(result);
    } catch (error) {
      lastLookup = null;
      showStatus(error && error.message ? error.message : 'The product could not be looked up.', 'error');
    }
  }

  async function startCamera() {
    if (nativeBarcodeAvailable()) {
      showStatus('Opening camera…');
      try {
        const value = await scanBarcodeNatively();
        const input = page.querySelector('[data-barcode-form] input[name="code"]');
        if (input) input.value = value;
        await performLookup(value);
      } catch (error) {
        const message = error?.message || 'The barcode could not be scanned.';
        if (!/canceled/i.test(message)) showStatus(message, 'empty');
      }
      return;
    }

    const wrapper = page.querySelector('[data-barcode-camera]');
    const video = wrapper && wrapper.querySelector('video');
    if (!wrapper || !video || !('BarcodeDetector' in root)) return;
    closeScanner();
    try {
      const formats = ['ean_8','ean_13','upc_a','upc_e'];
      const detector = new BarcodeDetector({ formats });
      stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' } }, audio:false });
      video.srcObject = stream;
      wrapper.hidden = false;
      await video.play();
      const scan = async () => {
        if (!stream) return;
        try {
          const codes = await detector.detect(video);
          const value = codes.find(code => code && code.rawValue)?.rawValue;
          if (value) {
            closeScanner();
            wrapper.hidden = true;
            const input = page.querySelector('[data-barcode-form] input[name="code"]');
            if (input) input.value = value;
            await performLookup(value);
            return;
          }
        } catch (_) { }
        scanner = requestAnimationFrame(scan);
      };
      scanner = requestAnimationFrame(scan);
    } catch (error) {
      closeScanner();
      wrapper.hidden = true;
      showStatus('Camera scanning is unavailable here. Enter the UPC / GTIN instead.', 'empty');
    }
  }

  page.addEventListener('click', async event => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.matches('[data-open-add]')) {
      queueMicrotask(enhanceAddMenu);
      return;
    }
    if (target.matches('[data-food-barcode]')) {
      barcodeDialog();
      return;
    }
    if (target.matches('[data-acquisition-close]')) {
      closeScanner();
      const targetDialog = dialog();
      if (targetDialog) targetDialog.hidden = true;
      return;
    }
    if (target.matches('[data-start-barcode-camera]')) {
      await startCamera();
      return;
    }
    if (target.matches('[data-save-barcode-product]')) {
      if (!lastLookup) return;
      try {
        const product = lookup.saveLookupResult(lastLookup);
        projectIntoYourFood(product);
        barcodeDialog(`${product.canonicalName || 'Product'} was added to Your Food.`);
      } catch (error) {
        showStatus(error && error.message ? error.message : 'The product could not be saved.', 'error');
      }
    }
  });

  page.addEventListener('submit', async event => {
    const form = event.target.closest('[data-barcode-form]');
    if (!form) return;
    event.preventDefault();
    closeScanner();
    const code = new FormData(form).get('code');
    await performLookup(code);
  });

  const observer = new MutationObserver(() => enhanceAddMenu());
  observer.observe(page, { childList:true, subtree:true });
  root.addEventListener('pagehide', closeScanner);
})(window);
