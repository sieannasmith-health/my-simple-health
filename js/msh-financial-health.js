/* My Simple Health — Financial Health workspace */
(function () {
  'use strict';
  const root = document.querySelector('[data-financial-health]');
  if (!root) return;
  const KEY = 'msh_financial_health_v1';
  const defaults = {
    income: 5301,
    categories: [
      { id:'housing', label:'Housing', amount:1650 },
      { id:'food', label:'Food', amount:800 },
      { id:'debt', label:'Debt', amount:1140.91 },
      { id:'transportation', label:'Transportation', amount:522 },
      { id:'personal', label:'Personal', amount:300 },
      { id:'household', label:'Household', amount:200 },
      { id:'utilities', label:'Utilities', amount:175 },
      { id:'insurance', label:'Insurance', amount:148.30 },
      { id:'retirement', label:'Retirement', amount:200 }
    ],
    goals: [
      { id:'emergency', label:'Emergency cushion', current:0, target:1000 },
      { id:'debt', label:'Reduce debt', current:0, target:10000 },
      { id:'home', label:'A home', current:0, target:30000 },
      { id:'retirement', label:'Retirement', current:0, target:15000 }
    ],
    upcoming: [],
    updatedAt: null
  };

  function money(value) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value)||0); }
  function esc(value) { return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      return saved && typeof saved === 'object' ? { ...defaults, ...saved, categories:Array.isArray(saved.categories)?saved.categories:defaults.categories, goals:Array.isArray(saved.goals)?saved.goals:defaults.goals, upcoming:Array.isArray(saved.upcoming)?saved.upcoming:[] } : structuredClone(defaults);
    } catch (_) { return structuredClone(defaults); }
  }
  let state = load();
  let view = 'picture';
  function save() { state.updatedAt = new Date().toISOString(); localStorage.setItem(KEY, JSON.stringify(state)); }
  function totalCategories() { return state.categories.reduce((sum,item)=>sum+(Number(item.amount)||0),0); }
  function available() { return state.income-totalCategories(); }
  function percent(current,target) { return target > 0 ? Math.min(100,Math.max(0,(current/target)*100)) : 0; }

  function picture() {
    const total = totalCategories();
    const living = state.categories.filter(x=>!['debt','retirement'].includes(x.id)).reduce((s,x)=>s+Number(x.amount||0),0);
    const building = total-living;
    const max = Math.max(state.income,1);
    return `<section class="msh-financial-board" aria-labelledby="current-picture">
      <div class="msh-financial-board-head"><div><p>Current picture</p><h2 id="current-picture">This month, at a glance.</h2></div><button type="button" data-action="edit-picture">Adjust</button></div>
      <div class="msh-money-flow">
        <div><span>Coming in</span><strong>${money(state.income)}</strong><i style="--fill:${Math.min(100,state.income/max*100)}%"></i></div>
        <div><span>Living</span><strong>${money(living)}</strong><i style="--fill:${living/max*100}%"></i></div>
        <div><span>Building</span><strong>${money(building)}</strong><i style="--fill:${building/max*100}%"></i></div>
        <div class="is-available"><span>Available to direct</span><strong>${money(available())}</strong><i style="--fill:${Math.max(0,available()/max*100)}%"></i></div>
      </div>
      <p class="msh-financial-note">This is a picture, not a score. Adjust the amounts so it reflects your life now.</p>
    </section>`;
  }

  function spending() {
    const max = Math.max(...state.categories.map(x=>Number(x.amount)||0),1);
    return `<section class="msh-financial-board"><div class="msh-financial-board-head"><div><p>Spending</p><h2>Where your money is going.</h2></div><button type="button" data-action="edit-picture">Adjust</button></div>
      <div class="msh-spending-list">${state.categories.map(item=>`<div><span>${esc(item.label)}</span><i><b style="width:${Math.max(2,(Number(item.amount)||0)/max*100)}%"></b></i><strong>${money(item.amount)}</strong>${item.id==='food'?'<small>Groceries and restaurants stay separate underneath Food.</small>':''}</div>`).join('')}</div>
    </section>`;
  }

  function build() {
    return `<section class="msh-financial-board"><div class="msh-financial-board-head"><div><p>Build</p><h2>What are you building toward?</h2></div><button type="button" data-action="add-goal">+ Add</button></div>
      <div class="msh-goal-list">${state.goals.map(goal=>`<button type="button" data-goal="${esc(goal.id)}"><span>${esc(goal.label)}</span><strong>${money(goal.current)} <small>of ${money(goal.target)}</small></strong><i><b style="width:${percent(goal.current,goal.target)}%"></b></i></button>`).join('')}</div>
      <p class="msh-financial-note">These are your directions, not required stages. You decide what matters and in what order.</p>
    </section>`;
  }

  function prepare() {
    return `<section class="msh-financial-board"><div class="msh-financial-board-head"><div><p>Prepare</p><h2>Make room for what life may need.</h2></div><button type="button" data-action="add-upcoming">+ Add</button></div>
      <div class="msh-prepare-grid"><article><span>Emergency cushion</span><strong>${money((state.goals.find(x=>x.id==='emergency')||{}).current)}</strong><p>Keep a reserve visible without turning preparedness into a judgment.</p></article><article><span>Upcoming</span>${state.upcoming.length?state.upcoming.map(x=>`<p><strong>${esc(x.label)}</strong><br><small>${esc(x.when||'')} ${x.amount?`· ${money(x.amount)}`:''}</small></p>`).join(''):'<p>Nothing added yet.</p>'}</article></div>
    </section>`;
  }

  function learn() {
    return `<section class="msh-financial-board"><div class="msh-financial-board-head"><div><p>Learn</p><h2>Notice change in context.</h2></div></div>
      <div class="msh-learning-prompts"><article><span>Food</span><h3>Was food more expensive, or did what you bought change?</h3><p>Grocery prices, restaurant spending, inventory, and purchasing behavior can be understood separately before drawing a conclusion.</p></article><article><span>Life around the numbers</span><h3>What was happening around this time?</h3><p>Work, health, capacity, transportation, family needs, and other circumstances can shape financial behavior. A pattern is something to explore, not automatic proof of cause.</p></article></div>
    </section>`;
  }

  function editor() {
    return `<dialog class="msh-financial-dialog" data-financial-dialog><form method="dialog" data-picture-form><header><p>Current picture</p><h2>Adjust what is true now.</h2></header><label>Monthly income<input name="income" type="number" min="0" step="0.01" value="${Number(state.income)||0}"></label><div class="msh-financial-fields">${state.categories.map(item=>`<label>${esc(item.label)}<input name="category:${esc(item.id)}" type="number" min="0" step="0.01" value="${Number(item.amount)||0}"></label>`).join('')}</div><div class="msh-dialog-actions"><button value="cancel">Cancel</button><button value="default" data-save-picture>Save picture</button></div></form></dialog>`;
  }

  function render() {
    const content = { picture:picture, spending, build, prepare, learn }[view]();
    root.innerHTML = `<nav class="msh-financial-nav" aria-label="Financial Health"><button data-view="picture" ${view==='picture'?'aria-current="page"':''}>Current picture</button><button data-view="spending" ${view==='spending'?'aria-current="page"':''}>Spending</button><button data-view="prepare" ${view==='prepare'?'aria-current="page"':''}>Prepare</button><button data-view="build" ${view==='build'?'aria-current="page"':''}>Build</button><button data-view="learn" ${view==='learn'?'aria-current="page"':''}>Learn</button></nav>${content}${editor()}`;
  }

  root.addEventListener('click', event => {
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) { view=viewButton.dataset.view; render(); return; }
    const action = event.target.closest('[data-action]');
    if (action && action.dataset.action==='edit-picture') { root.querySelector('[data-financial-dialog]').showModal(); return; }
    if (action && action.dataset.action==='add-goal') {
      const label=prompt('What are you building toward?'); if(!label) return;
      const target=Number(prompt('Target amount?')||0); state.goals.push({id:'goal_'+Date.now(),label:label.trim().slice(0,80),current:0,target:Math.max(0,target)}); save(); render(); return;
    }
    if (action && action.dataset.action==='add-upcoming') {
      const label=prompt('What are you preparing for?'); if(!label) return;
      const when=prompt('When? (optional)')||''; const amount=Number(prompt('Expected amount? (optional)')||0);
      state.upcoming.push({id:'upcoming_'+Date.now(),label:label.trim().slice(0,80),when:when.trim().slice(0,80),amount:Math.max(0,amount)}); save(); render(); return;
    }
    const goalButton=event.target.closest('[data-goal]');
    if(goalButton){ const goal=state.goals.find(x=>x.id===goalButton.dataset.goal); if(!goal)return; const current=prompt(`How much is currently set aside for ${goal.label}?`,goal.current); if(current===null)return; goal.current=Math.max(0,Number(current)||0); save(); render(); }
  });

  root.addEventListener('click', event => {
    if(!event.target.matches('[data-save-picture]')) return;
    event.preventDefault(); const form=event.target.closest('form'); const data=new FormData(form);
    state.income=Math.max(0,Number(data.get('income'))||0);
    state.categories=state.categories.map(item=>({...item,amount:Math.max(0,Number(data.get(`category:${item.id}`))||0)})); save(); root.querySelector('[data-financial-dialog]').close(); render();
  });

  render();
})();