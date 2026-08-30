/* My Simple Health — living health story compiler
 *
 * The story layer does not replace source records. It reads the canonical My Health
 * state, preserves provenance, and compiles meaningful contributions into a reviewable
 * longitudinal picture. User-authored story notes live in settings.memory so this can
 * later move to persistent account storage without changing the source records.
 */
(function (root) {
  'use strict';

  const MEMORY_KEY = 'healthStoryContributions';
  const STORY_VERSION = 1;
  const MAX_TEXT = 2400;

  const SECTION_ORDER = [
    'current_picture',
    'what_matters',
    'context',
    'what_i_tried',
    'what_i_learned',
    'health_in_time',
    'open_questions'
  ];

  const SECTION_LABELS = Object.freeze({
    current_picture: 'My current picture',
    what_matters: 'What matters to me',
    context: 'What was happening around it',
    what_i_tried: 'What I tried',
    what_i_learned: 'What I am learning',
    health_in_time: 'My health in time',
    open_questions: 'What is still open'
  });

  function list(value) { return Array.isArray(value) ? value : []; }
  function text(value, limit = MAX_TEXT) {
    return typeof value === 'string' ? value.trim().slice(0, limit) : '';
  }
  function dateValue(value) {
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function newest(items) {
    return [...list(items)].sort((a, b) => dateValue(b.updatedAt || b.completedAt || b.createdAt || b.observedAt) - dateValue(a.updatedAt || a.completedAt || a.createdAt || a.observedAt));
  }
  function uid(prefix) {
    return root.MSHStorage && MSHStorage.uid ? MSHStorage.uid(prefix) : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  function provenance(status, sourceId, recordedAt) {
    if (root.MSHStorage && MSHStorage.createProvenance) {
      return MSHStorage.createProvenance(status || MSHStorage.PROVENANCE.SYSTEM_OBSERVED, { sourceId, recordedAt });
    }
    return { status: status || 'SYSTEM_OBSERVED', sourceId: sourceId || null, recordedAt: recordedAt || new Date().toISOString(), transitions: [] };
  }
  function storyMemory(state) {
    return list(state && state.settings && state.settings.memory && state.settings.memory[MEMORY_KEY]);
  }
  function cleanTags(value) {
    return list(value).map(item => text(item, 80).toLowerCase()).filter(Boolean).slice(0, 12);
  }
  function normalizeContribution(input) {
    if (!input || typeof input !== 'object') return null;
    const section = SECTION_ORDER.includes(input.section) ? input.section : 'context';
    const summary = text(input.summary || input.detail || input.title);
    if (!summary) return null;
    const createdAt = input.createdAt || input.observedAt || new Date().toISOString();
    return {
      id: text(input.id, 180) || uid('story'),
      storyVersion: STORY_VERSION,
      section,
      title: text(input.title, 240),
      summary,
      detail: text(input.detail),
      sourceType: text(input.sourceType, 80) || 'story_note',
      sourceId: text(input.sourceId, 180) || null,
      domainTags: cleanTags(input.domainTags),
      observedAt: input.observedAt || createdAt,
      createdAt,
      updatedAt: input.updatedAt || createdAt,
      inclusion: input.inclusion === 'excluded' ? 'excluded' : 'included',
      provenance: input.provenance && typeof input.provenance === 'object'
        ? input.provenance
        : provenance(root.MSHStorage && MSHStorage.PROVENANCE ? MSHStorage.PROVENANCE.USER_STATED : 'USER_STATED', input.sourceId || input.id || 'health-story', createdAt)
    };
  }

  function landscapeContributions(state) {
    const record = newest(list(state.landscapes).filter(item => item && item.status === 'completed'))[0];
    if (!record) return [];
    const responses = list(record.responses).filter(item => item && item.dimension && item.value != null);
    const scoreSummary = responses.map(item => `${String(item.dimension).replace(/_/g, ' ')} ${item.value}/10`).join(' · ');
    const contributions = [];
    if (scoreSummary) {
      contributions.push(normalizeContribution({
        id: `derived:landscape:${record.id}`,
        section: 'current_picture',
        title: 'My Health Landscape',
        summary: `My current self-ratings: ${scoreSummary}.`,
        sourceType: 'health_landscape',
        sourceId: record.id,
        observedAt: record.completedAt || record.updatedAt,
        domainTags: responses.map(item => item.dimension),
        provenance: provenance(root.MSHStorage?.PROVENANCE?.SYSTEM_OBSERVED || 'SYSTEM_OBSERVED', record.id, record.completedAt || record.updatedAt)
      }));
    }
    if (record.selectedArea && record.selectedArea.name) {
      contributions.push(normalizeContribution({
        id: `derived:landscape-focus:${record.id}:${record.selectedArea.key || 'area'}`,
        section: 'what_matters',
        title: 'An area I chose to look at more closely',
        summary: text(record.selectedArea.name),
        sourceType: 'health_landscape_selection',
        sourceId: record.id,
        observedAt: record.selectedArea.selectedAt || record.updatedAt,
        domainTags: [record.selectedArea.key || record.selectedArea.name],
        provenance: record.selectedArea.provenance
      }));
    }
    list(record.dimensionContexts).forEach(entry => {
      const copy = text(entry.context) || (entry.contextType === 'leave_open' ? 'I chose to leave this area open for now.' : '');
      if (!copy) return;
      const section = entry.contextType === 'question' || entry.contextType === 'uncertainty' || entry.contextType === 'leave_open'
        ? 'open_questions' : 'context';
      contributions.push(normalizeContribution({
        id: `derived:landscape-context:${entry.id || `${record.id}:${entry.dimensionId}:${entry.createdAt}`}`,
        section,
        title: entry.dimensionLabel ? `${entry.dimensionLabel}: what I wanted to remember` : 'What I wanted to remember',
        summary: copy,
        sourceType: 'health_landscape_context',
        sourceId: entry.id || record.id,
        observedAt: entry.createdAt || record.updatedAt,
        domainTags: [entry.dimensionId || entry.dimensionLabel],
        provenance: entry.provenance
      }));
    });
    return contributions.filter(Boolean);
  }

  function focusContributions(state) {
    return list(state.focuses).filter(item => item && item.status === 'active' && item.label).map(item => normalizeContribution({
      id: `derived:focus:${item.id}`,
      section: 'what_matters',
      title: 'Something that matters to me now',
      summary: item.label,
      detail: item.navigationState ? `Current relationship: ${String(item.navigationState).replace(/_/g, ' ')}.` : '',
      sourceType: 'focus', sourceId: item.id, observedAt: item.confirmedAt || item.updatedAt || item.createdAt,
      domainTags: [item.subjectType, item.sourceType], provenance: item.provenance
    })).filter(Boolean);
  }

  function visionContributions(state) {
    const entry = root.MSHStorage && MSHStorage.getCurrentVision ? MSHStorage.getCurrentVision(state) : newest(list(state.visionEntries).filter(item => item && item.status === 'current'))[0];
    const statement = entry && entry.synthesis && text(entry.synthesis.statement);
    if (!statement) return [];
    return [normalizeContribution({
      id: `derived:vision:${entry.id}`,
      section: 'what_matters',
      title: 'The direction I have named',
      summary: statement,
      sourceType: 'vision', sourceId: entry.id, observedAt: entry.updatedAt || entry.createdAt,
      provenance: entry.synthesis.provenance || provenance(root.MSHStorage?.PROVENANCE?.USER_CONFIRMED || 'USER_CONFIRMED', entry.id, entry.updatedAt || entry.createdAt)
    })].filter(Boolean);
  }

  function projectAndPracticeContributions(state) {
    const result = [];
    list(state.projects).forEach(item => {
      if (!item) return;
      const title = text(item.title || item.name || item.label || item.pointB || item.direction);
      if (!title) return;
      result.push(normalizeContribution({
        id: `derived:project:${item.id}`,
        section: 'what_i_tried',
        title: 'A direction I worked on',
        summary: title,
        detail: text(item.why || item.reason || item.context || item.description),
        sourceType: 'project', sourceId: item.id, observedAt: item.updatedAt || item.createdAt,
        domainTags: item.tags, provenance: item.provenance
      }));
    });
    list(state.practices).forEach(item => {
      if (!item) return;
      const label = text(item.label || item.title || item.name || item.practice);
      if (!label) return;
      result.push(normalizeContribution({
        id: `derived:practice:${item.id}`,
        section: 'what_i_tried',
        title: 'Something I practiced',
        summary: label,
        detail: text(item.description || item.context || item.cue),
        sourceType: 'practice', sourceId: item.id, observedAt: item.updatedAt || item.createdAt,
        domainTags: item.tags, provenance: item.provenance
      }));
    });
    return result.filter(Boolean);
  }

  function learningContributions(state) {
    const result = [];
    list(state.reflections).forEach(item => {
      const copy = text(item && (item.reflection || item.text || item.note || item.response || item.summary));
      if (!copy) return;
      result.push(normalizeContribution({
        id: `derived:reflection:${item.id || item.createdAt}`,
        section: 'what_i_learned', title: 'A reflection I recorded', summary: copy,
        sourceType: 'reflection', sourceId: item.id || null, observedAt: item.createdAt || item.updatedAt,
        domainTags: item.tags, provenance: item.provenance
      }));
    });
    list(state.learningEntries).forEach(item => {
      const copy = text(item && (item.statement || item.learning || item.summary || item.text || item.note || item.title));
      if (!copy) return;
      result.push(normalizeContribution({
        id: `derived:learning:${item.id || item.createdAt}`,
        section: 'what_i_learned', title: 'Something I learned about myself', summary: copy,
        detail: text(item.detail || item.context), sourceType: 'learning', sourceId: item.id || null,
        observedAt: item.updatedAt || item.createdAt, domainTags: item.tags, provenance: item.provenance
      }));
    });
    return result.filter(Boolean);
  }

  function calendarContributions(state) {
    return newest(state.calendar && state.calendar.events).slice(0, 40).map(item => {
      const label = text(item && (item.title || item.label || item.name || item.category || item.type));
      if (!label) return null;
      const detail = text(item.note || item.notes || item.context || item.description);
      return normalizeContribution({
        id: `derived:calendar:${item.id || `${label}:${item.start || item.date || item.createdAt}`}`,
        section: 'health_in_time', title: label, summary: detail || label,
        sourceType: 'calendar_event', sourceId: item.id || null,
        observedAt: item.start || item.date || item.observedAt || item.createdAt,
        domainTags: [item.category, item.type, item.layer], provenance: item.provenance
      });
    }).filter(Boolean);
  }

  function progressContributions(state) {
    return newest(state.progressEvents).slice(0, 24).map(item => {
      const statement = text(item && item.statement);
      if (!statement) return null;
      return normalizeContribution({
        id: `derived:progress:${item.id || item.dedupeKey || item.createdAt}`,
        section: item.progressType && /learn|discover|reflect/i.test(item.progressType) ? 'what_i_learned' : 'health_in_time',
        title: 'A moment in my journey', summary: statement,
        sourceType: 'progress_event', sourceId: item.id || null, observedAt: item.createdAt,
        domainTags: [item.progressType, item.sourceType], provenance: item.provenance
      });
    }).filter(Boolean);
  }

  function derivedContributions(state) {
    return [
      ...landscapeContributions(state),
      ...focusContributions(state),
      ...visionContributions(state),
      ...projectAndPracticeContributions(state),
      ...learningContributions(state),
      ...calendarContributions(state),
      ...progressContributions(state)
    ];
  }

  function contributionOverrides(state) {
    const raw = state && state.settings && state.settings.memory && state.settings.memory.healthStoryOverrides;
    return raw && typeof raw === 'object' ? raw : {};
  }

  function getContributions(state) {
    const source = state || (root.MSHStorage && MSHStorage.getState ? MSHStorage.getState() : {});
    const overrides = contributionOverrides(source);
    const explicit = storyMemory(source).map(normalizeContribution).filter(Boolean);
    const derived = derivedContributions(source).map(item => {
      const override = overrides[item.id];
      return override ? { ...item, inclusion: override.inclusion === 'excluded' ? 'excluded' : 'included' } : item;
    });
    const seen = new Set();
    return newest([...explicit, ...derived]).filter(item => {
      if (!item || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  function recordContribution(input) {
    if (!root.MSHStorage || !MSHStorage.updateState) return null;
    const createdAt = input && (input.createdAt || input.observedAt) || new Date().toISOString();
    const contribution = normalizeContribution({
      ...input,
      id: input && input.id || uid('story'),
      createdAt,
      observedAt: input && input.observedAt || createdAt,
      provenance: input && input.provenance || provenance(MSHStorage.PROVENANCE.USER_STATED, input && input.sourceId || 'health-story-note', createdAt)
    });
    if (!contribution) return null;
    MSHStorage.updateState(state => {
      state.settings = state.settings || {};
      state.settings.memory = state.settings.memory || {};
      const entries = storyMemory(state).filter(item => item && item.id !== contribution.id);
      entries.push(contribution);
      state.settings.memory[MEMORY_KEY] = entries.slice(-250);
      return state;
    });
    return contribution;
  }

  function setInclusion(id, included) {
    if (!root.MSHStorage || !MSHStorage.updateState || !id) return false;
    MSHStorage.updateState(state => {
      state.settings = state.settings || {};
      state.settings.memory = state.settings.memory || {};
      const entries = storyMemory(state);
      const explicit = entries.find(item => item && item.id === id);
      if (explicit) {
        explicit.inclusion = included ? 'included' : 'excluded';
        explicit.updatedAt = new Date().toISOString();
        state.settings.memory[MEMORY_KEY] = entries;
      } else {
        const overrides = state.settings.memory.healthStoryOverrides && typeof state.settings.memory.healthStoryOverrides === 'object'
          ? state.settings.memory.healthStoryOverrides : {};
        overrides[id] = { inclusion: included ? 'included' : 'excluded', updatedAt: new Date().toISOString() };
        state.settings.memory.healthStoryOverrides = overrides;
      }
      return state;
    });
    return true;
  }

  function buildSnapshot(state) {
    const contributions = getContributions(state).filter(item => item.inclusion !== 'excluded');
    const sections = SECTION_ORDER.map(id => ({
      id,
      label: SECTION_LABELS[id],
      contributions: contributions.filter(item => item.section === id)
    })).filter(section => section.contributions.length);
    return {
      version: STORY_VERSION,
      generatedAt: new Date().toISOString(),
      title: 'My Health Story',
      sections,
      contributionCount: contributions.length,
      principles: {
        userEditable: true,
        preservesProvenance: true,
        distinguishesSourceFromSummary: true,
        causalClaims: false
      }
    };
  }

  root.MSHHealthStory = {
    STORY_VERSION,
    SECTION_ORDER,
    SECTION_LABELS,
    getContributions,
    recordContribution,
    setInclusion,
    buildSnapshot
  };
})(typeof window !== 'undefined' ? window : globalThis);
