/* My Simple Health — refined semantic area icons */
(function(global){
  'use strict';

  const paths={
    household:'<path d="M4 11.5 12 5l8 6.5V20H7v-8"/><path d="M9.5 20v-5h5v5"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/>',
    goals:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3.5"/><path d="m14.5 9.5 5-5M16.5 4.5h3v3"/>',
    categories:'<path d="M12 3a9 9 0 1 1-9 9h9Z"/><path d="M12 3v9h9M12 12 5.7 5.7"/>',
    items:'<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 11h6M9 15h4"/><path d="M16.8 14.8c-1.4-.7-3.3-.1-3.3 1.1 0 1.7 3.8.9 3.8 2.5 0 1.2-1.8 1.8-3.5 1M15.4 13.8v7.2"/>',
    lock:'<rect x="6" y="10" width="12" height="10" rx="2"/><path d="M9 10V7a3 3 0 0 1 6 0v3M12 14v2"/>',
    shield:'<path d="M12 3 5 6v5c0 4.7 2.8 8 7 10 4.2-2 7-5.3 7-10V6z"/><path d="m9 12 2 2 4-4"/>',
    movement:'<circle cx="13" cy="5" r="1.5"/><path d="m10 9 3-2 2 3 3 1M13 8l-2 5-4 2M11 13l3 3 1 4"/>',
    cycle:'<path d="M6.5 8.5A6.5 6.5 0 0 1 18 7l1-3M18 7h-4"/><path d="M17.5 15.5A6.5 6.5 0 0 1 6 17l-1 3M6 17h4"/>',
    symptoms:'<path d="M12 3c.9 3 2.4 4.6 5 5-2.6.5-4.1 2.1-5 5-.9-2.9-2.4-4.5-5-5 2.6-.4 4.1-2 5-5Z"/><path d="M18 14c.5 1.7 1.4 2.6 3 3-1.6.4-2.5 1.3-3 3-.5-1.7-1.4-2.6-3-3 1.6-.4 2.5-1.3 3-3Z"/>',
    sexualHealth:'<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/><path d="M9.5 12h5"/>',
    measurements:'<path d="M5 18a7 7 0 1 1 14 0"/><path d="m12 11 3-3M8 18h8"/>',
    camera:'<path d="M4 8h4l1.5-2h5L16 8h4v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    grocery:'<path d="M4 5h2l2 10h9l2-7H7"/><circle cx="10" cy="19" r="1"/><circle cx="17" cy="19" r="1"/>',
    receipt:'<path d="M7 3h10v18l-2-1.4-2 1.4-2-1.4L9 21l-2-1.4z"/><path d="M9 7h6M9 11h6M9 15h3"/>',
    meal:'<circle cx="12" cy="12" r="5.5"/><path d="M4.5 4v7M2.5 4v4c0 1.4.9 2.5 2 2.5S6.5 9.4 6.5 8V4M4.5 10.5V20M19 4v16M19 4c-1.6 1.3-2.5 3.1-2.5 5.5H19"/>',
    dateLabel:'<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 3v6M16 3v6M4 10h16M8 14h3M13 14h3"/>',
    plus:'<path d="M12 5v14M5 12h14"/>'
  };

  function svg(name,extraClass=''){
    const body=paths[name]||paths.items;
    return `<span class="msh-area-icon ${extraClass}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg></span>`;
  }

  global.MSHAreaIcons=Object.freeze({svg,names:Object.freeze(Object.keys(paths))});
})(window);