/* My Simple Health — time-aware personal greeting */
(function (root) {
  'use strict';

  const PROFILE_KEY = 'msh_profile_preferences_v1';
  const PROTOTYPE_DEFAULT_NAME = 'Siea';

  function cleanName(value) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 40) : '';
  }

  function readProfile() {
    try {
      const parsed = JSON.parse(root.localStorage.getItem(PROFILE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function writeProfile(profile) {
    try { root.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); }
    catch (_) {}
    return profile;
  }

  function getPreferredName() {
    const state = root.MSHStorage && root.MSHStorage.getState ? root.MSHStorage.getState() : null;
    const fromState = cleanName(
      state && state.user && state.user.preferredName ||
      state && state.settings && state.settings.profile && state.settings.profile.preferredName
    );
    if (fromState) return fromState;

    const profile = readProfile();
    const saved = cleanName(profile.preferredName);
    if (saved) return saved;

    /* Single-user prototype default. Account-backed profiles should replace this seed. */
    profile.preferredName = PROTOTYPE_DEFAULT_NAME;
    writeProfile(profile);
    return PROTOTYPE_DEFAULT_NAME;
  }

  function setPreferredName(value) {
    const preferredName = cleanName(value);
    const profile = readProfile();
    if (preferredName) profile.preferredName = preferredName;
    else delete profile.preferredName;
    writeProfile(profile);
    apply();
    return preferredName;
  }

  function greetingFor(moment, name) {
    const base = moment && moment.greeting ? moment.greeting : 'Hello';
    return name ? `${base}, ${name}.` : `${base}.`;
  }

  function apply(moment) {
    const header = root.document && root.document.querySelector('.msh-my-health-dashboard__intro');
    if (!header) return null;

    const current = moment || root.MSHEnvironment && root.MSHEnvironment.getCurrent && root.MSHEnvironment.getCurrent() || { greeting:'Hello', label:'My Health', id:'unknown' };
    const preferredName = getPreferredName();
    const title = header.querySelector('#my-health-title');
    const eyebrow = header.querySelector('.msh-my-health-dashboard__eyebrow');

    if (title) {
      title.textContent = greetingFor(current, preferredName);
      title.dataset.mshTimeGreeting = current.id || 'unknown';
    }
    if (eyebrow) eyebrow.textContent = `${current.label || 'My Health'} / My Health`;

    header.dataset.mshDaypart = current.id || 'unknown';
    header.dataset.mshPreferredName = preferredName;
    return { greeting:greetingFor(current, preferredName), preferredName, daypart:current.id || 'unknown' };
  }

  function mount() {
    apply();
    root.document.addEventListener('msh:environment-change', event => apply(event.detail && event.detail.current));
  }

  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', mount, { once:true });
    else mount();
  }

  root.MSHPersonalGreeting = Object.freeze({ getPreferredName, setPreferredName, greetingFor, apply });
})(typeof window !== 'undefined' ? window : globalThis);
