/* My Simple Health — personal health patterns design preview */
(function () {
  'use strict';

  const root = document.querySelector('[data-patterns-preview]');
  if (!root) return;

  const patterns = {
    'sleep-timing': {
      label: 'Pattern change',
      title: 'Your sleep timing has been later than your usual pattern.',
      summary: 'This began around Aug 11 and has persisted across 19 observed nights.',
      strength: 'Moderate signal',
      count: '19 nights',
      changed: '<p>Your sleep midpoint shifted later by about 46 minutes on average.</p><dl class="msh-pattern-stats"><div><dt>Change began</dt><dd>Aug 11</dd></div><div><dt>Direction</dt><dd>Later</dd></div><div><dt>Average change</dt><dd>46 min</dd></div><div><dt>Nights observed</dt><dd>19</dd></div></dl>',
      related: '<p>Three related changes appeared around the same period.</p><ul><li>Sleep duration decreased.</li><li>Morning energy decreased.</li><li>Schedule load increased.</li></ul><p class="msh-pattern-caveat">These variables moving together does not establish that one caused another.</p>',
      context: '<p>Calendar load and evening activity also increased during the comparison period.</p><button type="button" class="msh-text-action" data-action="context">Add or edit context</button>',
      unusual: '<p>The recent sleep timing sits outside the illustrative usual range shown in this preview.</p><div class="msh-range-bar" aria-hidden="true"><span></span><i></i></div><div class="msh-range-labels"><span>Typical</span><span>More unusual</span></div>',
      confidence: '<p><strong>Moderate confidence</strong> in the pattern description, not in a causal explanation.</p><dl class="msh-pattern-stats"><div><dt>Usable observations</dt><dd>19</dd></div><div><dt>Data completeness</dt><dd>78%</dd></div><div><dt>Consistency</dt><dd>Moderate</dd></div><div><dt>Pattern stability</dt><dd>Moderate</dd></div></dl>'
    },
    'sleep-energy': {
      label: 'Association',
      title: 'Lower-sleep days have coincided with lower morning energy.',
      summary: 'The pattern appears on 13 of the 19 comparable days in this preview.',
      strength: 'Moderate signal',
      count: '19 comparable days',
      changed: '<p>Morning energy was lower more often on days following shorter sleep in this illustrative comparison.</p><dl class="msh-pattern-stats"><div><dt>Comparable days</dt><dd>19</dd></div><div><dt>Pattern present</dt><dd>13 days</dd></div><div><dt>Direction</dt><dd>Moves together</dd></div><div><dt>Causal claim</dt><dd>None</dd></div></dl>',
      related: '<p>Sleep duration and morning energy moved together more often than not in the preview period.</p><p class="msh-pattern-caveat">An association can be useful without being causal. Other conditions may help explain both.</p>',
      context: '<p>Schedule load and evening timing also changed during some of the same days, so they remain plausible alternative explanations.</p><button type="button" class="msh-text-action" data-action="context">Add or edit context</button>',
      unusual: '<p>This relationship is more consistent in the recent preview period than in the earlier comparison period.</p><div class="msh-range-bar" aria-hidden="true"><span></span><i style="right:28%"></i></div><div class="msh-range-labels"><span>Less consistent</span><span>More consistent</span></div>',
      confidence: '<p><strong>Moderate confidence</strong> that the two variables moved together in this preview. Confidence in why they moved together is lower.</p><dl class="msh-pattern-stats"><div><dt>Comparable days</dt><dd>19</dd></div><div><dt>Pattern days</dt><dd>13</dd></div><div><dt>Missingness</dt><dd>21%</dd></div><div><dt>Confounding</dt><dd>Possible</dd></div></dl>'
    },
    'schedule-load': {
      label: 'Context shift',
      title: 'Your schedule load increased on weekdays.',
      summary: 'This change began around the same period as the sleep timing shift.',
      strength: 'Context signal',
      count: '3 weeks',
      changed: '<p>Weekday calendar load increased during the recent illustrative period compared with the earlier period.</p><dl class="msh-pattern-stats"><div><dt>Change began</dt><dd>Aug 10</dd></div><div><dt>Direction</dt><dd>Higher</dd></div><div><dt>Days affected</dt><dd>Weekdays</dd></div><div><dt>Duration</dt><dd>3 weeks</dd></div></dl>',
      related: '<p>The change overlapped with later sleep timing, while exercise frequency remained relatively stable.</p><p class="msh-pattern-caveat">Overlap in timing is context, not evidence that schedule load caused the sleep change.</p>',
      context: '<p>This is the kind of signal where the person may know something the system cannot see, such as a deadline, travel, caregiving, or a temporary routine change.</p><button type="button" class="msh-text-action" data-action="context">Add or edit context</button>',
      unusual: '<p>The recent weekday load is above the illustrative comparison period, but it may still be entirely expected for this person.</p><div class="msh-range-bar" aria-hidden="true"><span></span><i style="right:34%"></i></div><div class="msh-range-labels"><span>Usual load</span><span>Higher load</span></div>',
      confidence: '<p><strong>Moderate confidence</strong> that schedule load changed in the preview. MSH does not assign a health meaning to that change by itself.</p><dl class="msh-pattern-stats"><div><dt>Weeks compared</dt><dd>5</dd></div><div><dt>Weekdays observed</dt><dd>23</dd></div><div><dt>Direction</dt><dd>Higher</dd></div><div><dt>Health meaning</dt><dd>Not assumed</dd></div></dl>'
    }
  };

  const fields = {
    label: root.querySelector('[data-detail-label]'),
    title: root.querySelector('[data-detail-title]'),
    summary: root.querySelector('[data-detail-summary]'),
    strength: root.querySelector('[data-detail-strength]'),
    count: root.querySelector('[data-detail-count]'),
    changed: root.querySelector('[data-detail-changed]'),
    related: root.querySelector('[data-detail-related]'),
    context: root.querySelector('[data-detail-context]'),
    unusual: root.querySelector('[data-detail-unusual]'),
    confidence: root.querySelector('[data-detail-confidence]')
  };

  function selectPattern(id, moveFocus) {
    const pattern = patterns[id];
    if (!pattern) return;

    Object.entries(fields).forEach(([key, element]) => {
      if (!element) return;
      if (['changed', 'related', 'context', 'unusual', 'confidence'].includes(key)) element.innerHTML = pattern[key];
      else element.textContent = pattern[key];
    });

    root.querySelectorAll('[data-pattern-card]').forEach(card => {
      card.classList.toggle('is-active', card.dataset.patternCard === id);
    });

    const status = root.querySelector('[data-action-status]');
    if (status) status.textContent = 'No action has been chosen.';

    if (moveFocus && fields.title) {
      fields.title.setAttribute('tabindex', '-1');
      fields.title.focus({ preventScroll: false });
    }
  }

  function describeAction(action) {
    return {
      understand: 'You chose to understand this pattern better. No health record has been changed.',
      experiment: 'You chose to explore a small experiment. This preview does not create a goal, streak, or plan.',
      context: 'You chose to add context. In the real experience, you would decide what MSH is allowed to remember.',
      watch: 'You chose to keep watching. No action or behavior change is required.',
      dismiss: 'You marked this insight as not important to you. MSH should respect that choice.'
    }[action] || '';
  }

  root.addEventListener('click', event => {
    const explore = event.target.closest('[data-explore-pattern]');
    if (explore) {
      selectPattern(explore.dataset.explorePattern, true);
      return;
    }

    const quick = event.target.closest('[data-quick-action]');
    if (quick) {
      const status = root.querySelector('[data-action-status]');
      if (status) status.textContent = describeAction(quick.dataset.quickAction);
      root.querySelector('.msh-pattern-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const action = event.target.closest('[data-action]');
    if (action) {
      const status = root.querySelector('[data-action-status]');
      if (status) status.textContent = describeAction(action.dataset.action);
      return;
    }

    const deeper = event.target.closest('[data-toggle-deeper]');
    if (deeper) {
      const panel = root.querySelector('[data-deeper-panel]');
      const opening = panel.hasAttribute('hidden');
      panel.toggleAttribute('hidden', !opening);
      deeper.setAttribute('aria-expanded', String(opening));
      deeper.textContent = opening ? 'Show less' : 'Go deeper';
    }
  });
})();
