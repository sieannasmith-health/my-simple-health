/* My Simple Health — shared My Health workspace shell */
(function () {
  'use strict';

  const route = key => window.MSHRoutes && MSHRoutes.get(key) || ({
    health:{ key:'health', label:'My Health', href:'my-health.html' },
    explore:{ key:'explore', label:'Explore', href:'my-health.html?view=explore' },
    tools:{ key:'tools', label:'Tools', href:'my-health.html?view=tools' },
    calendar:{ key:'calendar', label:'Calendar', href:'calendar.html' }
  })[key];
  const navItems = ['health','explore','tools','calendar'].map(route);
  const journeyItems = [
    { page:'landscape', key:'landscape', label:'Landscape' },
    { page:'vision', key:'horizon', label:'Horizon' },
    { page:'project', key:'path', label:'Path' },
    { page:'practice', key:'practice', label:'Practice' },
    { page:'learning', key:'discovery', label:'Discovery' },
    { page:'progress', key:'journey', label:'Journey' }
  ];

  const pageContexts = Object.freeze({
    health: { page:'my-health', activity:'workspace_overview', visibleActivity:'My Health workspace', allowedActions:['explain','navigate','reflect','plan'] },
    landscape: { page:'landscape', activity:'landscape', visibleActivity:'Landscape exploration', allowedActions:['explain','clarify','reflect','pause'] },
    vision: { page:'vision', activity:'vision', visibleActivity:'Horizon reflection', allowedActions:['explain','clarify','reflect','pause'] },
    project: { page:'project', activity:'project', visibleActivity:'Active Path', allowedActions:['explain','clarify','make_smaller','reflect'] },
    practice: { page:'practice', activity:'practice', visibleActivity:'Practice experience', allowedActions:['explain','reflect','adapt','pause'] },
    learning: { page:'learning', activity:'learning', visibleActivity:'Discovery and learning', allowedActions:['explain','reflect','clarify','confirm_learning'] },
    progress: { page:'progress', activity:'progress', visibleActivity:'Journey over time', allowedActions:['explain','reflect','compare','navigate'] },
    calendar: { page:'calendar', activity:'health_calendar', visibleActivity:'Calendar · Health in time', allowedActions:['explain','navigate','review_cycle','record_cycle'] },
    assessments: { page:'assessments', activity:'self_insight_selection', visibleActivity:'Self-Insight', allowedActions:['explain','navigate','pause'] }
  });

  function renderNav(active, mobile, items) {
    return (items || navItems).map(item => {
      const label = mobile && item.key === 'health' ? 'Health' : item.label;
      return `<a href="${item.href}" data-msh-route="${item.key}"${item.key === active ? ' aria-current="page"' : ''}>${label}</a>`;
    }).join('');
  }

  function ensureContinuityStyles() {
    if (document.querySelector('link[data-msh-continuity-styles]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/msh-continuity.css';
    link.dataset.mshContinuityStyles = '';
    document.head.appendChild(link);
  }

  function renderJourneyContinuity(active) {
    if (!journeyItems.some(item => item.page === active)) return '';
    return `<div class="msh-continuity-wrap"><nav class="msh-continuity" aria-label="Your My Health journey"><span class="msh-continuity-label">Your journey</span>${journeyItems.map(item => {
      const destination = route(item.key);
      return `<a href="${destination.href}" data-msh-route="${item.key}"${item.page === active ? ' aria-current="step"' : ''}>${item.label}</a>`;
    }).join('')}</nav></div>`;
  }

  function renderUtilityFooter() {
    return `<footer class="msh-app-utility-footer"><div class="msh-app-utility-footer-inner"><span>Educational support, not diagnosis or medical care.</span><nav class="msh-app-utility-links" aria-label="My Simple Health information"><a href="privacy.html" data-msh-route="privacy">Privacy</a><a href="support.html" data-msh-route="support">Support</a></nav></div></footer>`;
  }

  function themeControl() {
    return `<details class="msh-theme-control"><summary class="msh-theme-trigger" aria-label="Appearance" title="Appearance"><span class="msh-theme-icon" aria-hidden="true">◐</span><span class="msh-visually-hidden">Appearance</span></summary><div class="msh-theme-menu" role="group" aria-label="Appearance"><span class="msh-theme-menu-label">Appearance</span><button type="button" data-theme-choice="light">Light</button><button type="button" data-theme-choice="dark">Dark</button><button type="button" data-theme-choice="system">System</button></div></details>`;
  }

  function soundControl() {
    if (!window.MSHSound) return '';
    return `<button class="msh-sound-control" type="button" data-msh-sound-toggle aria-pressed="false" aria-label="Sound off. Turn environmental sound on"><span data-msh-sound-label>Sound off</span></button>`;
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
      vision: vision && { selectedObjectType:'vision', selectedObjectId:vision.id, selectedObjectLabel:'Current Horizon' },
      project: project && { selectedObjectType:'project', selectedObjectId:project.id, selectedObjectLabel:project.title },
      practice: practice && { selectedObjectType:'practice', selectedObjectId:practice.id, selectedObjectLabel:practice.title },
      learning: learning && { selectedObjectType:'learning', selectedObjectId:learning.id, selectedObjectLabel:learning.statement },
      progress: latestProgress && { selectedObjectType:'progress_event', selectedObjectId:latestProgress.id, selectedObjectLabel:latestProgress.title || 'Recent journey activity' }
    };
    return { ...base, route:`${location.pathname}${location.search}`, contextId:base.page, contextLabel:base.visibleActivity, projectId:project && project.id || '', projectLabel:project && project.title || '', practiceId:practice && practice.id || '', practiceLabel:practice && practice.title || '', ...(objectByPage[page] || {}), provenance: 'SYSTEM_OBSERVED', recordable: false, ...extra };
  }

  function rememberHelloActivity(page, patch) {
    if (!window.MSHStorage) return;
    const context = buildHelloActivity(page, patch);
    if (context) MSHStorage.setHelloActivity(context);
  }

  function visiblePagePatch() {
    const promptSelectors = ['[data-msh-reflection-prompt]','.msh-v2-question-stage h1','.msh-landscape-question-shell .msh-question-domain h1','.msh-reflection-form legend strong','.msh-vision-prompt:focus-within strong'];
    const prompt = promptSelectors.map(selector => [...document.querySelectorAll(selector)]).flat().find(element => element.offsetParent !== null && element.textContent.trim());
    const selected = document.querySelector('input:checked');
    const selectedLabel = selected && selected.closest('label');
    return { questionText:prompt ? prompt.textContent.trim() : '', userSelectedState:selectedLabel ? selectedLabel.textContent.trim() : '' };
  }

  function watchPageContext(active) {
    if (!window.MSHStorage) return;
    let pending = 0;
    const refresh = () => { window.clearTimeout(pending); pending = window.setTimeout(() => rememberHelloActivity(active, visiblePagePatch()), 60); };
    document.addEventListener('focusin', refresh);
    document.addEventListener('change', refresh);
    const main = document.querySelector('main');
    if (main && window.MutationObserver) { const observer = new MutationObserver(refresh); observer.observe(main,{childList:true,subtree:true,characterData:true}); }
    refresh();
  }

  function mountShell() {
    const active = document.body.dataset.mshPage || 'health';
    const navActive = window.MSHRoutes ? MSHRoutes.currentKey() : active;
    ensureContinuityStyles();
    rememberHelloActivity(active);
    const header = document.querySelector('[data-msh-header]');
    const mobile = document.querySelector('[data-msh-mobile-nav]');
    if (header) {
      header.innerHTML = `<header class="msh-app-header"><div class="msh-app-header-inner"><a class="msh-app-logo" href="${route('health').href}" data-msh-route="health">My Simple Health</a><nav class="msh-app-nav" aria-label="My Health workspace">${renderNav(navActive,false,navItems)}</nav><div class="msh-app-header-actions" aria-label="Workspace controls">${soundControl()}${themeControl()}</div></div></header>${renderJourneyContinuity(active)}`;
    }
    if (mobile) {
      mobile.innerHTML = `<nav class="msh-mobile-nav" aria-label="My Health mobile navigation">${renderNav(navActive, true, navItems)}</nav>`;
      mobile.hidden = false;
      mobile.removeAttribute('aria-hidden');
      const mobileNav = mobile.querySelector('.msh-mobile-nav');
      const currentLink = mobile.querySelector('[aria-current="page"]');
      if (mobileNav && currentLink) requestAnimationFrame(() => {
        mobileNav.scrollLeft = currentLink.offsetLeft - (mobileNav.clientWidth - currentLink.clientWidth) / 2;
      });
    }
    const shell = document.querySelector('.msh-app-shell') || document.body;
    if (!document.querySelector('.msh-app-utility-footer')) shell.insertAdjacentHTML('beforeend',renderUtilityFooter());
    syncThemeControl();
    if (window.MSHSound) MSHSound.mountControl();
    if (window.MSHRoutes) MSHRoutes.decorate(document);
    watchPageContext(active);
  }

  window.MSHHelloContext = Object.freeze({ get:() => window.MSHStorage && MSHStorage.getHelloActivity ? MSHStorage.getHelloActivity() : null, update:patch => rememberHelloActivity(document.body.dataset.mshPage || 'health',patch), refresh:() => rememberHelloActivity(document.body.dataset.mshPage || 'health') });
  document.addEventListener('msh:hello-context',event => rememberHelloActivity(document.body.dataset.mshPage || 'health',event.detail || {}));
  document.addEventListener('click',event => { const choice = event.target.closest('[data-theme-choice]'); if (!choice || !window.MSHTheme) return; MSHTheme.setPreference(choice.dataset.themeChoice); syncThemeControl(); const control = choice.closest('details'); if (control) control.open = false; });
  document.addEventListener('DOMContentLoaded',mountShell);
  if (window.MSHTheme) MSHTheme.onChange(syncThemeControl);
})();
