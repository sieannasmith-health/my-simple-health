/* My Simple Health — kinetic product stories 02 + 03 */
(function () {
  'use strict';

  const demos = Array.from(document.querySelectorAll('.product-demo'));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 560px)');

  function ensureKineticStyles() {
    if (document.querySelector('link[data-msh-kinetic-styles]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/msh-product-story-kinetic.css';
    link.dataset.mshKineticStyles = 'true';
    document.head.appendChild(link);
  }
  let discoveryTimeline = null;
  let discoveryObserver = null;
  let discoveryMode = null;

  function loadGsap() {
    if (window.gsap) return Promise.resolve(window.gsap);
    return new Promise(function (resolve, reject) {
      const existing = document.querySelector('script[data-msh-gsap]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(window.gsap); }, { once:true });
        existing.addEventListener('error', reject, { once:true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js';
      script.async = true;
      script.dataset.mshGsap = 'true';
      script.onload = function () { resolve(window.gsap); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function renderTimeStory() {
    const demo = demos[1];
    if (!demo) return;
    const visual = demo.querySelector('.demo-visual');
    if (!visual) return;

    visual.classList.add('demo-visual--timeline-svg');
    visual.innerHTML = `
      <svg class="time-story-svg" viewBox="0 0 760 340" role="img" aria-labelledby="time-story-title time-story-desc">
        <title id="time-story-title">See what happens around what</title>
        <desc id="time-story-desc">A five-day health timeline showing poor sleep, stress, a strength workout, a headache, and a medication change in context.</desc>
        <defs>
          <filter id="timeCardShadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="10" stdDeviation="11" flood-color="#173d2b" flood-opacity=".13"/></filter>
          <filter id="timePointGlow" x="-100%" y="-100%" width="300%" height="300%"><feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#7d9460" flood-opacity=".35"/></filter>
        </defs>
        <rect class="time-context-window" x="205" y="38" width="380" height="225" rx="28"/>
        <path class="time-flow" d="M86 252 C185 247 244 255 330 250 S500 244 674 252"/>
        ${timeEvent('time-event-1',118,252,55,62,126,'Poor sleep',107,false)}
        ${timeEvent('time-event-2',258,250,193,108,130,'Stressful day',154,false)}
        ${timeEvent('time-event-3',392,249,315,55,154,'Strength workout',101,false,'time-card--strong')}
        ${timeEvent('time-event-4',525,248,469,99,112,'Headache',145,true,'time-card--focus')}
        ${timeEvent('time-event-5',648,251,570,138,156,'Medication change',184,false)}
        <g class="time-days" aria-hidden="true"><text x="118" y="302">Mon</text><text x="258" y="302">Tue</text><text x="392" y="302">Wed</text><text x="525" y="302">Thu</text><text x="648" y="302">Fri</text></g>
      </svg>`;
  }

  function timeEvent(cls,cx,cy,x,y,w,label,stemTop,focus,extra) {
    return `<g class="time-event ${cls}"><path class="time-stem" d="M${cx} ${stemTop} V${cy}"/><circle class="time-point${focus ? ' time-point--focus' : ''}" cx="${cx}" cy="${cy}" r="${focus ? 8 : 6}"${focus ? ' filter="url(#timePointGlow)"' : ''}/>${focus ? `<circle class="time-focus-ring" cx="${cx}" cy="${cy}" r="18"/><text class="time-focus-label" x="${cx}" y="216">around this moment</text>` : ''}<g filter="url(#timeCardShadow)"><rect class="time-card ${extra || ''}" x="${x}" y="${y}" width="${w}" height="48" rx="15"/><text class="time-card-label" x="${x + w/2}" y="${y + 30}">${label}</text></g></g>`;
  }

  function chip(id, x, y, w, label, tone) {
    return `<g class="history-chip history-chip-${id}" data-chip="${id}" transform="translate(${x} ${y})"><rect class="history-chip-card ${tone || ''}" width="${w}" height="38" rx="13"/><circle class="history-chip-dot ${tone || ''}" cx="17" cy="19" r="5"/><text class="history-chip-label" x="31" y="24">${label}</text></g>`;
  }

  function desktopDiscoverySvg() {
    return `<svg class="history-story-svg" viewBox="0 0 820 430" role="img" aria-labelledby="history-title history-desc">
      <title id="history-title">Notice what your history can reveal</title>
      <desc id="history-desc">Health entries organize in time, repeated observations become visible, and an observation becomes a question worth exploring.</desc>
      <defs>
        <filter id="historyShadow" x="-30%" y="-40%" width="170%" height="190%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#173d2b" flood-opacity=".12"/></filter>
        <filter id="historyGlow" x="-100%" y="-100%" width="300%" height="300%"><feDropShadow dx="0" dy="0" stdDeviation="7" flood-color="#7d9460" flood-opacity=".35"/></filter>
      </defs>
      <g class="history-stage-labels" aria-hidden="true"><text x="80" y="30">Information enters</text><text x="270" y="30">Time organizes it</text><text x="470" y="30">Repetition emerges</text><text x="655" y="30">Worth exploring?</text></g>
      <g class="history-stage-track" aria-hidden="true"><circle cx="62" cy="25" r="7"/><path d="M70 25 H740"/><circle class="history-stage-dot" cx="62" cy="25" r="4"/><circle class="history-stage-dot" cx="250" cy="25" r="4"/><circle class="history-stage-dot" cx="445" cy="25" r="4"/><circle class="history-stage-dot" cx="635" cy="25" r="4"/></g>
      <g class="history-scene">
        <rect class="history-glass-panel" x="28" y="55" width="505" height="330" rx="28"/>
        <g class="history-axis" aria-hidden="true"><path d="M78 315 H490"/><text x="90" y="340">MON</text><text x="188" y="340">TUE</text><text x="286" y="340">WED</text><text x="384" y="340">THU</text><text x="482" y="340">FRI</text></g>
        <g class="history-stems" aria-hidden="true"><path d="M90 194V315"/><path d="M188 232V315"/><path d="M286 178V315"/><path d="M384 247V315"/><path d="M482 211V315"/></g>
        <g class="history-chips" filter="url(#historyShadow)">
          ${chip('sleep',66,82,118,'Poor sleep','is-sleep')}
          ${chip('stress',190,123,130,'Stressful day','is-stress')}
          ${chip('workout',346,86,147,'Harder workout','is-workout')}
          ${chip('headache',98,202,116,'Headache','is-headache')}
          ${chip('medication',320,221,156,'Medication change','is-medication')}
        </g>
        <g class="history-repeat" aria-hidden="true">
          <path class="history-connection" d="M90 194 C150 155 228 152 286 178"/>
          <path class="history-connection" d="M188 232 C270 190 368 184 482 211"/>
          <circle class="history-repeat-point is-sleep" cx="90" cy="315" r="7"/><circle class="history-repeat-point is-workout" cx="286" cy="315" r="7"/><circle class="history-repeat-point is-sleep" cx="188" cy="315" r="7"/><circle class="history-repeat-point is-workout" cx="482" cy="315" r="7"/>
          <g class="history-repeat-badge"><rect x="325" y="276" width="154" height="30" rx="15"/><text x="402" y="296">Seen 3 times</text></g>
        </g>
      </g>
      <g class="history-insight" transform="translate(554 72)">
        <rect class="history-insight-card" width="238" height="205" rx="26"/>
        <text class="history-eyebrow" x="24" y="36">SOMETHING YOU NOTICED</text>
        <text class="history-insight-copy" x="24" y="72"><tspan x="24" dy="0">Harder workouts have</tspan><tspan x="24" dy="28">sometimes followed nights</tspan><tspan x="24" dy="28">of poorer sleep.</tspan></text>
        <text class="history-uncertainty" x="24" y="176">Observation, not conclusion.</text>
      </g>
      <g class="history-question" transform="translate(554 294)">
        <rect class="history-question-card" width="238" height="92" rx="24"/>
        <text class="history-eyebrow" x="24" y="30">WORTH EXPLORING?</text>
        <text class="history-question-copy" x="24" y="58">What changes when sleep is better?</text>
        <text class="history-question-arrow" x="205" y="61">→</text>
      </g>
    </svg>`;
  }

  function mobileDiscoverySvg() {
    return `<svg class="history-story-svg history-story-svg--mobile" viewBox="0 0 390 650" role="img" aria-labelledby="history-title history-desc">
      <title id="history-title">Notice what your history can reveal</title>
      <desc id="history-desc">Health entries organize in time, repeated observations become visible, and an observation becomes a question worth exploring.</desc>
      <defs><filter id="historyShadow" x="-30%" y="-40%" width="170%" height="190%"><feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="#173d2b" flood-opacity=".12"/></filter></defs>
      <g class="history-stage-track" aria-hidden="true"><path d="M38 31 H350"/><circle class="history-stage-dot" cx="38" cy="31" r="4"/><circle class="history-stage-dot" cx="142" cy="31" r="4"/><circle class="history-stage-dot" cx="246" cy="31" r="4"/><circle class="history-stage-dot" cx="350" cy="31" r="4"/></g>
      <g class="history-stage-labels history-stage-labels--mobile" aria-hidden="true"><text x="38" y="54">Enter</text><text x="142" y="54">Time</text><text x="246" y="54">Notice</text><text x="350" y="54">Explore</text></g>
      <rect class="history-glass-panel" x="18" y="75" width="354" height="330" rx="28"/>
      <g class="history-axis" aria-hidden="true"><path d="M52 333 H338"/><text x="58" y="357">M</text><text x="128" y="357">T</text><text x="198" y="357">W</text><text x="268" y="357">T</text><text x="338" y="357">F</text></g>
      <g class="history-stems" aria-hidden="true"><path d="M58 190V333"/><path d="M128 226V333"/><path d="M198 180V333"/><path d="M268 240V333"/><path d="M338 205V333"/></g>
      <g class="history-chips" filter="url(#historyShadow)">
        ${chip('sleep',40,98,112,'Poor sleep','is-sleep')}
        ${chip('stress',198,132,124,'Stressful day','is-stress')}
        ${chip('workout',204,80,142,'Harder workout','is-workout')}
        ${chip('headache',36,210,112,'Headache','is-headache')}
        ${chip('medication',190,244,150,'Medication change','is-medication')}
      </g>
      <g class="history-repeat" aria-hidden="true"><path class="history-connection" d="M58 190 C103 148 160 148 198 180"/><path class="history-connection" d="M128 226 C190 187 270 178 338 205"/><circle class="history-repeat-point is-sleep" cx="58" cy="333" r="7"/><circle class="history-repeat-point is-workout" cx="198" cy="333" r="7"/><circle class="history-repeat-point is-sleep" cx="128" cy="333" r="7"/><circle class="history-repeat-point is-workout" cx="338" cy="333" r="7"/><g class="history-repeat-badge"><rect x="210" y="292" width="132" height="28" rx="14"/><text x="276" y="311">Seen 3 times</text></g></g>
      <g class="history-insight" transform="translate(18 425)"><rect class="history-insight-card" width="354" height="132" rx="26"/><text class="history-eyebrow" x="22" y="30">SOMETHING YOU NOTICED</text><text class="history-insight-copy history-insight-copy--mobile" x="22" y="61"><tspan x="22" dy="0">Harder workouts have sometimes</tspan><tspan x="22" dy="24">followed nights of poorer sleep.</tspan></text><text class="history-uncertainty" x="22" y="112">Seen 3 times · Observation, not conclusion.</text></g>
      <g class="history-question" transform="translate(18 572)"><rect class="history-question-card" width="354" height="60" rx="22"/><text class="history-question-copy" x="22" y="36">Worth exploring? What changes when sleep is better?</text><text class="history-question-arrow" x="326" y="38">→</text></g>
    </svg>`;
  }

  function setDiscoveryFinal(svg) {
    if (!svg) return;
    svg.querySelectorAll('.history-chip,.history-axis,.history-stems,.history-repeat,.history-insight,.history-question,.history-stage-labels,.history-stage-track').forEach(function (el) {
      el.style.opacity = '1';
      el.style.transform = el.getAttribute('transform') ? '' : el.style.transform;
    });
  }

  function animateDiscovery(svg, gsap) {
    if (!svg || !gsap || reduced.matches) return setDiscoveryFinal(svg);
    if (discoveryTimeline) discoveryTimeline.kill();

    const chips = Array.from(svg.querySelectorAll('.history-chip'));
    const axis = svg.querySelector('.history-axis');
    const stems = svg.querySelector('.history-stems');
    const repeat = svg.querySelector('.history-repeat');
    const connections = Array.from(svg.querySelectorAll('.history-connection'));
    const insight = svg.querySelector('.history-insight');
    const question = svg.querySelector('.history-question');
    const stageDots = Array.from(svg.querySelectorAll('.history-stage-dot'));

    gsap.set(chips, { opacity:0, y:14, scale:.94, transformOrigin:'center' });
    gsap.set([axis, stems], { opacity:0 });
    gsap.set(repeat, { opacity:0 });
    gsap.set([insight, question], { opacity:0, x:16 });
    gsap.set(stageDots, { opacity:.24, scale:.8, transformOrigin:'center' });

    connections.forEach(function (path) {
      const length = path.getTotalLength();
      gsap.set(path, { strokeDasharray:length, strokeDashoffset:length });
    });

    discoveryTimeline = gsap.timeline({ defaults:{ ease:'power2.out' } });
    discoveryTimeline
      .to(stageDots[0], { opacity:1, scale:1, duration:.28 }, 0)
      .to(chips, { opacity:1, y:0, scale:1, duration:.45, stagger:.08 }, .08)
      .to(stageDots[1], { opacity:1, scale:1, duration:.28 }, .75)
      .to([axis, stems], { opacity:1, duration:.55 }, .75)
      .to(stageDots[2], { opacity:1, scale:1, duration:.28 }, 1.45)
      .to(repeat, { opacity:1, duration:.35 }, 1.48)
      .to(connections, { strokeDashoffset:0, duration:.8, stagger:.12, ease:'power1.inOut' }, 1.5)
      .to(chips.filter(function (_,i){ return i === 1 || i === 3 || i === 4; }), { opacity:.35, duration:.4 }, 1.75)
      .to(insight, { opacity:1, x:0, duration:.55 }, 2.15)
      .to(stageDots[3], { opacity:1, scale:1, duration:.28 }, 2.7)
      .to(question, { opacity:1, x:0, duration:.5 }, 2.75);
  }

  function renderDiscovery() {
    const demo = demos[2];
    if (!demo) return;
    const copy = demo.querySelector('.product-demo-copy');
    const visual = demo.querySelector('.demo-visual');
    if (!copy || !visual) return;

    const heading = copy.querySelector('h2');
    const support = copy.querySelector('p');
    if (heading) heading.textContent = 'Notice what your history can reveal.';
    if (support) support.textContent = 'The things you keep can become context, questions, and eventually something you understand about yourself.';

    const mode = mobile.matches ? 'mobile' : 'desktop';
    if (discoveryMode === mode && visual.querySelector('.history-story-svg')) return;
    discoveryMode = mode;
    if (discoveryTimeline) { discoveryTimeline.kill(); discoveryTimeline = null; }
    if (discoveryObserver) discoveryObserver.disconnect();

    visual.classList.add('demo-visual--history-svg');
    visual.innerHTML = mode === 'mobile' ? mobileDiscoverySvg() : desktopDiscoverySvg();
    const svg = visual.querySelector('.history-story-svg');

    if (reduced.matches || !('IntersectionObserver' in window)) return setDiscoveryFinal(svg);
    discoveryObserver = new IntersectionObserver(function (entries) {
      if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
      discoveryObserver.disconnect();
      loadGsap().then(function (gsap) { animateDiscovery(svg, gsap); }).catch(function () { setDiscoveryFinal(svg); });
    }, { threshold:.25 });
    discoveryObserver.observe(visual);
  }

  function boot() {
    ensureKineticStyles();
    renderTimeStory();
    renderDiscovery();
    if (typeof mobile.addEventListener === 'function') mobile.addEventListener('change', renderDiscovery);
    if (typeof reduced.addEventListener === 'function') reduced.addEventListener('change', renderDiscovery);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
}());
