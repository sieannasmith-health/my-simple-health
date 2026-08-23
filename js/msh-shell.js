/* My Simple Health — shared My Health workspace shell */
(function () {
  'use strict';

  const navItems = [
    { key: 'health', label: 'My Health', href: 'my-health.html' },
    { key: 'landscape', label: 'Landscape', href: 'my-landscape.html', comingSoon: true },
    { key: 'project', label: 'Project', href: 'my-project.html', comingSoon: true },
    { key: 'learning', label: 'Learning', href: 'my-learning.html', comingSoon: true }
  ];

  function renderNav(activePage, mobile) {
    return navItems.map(item => {
      if (item.comingSoon) {
        return `<span class="is-coming-soon" aria-disabled="true" title="Coming next">${item.label}</span>`;
      }

      const current = item.key === activePage ? ' aria-current="page"' : '';
      return `<a href="${item.href}"${current}>${mobile && item.key === 'health' ? 'Health' : item.label}</a>`;
    }).join('');
  }

  function mountShell() {
    const body = document.body;
    const activePage = body.dataset.mshPage || 'health';
    const headerMount = document.querySelector('[data-msh-header]');
    const mobileMount = document.querySelector('[data-msh-mobile-nav]');

    if (headerMount) {
      headerMount.innerHTML = `
        <header class="msh-app-header">
          <div class="msh-app-header-inner">
            <a class="msh-app-logo" href="index.html">My Simple Health</a>
            <nav class="msh-app-nav" aria-label="My Health workspace">
              ${renderNav(activePage, false)}
            </nav>
            <a class="msh-hello-launcher" href="hello.html">Hello <span aria-hidden="true">→</span></a>
          </div>
        </header>`;
    }

    if (mobileMount) {
      mobileMount.innerHTML = `
        <nav class="msh-mobile-nav" aria-label="My Health mobile navigation">
          ${renderNav(activePage, true)}
          <a href="hello.html">Hello</a>
        </nav>`;
    }
  }

  document.addEventListener('DOMContentLoaded', mountShell);
})();
