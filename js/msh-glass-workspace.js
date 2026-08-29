/* My Simple Health — reusable stateful Glass Workspace presentation primitive */
(function (root) {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function choices(items) {
    return `<div class="msh-glass-choices" role="list">${items.map((item, index) => `<div class="msh-glass-choice-region" role="listitem"><button class="msh-glass-choice" type="button" data-glass-choice="${esc(item.id)}" style="--choice-index:${index}"><span class="msh-glass-choice-mark" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><span><strong>${esc(item.label)}</strong>${item.detail ? `<small>${esc(item.detail)}</small>` : ''}</span><span class="msh-glass-choice-arrow" aria-hidden="true">→</span></button></div>`).join('')}</div>`;
  }

  function markup(config) {
    const choiceMarkup = config.choices && config.choices.length ? choices(config.choices) : '';
    const manifestation = config.manifestation || 'workspace';
    const ambient = '';
    return `<section class="msh-glass-workspace msh-${esc(manifestation)}-glass" data-msh-glass data-glass-manifestation="${esc(manifestation)}" data-glass-state="${esc(config.state || 'default')}" aria-labelledby="msh-glass-title" aria-describedby="msh-glass-intro">
      <div class="msh-glass-edge" aria-hidden="true"></div>
      ${ambient}
      <div class="msh-glass-content" data-msh-glass-content>
        <header class="msh-glass-heading">
          <p class="msh-glass-eyebrow">${esc(config.eyebrow || 'My Health')}</p>
          ${config.context ? `<p class="msh-glass-context">${esc(config.context)}</p>` : ''}
          <h1 id="msh-glass-title" tabindex="-1">${esc(config.title)}</h1>
          <p id="msh-glass-intro">${esc(config.intro || '')}</p>
        </header>
        ${choiceMarkup}
        ${config.body || ''}
        ${config.footer || ''}
      </div>
      <p class="msh-glass-status" aria-live="polite">${esc(config.status || '')}</p>
    </section>`;
  }

  function update(element, config, options) {
    if (!element) return;
    const next = document.createElement('template');
    next.innerHTML = markup(config).trim();
    const replacement = next.content.firstElementChild;
    element.replaceWith(replacement);
    if (!options || options.focus !== false) {
      requestAnimationFrame(() => replacement.querySelector('h1')?.focus({ preventScroll:true }));
    }
    return replacement;
  }

  root.MSHGlassWorkspace = Object.freeze({ markup, update });
})(typeof window !== 'undefined' ? window : globalThis);
