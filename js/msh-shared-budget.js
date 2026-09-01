/* My Simple Health — collaborative Shared Budget */
(function () {
  'use strict';
  const root = document.querySelector('[data-shared-budget]');
  const modeBar = document.querySelector('[data-financial-mode-switch]');
  const personal = document.querySelector('[data-financial-health]');
  if (!root || !modeBar || !personal) return;

  const api = window.MSHSupabase;
  const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value)||0);
  const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const categories = ['Housing','Food & household','Transportation','Insurance & healthcare','Family & children','Pets','Personal & lifestyle','Debt','Emergency savings','Investments','Subscriptions','Other'];

  let currentUser = null;
  let budgets = [];
  let invitations = [];
  let activeBudget = null;
  let items = [];
  let members = [];
  let busy = false;

  function setMode(mode) {
    const shared = mode === 'shared';
    personal.hidden = shared;
    root.hidden = !shared;
    modeBar.querySelectorAll('[data-financial-mode]').forEach(button => {
      const active = button.dataset.financialMode === mode;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      if (active) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
    });
    try { localStorage.setItem('msh_financial_mode_v1', mode); } catch (_) {}
    if (shared) init();
  }

  modeBar.addEventListener('click', event => {
    const button = event.target.closest('[data-financial-mode]');
    if (button) setMode(button.dataset.financialMode);
  });

  function notice(message, tone='') {
    const el = root.querySelector('[data-shared-notice]');
    if (!el) return;
    el.textContent = message || '';
    el.dataset.tone = tone;
  }

  function renderSignedOut() {
    root.innerHTML = `<section class="msh-shared-budget-card msh-shared-onboarding">
      <p class="msh-shared-kicker">Shared budget</p>
      <h2>Plan household money together.</h2>
      <p>Your personal Financial Health stays private. Sign in to create or join a budget that only invited people can access.</p>
      <form data-shared-signin>
        <label>Email address<input type="email" name="email" autocomplete="email" required placeholder="you@example.com"></label>
        <button type="submit">Email me a sign-in link</button>
      </form>
      <p class="msh-shared-status" data-shared-notice aria-live="polite"></p>
    </section>`;
  }

  function renderEmpty() {
    root.innerHTML = `<section class="msh-shared-budget-card msh-shared-onboarding">
      <div class="msh-shared-head"><div><p class="msh-shared-kicker">Shared budget</p><h2>Create your household budget.</h2></div><button type="button" data-shared-signout>Sign out</button></div>
      ${invitations.length ? `<div class="msh-shared-invites"><h3>Invitations</h3>${invitations.map(inv => `<article><div><strong>Shared budget invitation</strong><small>${esc(inv.invited_email)}</small></div><button type="button" data-accept-invite="${esc(inv.budget_id)}">Accept</button></article>`).join('')}</div>` : ''}
      <form data-create-budget class="msh-shared-create-form">
        <label>Budget name<input name="name" maxlength="80" value="Household budget" required></label>
        <label>Shared monthly income<input name="monthly_income" type="number" inputmode="decimal" min="0" step="0.01" value="0" required></label>
        <button type="submit">Create shared budget</button>
      </form>
      <p class="msh-shared-status" data-shared-notice aria-live="polite"></p>
    </section>`;
  }

  function totals() {
    return items.reduce((acc,item) => {
      acc.planned += Number(item.planned_amount)||0;
      acc.actual += Number(item.actual_amount)||0;
      return acc;
    }, {planned:0,actual:0});
  }

  function renderBudget() {
    const t = totals();
    const remaining = (Number(activeBudget.monthly_income)||0) - t.actual;
    const grouped = categories.map(category => ({category,items:items.filter(item=>item.category===category)})).filter(group=>group.items.length);
    const owner = currentUser?.id === activeBudget.owner_id;
    root.innerHTML = `<section class="msh-shared-budget-card">
      <div class="msh-shared-head">
        <div><p class="msh-shared-kicker">Shared budget</p><h2>${esc(activeBudget.name)}</h2><small>${members.filter(m=>m.status==='accepted').length + 1} participant${members.filter(m=>m.status==='accepted').length===0?'':'s'} · changes sync for everyone with access</small></div>
        <div class="msh-shared-head-actions"><button type="button" data-switch-budget>Budgets</button><button type="button" data-shared-signout>Sign out</button></div>
      </div>
      <div class="msh-shared-summary">
        <button type="button" data-edit-income><span>Shared monthly income</span><strong>${money(activeBudget.monthly_income)}</strong><small>Tap to edit</small></button>
        <article><span>Planned spending</span><strong>${money(t.planned)}</strong></article>
        <article><span>Actual spending</span><strong>${money(t.actual)}</strong></article>
        <article><span>Remaining</span><strong>${money(remaining)}</strong></article>
      </div>
      <div class="msh-shared-toolbar">
        <button type="button" data-add-shared-item>+ Add budget item</button>
        ${owner ? '<button type="button" data-invite-member>Invite person</button>' : ''}
      </div>
      ${members.length ? `<div class="msh-shared-members"><strong>People with access</strong>${members.map(member=>`<span>${esc(member.invited_email || 'Member')} · ${esc(member.status)}${member.status==='accepted' ? ` · ${esc(member.role)}`:''}</span>`).join('')}</div>`:''}
      <div class="msh-shared-categories">
        ${grouped.length ? grouped.map(group=>`<section><header><h3>${esc(group.category)}</h3><strong>${money(group.items.reduce((sum,item)=>sum+(Number(item.actual_amount)||0),0))}</strong></header>${group.items.map(item=>`<button type="button" data-shared-item="${esc(item.id)}"><span><b>${esc(item.label)}</b><small>Planned ${money(item.planned_amount)} · actual ${money(item.actual_amount)}</small></span><strong>${money(item.actual_amount)}</strong></button>`).join('')}</section>`).join('') : '<div class="msh-shared-empty-items"><h3>No shared items yet.</h3><p>Add housing, groceries, savings, subscriptions, or any other household cost.</p></div>'}
      </div>
      <p class="msh-shared-status" data-shared-notice aria-live="polite"></p>
      <dialog class="msh-shared-dialog" data-shared-dialog></dialog>
    </section>`;
  }

  function renderBudgetChooser() {
    root.innerHTML = `<section class="msh-shared-budget-card msh-shared-onboarding">
      <div class="msh-shared-head"><div><p class="msh-shared-kicker">Shared budgets</p><h2>Choose a budget.</h2></div><button type="button" data-shared-signout>Sign out</button></div>
      <div class="msh-shared-budget-list">${budgets.map(b=>`<button type="button" data-open-budget="${esc(b.id)}"><span><strong>${esc(b.name)}</strong><small>${money(b.monthly_income)} shared monthly income</small></span><b>Open</b></button>`).join('')}</div>
      ${invitations.length ? `<div class="msh-shared-invites"><h3>Invitations</h3>${invitations.map(inv=>`<article><div><strong>Shared budget invitation</strong><small>${esc(inv.invited_email)}</small></div><button type="button" data-accept-invite="${esc(inv.budget_id)}">Accept</button></article>`).join('')}</div>`:''}
      <button type="button" class="msh-shared-secondary" data-new-budget>+ New shared budget</button>
      <p class="msh-shared-status" data-shared-notice aria-live="polite"></p>
    </section>`;
  }

  async function loadBudgets() {
    budgets = await api.rest('shared_budgets', {query:'select=*&order=updated_at.desc'});
    invitations = await api.rest('shared_budget_members', {query:'select=*&status=eq.pending&order=created_at.desc'});
  }

  async function loadActiveBudget(id) {
    const rows = await api.rest('shared_budgets', {query:`select=*&id=eq.${encodeURIComponent(id)}`});
    if (!rows?.length) throw new Error('This shared budget is no longer available.');
    activeBudget = rows[0];
    items = await api.rest('shared_budget_items', {query:`select=*&budget_id=eq.${encodeURIComponent(id)}&order=created_at.asc`});
    members = await api.rest('shared_budget_members', {query:`select=*&budget_id=eq.${encodeURIComponent(id)}&order=created_at.asc`});
    renderBudget();
  }

  async function init(force=false) {
    if (busy && !force) return;
    busy = true;
    try {
      if (!api) throw new Error('Shared Budget connection is unavailable.');
      currentUser = await api.user();
      if (!currentUser) { renderSignedOut(); return; }
      await loadBudgets();
      if (activeBudget && budgets.some(b=>b.id===activeBudget.id)) await loadActiveBudget(activeBudget.id);
      else if (budgets.length===1 && invitations.length===0) await loadActiveBudget(budgets[0].id);
      else if (budgets.length || invitations.length) renderBudgetChooser();
      else renderEmpty();
    } catch (error) {
      renderSignedOut();
      notice(error.message || 'Shared Budget is temporarily unavailable.','error');
    } finally { busy = false; }
  }

  function dialog(html) {
    const el = root.querySelector('[data-shared-dialog]');
    if (!el) return null;
    el.innerHTML = html;
    el.showModal();
    return el;
  }

  root.addEventListener('submit', async event => {
    const form = event.target;
    if (form.matches('[data-shared-signin]')) {
      event.preventDefault();
      notice('Sending sign-in link…');
      try { await api.sendMagicLink(new FormData(form).get('email')); notice('Check your email. Open the link on this device to continue.','success'); }
      catch (error) { notice(error.message,'error'); }
      return;
    }
    if (form.matches('[data-create-budget]')) {
      event.preventDefault();
      if (!currentUser) return;
      const data = new FormData(form);
      try {
        const created = await api.rest('shared_budgets', {method:'POST',prefer:'return=representation',body:{name:String(data.get('name')||'Household budget').trim(),monthly_income:Number(data.get('monthly_income'))||0,owner_id:currentUser.id}});
        await loadBudgets();
        await loadActiveBudget(created[0].id);
      } catch (error) { notice(error.message,'error'); }
      return;
    }
    if (form.matches('[data-item-form]')) {
      event.preventDefault();
      const data = new FormData(form); const id = data.get('id');
      const payload = {budget_id:activeBudget.id,category:String(data.get('category')||'Other'),label:String(data.get('label')||'').trim(),planned_amount:Number(data.get('planned_amount'))||0,actual_amount:Number(data.get('actual_amount'))||0,updated_by:currentUser.id};
      try {
        if (id) await api.rest('shared_budget_items',{method:'PATCH',query:`id=eq.${encodeURIComponent(id)}`,prefer:'return=minimal',body:payload});
        else await api.rest('shared_budget_items',{method:'POST',prefer:'return=minimal',body:{...payload,created_by:currentUser.id}});
        form.closest('dialog').close(); await loadActiveBudget(activeBudget.id);
      } catch(error){ const status=form.querySelector('[data-form-status]'); if(status)status.textContent=error.message; }
      return;
    }
    if (form.matches('[data-invite-form]')) {
      event.preventDefault(); const data=new FormData(form);
      try {
        await api.rest('shared_budget_members',{method:'POST',prefer:'return=minimal',body:{budget_id:activeBudget.id,invited_email:String(data.get('email')||'').trim().toLowerCase(),role:String(data.get('role')||'collaborator'),status:'pending',invited_by:currentUser.id}});
        form.closest('dialog').close(); await loadActiveBudget(activeBudget.id); notice('Invitation added. They can accept after signing in with that email.','success');
      } catch(error){ const status=form.querySelector('[data-form-status]'); if(status)status.textContent=error.message; }
      return;
    }
    if (form.matches('[data-income-form]')) {
      event.preventDefault(); const amount=Number(new FormData(form).get('monthly_income'))||0;
      try { await api.rest('shared_budgets',{method:'PATCH',query:`id=eq.${encodeURIComponent(activeBudget.id)}`,prefer:'return=minimal',body:{monthly_income:amount}}); form.closest('dialog').close(); await loadActiveBudget(activeBudget.id); }
      catch(error){ const status=form.querySelector('[data-form-status]'); if(status)status.textContent=error.message; }
    }
  });

  root.addEventListener('click', async event => {
    const signout=event.target.closest('[data-shared-signout]');
    if(signout){ api.signOut(); currentUser=null; activeBudget=null; renderSignedOut(); return; }
    const open=event.target.closest('[data-open-budget]');
    if(open){ try{await loadActiveBudget(open.dataset.openBudget);}catch(error){notice(error.message,'error');} return; }
    if(event.target.closest('[data-switch-budget]')){ await loadBudgets(); activeBudget=null; renderBudgetChooser(); return; }
    if(event.target.closest('[data-new-budget]')){ renderEmpty(); return; }
    const accept=event.target.closest('[data-accept-invite]');
    if(accept){ try{ await api.rest('shared_budget_members',{method:'PATCH',query:`budget_id=eq.${encodeURIComponent(accept.dataset.acceptInvite)}&status=eq.pending`,prefer:'return=minimal',body:{user_id:currentUser.id,status:'accepted',accepted_at:new Date().toISOString()}}); activeBudget=null; await init(true); }catch(error){notice(error.message,'error');} return; }
    if(event.target.closest('[data-edit-income]')){ dialog(`<form data-income-form><header><p>Shared income</p><h3>Edit shared monthly income</h3></header><label>Monthly amount<input name="monthly_income" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(activeBudget.monthly_income)}" required></label><p data-form-status></p><footer><button type="button" data-close-dialog>Cancel</button><button type="submit">Save</button></footer></form>`); return; }
    if(event.target.closest('[data-add-shared-item]')){ dialog(itemForm()); return; }
    const itemButton=event.target.closest('[data-shared-item]');
    if(itemButton){ const item=items.find(x=>x.id===itemButton.dataset.sharedItem); if(item)dialog(itemForm(item)); return; }
    if(event.target.closest('[data-invite-member]')){ dialog(`<form data-invite-form><header><p>People</p><h3>Invite someone to this budget</h3></header><label>Email address<input name="email" type="email" required></label><label>Permission<select name="role"><option value="collaborator">Can edit</option><option value="viewer">View only</option></select></label><p data-form-status></p><footer><button type="button" data-close-dialog>Cancel</button><button type="submit">Invite</button></footer></form>`); return; }
    if(event.target.closest('[data-close-dialog]')){ event.target.closest('dialog')?.close(); }
  });

  function itemForm(item={}) {
    return `<form data-item-form><header><p>Budget item</p><h3>${item.id?'Edit shared item':'Add a shared item'}</h3></header><input type="hidden" name="id" value="${esc(item.id||'')}"><label>Name<input name="label" maxlength="100" value="${esc(item.label||'')}" placeholder="Groceries" required></label><label>Category<select name="category">${categories.map(category=>`<option ${item.category===category?'selected':''}>${esc(category)}</option>`).join('')}</select></label><div class="msh-shared-form-grid"><label>Planned<input name="planned_amount" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(item.planned_amount||0)}" required></label><label>Actual<input name="actual_amount" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(item.actual_amount||0)}" required></label></div><p data-form-status></p><footer><button type="button" data-close-dialog>Cancel</button><button type="submit">Save</button></footer></form>`;
  }

  const savedMode = (()=>{try{return localStorage.getItem('msh_financial_mode_v1')||'personal';}catch(_){return 'personal';}})();
  setMode(savedMode === 'shared' ? 'shared' : 'personal');
})();