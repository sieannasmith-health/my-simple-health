/* My Simple Health — original cycle observation icon system */
(function (root) {
  'use strict';

  const normalize = value => String(value || '').trim().toLowerCase();
  const esc = value => String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  const ICONS = Object.freeze({
    none:'<circle cx="24" cy="24" r="8"/><path d="M18 24h12"/>',
    spotting:'<path d="M24 12c-4 6-8 10-8 16a8 8 0 0 0 16 0c0-6-4-10-8-16Z"/><circle cx="24" cy="29" r="2" class="fill"/>',
    light:'<path d="M24 11c-5 7-9 12-9 18a9 9 0 0 0 18 0c0-6-4-11-9-18Z"/>',
    medium:'<path d="M24 9c-6 8-11 14-11 21a11 11 0 0 0 22 0c0-7-5-13-11-21Z"/><path d="M19 31c1.4 2 3 3 5 3"/>',
    heavy:'<path d="M24 7c-7 9-12 16-12 23a12 12 0 0 0 24 0c0-7-5-14-12-23Z"/><path d="M18 30c1.5 3 3.5 4.5 6 4.5"/>',
    'abdominal cramps':'<path d="M17 12c-2 5-3 9-3 13 0 8 4 12 10 12s10-4 10-12c0-4-1-8-3-13"/><path d="M18 28c2-3 4-4 6-4s4 1 6 4"/><circle cx="24" cy="29" r="3" class="fill"/>',
    backache:'<path d="M19 10c-2 5-3 10-3 15 0 7 3 12 8 12s8-5 8-12c0-5-1-10-3-15"/><path d="M24 14v20M20 22h8"/>',
    'body aches':'<path d="M24 10v9m0 0-7 6m7-6 7 6m-7-6v16"/><circle cx="24" cy="8" r="3"/><path d="M14 31l4-2m16 2-4-2"/>',
    'breast tenderness':'<path d="M15 18c2-5 6-8 9-8s7 3 9 8v14c-2 4-5 6-9 6s-7-2-9-6Z"/><circle cx="19" cy="25" r="2" class="fill"/><circle cx="29" cy="25" r="2" class="fill"/>',
    'muscle pain':'<path d="M14 30c4-10 7-15 12-16 4-1 8 2 8 6 0 7-7 14-15 14"/><path d="M22 22c3 0 5 2 5 5"/>',
    'pelvic pain':'<path d="M15 15c3 2 6 3 9 3s6-1 9-3l-3 16c-2 4-4 6-6 6s-4-2-6-6Z"/><circle cx="24" cy="28" r="3" class="fill"/>',
    'ovulation pain':'<circle cx="24" cy="24" r="8"/><path d="M13 14c4 1 7 4 8 8m14-8c-4 1-7 4-8 8"/><circle cx="24" cy="24" r="2.5" class="fill"/>',
    'joint pain':'<path d="M16 13l8 9 8-9M24 22v13"/><circle cx="24" cy="22" r="3" class="fill"/>',
    swelling:'<path d="M15 28c3-8 6-12 9-12s6 4 9 12"/><path d="M13 32h22"/>',
    bloating:'<ellipse cx="24" cy="26" rx="10" ry="12"/><path d="M18 12c1 3 3 5 6 5s5-2 6-5"/><circle cx="20" cy="25" r="1.5" class="fill"/><circle cx="28" cy="29" r="1.5" class="fill"/>',
    gas:'<path d="M12 22c4-6 9-7 13-3 4 4 8 3 11-2M14 29c5-4 10-3 13 1 3 3 6 2 9-1"/>',
    constipation:'<path d="M15 17c4-4 14-4 18 0 3 3 2 8-1 10 2 5-1 10-8 10s-10-5-8-10c-3-2-4-7-1-10Z"/><path d="M20 24h8"/>',
    diarrhea:'<path d="M15 16h18l-2 20H17Z"/><path d="M13 13h22M20 10h8"/><path d="M21 22v8m6-8v8"/>',
    nausea:'<circle cx="24" cy="23" r="11"/><path d="M19 21h.1M29 21h.1M19 29c3-2 7-2 10 0"/><path d="M33 12l3-3"/>',
    reflux:'<path d="M18 35c0-8 2-12 6-16 4-4 5-7 4-11"/><path d="M23 13l5-5 5 5"/>',
    'stomach pain':'<path d="M22 10c0 7-7 7-7 15 0 7 5 12 11 12 7 0 11-5 10-11-1-5-5-8-10-8"/><circle cx="26" cy="28" r="3" class="fill"/>',
    hunger:'<path d="M17 10v12m4-12v12m-4-5h4M31 10v27"/><path d="M28 10c0 7 1 10 3 12"/>',
    'low appetite':'<path d="M15 12v25m8-25v25m8-25v25"/><path d="M11 11l26 27"/>',
    cravings:'<path d="M14 28c0-7 5-12 10-12s10 5 10 12"/><path d="M15 28h18M20 16v-4h8v4"/>',
    indigestion:'<path d="M20 11c-4 6-6 10-5 16 1 6 5 10 11 10 6 0 10-5 9-11-1-5-4-8-9-9"/><path d="M18 25h12"/>',
    headache:'<path d="M15 30c0-10 4-18 10-18 7 0 11 7 11 15l-5 3v7H20v-7Z"/><circle cx="25" cy="20" r="3" class="fill"/>',
    migraine:'<path d="M15 30c0-10 4-18 10-18 7 0 11 7 11 15l-5 3v7H20v-7Z"/><path d="M25 14l-3 7h5l-4 8"/>',
    dizziness:'<path d="M12 18c5-6 19-6 24 0-5 5-19 5-24 0Z"/><path d="M17 27c4-4 10-4 14 0-3 4-11 4-14 0Z"/>',
    'smell sensitivity':'<path d="M23 10v13c0 5 3 8 7 8 3 0 5-2 5-5"/><path d="M13 18c3-3 6-4 10-4"/>',
    fatigue:'<path d="M13 16h22v17H13Z"/><path d="M35 21h3v7h-3"/><path d="M18 24h7"/>',
    'night sweats':'<path d="M26 11a10 10 0 1 0 9 14 9 9 0 0 1-9-14Z"/><path d="M14 35c1-3 3-5 5-7m10 7c-1-3-3-5-5-7"/>',
    'hot flashes':'<path d="M18 36c-5-5 0-9 1-13 1-4-2-6 0-11 6 4 7 8 5 12 5-4 7-8 6-12 5 5 4 10 1 14 5-1 7-5 7-8 3 9-3 18-12 19-3 0-6 0-8-1Z"/>',
    acne:'<circle cx="24" cy="24" r="10"/><circle cx="24" cy="24" r="3" class="fill"/>',
    itching:'<path d="M15 31c4-2 4-7 7-10 2-3 6-2 7 1 1 3-1 5-3 7"/><path d="M29 18l3-4m1 7 4-1m-6 5 4 3"/>',
    'skin changes':'<path d="M13 28c4-8 8-12 13-12 5 0 8 4 9 10"/><circle cx="20" cy="25" r="2" class="fill"/><circle cx="27" cy="21" r="1.5" class="fill"/><circle cx="30" cy="29" r="1.5" class="fill"/>',
    'painful urination':'<path d="M24 10c-5 7-9 12-9 18a9 9 0 0 0 18 0c0-6-4-11-9-18Z"/><path d="M22 22l5 5m0-5-5 5"/>',
    anxiety:'<circle cx="24" cy="24" r="9"/><path d="M12 15c2-4 5-7 9-8m15 8c-2-4-5-7-9-8M11 31c3 4 7 6 13 6s10-2 13-6"/><path d="M19 27c3-2 7-2 10 0"/>',
    irritability:'<circle cx="24" cy="25" r="10"/><path d="M17 21l5 1m9-1-5 1M19 30h10"/><path d="M13 13l-4-4m26 4 4-4"/>',
    'mood changes':'<circle cx="24" cy="24" r="11"/><path d="M24 13v22M18 21h.1M30 21h.1M17 29c2 2 4 3 7 3m7-3c-2-2-4-3-7-3"/>',
    'lower mood':'<circle cx="24" cy="24" r="11"/><path d="M19 21h.1M29 21h.1M19 31c3-3 7-3 10 0"/>',
    stress:'<path d="M14 29c2-10 6-16 10-16s8 6 10 16"/><path d="M12 12l5 5m19-5-5 5M24 7v7"/><path d="M19 28h10"/>',
    tension:'<path d="M12 24h24M18 18l-6 6 6 6m12-12 6 6-6 6"/>',
    'difficulty focusing':'<circle cx="24" cy="24" r="11"/><circle cx="24" cy="24" r="4"/><path d="M24 7v6m0 22v6M7 24h6m22 0h6"/>',
    insomnia:'<path d="M29 11a11 11 0 1 0 7 19 10 10 0 0 1-7-19Z"/><path d="M14 13h5l-5 6h5"/>',
    'poor sleep':'<path d="M13 29h22v7H13Z"/><path d="M16 29V19h8c5 0 8 4 8 10"/><path d="M28 13h5l-5 6h5"/>',
    'no symptoms':'<circle cx="24" cy="24" r="11"/><path d="M18 24l4 4 8-9"/>'
  });

  function genericIcon(label) {
    const key = normalize(label);
    if (/sex|libido|love|intimacy/.test(key)) return '<path d="M24 36 12 24c-5-5-2-13 5-13 4 0 6 2 7 5 1-3 3-5 7-5 7 0 10 8 5 13Z"/>';
    if (/medicine|medication|pill|contraception/.test(key)) return '<rect x="12" y="18" width="24" height="12" rx="6" transform="rotate(-35 24 24)"/><path d="M19 30l10-14"/>';
    if (/sleep|tired|energy/.test(key)) return ICONS['poor sleep'];
    if (/mood|emotion|happy|sad|confident|stressed|relaxed/.test(key)) return '<circle cx="24" cy="24" r="11"/><path d="M19 21h.1M29 21h.1M19 29c3 2 7 2 10 0"/>';
    if (/bleed|flow|period/.test(key)) return ICONS.medium;
    return '<circle cx="24" cy="24" r="10"/><path d="M18 24h12M24 18v12"/>';
  }

  function svg(label) {
    const key = normalize(label);
    const body = ICONS[key] || genericIcon(key);
    return `<svg class="msh-cycle-original-icon" viewBox="0 0 48 48" role="img" aria-label="${esc(label)} icon"><g>${body}</g></svg>`;
  }

  function choiceLabel(choice) {
    const input = choice.querySelector('input');
    if (input && input.value) return input.value;
    const clone = choice.cloneNode(true);
    clone.querySelectorAll('svg,i,input').forEach(node => node.remove());
    return clone.textContent.trim();
  }

  function enhance(rootNode) {
    const scope = rootNode && rootNode.querySelectorAll ? rootNode : document;
    scope.querySelectorAll('.msh-cycle-picture-choice').forEach(choice => {
      const iconHost = choice.querySelector('span > i');
      if (!iconHost || iconHost.dataset.mshOriginalIcon === 'true') return;
      const label = choiceLabel(choice);
      if (!label) return;
      iconHost.innerHTML = svg(label);
      iconHost.dataset.mshOriginalIcon = 'true';
      choice.dataset.mshIcon = normalize(label).replace(/[^a-z0-9]+/g,'-');
    });
  }

  root.MSHCycleIcons = Object.freeze({ svg, enhance, icons: ICONS });

  const host = document.querySelector('[data-msh-calendar]');
  if (!host) return;
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType === 1) enhance(node);
  }))).observe(host,{childList:true,subtree:true});
  enhance(host);
})(window);
