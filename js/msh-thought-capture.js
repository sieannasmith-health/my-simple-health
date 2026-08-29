/* My Simple Health — freeform thought capture
   Principle: structured freedom. The user's words are preserved as USER_STATED.
*/
(function (root) {
  'use strict';

  const MEMORY_KEY = 'thoughts';
  const MAX_LENGTH = 4000;

  function now() { return new Date().toISOString(); }

  function getSurfaceContext() {
    const page = document.body && document.body.dataset.mshPage || 'unknown';
    const route = `${location.pathname}${location.search}`;
    const active = document.querySelector('[aria-current="page"]');
    const heading = document.querySelector('main h1, main h2');
    return {
      page,
      route,
      pageLabel: active && active.textContent ? active.textContent.trim().slice(0, 120) : '',
      visibleHeading: heading && heading.textContent ? heading.textContent.trim().slice(0, 240) : ''
    };
  }

  function normalizeThought(value) {
    if (!value || typeof value !== 'object') return null;
    const text = typeof value.text === 'string' ? value.text.trim().slice(0, MAX_LENGTH) : '';
    if (!text) return null;
    const createdAt = value.createdAt || now();
    return {
      id: typeof value.id === 'string' && value.id ? value.id : root.MSHStorage.uid('thought'),
      text,
      createdAt,
      updatedAt: value.updatedAt || createdAt,
      status: value.status === 'archived' ? 'archived' : 'active',
      meaning: value.meaning && typeof value.meaning === 'string' ? value.meaning.trim().slice(0, 160) : '',
      context: value.context && typeof value.context === 'object' ? {
        page: typeof value.context.page === 'string' ? value.context.page.slice(0, 80) : '',
        route: typeof value.context.route === 'string' ? value.context.route.slice(0, 240) : '',
        pageLabel: typeof value.context.pageLabel === 'string' ? value.context.pageLabel.slice(0, 120) : '',
        visibleHeading: typeof value.context.visibleHeading === 'string' ? value.context.visibleHeading.slice(0, 240) : ''
      } : getSurfaceContext(),
      provenance: value.provenance && typeof value.provenance === 'object'
        ? value.provenance
        : root.MSHStorage.createProvenance(root.MSHStorage.PROVENANCE.USER_STATED, {
            sourceId: 'freeform-thought',
            recordedAt: createdAt
          })
    };
  }

  function getAll(state) {
    const source = state || root.MSHStorage.getState();
    const memory = source.settings && source.settings.memory || {};
    return Array.isArray(memory[MEMORY_KEY])
      ? memory[MEMORY_KEY].map(normalizeThought).filter(Boolean)
      : [];
  }

  function save(text, options) {
    if (!root.MSHStorage) throw new Error('MSHStorage is required.');
    const details = options && typeof options === 'object' ? options : {};
    const thought = normalizeThought({
      text,
      meaning: details.meaning || '',
      context: details.context || getSurfaceContext()
    });
    if (!thought) return null;

    root.MSHStorage.updateState(state => {
      state.settings = state.settings || {};
      state.settings.memory = state.settings.memory || {};
      const thoughts = Array.isArray(state.settings.memory[MEMORY_KEY])
        ? state.settings.memory[MEMORY_KEY]
        : [];
      thoughts.push(thought);
      state.settings.memory[MEMORY_KEY] = thoughts;
      return state;
    });

    document.dispatchEvent(new CustomEvent('msh:thought-saved', { detail: thought }));
    if (root.MSHFeedback) root.MSHFeedback.emit('record',{ source:'thought' });
    return thought;
  }

  function archive(id) {
    if (!id || !root.MSHStorage) return;
    root.MSHStorage.updateState(state => {
      const memory = state.settings && state.settings.memory;
      if (!memory || !Array.isArray(memory[MEMORY_KEY])) return state;
      memory[MEMORY_KEY] = memory[MEMORY_KEY].map(item =>
        item && item.id === id ? { ...item, status:'archived', updatedAt:now() } : item
      );
      return state;
    });
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function panelMarkup() {
    return `<div class="msh-thought-layer" data-msh-thought-layer hidden>
      <button class="msh-thought-backdrop" type="button" data-msh-thought-close aria-label="Close thought capture"></button>
      <section class="msh-thought-panel" role="dialog" aria-modal="true" aria-labelledby="msh-thought-title">
        <div class="msh-thought-panel-head">
          <div>
            <p class="msh-thought-eyebrow">YOUR SPACE</p>
            <h2 id="msh-thought-title">What are you thinking?</h2>
          </div>
          <button class="msh-thought-close" type="button" data-msh-thought-close aria-label="Close">×</button>
        </div>
        <p class="msh-thought-intro">Say it in your own words. You do not have to fit it into a category first.</p>
        <form data-msh-thought-form>
          <label class="msh-thought-label" for="msh-thought-text">Your thought</label>
          <textarea id="msh-thought-text" data-msh-thought-text rows="7" maxlength="${MAX_LENGTH}" placeholder="Something happened... I noticed... I keep thinking about... I don't know what this means yet, but..."></textarea>
          <div class="msh-thought-meta">
            <span data-msh-thought-context></span>
            <span><span data-msh-thought-count>0</span> / ${MAX_LENGTH}</span>
          </div>
          <details class="msh-thought-optional">
            <summary>Give it a meaning, if you want</summary>
            <p>This is optional. Your original words stay unchanged.</p>
            <input type="text" data-msh-thought-meaning maxlength="160" placeholder="Observation, question, reflection, something else...">
          </details>
          <div class="msh-thought-actions">
            <button class="msh-thought-secondary" type="button" data-msh-thought-close>Not now</button>
            <button class="msh-thought-primary" type="submit">Keep this thought</button>
          </div>
          <p class="msh-thought-confirmation" data-msh-thought-confirmation role="status" aria-live="polite"></p>
        </form>
      </section>
    </div>`;
  }

  function launcherMarkup() {
    return `<button class="msh-thought-launcher" type="button" data-msh-thought-open aria-haspopup="dialog">
      <span class="msh-thought-launcher-mark" aria-hidden="true">＋</span>
      <span>Thought</span>
    </button>`;
  }

  function contextLabel(context) {
    if (!context) return 'Saved in your health world';
    if (context.pageLabel) return `From ${escapeHtml(context.pageLabel)}`;
    if (context.visibleHeading) return `From ${escapeHtml(context.visibleHeading)}`;
    return 'Saved in your health world';
  }

  function mount() {
    if (!root.MSHStorage || document.querySelector('[data-msh-thought-open]')) return;
    const host = document.createElement('div');
    host.className = 'msh-thought-capture';
    host.innerHTML = `${launcherMarkup()}${panelMarkup()}`;
    document.body.appendChild(host);

    const layer = host.querySelector('[data-msh-thought-layer]');
    const textarea = host.querySelector('[data-msh-thought-text]');
    const meaning = host.querySelector('[data-msh-thought-meaning]');
    const count = host.querySelector('[data-msh-thought-count]');
    const contextEl = host.querySelector('[data-msh-thought-context]');
    const confirmation = host.querySelector('[data-msh-thought-confirmation]');
    let restoreFocus = null;

    function open() {
      restoreFocus = document.activeElement;
      const context = getSurfaceContext();
      contextEl.innerHTML = contextLabel(context);
      layer.hidden = false;
      document.body.classList.add('msh-thought-open');
      confirmation.textContent = '';
      requestAnimationFrame(() => textarea.focus());
      if (root.MSHFeedback) root.MSHFeedback.emit('reveal',{ source:'thought', target:host.querySelector('.msh-thought-panel') });
    }

    function close() {
      layer.hidden = true;
      document.body.classList.remove('msh-thought-open');
      if (restoreFocus && typeof restoreFocus.focus === 'function') restoreFocus.focus();
      if (root.MSHFeedback) root.MSHFeedback.emit('return',{ source:'thought' });
    }

    host.addEventListener('click', event => {
      if (event.target.closest('[data-msh-thought-open]')) open();
      if (event.target.closest('[data-msh-thought-close]')) close();
    });

    textarea.addEventListener('input', () => {
      count.textContent = String(textarea.value.length);
    });

    host.querySelector('[data-msh-thought-form]').addEventListener('submit', event => {
      event.preventDefault();
      const saved = save(textarea.value, { meaning:meaning.value, context:getSurfaceContext() });
      if (!saved) {
        confirmation.textContent = 'Write something first. Your words can be as open-ended as you need.';
        textarea.focus();
        return;
      }
      textarea.value = '';
      meaning.value = '';
      count.textContent = '0';
      confirmation.textContent = 'Kept exactly as you wrote it.';
      window.setTimeout(close, 650);
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !layer.hidden) close();
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 't') {
        event.preventDefault();
        open();
      }
    });
  }

  root.MSHThoughts = Object.freeze({ getAll, save, archive, getSurfaceContext, mount });
})(typeof window !== 'undefined' ? window : globalThis);
