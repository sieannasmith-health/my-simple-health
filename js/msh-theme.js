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

  function installSimpleSharingPrompt() {
    const document = root.document;
    if (!document || !root.MSH_NATIVE_SHELL) return;

    const pathname = root.location && root.location.pathname ? root.location.pathname : '';
    if (!pathname.endsWith('/hello.html') && !pathname.endsWith('hello.html')) return;

    const promptSeenKey = 'msh.simple.sharingPromptSeen';
    const domainKeyPrefix = 'msh.simple.share.';
    const domains = [
      {
        id: 'sleep',
        title: 'Sleep',
        description: 'Use saved sleep duration, timing, stages, and recent sleep context.'
      },
      {
        id: 'movement',
        title: 'Movement',
        description: 'Use saved movement, activity, workouts, and movement context.'
      },
      {
        id: 'heartActivity',
        title: 'Heart activity',
        description: 'Use saved heart-rate and heart-activity context from My Health.'
      },
      {
        id: 'bodyMeasurements',
        title: 'Body measurements',
        description: 'Use saved body-measurement context such as weight or blood pressure.'
      },
      {
        id: 'cycle',
        title: 'Cycle',
        description: 'Use saved cycle context when you choose to share it with Simple.'
      },
      {
        id: 'medications',
        title: 'Medications',
        description: 'Use saved medication and continuity context when answering questions.'
      },
      {
        id: 'assessments',
        title: 'Assessments',
        description: 'Use assessment answers and summaries you have chosen to keep in MSH.'
      },
      {
        id: 'healthStory',
        title: 'My Health Story',
        description: 'Use confirmed health-story observations and lived-experience context.'
      },
      {
        id: 'calendarHealthEvents',
        title: 'Calendar health events',
        description: 'Use health-related appointments, planned actions, and dated events.'
      }
    ];

    function localStorageGet(key) {
      try { return root.localStorage.getItem(key); }
      catch (_) { return null; }
    }

    function localStorageSet(key, value) {
      try { root.localStorage.setItem(key, value); } catch (_) {}
    }

    const hasSharedDomain = domains.some(domain => localStorageGet(domainKeyPrefix + domain.id) === 'true');
    if (localStorageGet(promptSeenKey) === 'true' || hasSharedDomain || document.getElementById('msh-simple-sharing-gate')) return;

    function removeGate() {
      const existing = document.getElementById('msh-simple-sharing-gate');
      if (existing) existing.remove();
      document.documentElement.classList.remove('msh-simple-sharing-open');
    }

    function renderSharingChoices(card) {
      card.innerHTML = '';

      const eyebrow = document.createElement('p');
      eyebrow.className = 'msh-simple-sharing-eyebrow';
      eyebrow.textContent = 'SIMPLE SHARING';

      const title = document.createElement('h1');
      title.textContent = 'Choose what Simple can use.';

      const description = document.createElement('p');
      description.className = 'msh-simple-sharing-copy';
      description.textContent = 'Simple can only use the My Health areas you turn on. This is separate from Apple Health access, and you can change these choices later.';

      const list = document.createElement('div');
      list.className = 'msh-simple-sharing-list';

      domains.forEach(domain => {
        const row = document.createElement('label');
        row.className = 'msh-simple-sharing-row';

        const text = document.createElement('span');
        text.className = 'msh-simple-sharing-row-text';

        const name = document.createElement('strong');
        name.textContent = domain.title;

        const detail = document.createElement('small');
        detail.textContent = domain.description;

        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.checked = localStorageGet(domainKeyPrefix + domain.id) === 'true';
        toggle.setAttribute('aria-label', 'Share ' + domain.title + ' with Simple');

        text.appendChild(name);
        text.appendChild(detail);
        row.appendChild(text);
        row.appendChild(toggle);
        list.appendChild(row);
      });

      const actions = document.createElement('div');
      actions.className = 'msh-simple-sharing-actions';

      const save = document.createElement('button');
      save.type = 'button';
      save.className = 'msh-simple-sharing-primary';
      save.textContent = 'Save sharing choices';
      save.addEventListener('click', () => {
        Array.from(list.querySelectorAll('input[type="checkbox"]')).forEach((input, index) => {
          localStorageSet(domainKeyPrefix + domains[index].id, input.checked ? 'true' : 'false');
        });
        localStorageSet(promptSeenKey, 'true');
        removeGate();
      });

      const skip = document.createElement('button');
      skip.type = 'button';
      skip.className = 'msh-simple-sharing-secondary';
      skip.textContent = 'Not now';
      skip.addEventListener('click', () => {
        localStorageSet(promptSeenKey, 'true');
        removeGate();
      });

      actions.appendChild(save);
      actions.appendChild(skip);
      card.appendChild(eyebrow);
      card.appendChild(title);
      card.appendChild(description);
      card.appendChild(list);
      card.appendChild(actions);
    }

    function showGate() {
      const gate = document.createElement('div');
      gate.id = 'msh-simple-sharing-gate';
      gate.setAttribute('role', 'dialog');
      gate.setAttribute('aria-modal', 'true');
      gate.setAttribute('aria-label', 'Share My Health with Simple');

      const style = document.createElement('style');
      style.textContent = `
        .msh-simple-sharing-open { overflow: hidden; }
        #msh-simple-sharing-gate {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 18px;
          background: rgba(10, 14, 11, 0.64);
          backdrop-filter: blur(10px);
        }
        .msh-simple-sharing-card {
          width: min(100%, 540px);
          max-height: calc(100vh - 40px);
          overflow: auto;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 30px;
          background: #111512;
          color: #f7f3ea;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.4);
          padding: 28px 22px 22px;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, sans-serif;
        }
        .msh-simple-sharing-card h1 {
          margin: 0 0 12px;
          color: #f7f3ea;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(32px, 9vw, 44px);
          line-height: 0.96;
          font-weight: 500;
          letter-spacing: -0.03em;
        }
        .msh-simple-sharing-eyebrow {
          margin: 0 0 14px;
          color: #a9d3aa;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.18em;
        }
        .msh-simple-sharing-copy {
          margin: 0 0 22px;
          color: rgba(247, 243, 234, 0.78);
          font-size: 16px;
          line-height: 1.55;
        }
        .msh-simple-sharing-list {
          border-top: 1px solid rgba(247, 243, 234, 0.12);
          margin-top: 4px;
        }
        .msh-simple-sharing-row {
          display: flex;
          gap: 16px;
          align-items: center;
          justify-content: space-between;
          padding: 16px 0;
          border-bottom: 1px solid rgba(247, 243, 234, 0.12);
        }
        .msh-simple-sharing-row-text {
          display: grid;
          gap: 4px;
          min-width: 0;
        }
        .msh-simple-sharing-row strong {
          color: #f7f3ea;
          font-size: 16px;
        }
        .msh-simple-sharing-row small {
          color: rgba(247, 243, 234, 0.66);
          font-size: 13px;
          line-height: 1.35;
        }
        .msh-simple-sharing-row input {
          width: 24px;
          height: 24px;
          accent-color: #a9d3aa;
          flex: 0 0 auto;
        }
        .msh-simple-sharing-actions {
          display: grid;
          gap: 10px;
          margin-top: 20px;
        }
        .msh-simple-sharing-primary,
        .msh-simple-sharing-secondary {
          appearance: none;
          border: 0;
          border-radius: 18px;
          min-height: 52px;
          padding: 0 18px;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
        }
        .msh-simple-sharing-primary {
          background: #a9d3aa;
          color: #101510;
        }
        .msh-simple-sharing-secondary {
          background: rgba(247, 243, 234, 0.08);
          color: #f7f3ea;
        }
      `;

      const card = document.createElement('div');
      card.className = 'msh-simple-sharing-card';

      const eyebrow = document.createElement('p');
      eyebrow.className = 'msh-simple-sharing-eyebrow';
      eyebrow.textContent = 'SIMPLE SHARING';

      const title = document.createElement('h1');
      title.textContent = 'Share My Health with Simple?';

      const description = document.createElement('p');
      description.className = 'msh-simple-sharing-copy';
      description.textContent = 'Simple can use your My Health context only after you choose what to share. MSH keeps Apple Health access and Simple sharing as separate permissions.';

      const actions = document.createElement('div');
      actions.className = 'msh-simple-sharing-actions';

      const choose = document.createElement('button');
      choose.type = 'button';
      choose.className = 'msh-simple-sharing-primary';
      choose.textContent = 'Choose what to share';
      choose.addEventListener('click', () => renderSharingChoices(card));

      const notNow = document.createElement('button');
      notNow.type = 'button';
      notNow.className = 'msh-simple-sharing-secondary';
      notNow.textContent = 'Not now';
      notNow.addEventListener('click', () => {
        localStorageSet(promptSeenKey, 'true');
        removeGate();
      });

      actions.appendChild(choose);
      actions.appendChild(notNow);
      card.appendChild(eyebrow);
      card.appendChild(title);
      card.appendChild(description);
      card.appendChild(actions);
      gate.appendChild(style);
      gate.appendChild(card);
      document.documentElement.classList.add('msh-simple-sharing-open');
      document.body.appendChild(gate);
      choose.focus({ preventScroll: true });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showGate, { once: true });
    } else {
      showGate();
    }
  }

  if (typeof media.addEventListener === 'function') media.addEventListener('change', handleSystemChange);
  else if (typeof media.addListener === 'function') media.addListener(handleSystemChange);

  root.MSHTheme = { STORAGE_KEY, OPTIONS, getPreference, setPreference, onChange, apply };
  apply(readPreference(), false);
  installSimpleSharingPrompt();
})(typeof window !== 'undefined' ? window : globalThis);
