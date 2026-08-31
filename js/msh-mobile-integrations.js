/* My Simple Health — integrated mobile feature hub */
(function (root) {
  'use strict';

  const host = document.querySelector('[data-msh-dashboard]');
  if (!host) return;

  const icons = {
    calendar:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 9h18"/></svg>',
    movement:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14M5 8h6M13 8h6M5 16h6M13 16h6"/></svg>',
    cycle:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.5 8a7 7 0 1 0 .5 7"/><path d="M18 4v4h-4"/></svg>',
    food:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4zM8 4v16M8 10h12M12 10v10"/></svg>',
    finance:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v11H4zM7 7V5h10v2M8 13h3M15 13h1"/></svg>',
    health:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.3-7-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 15.7 12 20 12 20z"/><path d="M9 12h6M12 9v6"/></svg>'
  };

  function daypart() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    if (hour < 21) return 'Evening';
    return 'Tonight';
  }

  function timeLabel() {
    return new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(new Date());
  }

  function feature(href, route, icon, title, copy) {
    return `<a class="msh-mobile-feature" href="${href}" data-msh-route="${route}"><span class="msh-mobile-feature__icon">${icons[icon]}</span><span><strong>${title}</strong><small>${copy}</small></span></a>`;
  }

  function nativeHealthHandler() {
    const handlers = root.webkit && root.webkit.messageHandlers;
    if (!handlers) return null;
    return handlers.mshAppleHealth || handlers.appleHealth || handlers.healthKit || handlers.AppleHealthBridge || null;
  }

  function requestAppleHealth() {
    const message = document.querySelector('[data-mobile-integration-message]');
    const handler = nativeHealthHandler();
    if (handler && typeof handler.postMessage === 'function') {
      handler.postMessage({ action:'connect', source:'my-health-mobile-hub' });
      if (message) message.textContent = 'Apple Health connection requested.';
      return;
    }
    document.dispatchEvent(new CustomEvent('msh:apple-health-connect-request',{detail:{source:'my-health-mobile-hub'}}));
    if (message) message.textContent = 'Apple Health is available when My Health is running inside the iOS app.';
  }

  function markup() {
    return `<section class="msh-mobile-integrations" data-mobile-integrations aria-labelledby="msh-mobile-integrations-title">
      <header class="msh-mobile-integrations__head"><div><p>${daypart()} / My Health</p><h2 id="msh-mobile-integrations-title">What do you want to work with?</h2></div><span class="msh-mobile-integrations__time">${timeLabel()}</span></header>
      <div class="msh-mobile-integrations__grid">
        ${feature('calendar.html?customize=layers','calendar','calendar','Calendar','Plan your health, choose visible layers, and customize the Calendar.')}
        ${feature('calendar.html?view=movement','movement','movement','Workouts','Plan workout videos from your Movement collection.')}
        ${feature('calendar.html?view=cycle','cycle','cycle','Cycle','Track periods, symptoms, and cycle context in Calendar.')}
        ${feature('my-food.html','food','food','Food','See inventory, what you have, and what to use next.')}
        ${feature('financial-health.html','financial','finance','Financial','Keep the money areas that matter to your health and life visible.')}
        <button class="msh-mobile-feature" type="button" data-healthkit><span class="msh-mobile-feature__icon">${icons.health}</span><span><strong>Apple Health</strong><small>Connect movement, sleep, heart activity, and other selected health data.</small><span class="msh-mobile-feature__status">iOS connection</span></span></button>
      </div>
      <div class="msh-mobile-integrations__footer"><span>Appearance follows your Light, Dark, or System setting. Time-aware greetings update with your day.</span><a href="calendar.html">Open full Calendar</a></div>
      <p class="msh-mobile-integrations__message" data-mobile-integration-message role="status" aria-live="polite"></p>
    </section>`;
  }

  function mount() {
    if (document.querySelector('[data-mobile-integrations]')) return;
    const dashboard = host.querySelector('.msh-my-health-dashboard');
    const intro = host.querySelector('.msh-my-health-dashboard__intro');
    if (!dashboard && !intro) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = markup();
    const section = wrapper.firstElementChild;
    if (intro && intro.parentElement) intro.insertAdjacentElement('afterend', section);
    else host.prepend(section);
    section.querySelector('[data-healthkit]')?.addEventListener('click', requestAppleHealth);
    if (root.MSHRoutes) root.MSHRoutes.decorate(section);
  }

  function start() {
    mount();
    if (root.MutationObserver) {
      const observer = new MutationObserver(() => mount());
      observer.observe(host,{childList:true,subtree:true});
    }
    root.setInterval(() => {
      const head = document.querySelector('.msh-mobile-integrations__head p');
      const date = document.querySelector('.msh-mobile-integrations__time');
      if (head) head.textContent = `${daypart()} / My Health`;
      if (date) date.textContent = timeLabel();
    },60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})(typeof window !== 'undefined' ? window : globalThis);
