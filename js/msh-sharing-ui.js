/* My Simple Health — visible Calendar and Financial sharing controls */
(function (root) {
  'use strict';

  if (!root.MSHSharing) return;
  const repo = root.MSHSharing.createRepository();
  const body = document.body;
  const page = body && body.dataset.mshPage;
  if (!['calendar','financial'].includes(page)) return;

  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  function closeDialog() {
    document.querySelector('[data-sharing-overlay]')?.remove();
  }

  function personFor(grant) {
    return repo.snapshot().people.find(person => person.id === grant.personId) || null;
  }

  function calendarScopeMarkup() {
    let layers = {};
    try { layers = root.MSHStorage?.getState()?.calendar?.settings?.layers || {}; } catch (_) {}
    const options = [
      ['life','Life context'],['movement','Movement/workouts'],['care','Care & appointments'],['medications','Medication/refill events'],
      ['symptoms','Symptoms'],['measurements','Measurements'],['cycle','Cycle'],['observations','Observations']
    ];
    return `<fieldset><legend>What from Calendar?</legend>
      <label><input type="radio" name="calendarScopeMode" value="selected_layers" checked> Selected layers</label>
      <div class="msh-sharing-checks">${options.map(([key,label]) => `<label><input type="checkbox" name="calendarLayer" value="${esc(key)}" ${layers[key] ? 'checked' : ''}> ${esc(label)}</label>`).join('')}</div>
      <label><input type="radio" name="calendarScopeMode" value="selected_event"> Only the currently selected event/day context</label>
      <small>Health, cycle, medication, and other sensitive layers are never included just because Calendar sharing is enabled. Select them explicitly.</small>
    </fieldset>`;
  }

  function financialScopeMarkup() {
    return `<fieldset><legend>What from Financial Health?</legend>
      <label><input type="checkbox" name="financialScope" value="household_budget" checked> Household budget / included expenses</label>
      <label><input type="checkbox" name="financialScope" value="goals"> Selected goals</label>
      <label><input type="checkbox" name="financialScope" value="categories"> Budget categories</label>
      <label><input type="checkbox" name="financialScope" value="income_summary"> Income summary</label>
      <small>Bank credentials, account connections, and unrelated financial data are not shared by this permission.</small>
    </fieldset>`;
  }

  function existingMarkup(resourceType) {
    const grants = repo.active(resourceType);
    if (!grants.length) return '<p class="msh-sharing-empty">Nothing configured for sharing yet.</p>';
    return `<div class="msh-sharing-existing">${grants.map(grant => {
      const person = personFor(grant);
      const personStatus = person?.status || 'pending';
      return `<article><div><strong>${esc(person?.displayName || person?.email || 'Sharing person')}</strong><small>${esc(grant.permission)} · ${esc(personStatus === 'accepted' ? 'connected' : 'pending connection')}</small></div><button type="button" data-revoke-share="${esc(grant.id)}">Revoke</button></article>`;
    }).join('')}</div>`;
  }

  function openShareDialog(resourceType) {
    closeDialog();
    const title = resourceType === 'calendar' ? 'Share Calendar' : 'Share Financial Health';
    const scope = resourceType === 'calendar' ? calendarScopeMarkup() : financialScopeMarkup();
    const overlay = document.createElement('div');
    overlay.className = 'msh-sharing-overlay';
    overlay.dataset.sharingOverlay = '';
    overlay.innerHTML = `<div class="msh-sharing-backdrop" data-close-sharing></div>
      <section class="msh-sharing-dialog" role="dialog" aria-modal="true" aria-labelledby="msh-sharing-title">
        <header><div><p>People & Sharing</p><h2 id="msh-sharing-title">${esc(title)}</h2></div><button type="button" data-close-sharing aria-label="Close">×</button></header>
        <div class="msh-sharing-connection-note"><strong>Permission setup</strong><span>This configures exactly what MSH may share. Until the other account accepts through the connected account service, it remains pending and no cross-account data is exposed.</span></div>
        <form data-sharing-form data-resource-type="${esc(resourceType)}">
          <label>Person's email<input type="email" name="email" required placeholder="name@example.com" autocomplete="email"></label>
          <label>Name <span>(optional)</span><input name="displayName" maxlength="80" placeholder="Partner or family member"></label>
          ${scope}
          <fieldset><legend>Permission</legend><label><input type="radio" name="permission" value="view" checked> View only</label><label><input type="radio" name="permission" value="collaborate"> Collaborate / edit where allowed</label></fieldset>
          <p class="msh-sharing-status" data-sharing-status hidden></p>
          <button class="msh-sharing-primary" type="submit">Save sharing permission</button>
        </form>
        <section class="msh-sharing-current"><h3>Currently configured</h3>${existingMarkup(resourceType)}</section>
      </section>`;
    document.body.appendChild(overlay);
    overlay.querySelector('input[name="email"]')?.focus();
  }

  function calendarSelectedContext() {
    const calendar = document.querySelector('[data-msh-calendar]');
    const selectedDate = calendar?.querySelector('[data-date].is-selected')?.dataset.date || calendar?.querySelector('[data-date][aria-current="date"]')?.dataset.date || null;
    return { selectedDate };
  }

  function buildScope(form, resourceType) {
    if (resourceType === 'calendar') {
      const mode = form.elements.calendarScopeMode.value;
      if (mode === 'selected_event') return { mode, ...calendarSelectedContext() };
      const layers = Array.from(form.querySelectorAll('input[name="calendarLayer"]:checked')).map(input => input.value);
      return { mode:'selected_layers', layers };
    }
    const areas = Array.from(form.querySelectorAll('input[name="financialScope"]:checked')).map(input => input.value);
    return { mode:'selected_areas', areas };
  }

  function injectCalendarShare() {
    const main = document.querySelector('[data-msh-calendar]');
    if (!main || main.querySelector('[data-calendar-share]')) return;
    const bar = document.createElement('div');
    bar.className = 'msh-sharing-entrybar msh-sharing-calendar-entry';
    bar.innerHTML = `<div><span>Calendar sharing</span><small>Choose exactly what another person can see.</small></div><button type="button" data-calendar-share>Share</button>`;
    main.prepend(bar);
  }

  function injectFinancialShare() {
    const host = document.querySelector('[data-financial-health]');
    if (!host || host.querySelector('[data-financial-share]')) return;
    const toolbar = host.querySelector('.msh-financial-toolbar');
    if (toolbar) {
      const actions = toolbar.querySelector('.msh-toolbar-actions') || toolbar;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.financialShare = '';
      button.textContent = 'Share';
      actions.appendChild(button);
      return;
    }
    const bar = document.createElement('div');
    bar.className = 'msh-sharing-entrybar';
    bar.innerHTML = `<div><span>Financial sharing</span><small>Share selected household budget information, not your whole financial workspace.</small></div><button type="button" data-financial-share>Share</button>`;
    host.prepend(bar);
  }

  function syncEntryPoints() {
    if (page === 'calendar') injectCalendarShare();
    if (page === 'financial') injectFinancialShare();
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-calendar-share]')) { openShareDialog('calendar'); return; }
    if (event.target.closest('[data-financial-share]')) { openShareDialog('financial'); return; }
    if (event.target.closest('[data-close-sharing]')) { closeDialog(); return; }
    const revoke = event.target.closest('[data-revoke-share]');
    if (revoke) {
      repo.revoke(revoke.dataset.revokeShare);
      const resource = document.querySelector('[data-sharing-form]')?.dataset.resourceType;
      if (resource) openShareDialog(resource);
    }
  });

  document.addEventListener('submit', event => {
    const form = event.target.closest('[data-sharing-form]');
    if (!form) return;
    event.preventDefault();
    const status = form.querySelector('[data-sharing-status]');
    try {
      const resourceType = form.dataset.resourceType;
      const person = repo.upsertPerson({ email:form.elements.email.value, displayName:form.elements.displayName.value, relationship:'partner' });
      const scope = buildScope(form, resourceType);
      if (resourceType === 'calendar' && scope.mode === 'selected_layers' && !scope.layers.length) throw new Error('Choose at least one Calendar layer to share.');
      if (resourceType === 'financial' && !scope.areas.length) throw new Error('Choose at least one financial area to share.');
      repo.grant({ personId:person.id, resourceType, permission:form.elements.permission.value, scope });
      openShareDialog(resourceType);
      const nextStatus = document.querySelector('[data-sharing-status]');
      if (nextStatus) {
        nextStatus.textContent = `Permission saved for ${person.email}. It is pending until the other MSH account accepts.`;
        nextStatus.hidden = false;
      }
    } catch (error) {
      status.textContent = error.message || 'Sharing permission could not be saved.';
      status.hidden = false;
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeDialog();
  });

  const observer = new MutationObserver(syncEntryPoints);
  observer.observe(document.body, { childList:true, subtree:true });
  syncEntryPoints();
})(window);