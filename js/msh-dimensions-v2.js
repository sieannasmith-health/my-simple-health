/* My Simple Health — Dimensions of Health V2 pure measurement helpers */
(function (root) {
  'use strict';

  const EXPERIENCE_VERSION = 'DIMENSIONS-OF-HEALTH-V2';
  const PROVENANCE = 'USER_STATED';

  function now() { return new Date().toISOString(); }
  function uid(prefix) {
    if (root.crypto && root.crypto.randomUUID) return `${prefix}_${root.crypto.randomUUID()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function scaleIdFor(config, item) {
    const entries = Object.entries(config.scales || {});
    const match = entries.find(([, options]) => options === item.options);
    if (match) return match[0];
    const values = (item.options || []).map(option => option.value).join('|');
    if (/much_too_little/.test(values)) return 'amountFit5';
    if (/not_manageable/.test(values)) return 'manageability5';
    if (/almost_always/.test(values)) {
      return item.options[0] && item.options[0].signal === 'fit' ? 'frequencyBurden5' : 'frequencyPositive5';
    }
    return 'fit5';
  }

  function createObservation(config, item, selection, options) {
    const details = options && typeof options === 'object' ? options : {};
    const recordedAt = details.recordedAt || now();
    const isMissing = !selection;
    const missingReason = isMissing ? (details.missingReason || 'SKIPPED_ITEM') : null;
    const optionIndex = isMissing ? null : item.options.findIndex(option => option.value === selection.value);

    return {
      observationId: details.observationId || uid('observation'),
      itemId: item.id,
      domain: item.domain,
      dimension: item.domain,
      construct: item.construct,
      value: isMissing ? null : selection.value,
      label: isMissing ? (missingReason === 'NOT_SURE' ? 'Not sure' : 'Skipped') : selection.label,
      signal: isMissing ? null : selection.signal,
      direction: isMissing ? null : selection.direction || null,
      valueIndex: optionIndex >= 0 ? optionIndex : null,
      scale: {
        id: scaleIdFor(config, item),
        type: 'ordinal',
        min: 0,
        max: Math.max(0, item.options.length - 1),
        optionCount: item.options.length
      },
      timeframe: { id: 'current', label: 'Right now' },
      source: {
        type: 'SELF_REPORT',
        instrument: 'dimensions_of_health',
        itemId: item.id
      },
      assessmentVersion: config.version,
      experienceVersion: EXPERIENCE_VERSION,
      provenance: {
        status: PROVENANCE,
        sourceId: item.id,
        recordedAt,
        transitions: []
      },
      missingness: {
        status: isMissing ? 'MISSING' : 'OBSERVED',
        reason: missingReason
      },
      context: typeof details.context === 'string' ? details.context : '',
      answeredAt: recordedAt,
      observedAt: recordedAt
    };
  }

  function responsesForDomain(responses, domainId) {
    return (responses || []).filter(response => response.domain === domainId);
  }

  function summarizeDomain(config, responses, domainId) {
    const domainResponses = responsesForDomain(responses, domainId);
    const observed = domainResponses.filter(response => response.missingness && response.missingness.status === 'OBSERVED' || response.value != null);
    const missing = domainResponses.filter(response => response.value == null);
    const itemCount = config.items.filter(item => item.domain === domainId).length;
    const attention = observed.filter(response => response.signal === 'attention').length;
    const mixed = observed.filter(response => response.signal === 'mixed').length;
    const fit = observed.filter(response => response.signal === 'fit').length;
    const directional = observed.filter(response => response.direction && response.direction !== 'fit');
    let state = 'Not explored yet';

    if (observed.length) {
      state = 'Fits well';
      if (attention > 0) state = 'Worth noticing';
      else if (mixed > 0) state = 'Mixed';
      if (directional.length === observed.length && fit === 0) {
        const low = directional.filter(response => response.direction === 'low').length;
        const high = directional.filter(response => response.direction === 'high').length;
        if (low === directional.length) state = 'Less than fits right now';
        if (high === directional.length) state = 'More than fits right now';
      }
    } else if (missing.length) {
      state = 'Open for later';
    }

    return {
      domainId,
      state,
      responses: domainResponses,
      observedCount: observed.length,
      missingCount: missing.length,
      itemCount,
      resolution: itemCount ? observed.length / itemCount : 0,
      attention,
      mixed,
      fit
    };
  }

  function buildSelfMap(config, responses) {
    const domains = config.domains.map(domain => ({
      ...domain,
      ...summarizeDomain(config, responses, domain.id)
    }));
    const observedCount = (responses || []).filter(response => response.value != null).length;
    const exploredCount = (responses || []).length;
    return {
      experienceVersion: EXPERIENCE_VERSION,
      derivedFrom: 'healthMap.landscapes.responses',
      observedCount,
      exploredCount,
      totalItems: config.items.length,
      resolution: config.items.length ? observedCount / config.items.length : 0,
      domains
    };
  }

  function nextUnexploredIndex(config, responses, afterIndex) {
    const explored = new Set((responses || []).map(response => response.itemId));
    for (let offset = 1; offset <= config.items.length; offset += 1) {
      const index = ((Number(afterIndex) || 0) + offset) % config.items.length;
      if (!explored.has(config.items[index].id)) return index;
    }
    return -1;
  }

  function interpretationFor(observation, item) {
    if (!observation || observation.value == null) {
      if (observation && observation.missingness.reason === 'NOT_SURE') {
        return 'Not being sure is useful information. This part of the picture can stay open without being guessed.';
      }
      return 'This area can remain open. Skipping it does not make the picture a failure or erase what you have explored.';
    }
    if (observation.direction === 'low') return `You described ${item.construct.replace(/_/g, ' ')} as less than fits right now. That is a signal to understand, not an instruction to change it.`;
    if (observation.direction === 'high') return `You described ${item.construct.replace(/_/g, ' ')} as more than fits right now. The meaning remains yours.`;
    if (observation.signal === 'attention') return `Your response brings ${item.construct.replace(/_/g, ' ')} into clearer view. It does not automatically make it a problem or a goal.`;
    if (observation.signal === 'mixed') return `Your response suggests there may be more context around ${item.construct.replace(/_/g, ' ')} than one label can capture.`;
    return `Your response suggests ${item.construct.replace(/_/g, ' ')} is fitting reasonably well right now. What works can be worth preserving.`;
  }

  function associationClaims() {
    return [];
  }

  root.MSHDimensionsV2 = {
    EXPERIENCE_VERSION,
    scaleIdFor,
    createObservation,
    summarizeDomain,
    buildSelfMap,
    nextUnexploredIndex,
    interpretationFor,
    associationClaims
  };
})(typeof window !== 'undefined' ? window : globalThis);
