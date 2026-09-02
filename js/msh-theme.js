/* My Simple Health — shared Light / Dark / System theme runtime */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'msh_theme_preference';
  const OPTIONS = ['light', 'dark', 'system'];
  const CONTRAST_STYLESHEET = 'css/msh-surface-contrast.css?v=20260902-1';
  const media = typeof root.matchMedia === 'function'
    ? root.matchMedia('(prefers-color-scheme: dark)')
    : { matches: false };
  const listeners = new Set();

  function ensureContrastStylesheet() {
    const document = root.document;
    if (!document || document.querySelector('link[data-msh-surface-contrast]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CONTRAST_STYLESHEET;
    link.dataset.mshSurfaceContrast = '';
    (document.head || document.documentElement).appendChild(link);
  }

  function normalize(value) {
    return OPTIONS.includes(value) ? value : 'system';
  }

  function readPreference() {
    try { return normalize(root.localStorage.getItem(STORAGE_KEY)); }
    catch (_) { return 'system'; }
  }

  function resolvedTheme(preference) {
    return preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
  }

  function apply(preference, persist) {
    const nextPreference = normalize(preference);
    const resolved = resolvedTheme(nextPreference);
    const documentElement = root.document && root.document.documentElement;
    ensureContrastStylesheet();
    if (documentElement) {
      documentElement.dataset.themePreference = nextPreference;
      documentElement.dataset.theme = resolved;
      documentElement.style.colorScheme = resolved;
    }
    if (persist) {
      try { root.localStorage.setItem(STORAGE_KEY, nextPreference); } catch (_) {}
    }
    listeners.forEach(listener => listener({ preference: nextPreference, resolved }));
    return { preference: nextPreference, resolved };
  }

  function setPreference(preference) {
    return apply(preference, true);
  }

  function getPreference() {
    const documentElement = root.document && root.document.documentElement;
    return normalize(documentElement && documentElement.dataset.themePreference || readPreference());
  }

  function onChange(listener) {
    if (typeof listener !== 'function') return function () {};
    listeners.add(listener);
    return function () { listeners.delete(listener); };
  }

  function handleSystemChange() {
    if (getPreference() === 'system') apply('system', false);
  }

  if (typeof media.addEventListener === 'function') media.addEventListener('change', handleSystemChange);
  else if (typeof media.addListener === 'function') media.addListener(handleSystemChange);

  root.MSHTheme = { STORAGE_KEY, OPTIONS, getPreference, setPreference, onChange, apply };
  apply(readPreference(), false);
})(typeof window !== 'undefined' ? window : globalThis);
