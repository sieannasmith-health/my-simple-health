/* My Simple Health — normalized Food Acquisition foundation */
(function (global) {
  'use strict';

  const SCHEMA_VERSION = 1;
  const STORAGE_KEY = 'msh_food_acquisition_v1';
  const GTIN_LENGTHS = new Set([8, 12, 13, 14]);
  const SOURCE_TYPES = Object.freeze([
    'barcode',
    'product_lookup',
    'manual',
    'receipt_image',
    'digital_receipt',
    'retailer',
    'delivery',
    'restaurant',
    'financial_transaction'
  ]);
  const RESOLUTION_STATES = Object.freeze(['unresolved', 'resolved', 'user_confirmed', 'rejected']);
  const RECONCILIATION_STATES = Object.freeze(['unmatched', 'candidate', 'matched', 'user_confirmed', 'rejected']);

  const clone = value => JSON.parse(JSON.stringify(value));
  const now = () => new Date().toISOString();
  const uid = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  function digitsOnly(value) {
    return String(value == null ? '' : value).replace(/\D/g, '');
  }

  function gtinCheckDigit(body) {
    const digits = digitsOnly(body);
    if (!digits) return null;
    let sum = 0;
    let weight = 3;
    for (let index = digits.length - 1; index >= 0; index -= 1) {
      sum += Number(digits[index]) * weight;
      weight = weight === 3 ? 1 : 3;
    }
    return (10 - (sum % 10)) % 10;
  }

  function isValidGtin(value) {
    const digits = digitsOnly(value);
    if (!GTIN_LENGTHS.has(digits.length)) return false;
    const body = digits.slice(0, -1);
    return gtinCheckDigit(body) === Number(digits.at(-1));
  }

  function gtinScheme(value) {
    const digits = digitsOnly(value);
    if (digits.length === 8) return 'gtin_8';
    if (digits.length === 12) return 'gtin_12';
    if (digits.length === 13) return 'gtin_13';
    if (digits.length === 14) return 'gtin_14';
    return null;
  }

  function normalizeGtin(value, options) {
    const settings = { validateCheckDigit: true, ...(options || {}) };
    const digits = digitsOnly(value);
    const scheme = gtinScheme(digits);
    if (!scheme) throw new Error('GTIN must contain 8, 12, 13, or 14 digits.');
    if (settings.validateCheckDigit && !isValidGtin(digits)) throw new Error('GTIN check digit is invalid.');
    return { value: digits, scheme };
  }

  function normalizeMoney(value) {
    if (value == null || value === '') return null;
    const amount = Number(value);
    if (!Number.isFinite(amount)) return null;
    return Math.round(amount * 100) / 100;
  }

  function normalizeDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function normalizeConfidence(value) {
    if (value == null || value === '') return null;
    const confidence = Number(value);
    if (!Number.isFinite(confidence)) return null;
    return Math.max(0, Math.min(1, confidence));
  }

  function sourceMeta(input) {
    const source = input || {};
    const sourceType = SOURCE_TYPES.includes(source.sourceType) ? source.sourceType : 'manual';
    return {
      sourceType,
      sourceProvider: source.sourceProvider || null,
      sourceRecordId: source.sourceRecordId || null,
      observedAt: normalizeDate(source.observedAt) || now(),
      importedAt: normalizeDate(source.importedAt) || now(),
      confidence: normalizeConfidence(source.confidence),
      rawReference: source.rawReference || null
    };
  }

  function createProduct(input) {
    const data = input || {};
    return {
      id: data.id || uid('product'),
      canonicalName: String(data.canonicalName || data.name || '').trim(),
      brand: data.brand ? String(data.brand).trim() : null,
      description: data.description ? String(data.description).trim() : null,
      packageQuantity: data.packageQuantity == null ? null : Number(data.packageQuantity),
      packageUnit: data.packageUnit || null,
      category: data.category || null,
      imageUrl: data.imageUrl || null,
      createdAt: normalizeDate(data.createdAt) || now(),
      updatedAt: normalizeDate(data.updatedAt) || now()
    };
  }

  function createProductIdentifier(productId, input) {
    if (!productId) throw new Error('productId is required.');
    const data = input || {};
    let scheme = data.scheme || null;
    let value = String(data.value == null ? '' : data.value).trim();
    if (scheme && scheme.startsWith('gtin_')) {
      const normalized = normalizeGtin(value);
      scheme = normalized.scheme;
      value = normalized.value;
    }
    if (!scheme || !value) throw new Error('Identifier scheme and value are required.');
    return {
      id: data.id || uid('identifier'),
      productId,
      scheme,
      value,
      source: data.source || null,
      verifiedAt: normalizeDate(data.verifiedAt)
    };
  }

  function createMerchant(input) {
    const data = input || {};
    return {
      id: data.id || uid('merchant'),
      name: String(data.name || '').trim(),
      merchantType: data.merchantType || 'other',
      parentBrandId: data.parentBrandId || null
    };
  }

  function createAcquisitionItem(input) {
    const data = input || {};
    const resolutionStatus = RESOLUTION_STATES.includes(data.resolutionStatus)
      ? data.resolutionStatus
      : (data.productId ? 'resolved' : 'unresolved');
    return {
      id: data.id || uid('acq_item'),
      acquisitionId: data.acquisitionId || null,
      productId: data.productId || null,
      sourceDescription: String(data.sourceDescription || data.receiptText || data.normalizedName || '').trim(),
      quantity: data.quantity == null ? null : Number(data.quantity),
      unit: data.unit || null,
      unitPrice: normalizeMoney(data.unitPrice),
      lineTotal: normalizeMoney(data.lineTotal),
      sourceIdentifier: data.sourceIdentifier || null,
      confidence: normalizeConfidence(data.confidence),
      resolutionStatus,
      category: data.category || null,
      provenance: sourceMeta(data.provenance || data)
    };
  }

  function createAcquisition(input) {
    const data = input || {};
    const id = data.id || uid('acquisition');
    const acquisition = {
      id,
      ownerId: data.ownerId || data.userId || null,
      householdId: data.householdId || null,
      acquiredAt: normalizeDate(data.acquiredAt || data.purchaseDate) || now(),
      merchantId: data.merchantId || null,
      merchantLocationId: data.merchantLocationId || null,
      source: sourceMeta(data.source || data),
      subtotal: normalizeMoney(data.subtotal),
      tax: normalizeMoney(data.tax),
      fees: normalizeMoney(data.fees),
      total: normalizeMoney(data.total),
      currency: data.currency || 'USD',
      status: data.status || 'recorded',
      createdAt: normalizeDate(data.createdAt) || now(),
      updatedAt: normalizeDate(data.updatedAt) || now(),
      items: []
    };
    acquisition.items = (Array.isArray(data.items) ? data.items : []).map(item =>
      createAcquisitionItem({ ...item, acquisitionId: id })
    );
    return acquisition;
  }

  function createInventoryLot(input) {
    const data = input || {};
    if (!data.productId) throw new Error('Inventory lot requires productId.');
    return {
      id: data.id || uid('inventory_lot'),
      ownerId: data.ownerId || null,
      householdId: data.householdId || null,
      productId: data.productId,
      acquisitionItemId: data.acquisitionItemId || null,
      quantityAcquired: data.quantityAcquired == null ? 1 : Number(data.quantityAcquired),
      quantityRemaining: data.quantityRemaining == null ? (data.quantityAcquired == null ? 1 : Number(data.quantityAcquired)) : Number(data.quantityRemaining),
      unit: data.unit || null,
      storageLocation: data.storageLocation || null,
      acquiredAt: normalizeDate(data.acquiredAt) || now(),
      bestBy: normalizeDate(data.bestBy),
      expiration: normalizeDate(data.expiration),
      status: data.status || 'available'
    };
  }

  function createPriceObservation(input) {
    const data = input || {};
    if (!data.productId) throw new Error('Price observation requires productId.');
    return {
      id: data.id || uid('price'),
      productId: data.productId,
      merchantId: data.merchantId || null,
      merchantLocationId: data.merchantLocationId || null,
      observedAt: normalizeDate(data.observedAt) || now(),
      price: normalizeMoney(data.price),
      packageQuantity: data.packageQuantity == null ? null : Number(data.packageQuantity),
      packageUnit: data.packageUnit || null,
      currency: data.currency || 'USD',
      source: sourceMeta(data.source || data)
    };
  }

  function emptyState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      products: [],
      identifiers: [],
      merchants: [],
      merchantLocations: [],
      acquisitions: [],
      inventoryLots: [],
      priceObservations: [],
      financialLinks: [],
      updatedAt: null
    };
  }

  function mergeState(saved) {
    const base = emptyState();
    if (!saved || typeof saved !== 'object') return base;
    Object.keys(base).forEach(key => {
      if (Array.isArray(base[key])) base[key] = Array.isArray(saved[key]) ? saved[key] : [];
    });
    base.schemaVersion = SCHEMA_VERSION;
    base.updatedAt = saved.updatedAt || null;
    return base;
  }

  function createStorage(storage) {
    const backing = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    let memory = emptyState();
    return {
      load() {
        if (!backing) return clone(memory);
        try {
          return mergeState(JSON.parse(backing.getItem(STORAGE_KEY) || 'null'));
        } catch (_) {
          return emptyState();
        }
      },
      save(state) {
        const next = mergeState(state);
        next.updatedAt = now();
        if (!backing) memory = clone(next);
        else backing.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      },
      clear() {
        if (!backing) memory = emptyState();
        else backing.removeItem(STORAGE_KEY);
      }
    };
  }

  function merchantKey(name) {
    return String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function sameDay(a, b) {
    const left = normalizeDate(a);
    const right = normalizeDate(b);
    return Boolean(left && right && left.slice(0, 10) === right.slice(0, 10));
  }

  function acquisitionMatchScore(existing, incoming, merchantNames) {
    const aSource = existing.source || {};
    const bSource = incoming.source || {};
    if (aSource.sourceProvider && bSource.sourceProvider &&
        aSource.sourceProvider === bSource.sourceProvider &&
        aSource.sourceRecordId && bSource.sourceRecordId &&
        aSource.sourceRecordId === bSource.sourceRecordId) return 1;

    let score = 0;
    if (existing.total != null && incoming.total != null && Math.abs(existing.total - incoming.total) < 0.01) score += 0.45;
    if (sameDay(existing.acquiredAt, incoming.acquiredAt)) score += 0.25;

    const existingMerchant = merchantKey((merchantNames && merchantNames[existing.merchantId]) || existing.merchantName);
    const incomingMerchant = merchantKey((merchantNames && merchantNames[incoming.merchantId]) || incoming.merchantName);
    if (existingMerchant && incomingMerchant && existingMerchant === incomingMerchant) score += 0.25;

    if (existing.items && incoming.items && existing.items.length && incoming.items.length) score += 0.05;
    return Math.min(1, score);
  }

  function findAcquisitionMatches(state, incoming, threshold) {
    const limit = threshold == null ? 0.7 : Number(threshold);
    const merchantNames = Object.fromEntries((state.merchants || []).map(merchant => [merchant.id, merchant.name]));
    return (state.acquisitions || [])
      .map(existing => ({ existing, score: acquisitionMatchScore(existing, incoming, merchantNames) }))
      .filter(candidate => candidate.score >= limit)
      .sort((a, b) => b.score - a.score);
  }

  function createRepository(options) {
    const settings = options || {};
    const storage = createStorage(settings.storage);
    let state = storage.load();

    function commit() {
      state = storage.save(state);
      return snapshot();
    }
    function snapshot() { return clone(state); }

    return {
      snapshot,
      reset() { state = emptyState(); return commit(); },
      addProduct(input) {
        const product = createProduct(input);
        state.products.push(product);
        commit();
        return clone(product);
      },
      addIdentifier(productId, input) {
        const identifier = createProductIdentifier(productId, input);
        const duplicate = state.identifiers.find(item => item.scheme === identifier.scheme && item.value === identifier.value);
        if (duplicate && duplicate.productId !== productId) throw new Error('Identifier is already attached to another product.');
        if (!duplicate) state.identifiers.push(identifier);
        commit();
        return clone(duplicate || identifier);
      },
      findProductByIdentifier(value) {
        const normalized = normalizeGtin(value);
        const identifier = state.identifiers.find(item => item.scheme === normalized.scheme && item.value === normalized.value);
        if (!identifier) return null;
        return clone(state.products.find(product => product.id === identifier.productId) || null);
      },
      addMerchant(input) {
        const candidate = createMerchant(input);
        const key = merchantKey(candidate.name);
        const existing = state.merchants.find(item => merchantKey(item.name) === key && item.merchantType === candidate.merchantType);
        if (existing) return clone(existing);
        state.merchants.push(candidate);
        commit();
        return clone(candidate);
      },
      recordAcquisition(input, options) {
        const settings = { dedupe: true, threshold: 0.7, ...(options || {}) };
        const acquisition = createAcquisition(input);
        const matches = settings.dedupe ? findAcquisitionMatches(state, acquisition, settings.threshold) : [];
        if (matches.length && matches[0].score >= 0.95) {
          return { status: 'duplicate', acquisition: clone(matches[0].existing), matchScore: matches[0].score };
        }
        state.acquisitions.push(acquisition);
        commit();
        return {
          status: matches.length ? 'candidate' : 'recorded',
          acquisition: clone(acquisition),
          candidates: matches.map(match => ({ acquisitionId: match.existing.id, score: match.score }))
        };
      },
      addInventoryLot(input) {
        const lot = createInventoryLot(input);
        state.inventoryLots.push(lot);
        commit();
        return clone(lot);
      },
      addPriceObservation(input) {
        const observation = createPriceObservation(input);
        state.priceObservations.push(observation);
        commit();
        return clone(observation);
      },
      linkFinancialTransaction(input) {
        const data = input || {};
        if (!data.acquisitionId || !data.financialTransactionId) throw new Error('acquisitionId and financialTransactionId are required.');
        const link = {
          id: data.id || uid('financial_link'),
          acquisitionId: data.acquisitionId,
          financialTransactionId: data.financialTransactionId,
          matchStatus: RECONCILIATION_STATES.includes(data.matchStatus) ? data.matchStatus : 'matched',
          matchConfidence: normalizeConfidence(data.matchConfidence),
          matchedAt: normalizeDate(data.matchedAt) || now()
        };
        state.financialLinks.push(link);
        commit();
        return clone(link);
      }
    };
  }

  function createAdapterRegistry() {
    const adapters = new Map();
    return {
      register(name, adapter) {
        if (!name || typeof name !== 'string') throw new Error('Adapter name is required.');
        if (!adapter || typeof adapter.normalize !== 'function') throw new Error('Food acquisition adapter must implement normalize(rawRecord).');
        adapters.set(name, adapter);
        return adapter;
      },
      unregister(name) { adapters.delete(name); },
      get(name) { return adapters.get(name) || null; },
      has(name) { return adapters.has(name); },
      list() { return Array.from(adapters.keys()); },
      async ingest(name, rawRecord, context) {
        const adapter = adapters.get(name);
        if (!adapter) throw new Error(`Unknown food acquisition adapter: ${name}`);
        const normalized = await adapter.normalize(rawRecord, context || {});
        return createAcquisition(normalized);
      }
    };
  }

  const API = Object.freeze({
    SCHEMA_VERSION,
    STORAGE_KEY,
    SOURCE_TYPES,
    RESOLUTION_STATES,
    RECONCILIATION_STATES,
    gtinCheckDigit,
    isValidGtin,
    gtinScheme,
    normalizeGtin,
    sourceMeta,
    createProduct,
    createProductIdentifier,
    createMerchant,
    createAcquisitionItem,
    createAcquisition,
    createInventoryLot,
    createPriceObservation,
    emptyState,
    createStorage,
    createRepository,
    createAdapterRegistry,
    acquisitionMatchScore,
    findAcquisitionMatches
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.MSHFoodAcquisition = API;
})(typeof window !== 'undefined' ? window : globalThis);
