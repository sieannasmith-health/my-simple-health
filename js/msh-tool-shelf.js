/* My Simple Health — customizable personal tool shelf */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'msh_data';
  const MEMORY_KEY = 'toolShelf';

  function isToolsView() {
    return document.body && document.body.dataset.mshPage === 'health' && new URLSearchParams(location.search).get('view') === 'tools';
  }

  function toolId(section, index) {
    if (section.dataset.mshToolId) return section.dataset.mshToolId;
    const route = section.querySelector('[data-msh-route]')?.dataset.mshRoute;
    const heading = section.querySelector('h2')?.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const id = route || heading || `tool-${index + 1}`;
    section.dataset.mshToolId = id;
    return id;
  }

  function readPreference() {
    try {
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const shelf = state.settings && state.settings.memory && state.settings.memory[MEMORY_KEY];
      return shelf && typeof shelf === 'object' ? shelf : { hidden: [] };
    } catch (_) {
      return { hidden: [] };
    }
  }

  function writePreference(hidden) {
    try {
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      state.settings = state.settings && typeof state.settings === 'object' ? state.settings : {};
      state.settings.memory = state.settings.memory && typeof state.settings.memory === 'object' ? state.settings.memory : {};
      state.settings.memory[MEMORY_KEY] = { hidden: Array.from(new Set(hidden)), updatedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('My Simple Health could not save tool shelf preferences.', error);
    }
  }

  function getCarousel() {
    return document.querySelector('.msh-tools-directory.msh-glide[data-msh-glide-label="Tools"]');
  }

  function getTools(carousel) {
    return Array.from(carousel ? carousel.children : []).filter(node => node.matches && node.matches('section'));
  }

  function applyPreference(carousel) {
    const preference = readPreference();
    const hidden = new Set(Array.isArray(preference.hidden) ? preference.hidden : []);
    const tools = getTools(carousel);
    tools.forEach((section, index) => {
      const id = toolId(section, index);
      section.hidden = hidden.has(id);
    });
    carousel.dispatchEvent(new CustomEvent('msh:tools-changed', { bubbles: true }));
  }

  function buildManager(carousel) {
    if (document.querySelector('[data-msh-tool-manager]')) return;

    const tools = getTools(carousel);
    if (!tools.length) return;

    const wrap = document.createElement('div');
    wrap.className = 'msh-tool-shelf-controls';
    wrap.dataset.mshToolManager = '';
    wrap.innerHTML = `
      <button type="button" class="msh-text-button" data-tool-manager-open>Manage tools</button>
      <dialog class="msh-tool-manager-dialog" data-tool-manager-dialog aria-labelledby="msh-tool-manager-title">
        <form method="dialog" class="msh-tool-manager-card">
          <header>
            <p class="msh-glass-category">My tools</p>
            <h2 id="msh-tool-manager-title">Choose what stays close.</h2>
            <p>Add or remove tools from this shelf. Every available tool remains accessible here.</p>
          </header>
          <div class="msh-tool-manager-list" data-tool-manager-list></div>
          <div class="msh-card-actions">
            <button type="button" class="msh-button" data-tool-manager-done>Done</button>
          </div>
        </form>
      </dialog>`;

    const shell = carousel.closest('.msh-glide-shell') || carousel.parentElement;
    shell.insertAdjacentElement('afterend', wrap);

    const dialog = wrap.querySelector('[data-tool-manager-dialog]');
    const list = wrap.querySelector('[data-tool-manager-list]');

    function renderList() {
      const preference = readPreference();
      const hidden = new Set(Array.isArray(preference.hidden) ? preference.hidden : []);
      list.innerHTML = getTools(carousel).map((section, index) => {
        const id = toolId(section, index);
        const title = section.querySelector('h2')?.textContent.trim() || `Tool ${index + 1}`;
        const category = section.querySelector('.msh-glass-category')?.textContent.trim() || 'Tool';
        return `<label class="msh-tool-manager-item"><span><strong>${title}</strong><small>${category}</small></span><input type="checkbox" data-tool-choice="${id}" ${hidden.has(id) ? '' : 'checked'} aria-label="Show ${title} in My tools"></label>`;
      }).join('');
    }

    wrap.querySelector('[data-tool-manager-open]').addEventListener('click', () => {
      renderList();
      if (dialog.showModal) dialog.showModal();
      else dialog.setAttribute('open', '');
    });

    list.addEventListener('change', event => {
      const input = event.target.closest('[data-tool-choice]');
      if (!input) return;
      const hidden = getTools(carousel).map((section, index) => toolId(section, index)).filter(id => {
        const control = list.querySelector(`[data-tool-choice="${CSS.escape(id)}"]`);
        return control && !control.checked;
      });
      writePreference(hidden);
      applyPreference(carousel);
    });

    wrap.querySelector('[data-tool-manager-done]').addEventListener('click', () => {
      if (dialog.close) dialog.close();
      else dialog.removeAttribute('open');
    });
  }

  function mount() {
    if (!isToolsView()) return;
    const carousel = getCarousel();
    if (!carousel) return;
    applyPreference(carousel);
    buildManager(carousel);
  }

  function initialize() {
    mount();
    if (!root.MutationObserver) return;
    const observer = new MutationObserver(() => mount());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})(typeof window !== 'undefined' ? window : globalThis);
