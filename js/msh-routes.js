/* My Simple Health — canonical route classes and navigation continuity */
(function (root) {
  'use strict';

  const TYPES = Object.freeze({ PRIVATE:'PRIVATE', PUBLIC:'PUBLIC', EXTERNAL:'EXTERNAL' });
  const routes = Object.freeze({
    health: Object.freeze({ key:'health', label:'My Health', href:'my-health.html', type:TYPES.PRIVATE, role:'home' }),
    explore: Object.freeze({ key:'explore', label:'Explore', href:'my-health.html?view=explore', type:TYPES.PRIVATE, role:'directory' }),
    tools: Object.freeze({ key:'tools', label:'Tools', href:'my-health.html?view=tools', type:TYPES.PRIVATE, role:'directory' }),
    calendar: Object.freeze({ key:'calendar', label:'Calendar', href:'calendar.html', type:TYPES.PRIVATE, role:'activity' }),
    landscape: Object.freeze({ key:'landscape', label:'Landscape', href:'health-landscape.html', type:TYPES.PRIVATE, role:'activity' }),
    assessments: Object.freeze({ key:'assessments', label:'Self-Insight', href:'assessments.html', type:TYPES.PRIVATE, role:'activity' }),
    horizon: Object.freeze({ key:'horizon', label:'Horizon', href:'my-vision.html', type:TYPES.PRIVATE, role:'activity' }),
    path: Object.freeze({ key:'path', label:'Path', href:'my-project.html', type:TYPES.PRIVATE, role:'activity' }),
    practice: Object.freeze({ key:'practice', label:'Practice', href:'my-practice.html', type:TYPES.PRIVATE, role:'activity' }),
    discovery: Object.freeze({ key:'discovery', label:'Discovery', href:'my-learning.html', type:TYPES.PRIVATE, role:'activity' }),
    journey: Object.freeze({ key:'journey', label:'Journey', href:'my-progress.html', type:TYPES.PRIVATE, role:'activity' }),
    healthStory: Object.freeze({ key:'healthStory', label:'My Health Story', href:'my-health-story.html', type:TYPES.PRIVATE, role:'activity' }),
    cycle: Object.freeze({ key:'cycle', label:'Cycle', href:'calendar.html?view=cycle', type:TYPES.PRIVATE, role:'activity' }),
    movement: Object.freeze({ key:'movement', label:'Movement', href:'calendar.html?view=movement', type:TYPES.PRIVATE, role:'activity' }),
    medications: Object.freeze({ key:'medications', label:'Medications', href:'medications.html', type:TYPES.PRIVATE, role:'activity' }),
    food: Object.freeze({ key:'food', label:'Food', href:'my-food.html', type:TYPES.PRIVATE, role:'activity' }),
    financial: Object.freeze({ key:'financial', label:'Financial Health', href:'financial-health.html', type:TYPES.PRIVATE, role:'activity' }),
    hello: Object.freeze({ key:'hello', label:'Hello', href:'hello.html', type:TYPES.PRIVATE, role:'activity' }),
    publicHome: Object.freeze({ key:'publicHome', label:'My Simple Health', href:'index.html', type:TYPES.PUBLIC, role:'doorway' }),
    publicResources: Object.freeze({ key:'publicResources', label:'Resources', href:'resources.html', type:TYPES.PUBLIC, role:'doorway' }),
    science: Object.freeze({ key:'science', label:'Explore the science', href:'resources.html', type:TYPES.PUBLIC, role:'doorway' }),
    recipes: Object.freeze({ key:'recipes', label:'Recipes', href:'recipes.html', type:TYPES.PUBLIC, role:'doorway' }),
    about: Object.freeze({ key:'about', label:'About', href:'about.html', type:TYPES.PUBLIC, role:'doorway' }),
    support: Object.freeze({ key:'support', label:'Help & Support', href:'support.html', type:TYPES.PUBLIC, role:'doorway' }),
    privacy: Object.freeze({ key:'privacy', label:'Privacy', href:'privacy.html', type:TYPES.PUBLIC, role:'doorway' }),
    contact: Object.freeze({ key:'contact', label:'Contact', href:'contact.html', type:TYPES.PUBLIC, role:'doorway' })
  });

  const pathIndex = Object.freeze(Object.values(routes).reduce((index, route) => {
    const url = new URL(route.href, 'https://msh.local/');
    const path = url.pathname.split('/').pop();
    const current = index[path];
    const currentUrl = current && new URL(current.href, 'https://msh.local/');
    if (!current || current.type !== TYPES.PRIVATE && route.type === TYPES.PRIVATE || currentUrl && currentUrl.search && !url.search) index[path] = route;
    return index;
  }, {}));

  function get(key) { return routes[key] || null; }
  function href(key, parameters) {
    const route = get(key);
    if (!route) return '';
    const url = new URL(route.href, 'https://msh.local/');
    Object.entries(parameters || {}).forEach(([name, value]) => {
      if (value != null && value !== '') url.searchParams.set(name, String(value));
    });
    return `${url.pathname.split('/').pop()}${url.search}${url.hash}`;
  }
  function classify(value) {
    if (!value || value[0] === '#') return null;
    if (/^(?:mailto:|tel:|sms:)/i.test(value)) return TYPES.EXTERNAL;
    let url;
    try { url = new URL(value, root.location && root.location.href || 'https://msh.local/'); }
    catch (_) { return null; }
    const origin = root.location && root.location.origin;
    if (/^https?:$/i.test(url.protocol) && origin && origin !== 'null' && url.origin !== origin) return TYPES.EXTERNAL;
    const file = url.pathname.split('/').pop() || 'index.html';
    return pathIndex[file] ? pathIndex[file].type : TYPES.PUBLIC;
  }
  function currentKey() {
    const page = root.document && root.document.body && root.document.body.dataset.mshPage;
    const view = new URLSearchParams(root.location && root.location.search || '').get('view');
    if (page === 'health' && view === 'explore') return 'explore';
    if (page === 'health' && view === 'tools') return 'tools';
    if (page === 'calendar') return 'calendar';
    if (page === 'landscape' || page === 'assessments') return 'explore';
    return ({ health:'health', 'health-story':'healthStory', vision:'horizon', project:'path', practice:'practice', learning:'discovery', progress:'journey', medications:'medications', food:'food', financial:'financial' })[page] || 'health';
  }
  function transition(sourceKey, destination) {
    const source = get(sourceKey) || get('health');
    const target = typeof destination === 'string' ? get(destination) : destination;
    if (!target) return '';
    if (target.type === TYPES.EXTERNAL) return 'departure';
    if (target.type === TYPES.PUBLIC) return 'doorway';
    if (target.key === 'health') return 'return';
    if (target.role === 'activity') return 'open';
    return source.type === TYPES.PRIVATE ? 'glide' : 'enter';
  }
  function routeForAnchor(anchor) {
    const named = anchor.dataset.mshRoute;
    if (named && get(named)) return get(named);
    const value = anchor.getAttribute('href');
    const type = classify(value);
    if (!type) return null;
    let file = '';
    try { file = new URL(value, root.location && root.location.href || 'https://msh.local/').pathname.split('/').pop() || 'index.html'; }
    catch (_) {}
    return pathIndex[file] || { key:'unregistered', label:anchor.textContent.trim(), href:value, type, role:type === TYPES.PRIVATE ? 'activity' : 'doorway' };
  }
  function carryFirstDoorQuestion(anchor) {
    if (!anchor.matches || !anchor.matches('[data-first-door-route]') || !root.MSHStorage) return;
    let entry;
    try { entry = root.MSHStorage.getFirstDoor(root.MSHStorage.getState()); }
    catch (_) { return; }
    if (!entry || entry.intent !== 'health_question' || !entry.context) return;
    let url;
    try { url = new URL(anchor.getAttribute('href'), root.location && root.location.href || 'https://msh.local/'); }
    catch (_) { return; }
    if (url.pathname.split('/').pop() !== 'resources.html') return;
    url.searchParams.set('q', entry.context);
    anchor.href = `${url.pathname.split('/').pop()}${url.search}${url.hash}`;
  }
  function decorate(scope) {
    const container = scope || root.document;
    if (!container || !container.querySelectorAll) return;
    const source = currentKey();
    container.querySelectorAll('a[href]').forEach(anchor => {
      const route = routeForAnchor(anchor);
      if (!route) return;
      anchor.dataset.mshRouteKind = route.type;
      anchor.dataset.mshTransition = transition(source, route);
      if (route.type === TYPES.PUBLIC && !anchor.title) anchor.title = `Open ${route.label}`;
      if (route.type === TYPES.EXTERNAL) {
        anchor.rel = [anchor.rel, 'external'].filter(Boolean).join(' ');
        if (!anchor.title) anchor.title = 'Leave My Simple Health';
      }
    });
  }
  function loadReflectionClarity() {
    const page = root.document && root.document.body && root.document.body.dataset.mshPage;
    if (page !== 'landscape' && page !== 'vision') return;
    if (root.document.querySelector('script[data-msh-reflection-clarity]')) return;
    const script = root.document.createElement('script');
    script.src = 'js/msh-reflection-clarity.js?v=20260901-1';
    script.defer = true;
    script.dataset.mshReflectionClarity = 'true';
    (root.document.body || root.document.head || root.document.documentElement).appendChild(script);
  }

  function loadReflectionClarity() {
    const page = root.document && root.document.body && root.document.body.dataset.mshPage;
    if (page !== 'landscape' && page !== 'vision') return;
    if (root.document.querySelector('script[data-msh-reflection-clarity]')) return;
    const script = root.document.createElement('script');
    script.src = 'js/msh-reflection-clarity.js?v=20260901-1';
    script.defer = true;
    script.dataset.mshReflectionClarity = 'true';
    (root.document.body || root.document.head || root.document.documentElement).appendChild(script);
  }

  if (root.document) {
    root.document.addEventListener('DOMContentLoaded', () => {
      decorate();
      loadReflectionClarity();
    });
    root.document.addEventListener('click', event => {
      const anchor = event.target.closest && event.target.closest('a[href]');
      if (!anchor) return;
      carryFirstDoorQuestion(anchor);
      const route = routeForAnchor(anchor);
      if (!route) return;
      const source = currentKey();
      try { root.sessionStorage.setItem('msh_navigation_context_v1', JSON.stringify({ source, destination:route.key, transition:transition(source, route), at:new Date().toISOString() })); }
      catch (_) {}
    });
  }

  root.MSHRoutes = Object.freeze({ TYPES, routes, get, href, classify, currentKey, transition, decorate });
})(typeof window !== 'undefined' ? window : globalThis);
