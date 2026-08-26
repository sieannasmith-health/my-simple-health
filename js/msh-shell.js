/* My Simple Health — shared My Health workspace shell */
(function () {
  'use strict';

  const navItems = [
    { key:'health', label:'My Health', href:'my-health.html' },
    { key:'landscape', label:'Landscape', href:'my-landscape.html' },
    { key:'vision', label:'Horizon', href:'my-vision.html' },
    { key:'project', label:'Path', href:'my-project.html' },
    { key:'practice', label:'Practice', href:'my-practice.html' },
    { key:'learning', label:'Discovery', href:'my-learning.html' },
    { key:'progress', label:'Journey', href:'my-progress.html' },
    { key:'calendar', label:'Calendar', href:'calendar.html' },
    { key:'hello', label:'Hello', href:'hello.html?from=workspace' }
  ];

  const simplifiedHealthNav = [
    { key:'health', label:'My Health', href:'my-health.html' },
    { key:'explore', label:'Explore', href:'topics.html' },
    { key:'tools', label:'Tools', href:'my-health.html?view=tools' },
    { key:'hello', label:'Hello', href:'hello.html?from=workspace' }
  ];

  const pageContexts = Object.freeze({
    health: { page:'my-health', activity:'workspace_overview', visibleActivity:'My Health workspace', allowedActions:['explain','navigate','reflect','plan'] },
    landscape: { page:'landscape', activity:'landscape', visibleActivity:'Landscape exploration', allowedActions:['explain','clarify','reflect','pause'] },
    vision: { page:'vision', activity:'vision', visibleActivity:'Vision reflection', allowedActions:['explain','clarify','reflect','pause'] },
    project: { page:'project', activity:'project', visibleActivity:'Active Project path', allowedActions:['explain','clarify','make_smaller','reflect'] },
    practice: { page:'practice', activity:'practice', visibleActivity:'Practice experience', allowedActions:['explain','reflect','adapt','pause'] },
    learning: { page:'learning', activity:'learning', visibleActivity:'Learning and discovery', allowedActions:['explain','reflect','clarify','confirm_learning'] },
    progress: { page:'progress', activity:'progress', visibleActivity:'Progress over time', allowedActions:['explain','reflect','compare','navigate'] },
    calendar: { page:'calendar', activity:'cycle_calendar', visibleActivity:'Calendar with Cycle layer', allowedActions:['explain','navigate','review_cycle','record_cycle'] },
    assessments: { page:'assessments', activity:'assessment_selection', visibleActivity:'Assessment selection', allowedActions:['explain','navigate','pause'] }
  });

  function renderNav(active, mobile, items) {
    return (items || navItems).map(item => {
      const label = mobile && item.key === 'health' ? 'Health' : item.label;
      if (item.key === 'hello' && active !== 'hello') {
        return `<button type="button" data-msh-hello-open aria-expanded="false">${label}</button>`;
      }
      return `<a href="${item.href}"${item.key === active ? ' aria-current="page"' : ''}>${label}</a>`;
    }).join('');
  }

  function loadStyle(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true' || src === 'js/msh-storage.js' && window.MSHStorage) resolve();
        else {
          existing.addEventListener('load', resolve, { once:true });
          existing.addEventListener('error', reject, { once:true });
        }
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.addEventListener('load', () => { script.dataset.loaded = 'true'; resolve(); }, { once:true });
      script.addEventListener('error', reject, { once:true });
      document.head.appendChild(script);
    });
  }

  function themeControl() {
    return `<details class="msh-theme-control">
      <summary aria-label="Theme settings" title="Theme settings"><span aria-hidden="true">◐</span><span class="msh-theme-label">Theme</span></summary>
      <div class="msh-theme-menu" role="group" aria-label="Choose theme">
        <button type="button" data-theme-choice="light">Light</button>
        <button type="button" data-theme-choice="dark">Dark</button>
        <button type="button" data-theme-choice="system">System</button>
      </div>
    </details>`;
  }

  function syncThemeControl() {
    if (!window.MSHTheme) return;
    const preference = MSHTheme.getPreference();
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      const selected = button.dataset.themeChoice === preference;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('selected', selected);
    });
  }

  function buildHelloActivity(page, patch) {
    const base = pageContexts[page];
    if (!base) return null;
    const extra = patch && typeof patch === 'object' ? patch : {};
    const state = window.MSHStorage ? MSHStorage.getState() : null;
    const project = state ? MSHStorage.getActiveProject(state) : null;
    const practice = state ? MSHStorage.getActivePractice(state) : null;
    const vision = state ? MSHStorage.getCurrentVision(state) : null;
    const learning = state ? MSHStorage.getCurrentLearning(state)[0] || null : null;
    const latestProgress = state ? [...state.progressEvents].sort((a,b) => new Date(b.createdAt||0)-new Date(a.createdAt||0))[0] || null : null;
    const landscape = state ? MSHStorage.getCurrentLandscape(state) : null;
    const objectByPage = {
      landscape: landscape && { selectedObjectType:'landscape', selectedObjectId:landscape.id, selectedObjectLabel:'Current Landscape' },
      vision: vision && { selectedObjectType:'vision', selectedObjectId:vision.id, selectedObjectLabel:'Current Vision' },
      project: project && { selectedObjectType:'project', selectedObjectId:project.id, selectedObjectLabel:project.title },
      practice: practice && { selectedObjectType:'practice', selectedObjectId:practice.id, selectedObjectLabel:practice.title },
      learning: learning && { selectedObjectType:'learning', selectedObjectId:learning.id, selectedObjectLabel:learning.statement },
      progress: latestProgress && { selectedObjectType:'progress_event', selectedObjectId:latestProgress.id, selectedObjectLabel:latestProgress.title || 'Recent progress' }
    };
    return {
      ...base,
      route: `${location.pathname}${location.search}`,
      contextId: base.page,
      contextLabel: base.visibleActivity,
      projectId: project && project.id || '',
      projectLabel: project && project.title || '',
      practiceId: practice && practice.id || '',
      practiceLabel: practice && practice.title || '',
      ...(objectByPage[page] || {}),
      provenance: 'SYSTEM_OBSERVED',
      recordable: false,
      ...extra
    };
  }

  function rememberHelloActivity(page, patch) {
    if (!window.MSHStorage || page === 'hello') return;
    const context = buildHelloActivity(page, patch);
    if (context) MSHStorage.setHelloActivity(context);
  }

  function visiblePagePatch() {
    const promptSelectors = [
      '[data-msh-reflection-prompt]', '.msh-v2-question-stage h1',
      '.msh-landscape-question-shell .msh-question-domain h1',
      '.msh-reflection-form legend strong', '.msh-vision-prompt:focus-within strong'
    ];
    const prompt = promptSelectors.map(selector => [...document.querySelectorAll(selector)])
      .flat().find(element => element.offsetParent !== null && element.textContent.trim());
    const selected = document.querySelector('input:checked');
    const selectedLabel = selected && selected.closest('label');
    return {
      questionText: prompt ? prompt.textContent.trim() : '',
      userSelectedState: selectedLabel ? selectedLabel.textContent.trim() : ''
    };
  }

  function watchPageContext(active) {
    if (!window.MSHStorage || active === 'hello') return;
    let pending = 0;
    const refresh = () => {
      window.clearTimeout(pending);
      pending = window.setTimeout(() => rememberHelloActivity(active, visiblePagePatch()), 60);
    };
    document.addEventListener('focusin', refresh);
    document.addEventListener('change', refresh);
    const main = document.querySelector('main');
    if (main && window.MutationObserver) {
      const observer = new MutationObserver(refresh);
      observer.observe(main, { childList:true, subtree:true, characterData:true });
    }
    refresh();
  }

  async function mountUniversalHello(active) {
    if (active === 'hello' || new URLSearchParams(location.search).get('embedded') === '1') return;
    loadStyle('css/msh-hello-pane.css');
    if (!window.MSHStorage) await loadScript('js/msh-storage.js');
    rememberHelloActivity(active);
    if (!window.MSHHelloPane) await loadScript('js/msh-hello-workspace.js');
    if (window.MSHHelloPane) window.MSHHelloPane.mount();
  }

  function mountShell() {
    const active = document.body.dataset.mshPage || 'health';
    const navActive = active === 'health' && new URLSearchParams(location.search).get('view') === 'tools' ? 'tools' : active;
    const shellNav = active === 'health' ? simplifiedHealthNav : navItems;
    rememberHelloActivity(active);
    const header = document.querySelector('[data-msh-header]');
    const mobile = document.querySelector('[data-msh-mobile-nav]');
    if (header) header.innerHTML = `<header class="msh-app-header"><div class="msh-app-header-inner"><a class="msh-app-logo" href="index.html">My Simple Health</a><nav class="msh-app-nav" aria-label="My Health workspace">${renderNav(navActive, false, shellNav)}</nav>${active === 'health' ? '' : '<a class="msh-assessment-link" href="assessments.html">Assessments</a>'}${themeControl()}</div></header>`;
    if (mobile) {
      mobile.innerHTML = `<nav class="msh-mobile-nav" aria-label="My Health mobile navigation">${renderNav(navActive, true, shellNav)}</nav>`;
      const mobileNav = mobile.querySelector('.msh-mobile-nav');
      const currentLink = mobile.querySelector('[aria-current="page"]');
      if (mobileNav && currentLink) requestAnimationFrame(() => {
        mobileNav.scrollLeft = currentLink.offsetLeft - (mobileNav.clientWidth - currentLink.clientWidth) / 2;
      });
    }
    syncThemeControl();
    watchPageContext(active);
    mountUniversalHello(active).catch(error => console.warn('Hello surface could not load.', error));
  }

  window.MSHHelloContext = Object.freeze({
    get: () => window.MSHStorage && MSHStorage.getHelloActivity ? MSHStorage.getHelloActivity() : null,
    update: patch => rememberHelloActivity(document.body.dataset.mshPage || 'health', patch),
    refresh: () => rememberHelloActivity(document.body.dataset.mshPage || 'health')
  });

  document.addEventListener('msh:hello-context', event => {
    rememberHelloActivity(document.body.dataset.mshPage || 'health', event.detail || {});
  });

  document.addEventListener('click', event => {
    const choice = event.target.closest('[data-theme-choice]');
    if (!choice || !window.MSHTheme) return;
    MSHTheme.setPreference(choice.dataset.themeChoice);
    syncThemeControl();
    const control = choice.closest('details');
    if (control) control.open = false;
  });

  document.addEventListener('DOMContentLoaded', mountShell);
  if (window.MSHTheme) MSHTheme.onChange(syncThemeControl);
})();
