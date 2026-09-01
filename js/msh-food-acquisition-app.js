/* My Simple Health — Food Acquisition application bridge */
(function (root) {
  'use strict';

  const core = root.MSHFoodAcquisition;
  const storage = root.MSHStorage;
  if (!core || !storage) return;

  const PROVENANCE = Object.freeze({
    USER_STATED: 'USER_STATED',
    USER_CONFIRMED: 'USER_CONFIRMED',
    SYSTEM_OBSERVED: 'SYSTEM_OBSERVED',
    MODEL_INFERRED: 'MODEL_INFERRED'
  });

  const INFORMATION_CLASS = Object.freeze({
    RECORDED: 'RECORDED',
    SYSTEM_DERIVED: 'SYSTEM_DERIVED',
    ESTIMATED: 'ESTIMATED'
  });

  function now() { return new Date().toISOString(); }

  function ensureFoodState(state) {
    if (!state.food || typeof state.food !== 'object') {
      state.food = { foods:[], onHand:[], meals:[], recipes:[], groceries:[] };
    }
    if (!state.food.acquisition || typeof state.food.acquisition !== 'object') {
      state.food.acquisition = core.emptyState();
    }
    return state.food;
  }

  const stateStorage = {
    getItem(key) {
      if (key !== core.STORAGE_KEY) return null;
      const state = storage.getState();
      const food = state.food && typeof state.food === 'object' ? state.food : null;
      return food && food.acquisition ? JSON.stringify(food.acquisition) : null;
    },
    setItem(key, value) {
      if (key !== core.STORAGE_KEY) return;
      const parsed = JSON.parse(value);
      storage.updateState(state => {
        const food = ensureFoodState(state);
        food.acquisition = parsed;
        return state;
      });
    },
    removeItem(key) {
      if (key !== core.STORAGE_KEY) return;
      storage.updateState(state => {
        const food = ensureFoodState(state);
        food.acquisition = core.emptyState();
        return state;
      });
    }
  };

  const repository = core.createRepository({ storage: stateStorage });
  const adapters = core.createAdapterRegistry();

  function sourceEnvelope(source) {
    const meta = source || {};
    const type = meta.sourceType || 'manual';
    const manual = type === 'manual';
    return {
      kind: manual ? 'USER_ENTRY' : 'INTEGRATION',
      system: meta.sourceProvider || (manual ? 'MSH' : 'UNKNOWN'),
      channel: type.toUpperCase(),
      externalId: meta.sourceRecordId || null
    };
  }

  function provenanceForSource(source, options) {
    const meta = source || {};
    const settings = options || {};
    if (settings.userConfirmed === true) return PROVENANCE.USER_CONFIRMED;
    if (settings.modelInferred === true) return PROVENANCE.MODEL_INFERRED;
    if (meta.sourceType === 'manual') return PROVENANCE.USER_STATED;
    return PROVENANCE.SYSTEM_OBSERVED;
  }

  function toRecordEnvelope(acquisition, options) {
    if (!acquisition) return null;
    const settings = options || {};
    const createdAt = acquisition.createdAt || now();
    return {
      id: acquisition.id,
      ownerId: acquisition.ownerId || null,
      recordType: 'food.acquisition',
      eventStart: acquisition.acquiredAt || createdAt,
      eventEnd: null,
      createdAt,
      updatedAt: acquisition.updatedAt || createdAt,
      source: sourceEnvelope(acquisition.source),
      provenance: provenanceForSource(acquisition.source, settings),
      informationClass: settings.informationClass || INFORMATION_CLASS.RECORDED,
      schemaVersion: '1.0.0',
      context: {
        householdId: acquisition.householdId || null,
        merchantId: acquisition.merchantId || null,
        merchantLocationId: acquisition.merchantLocationId || null
      },
      lifecycleStatus: 'ACTIVE',
      deletedAt: null,
      payload: {
        payloadType: 'food.acquisition',
        payloadVersion: '1.0.0',
        acquisition
      },
      lineage: settings.lineage || null
    };
  }

  adapters.register('msh-receipt', {
    normalize(receipt, context) {
      const source = context || {};
      return {
        ownerId: source.ownerId || null,
        householdId: source.householdId || null,
        purchaseDate: receipt && receipt.purchaseDate,
        merchantId: source.merchantId || null,
        subtotal: receipt && receipt.subtotal,
        tax: receipt && receipt.tax,
        fees: receipt && receipt.fees,
        total: receipt && receipt.total,
        currency: source.currency || 'USD',
        sourceType: source.sourceType || 'receipt_image',
        sourceProvider: source.sourceProvider || 'msh_receipt',
        sourceRecordId: source.sourceRecordId || null,
        observedAt: source.observedAt || now(),
        confidence: source.confidence == null ? null : source.confidence,
        rawReference: source.rawReference || null,
        items: Array.isArray(receipt && receipt.items) ? receipt.items.map(item => ({
          sourceDescription: item.receiptText || item.sourceDescription || item.normalizedName || '',
          quantity: item.quantity,
          unit: item.unit || null,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          sourceIdentifier: item.sourceIdentifier || null,
          confidence: item.confidence,
          resolutionStatus: item.resolutionStatus || (item.productId ? 'resolved' : 'unresolved'),
          productId: item.productId || null,
          category: item.category || item.itemType || null,
          provenance: {
            sourceType: source.sourceType || 'receipt_image',
            sourceProvider: source.sourceProvider || 'msh_receipt',
            sourceRecordId: source.sourceRecordId || null,
            observedAt: source.observedAt || now(),
            confidence: item.confidence,
            rawReference: item.receiptText || null
          }
        })) : []
      };
    }
  });

  async function normalizeReceipt(receipt, context) {
    const merchantName = String(receipt && (receipt.merchant || receipt.selectedStore) || '').trim();
    let merchant = null;
    if (merchantName) merchant = repository.addMerchant({ name:merchantName, merchantType:'grocery' });
    return adapters.ingest('msh-receipt', receipt || {}, {
      ...(context || {}),
      merchantId: merchant && merchant.id
    });
  }

  async function recordReceipt(receipt, context) {
    const normalized = await normalizeReceipt(receipt, context);
    const result = repository.recordAcquisition(normalized);
    return {
      ...result,
      record: toRecordEnvelope(result.acquisition, {
        modelInferred: Boolean(context && context.modelInferred),
        userConfirmed: Boolean(context && context.userConfirmed)
      })
    };
  }

  root.MSHFoodAcquisitionApp = Object.freeze({
    repository,
    adapters,
    PROVENANCE,
    INFORMATION_CLASS,
    ensureFoodState,
    toRecordEnvelope,
    normalizeReceipt,
    recordReceipt
  });
})(window);
