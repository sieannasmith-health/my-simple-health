/* My Simple Health — barcode / GTIN product lookup adapter */
(function (root) {
  'use strict';

  const core = root.MSHFoodAcquisition;
  const app = root.MSHFoodAcquisitionApp;
  if (!core || !app) return;

  async function lookup(code) {
    const normalized = core.normalizeGtin(code);
    const existing = app.repository.findProductByIdentifier(normalized.value);
    if (existing) return { found:true, product:existing, identifier:normalized, source:'local' };

    const response = await fetch(`/api/food-product?code=${encodeURIComponent(normalized.value)}`, {
      headers: { 'Accept':'application/json' }
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 404) return { found:false, identifier:normalized, source:'open_food_facts' };
    if (!response.ok || !payload.success) throw new Error(payload.message || 'Product lookup failed.');
    return { found:true, product:payload.product, identifier:normalized, source:payload.provider || 'open_food_facts' };
  }

  function saveLookupResult(result, options) {
    if (!result || !result.found || !result.product) throw new Error('A resolved product lookup is required.');
    if (result.source === 'local' && result.product.id) return result.product;

    const source = result.product;
    const product = app.repository.addProduct({
      canonicalName: source.canonicalName,
      brand: source.brand,
      description: source.description,
      packageQuantity: source.packageQuantity,
      packageUnit: source.packageUnit,
      category: source.category,
      imageUrl: source.imageUrl
    });

    app.repository.addIdentifier(product.id, {
      scheme: source.identifier && source.identifier.scheme || result.identifier.scheme,
      value: source.identifier && source.identifier.value || result.identifier.value,
      source: source.provenance && source.provenance.sourceProvider || result.source,
      verifiedAt: new Date().toISOString()
    });

    const settings = options || {};
    if (settings.recordAcquisition === true) {
      const acquisition = app.repository.recordAcquisition({
        ownerId: settings.ownerId || null,
        householdId: settings.householdId || null,
        acquiredAt: settings.acquiredAt || new Date().toISOString(),
        merchantId: settings.merchantId || null,
        sourceType: settings.sourceType || 'barcode',
        sourceProvider: settings.sourceProvider || result.source || 'product_lookup',
        sourceRecordId: settings.sourceRecordId || null,
        items: [{
          productId: product.id,
          sourceDescription: source.canonicalName,
          quantity: settings.quantity == null ? 1 : Number(settings.quantity),
          unit: settings.unit || 'package',
          unitPrice: settings.unitPrice == null ? null : settings.unitPrice,
          lineTotal: settings.lineTotal == null ? null : settings.lineTotal,
          sourceIdentifier: result.identifier.value,
          resolutionStatus: 'resolved',
          confidence: 1
        }]
      });

      if (acquisition.status !== 'duplicate' && settings.addToInventory !== false) {
        const item = acquisition.acquisition.items[0];
        app.repository.addInventoryLot({
          ownerId: settings.ownerId || null,
          householdId: settings.householdId || null,
          productId: product.id,
          acquisitionItemId: item.id,
          quantityAcquired: settings.quantity == null ? 1 : Number(settings.quantity),
          quantityRemaining: settings.quantity == null ? 1 : Number(settings.quantity),
          unit: settings.unit || 'package',
          storageLocation: settings.storageLocation || null,
          acquiredAt: acquisition.acquisition.acquiredAt,
          bestBy: settings.bestBy || null,
          expiration: settings.expiration || null
        });
      }
    }

    return product;
  }

  root.MSHFoodProductLookup = Object.freeze({ lookup, saveLookupResult });
})(window);
