/* My Simple Health — shared local prototype data contract */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'msh_data';
  const SCHEMA_VERSION = 7;
  const HELLO_HISTORY_LIMIT = 12;
  const PROVENANCE = Object.freeze({
    USER_STATED: 'USER_STATED',
    SYSTEM_OBSERVED: 'SYSTEM_OBSERVED',
    MODEL_INFERRED: 'MODEL_INFERRED',
    USER_CONFIRMED: 'USER_CONFIRMED'
  });
  const FOCUS_DISPOSITIONS = Object.freeze([
    'develop', 'preserve', 'explore', 'prepare', 'adapt', 'no_action'
  ]);
  const COLLECTIONS = [
    'landscapes', 'focuses', 'visionEntries', 'projects', 'practices',
    'practiceAttempts', 'reflections', 'learningEntries', 'progressEvents',
    'returnPoints'
  ];

  function now() { return new Date().toISOString(); }
  function list(value) { return Array.isArray(value) ? value : []; }
  function uid(prefix) {
    if (root.crypto && root.crypto.randomUUID) return `${prefix}_${root.crypto.randomUUID()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function createInitialState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      user: { createdAt: now(), firstDoor: null },
      landscapes: [], focuses: [], visionEntries: [], projects: [], practices: [],
      practiceAttempts: [], reflections: [], learningEntries: [], progressEvents: [],
      returnPoints: [],
      wellnessWheel: { current: null, history: [] },
      calendar: {
        events: [],
        predictions: [],
        settings: {
          visibilityVersion: 2,
          layers: { movement:true, cycle:false, symptoms:true, medications:true, sexualHealth:false, care:true, measurements:true, life:true, observations:true, practices:false, projects:false },
          appearance: { accentId:'default', customColor:null },
          cycle: { enabled:true, dischargeTracking:false, reproductiveHealthTracking:false, mixHealthTimeline:false }
        },
        privacy: { cycleCalendar:true, workspace:false, hello:false, patternAnalysis:false }
      },
      settings: { reminders: {}, memory: {} }
    };
  }

  function normalizeVision(entry) {
    const hasLegacyStatement = Boolean(entry && typeof entry.statement === 'string' && entry.statement.trim());
    return {
      ...entry,
      responses: entry && entry.responses && typeof entry.responses === 'object' ? entry.responses : {},
      synthesis: entry && entry.synthesis && typeof entry.synthesis === 'object'
        ? entry.synthesis
        : hasLegacyStatement ? { statement: entry.statement.trim(), confirmationStatus: 'confirmed', confirmedAt: entry.updatedAt || entry.createdAt || now(), sourceKeys: [] } : null
    };
  }

  function inferLandscapeScale(response) {
    const value = String(response && response.value || '');
    if (/too_little|too_much|about_right/.test(value)) return 'amountFit5';
    if (/manageable/.test(value)) return 'manageability5';
    if (/rarely|not_often|sometimes|often|almost_always/.test(value)) {
      return ['interference', 'unwanted_disconnection', 'strain'].includes(response && response.construct)
        ? 'frequencyBurden5' : 'frequencyPositive5';
    }
    return 'fit5';
  }

  function normalizeLandscapeResponse(response, landscape) {
    const recordedAt = response.observedAt || response.answeredAt || landscape.updatedAt || landscape.startedAt || now();
    const isMissing = response.value == null;
    return {
      ...response,
      observationId: response.observationId || `observation_${landscape.id || 'legacy'}_${response.itemId || 'unknown'}`,
      dimension: response.dimension || response.domain || null,
      valueIndex: Number.isInteger(response.valueIndex) ? response.valueIndex : null,
      scale: response.scale && typeof response.scale === 'object' ? response.scale : {
        id: inferLandscapeScale(response), type: 'ordinal', min: 0, max: 4, optionCount: 5
      },
      timeframe: response.timeframe && typeof response.timeframe === 'object'
        ? response.timeframe : { id: 'current', label: 'Right now' },
      source: response.source && typeof response.source === 'object' ? response.source : {
        type: 'SELF_REPORT', instrument: 'dimensions_of_health', itemId: response.itemId || null
      },
      assessmentVersion: response.assessmentVersion || landscape.instrumentVersion || 'WL-PROTOTYPE-1',
      experienceVersion: response.experienceVersion || landscape.experienceVersion || 'DIMENSIONS-OF-HEALTH-V1',
      provenance: response.provenance && typeof response.provenance === 'object'
        ? response.provenance
        : createProvenance(PROVENANCE.USER_STATED, { sourceId: response.itemId || landscape.id, recordedAt }),
      missingness: response.missingness && typeof response.missingness === 'object'
        ? response.missingness
        : { status: isMissing ? 'MISSING' : 'OBSERVED', reason: isMissing ? 'LEGACY_MISSING' : null },
      answeredAt: response.answeredAt || recordedAt,
      observedAt: recordedAt
    };
  }

  function normalizeLandscape(landscape) {
    const source = landscape && typeof landscape === 'object' ? landscape : {};
    return {
      ...source,
      experienceVersion: source.experienceVersion || 'DIMENSIONS-OF-HEALTH-V1',
      responses: list(source.responses).map(response => normalizeLandscapeResponse(response || {}, source))
    };
  }

  function normalizeFocus(focus) {
    const source = focus && typeof focus === 'object' ? focus : {};
    const createdAt = source.createdAt || now();
    const navigationState = FOCUS_DISPOSITIONS.includes(source.navigationState)
      ? source.navigationState : null;
    return {
      ...source,
      id: typeof source.id === 'string' && source.id ? source.id : uid('focus'),
      label: typeof source.label === 'string' ? source.label.trim().slice(0, 240) : '',
      status: ['active', 'historical'].includes(source.status) ? source.status : 'active',
      navigationState,
      subjectType: typeof source.subjectType === 'string' ? source.subjectType.slice(0, 80) : null,
      subjectId: typeof source.subjectId === 'string' ? source.subjectId.slice(0, 160) : null,
      sourceType: typeof source.sourceType === 'string' ? source.sourceType.slice(0, 80) : null,
      sourceId: typeof source.sourceId === 'string' ? source.sourceId.slice(0, 160) : null,
      relationshipStatus: source.relationshipStatus === 'current' ? 'current' : null,
      projectReadiness: ['available', 'selected_for_shaping'].includes(source.projectReadiness)
        ? source.projectReadiness : null,
      capacityDecision: ['shape_this_now', 'keep_both_visible'].includes(source.capacityDecision)
        ? source.capacityDecision : null,
      createdAt,
      updatedAt: source.updatedAt || createdAt,
      provenance: source.provenance && typeof source.provenance === 'object'
        ? createProvenance(source.provenance.status, source.provenance)
        : createProvenance(PROVENANCE.USER_STATED, { sourceId:source.sourceId || source.id || 'what-matters-now', recordedAt:createdAt })
    };
  }

  function normalizeState(state) {
    const initial = createInitialState();
    if (!state || typeof state !== 'object') return initial;
    const normalized = {
      ...initial,
      ...state,
      schemaVersion: SCHEMA_VERSION,
      user: {
        ...initial.user,
        ...(state.user || {}),
        firstDoor: cleanFirstDoor(state.user && state.user.firstDoor)
      },
      wellnessWheel: {
        current: state.wellnessWheel && state.wellnessWheel.current || null,
        history: list(state.wellnessWheel && state.wellnessWheel.history)
      },
      calendar: {
        events: list(state.calendar && state.calendar.events),
        predictions: list(state.calendar && state.calendar.predictions),
        settings: {
          visibilityVersion: 2,
          layers: {
            ...initial.calendar.settings.layers,
            ...(() => {
              const settings=state.calendar && state.calendar.settings || {};
              const legacy=settings.layers && typeof settings.layers==='object' ? settings.layers : {};
              if(Number(settings.visibilityVersion)>=2)return legacy;
              const hasRecordedCycle=list(state.calendar && state.calendar.events).some(event => {
                const value=String(event && (event.category || event.type || '')).toLowerCase();
                return /cycle|period|menstrual/.test(value);
              });
              return {
                movement: legacy.movement !== false,
                cycle: legacy.cycle !== false && hasRecordedCycle,
                symptoms: legacy.life !== false,
                medications: legacy.appointments !== false,
                sexualHealth: false,
                care: legacy.appointments !== false,
                measurements: legacy.life !== false,
                life: legacy.life !== false,
                observations: legacy.life !== false,
                practices: false,
                projects: false
              };
            })()
          },
          appearance: state.calendar && state.calendar.settings && state.calendar.settings.appearance && typeof state.calendar.settings.appearance === 'object'
            ? {
                accentId: typeof state.calendar.settings.appearance.accentId === 'string' ? state.calendar.settings.appearance.accentId : 'default',
                customColor: typeof state.calendar.settings.appearance.customColor === 'string' ? state.calendar.settings.appearance.customColor : null
              }
            : { ...initial.calendar.settings.appearance },
          cycle: {
            ...initial.calendar.settings.cycle,
            ...(state.calendar && state.calendar.settings && state.calendar.settings.cycle || {})
          }
        },
        privacy: {
          ...initial.calendar.privacy,
          ...(state.calendar && state.calendar.privacy || {}),
          cycleCalendar: true
        }
      },
      settings: {
        reminders: { ...(state.settings && state.settings.reminders || {}) },
        memory: { ...(state.settings && state.settings.memory || {}) }
      }
    };
    COLLECTIONS.forEach(key => { normalized[key] = list(state[key]); });
    normalized.landscapes = normalized.landscapes.map(normalizeLandscape);
    normalized.focuses = normalized.focuses.map(normalizeFocus);
    normalized.visionEntries = normalized.visionEntries.map(normalizeVision);
    return normalized;
  }

  function getState() {
    try {
      const raw = root.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const initial = createInitialState();
        saveState(initial);
        return initial;
      }
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      console.warn('My Simple Health could not read local prototype data.', error);
      return createInitialState();
    }
  }

  function saveState(state) {
    const normalized = normalizeState(state);
    root.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function updateState(updater) {
    const current = getState();
    const next = typeof updater === 'function' ? updater(current) : current;
    return saveState(next || current);
  }

  function getHelloConversation(state) {
    const source = state || getState();
    return list(source.settings && source.settings.memory && source.settings.memory.helloConversation)
      .filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string' && item.content.trim())
      .slice(-HELLO_HISTORY_LIMIT)
      .map(item => {
        const turn = { role:item.role, content:item.content.trim().slice(0, 1500) };
        if (item.role === 'assistant' && ['HELLO', 'PAL'].includes(item.assistantRole)) turn.assistantRole = item.assistantRole;
        return turn;
      });
  }

  function cleanFirstDoor(value) {
    if (!value || typeof value !== 'object') return null;
    const allowedIntents = ['health_question','not_working','work_on_something','care_support','clearer_picture','exploring'];
    if (!allowedIntents.includes(value.intent)) return null;
    const createdAt = value.createdAt || now();
    return {
      id: typeof value.id === 'string' && value.id ? value.id : uid('entry'),
      intent: value.intent,
      context: typeof value.context === 'string' ? value.context.trim().slice(0, 1200) : '',
      status: ['intent_selected','context_added','routed'].includes(value.status) ? value.status : 'intent_selected',
      route: typeof value.route === 'string' ? value.route.trim().slice(0, 240) : '',
      createdAt,
      updatedAt: value.updatedAt || createdAt,
      provenance: value.provenance && typeof value.provenance === 'object'
        ? createProvenance(value.provenance.status, value.provenance)
        : createProvenance(PROVENANCE.USER_STATED, { sourceId:'first-door', recordedAt:createdAt })
    };
  }

  function getFirstDoor(state) {
    const source = state || getState();
    return cleanFirstDoor(source.user && source.user.firstDoor);
  }

  function saveFirstDoor(value) {
    const cleaned = cleanFirstDoor(value);
    if (!cleaned) return null;
    updateState(state => {
      state.user.firstDoor = cleaned;
      return state;
    });
    return cleaned;
  }

  function appendHelloTurn(role, content, assistantRole) {
    if (!['user', 'assistant'].includes(role) || typeof content !== 'string' || !content.trim()) return getHelloConversation();
    let result = [];
    updateState(state => {
      const history = getHelloConversation(state);
      const turn = { role, content:content.trim().slice(0, 1500) };
      if (role === 'assistant') turn.assistantRole = assistantRole === 'PAL' ? 'PAL' : 'HELLO';
      history.push(turn);
      result = history.slice(-HELLO_HISTORY_LIMIT);
      state.settings.memory.helloConversation = result;
      return state;
    });
    return result;
  }

  function clearHelloConversation() {
    updateState(state => {
      state.settings.memory.helloConversation = [];
      return state;
    });
  }

  function cleanActivityContext(value) {
    if (!value || typeof value !== 'object') return null;
    const allowed = ['route','page','activity','visibleActivity','dimension','questionId','questionText','nextQuestionId','nextQuestionText','currentResponse','construct','interactionState','contextId','contextLabel','selectedObjectType','selectedObjectId','selectedObjectLabel','projectId','projectLabel','milestoneId','practiceId','practiceLabel','reflectionId','learningId','progressEventId','userSelectedState','provenance'];
    const cleaned = {};
    allowed.forEach(key => {
      if (typeof value[key] === 'string' && value[key].trim()) cleaned[key] = value[key].trim().slice(0, key === 'questionText' || key === 'nextQuestionText' || key === 'currentResponse' ? 600 : 160);
      else if (value[key] === null && key === 'currentResponse') cleaned[key] = null;
    });
    if (Array.isArray(value.allowedActions)) {
      cleaned.allowedActions = value.allowedActions
        .filter(item => typeof item === 'string' && item.trim())
        .slice(0, 12)
        .map(item => item.trim().slice(0, 80));
    }
    cleaned.recordable = false;
    return cleaned.page ? cleaned : null;
  }

  function setHelloActivity(value) {
    const context = cleanActivityContext(value);
    updateState(state => {
      state.settings.memory.helloActivity = context;
      return state;
    });
    return context;
  }

  function getHelloActivity(state) {
    const source = state || getState();
    return cleanActivityContext(source.settings && source.settings.memory && source.settings.memory.helloActivity);
  }

  function createProvenance(status, options) {
    const allowed = Object.values(PROVENANCE);
    const nextStatus = allowed.includes(status) ? status : PROVENANCE.SYSTEM_OBSERVED;
    const details = options && typeof options === 'object' ? options : {};
    return {
      status: nextStatus,
      sourceId: typeof details.sourceId === 'string' ? details.sourceId : null,
      recordedAt: details.recordedAt || now(),
      transitions: Array.isArray(details.transitions) ? [...details.transitions] : []
    };
  }

  function confirmInference(provenance, options) {
    const current = createProvenance(
      provenance && provenance.status,
      provenance
    );
    if (current.status !== PROVENANCE.MODEL_INFERRED) return current;
    const details = options && typeof options === 'object' ? options : {};
    const confirmedAt = details.confirmedAt || now();
    return {
      ...current,
      status: PROVENANCE.USER_CONFIRMED,
      confirmedAt,
      editedByUser: details.editedByUser === true,
      transitions: [
        ...current.transitions,
        {
          from: PROVENANCE.MODEL_INFERRED,
          to: PROVENANCE.USER_CONFIRMED,
          at: confirmedAt,
          editedByUser: details.editedByUser === true
        }
      ]
    };
  }

  function resetPrototypeData() {
    root.localStorage.removeItem(STORAGE_KEY);
    try { root.sessionStorage.removeItem('helloWellnessState'); } catch (_) {}
    return getState();
  }

  function byNewest(items, fields) {
    const keys = fields || ['updatedAt', 'completedAt', 'createdAt'];
    return [...list(items)].sort((a, b) => {
      const time = item => {
        for (const key of keys) {
          const value = Date.parse(item && item[key] || '');
          if (Number.isFinite(value)) return value;
        }
        return 0;
      };
      return time(b) - time(a);
    });
  }

  function getCurrentLandscape(state) {
    return byNewest((state || getState()).landscapes.filter(item => item.status === 'completed'), ['completedAt', 'updatedAt'])[0] || null;
  }

  function getCurrentVision(state) {
    return byNewest((state || getState()).visionEntries.filter(entry =>
      entry.status === 'current' && entry.synthesis && entry.synthesis.confirmationStatus === 'confirmed'
    ))[0] || null;
  }

  function getActiveProject(state) {
    return byNewest((state || getState()).projects.filter(project => project.status === 'active'))[0] || null;
  }

  function getActivePractice(state) {
    const source = state || getState();
    const project = getActiveProject(source);
    if (!project) return null;
    return byNewest(source.practices.filter(practice => practice.projectId === project.id && practice.status === 'active'))[0] || null;
  }

  function getCurrentLearning(state) {
    return byNewest((state || getState()).learningEntries.filter(entry => entry.currentStatus === 'current'));
  }

  function getCurrentFocuses(state) {
    return byNewest((state || getState()).focuses.filter(focus => focus.status === 'active'), ['updatedAt', 'confirmedAt', 'createdAt']);
  }

  function saveFocusDecision(input) {
    if (!input || !FOCUS_DISPOSITIONS.includes(input.navigationState)) return null;
    const label = typeof input.label === 'string' ? input.label.trim().slice(0, 240) : '';
    if (!label) return null;
    const confirmedAt = input.confirmedAt || now();
    const id = input.id || uid('focus');
    let saved = null;
    updateState(state => {
      state.focuses.forEach(focus => {
        const sameSubject = input.subjectType && input.subjectId
          ? focus.subjectType === input.subjectType && focus.subjectId === input.subjectId
          : focus.sourceType === input.sourceType && focus.sourceId === input.sourceId && focus.label === label;
        if (sameSubject && focus.status === 'active') {
          focus.status = 'historical';
          focus.supersededAt = confirmedAt;
          focus.supersededBy = id;
          focus.updatedAt = confirmedAt;
        }
      });
      saved = normalizeFocus({
        id,
        label,
        status:'active',
        relationshipStatus:'current',
        navigationState:input.navigationState,
        subjectType:input.subjectType || null,
        subjectId:input.subjectId || null,
        sourceType:input.sourceType || null,
        sourceId:input.sourceId || null,
        confirmedAt,
        createdAt:confirmedAt,
        updatedAt:confirmedAt,
        provenance:createProvenance(PROVENANCE.USER_STATED, { sourceId:input.sourceId || id, recordedAt:confirmedAt })
      });
      state.focuses.push(saved);
      return state;
    });
    return saved;
  }

  function saveFocusCapacityDecision(focusId, decision) {
    if (!['shape_this_now', 'keep_both_visible'].includes(decision)) return null;
    let saved = null;
    updateState(state => {
      const focus = state.focuses.find(item => item.id === focusId && item.status === 'active');
      if (!focus || focus.navigationState !== 'develop') return state;
      const decidedAt = now();
      if (decision === 'shape_this_now') {
        state.focuses.forEach(item => {
          if (item.status === 'active' && item.navigationState === 'develop') item.projectReadiness = 'available';
        });
        focus.projectReadiness = 'selected_for_shaping';
      }
      focus.capacityDecision = decision;
      focus.capacityDecidedAt = decidedAt;
      focus.updatedAt = decidedAt;
      saved = focus;
      return state;
    });
    return saved;
  }

  function recordEvent(state, event) {
    const source = state || getState();
    const createdAt = event.createdAt || now();
    const dedupeKey = event.dedupeKey || null;
    if (dedupeKey && source.progressEvents.some(item => item.dedupeKey === dedupeKey)) return source;
    source.progressEvents.push({
      id: event.id || uid('progress'),
      progressType: event.progressType || 'movement',
      statement: String(event.statement || '').trim(),
      sourceType: event.sourceType || null,
      sourceId: event.sourceId || null,
      projectId: event.projectId || null,
      practiceId: event.practiceId || null,
      dedupeKey,
      createdAt
    });
    return source;
  }

  function saveWellnessWheel(payload) {
    const completedAt = payload.completedAt || now();
    return updateState(state => {
      if (state.wellnessWheel.current) state.wellnessWheel.history.push(state.wellnessWheel.current);
      state.wellnessWheel.current = { ...payload, completedAt };
      recordEvent(state, {
        progressType: 'landscape_mapped',
        statement: 'Mapped the Wellness Wheel across eight dimensions.',
        sourceType: 'wellness_wheel',
        sourceId: payload.id || null,
        dedupeKey: `wellness-wheel:${completedAt}`,
        createdAt: completedAt
      });
      return state;
    });
  }

  root.MSHStorage = {
    STORAGE_KEY, SCHEMA_VERSION, HELLO_HISTORY_LIMIT, PROVENANCE, FOCUS_DISPOSITIONS, createInitialState, normalizeState, getState,
    saveState, updateState, resetPrototypeData, getCurrentLandscape,
    getCurrentVision, getActiveProject, getActivePractice, getCurrentLearning, getCurrentFocuses,
    getHelloConversation, appendHelloTurn, clearHelloConversation,
    getFirstDoor, saveFirstDoor,
    setHelloActivity, getHelloActivity,
    createProvenance, confirmInference, saveFocusDecision, saveFocusCapacityDecision, recordEvent, saveWellnessWheel, uid
  };
})(typeof window !== 'undefined' ? window : globalThis);
