/* My Simple Health — local prototype storage */
(function () {
  'use strict';

  const STORAGE_KEY = 'msh_data';
  const SCHEMA_VERSION = 1;

  function createInitialState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      user: {
        createdAt: new Date().toISOString()
      },
      landscapes: [],
      focuses: [],
      visionEntries: [],
      projects: [],
      practices: [],
      practiceAttempts: [],
      reflections: [],
      learningEntries: [],
      progressEvents: [],
      settings: {
        reminders: {},
        memory: {}
      }
    };
  }

  function normalizeState(state) {
    const initial = createInitialState();
    if (!state || typeof state !== 'object') return initial;

    return {
      ...initial,
      ...state,
      schemaVersion: SCHEMA_VERSION,
      user: { ...initial.user, ...(state.user || {}) },
      settings: {
        reminders: { ...(state.settings && state.settings.reminders || {}) },
        memory: { ...(state.settings && state.settings.memory || {}) }
      }
    };
  }

  function getState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const initial = createInitialState();
        saveState(initial);
        return initial;
      }

      const parsed = JSON.parse(raw);
      return normalizeState(parsed);
    } catch (error) {
      console.warn('My Simple Health could not read local prototype data.', error);
      return createInitialState();
    }
  }

  function saveState(state) {
    const normalized = normalizeState(state);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function updateState(updater) {
    const current = getState();
    const next = typeof updater === 'function' ? updater(current) : current;
    return saveState(next || current);
  }

  function resetPrototypeData() {
    window.localStorage.removeItem(STORAGE_KEY);
    return getState();
  }

  function getCurrentLandscape(state) {
    const source = state || getState();
    return [...source.landscapes]
      .filter(item => item.status === 'completed')
      .sort((a, b) => new Date(b.completedAt || b.updatedAt || 0) - new Date(a.completedAt || a.updatedAt || 0))[0] || null;
  }

  function getActiveProject(state) {
    const source = state || getState();
    return source.projects.find(project => project.status === 'active') || null;
  }

  function getActivePractice(state) {
    const source = state || getState();
    const project = getActiveProject(source);
    if (!project) return null;
    return source.practices.find(practice => practice.projectId === project.id && practice.status === 'active') || null;
  }

  function getCurrentLearning(state) {
    const source = state || getState();
    return source.learningEntries.filter(entry => entry.currentStatus === 'current');
  }

  window.MSHStorage = {
    STORAGE_KEY,
    SCHEMA_VERSION,
    createInitialState,
    getState,
    saveState,
    updateState,
    resetPrototypeData,
    getCurrentLandscape,
    getActiveProject,
    getActivePractice,
    getCurrentLearning
  };
})();
