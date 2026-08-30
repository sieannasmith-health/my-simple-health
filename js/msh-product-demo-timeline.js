/* My Simple Health — product story 02: health in time */
(function () {
  'use strict';

  const demos = document.querySelectorAll('.product-demo');
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
        <filter id="timeCardShadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="10" stdDeviation="11" flood-color="#173d2b" flood-opacity=".13"/>
        </filter>
        <filter id="timePointGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#7d9460" flood-opacity=".35"/>
        </filter>
      </defs>

      <rect class="time-context-window" x="205" y="38" width="380" height="225" rx="28"/>
      <path class="time-flow" d="M86 252 C185 247 244 255 330 250 S500 244 674 252"/>

      <g class="time-event time-event-1">
        <path class="time-stem" d="M118 107 V252"/>
        <circle class="time-point" cx="118" cy="252" r="6"/>
        <g filter="url(#timeCardShadow)">
          <rect class="time-card" x="55" y="62" width="126" height="48" rx="15"/>
          <text class="time-card-label" x="118" y="92">Poor sleep</text>
        </g>
      </g>

      <g class="time-event time-event-2">
        <path class="time-stem" d="M258 154 V250"/>
        <circle class="time-point" cx="258" cy="250" r="6"/>
        <g filter="url(#timeCardShadow)">
          <rect class="time-card" x="193" y="108" width="130" height="48" rx="15"/>
          <text class="time-card-label" x="258" y="138">Stressful day</text>
        </g>
      </g>

      <g class="time-event time-event-3">
        <path class="time-stem" d="M392 101 V249"/>
        <circle class="time-point" cx="392" cy="249" r="7"/>
        <g filter="url(#timeCardShadow)">
          <rect class="time-card time-card--strong" x="315" y="55" width="154" height="48" rx="15"/>
          <text class="time-card-label" x="392" y="85">Strength workout</text>
        </g>
      </g>

      <g class="time-event time-event-4">
        <path class="time-stem" d="M525 145 V248"/>
        <circle class="time-point time-point--focus" cx="525" cy="248" r="8" filter="url(#timePointGlow)"/>
        <circle class="time-focus-ring" cx="525" cy="248" r="18"/>
        <g filter="url(#timeCardShadow)">
          <rect class="time-card time-card--focus" x="469" y="99" width="112" height="48" rx="15"/>
          <text class="time-card-label" x="525" y="129">Headache</text>
        </g>
        <text class="time-focus-label" x="525" y="216">around this moment</text>
      </g>

      <g class="time-event time-event-5">
        <path class="time-stem" d="M648 184 V251"/>
        <circle class="time-point" cx="648" cy="251" r="6"/>
        <g filter="url(#timeCardShadow)">
          <rect class="time-card" x="570" y="138" width="156" height="48" rx="15"/>
          <text class="time-card-label" x="648" y="168">Medication change</text>
        </g>
      </g>

      <g class="time-days" aria-hidden="true">
        <text x="118" y="302">Mon</text>
        <text x="258" y="302">Tue</text>
        <text x="392" y="302">Wed</text>
        <text x="525" y="302">Thu</text>
        <text x="648" y="302">Fri</text>
      </g>
    </svg>`;
}());
