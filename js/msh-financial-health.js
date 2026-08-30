/* My Simple Health — comprehensive, customizable Financial Health workspace */
(function () {
  'use strict';
  const root = document.querySelector('[data-financial-health]');
  if (!root) return;

  const KEY = 'msh_financial_health_v2';
  const OLD_KEY = 'msh_financial_health_v1';
  const MODULES = [
    ['income','Income & targets'],['housing','Housing'],['household','Food & household'],['transportation','Transportation'],
    ['insurance','Insurance & healthcare'],['family','Family & children'],['pets','Pets'],['personal','Personal & lifestyle'],
    ['debt','Debt'],['emergency','Emergency savings'],['investments','Investments'],['future','Long-term planning']
  ];

  const defaults = {
    household: { adults:2, children:0, pets:2 },
    income: { monthlyNet:10000, annualGross:160000, minimumAnnual:96000, comfortableAnnual:120000, maximumAnnual:190000 },
    enabledModules: MODULES.map(([id]) => id),
    expenses: [
      {id:'housing',module:'housing',label:'Housing',amount:3100},
      {id:'utilities',module:'housing',label:'Utilities',amount:425},
      {id:'groceries',module:'household',label:'Groceries',amount:1300},
      {id:'household',module:'household',label:'Household + toiletries',amount:300},
      {id:'dining',module:'household',label:'Dining out',amount:300},
      {id:'transportation',module:'transportation',label:'Transportation',amount:1000},
      {id:'health-insurance',module:'insurance',label:'Health / dental / vision insurance',amount:750},
      {id:'life-insurance',module:'insurance',label:'Life insurance',amount:70},
      {id:'baby-care',module:'family',label:'Baby care',amount:0},
      {id:'education',module:'family',label:'Education / homeschool',amount:0},
      {id:'pets',module:'pets',label:'Pet care',amount:300},
      {id:'personal',module:'personal',label:'Personal & entertainment',amount:675},
      {id:'misc',module:'personal',label:'Miscellaneous',amount:325},
      {id:'debt',module:'debt',label:'Debt payments',amount:500},
      {id:'emergency',module:'emergency',label:'Emergency fund contribution',amount:1000},
      {id:'retirement',module:'investments',label:'Retirement contributions',amount:1950},
      {id:'ira',module:'investments',label:'IRA contributions',amount:1166},
      {id:'hsa',module:'investments',label:'HSA contribution',amount:0}
    ],
    housing: {
      homePrice:400000, downPayment:80000, mortgageRate:7.1, mortgageYears:30,
      mortgagePayment:2059, propertyTaxRate:0.85, homeownersInsurance:220, hoa:250,
      maintenanceMonthly:400, utilitiesMonthly:425, closingCosts:3600
    },
    emergency: { current:0, target:60000, monthlyContribution:1000, monthsOfExpenses:6 },
    investments: [
      {id:'retirement',label:'401(k) / workplace retirement',monthly:1958,annualMax:23500,enabled:true},
      {id:'ira',label:'Roth / spousal IRA',monthly:1166,annualMax:14000,enabled:true},
      {id:'hsa',label:'HSA',monthly:712,annualMax:8550,enabled:false},
      {id:'life',label:'Life insurance / long-term protection',monthly:100,annualMax:0,enabled:true}
    ],
    goals: [
      {id:'emergency',label:'Emergency fund',current:0,target:60000,module:'emergency'},
      {id:'home',label:'Home / housing reserve',current:0,target:80000,module:'housing'},
      {id:'retirement',label:'Retirement',current:0,target:150000,module:'investments'},
      {id:'custom-wealth',label:'Fully fund investment accounts',current:0,target:58000,module:'investments'}
    ],
    notes: {
      lifestyle:'Planning assumptions are personal. Income targets and category amounts are editable and are not universal requirements.',
      housing:'Housing can include mortgage principal and interest, property taxes, homeowners insurance, HOA, PMI when applicable, maintenance, utilities, and one-time closing costs.',
      emergency:'Emergency savings may cover home and car repairs, deductibles, medical costs, and pet emergencies.'
    },
    updatedAt:null
  };

  const clone = value => JSON.parse(JSON.stringify(value));
  const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value)||0);
  const esc = value => String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const uid = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const enabled = id => state.enabledModules.includes(id);

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved && typeof saved === 'object') return merge(saved);
      const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
      if (old && typeof old === 'object') {
        const migrated = clone(defaults);
        migrated.income.monthlyNet = Number(old.income)||migrated.income.monthlyNet;
        if (Array.isArray(old.goals)) migrated.goals = old.goals.map(g=>({...g,module:g.id==='home'?'housing':g.id==='emergency'?'emergency':'investments'}));
        return migrated;
      }
    } catch (_) {}
    return clone(defaults);
  }

  function merge(saved) {
    const next = clone(defaults);
    Object.assign(next, saved);
    next.household = {...defaults.household,...(saved.household||{})};
    next.income = {...defaults.income,...(saved.income||{})};
    next.housing = {...defaults.housing,...(saved.housing||{})};
    next.emergency = {...defaults.emergency,...(saved.emergency||{})};
    next.notes = {...defaults.notes,...(saved.notes||{})};
    next.enabledModules = Array.isArray(saved.enabledModules) ? saved.enabledModules : defaults.enabledModules.slice();
    next.expenses = Array.isArray(saved.expenses) ? saved.expenses : clone(defaults.expenses);
    next.investments = Array.isArray(saved.investments) ? saved.investments : clone(defaults.investments);
    next.goals = Array.isArray(saved.goals) ? saved.goals : clone(defaults.goals);
    return next;
  }

  let state = load();
  let view = 'picture';
  function save(){ state.updatedAt=new Date().toISOString(); localStorage.setItem(KEY,JSON.stringify(state)); }
  function visibleExpenses(){ return state.expenses.filter(item=>enabled(item.module)); }
  function totalExpenses(){ return visibleExpenses().reduce((sum,item)=>sum+(Number(item.amount)||0),0); }
  function available(){ return (Number(state.income.monthlyNet)||0)-totalExpenses(); }
  function pct(a,b){ return Number(b)>0?Math.min(100,Math.max(0,(Number(a)||0)/(Number(b)||1)*100)):0; }
  function moduleLabel(id){ return (MODULES.find(([key])=>key===id)||[id,id])[1]; }

  function toolbar(){
    return `<div class="msh-financial-toolbar"><div><span>${state.enabledModules.length} of ${MODULES.length} sections included</span><small>Keep only what belongs in your financial picture.</small></div><button type="button" data-action="customize">Customize</button></div>`;
  }

  function picture(){
    const monthly=Number(state.income.monthlyNet)||0, expenses=totalExpenses(), remaining=available();
    const annualExpenses=expenses*12;
    return `<section class="msh-financial-board"><div class="msh-financial-board-head"><div><p>Current picture</p><h2>Your money, in context.</h2></div><button data-action="edit-income">Edit income</button></div>
      <div class="msh-financial-summary-grid">
        <article><span>Monthly net income</span><strong>${money(monthly)}</strong></article>
        <article><span>Included monthly expenses</span><strong>${money(expenses)}</strong></article>
        <article><span>Available to direct</span><strong>${money(remaining)}</strong></article>
        <article><span>Annualized included expenses</span><strong>${money(annualExpenses)}</strong></article>
      </div>
      ${enabled('income')?`<div class="msh-income-targets"><div><span>Planning range</span><strong>${money(state.income.minimumAnnual)} – ${money(state.income.comfortableAnnual)}</strong><small>Minimum / more modest planning target</small></div><div><span>Higher target</span><strong>${money(state.income.maximumAnnual)}</strong><small>For a more expensive lifestyle or aggressive investing</small></div></div>`:''}
      <p class="msh-financial-note">${esc(state.notes.lifestyle)}</p>
    </section>`;
  }

  function expenses(){
    const groups = MODULES.map(([id,label])=>({id,label,items:visibleExpenses().filter(x=>x.module===id)})).filter(group=>group.items.length);
    return `<section class="msh-financial-board"><div class="msh-financial-board-head"><div><p>Expenses</p><h2>What does your life actually cost?</h2></div><button data-action="add-expense">+ Add expense</button></div>
      <div class="msh-expense-groups">${groups.map(group=>`<section><header><h3>${esc(group.label)}</h3><strong>${money(group.items.reduce((s,x)=>s+(Number(x.amount)||0),0))}/mo.</strong></header>${group.items.map(item=>`<button class="msh-expense-row" data-expense="${esc(item.id)}"><span>${esc(item.label)}</span><strong>${money(item.amount)}</strong></button>`).join('')}</section>`).join('')}</div>
      <p class="msh-financial-note">Tap any line to edit it. Add, rename, or remove expenses so the model reflects the household instead of forcing a standard budget.</p>
    </section>`;
  }

  function housing(){
    const h=state.housing;
    const downPct=h.homePrice?Math.round(h.downPayment/h.homePrice*100):0;
    const monthly=h.mortgagePayment+h.homeownersInsurance+h.hoa+h.maintenanceMonthly+h.utilitiesMonthly+(h.homePrice*h.propertyTaxRate/100/12);
    return `<section class="msh-financial-board"><div class="msh-financial-board-head"><div><p>Housing</p><h2>See the whole cost of home.</h2></div><button data-action="edit-housing">Adjust scenario</button></div>
      <div class="msh-housing-hero"><div><span>Home price</span><strong>${money(h.homePrice)}</strong><small>${money(h.downPayment)} down · ${downPct}%</small></div><div><span>Estimated ongoing monthly housing</span><strong>${money(monthly)}</strong><small>Including selected ownership costs and utilities</small></div></div>
      <div class="msh-detail-grid">
        ${[['Mortgage + interest',h.mortgagePayment],['Property tax',h.homePrice*h.propertyTaxRate/100/12],['Homeowners insurance',h.homeownersInsurance],['HOA',h.hoa],['Maintenance reserve',h.maintenanceMonthly],['Utilities',h.utilitiesMonthly]].map(([label,value])=>`<div><span>${label}</span><strong>${money(value)}</strong></div>`).join('')}
      </div>
      <div class="msh-housing-note"><strong>Also plan for one-time and conditional costs.</strong><p>Closing costs ${money(h.closingCosts)} in this scenario. PMI can apply until sufficient equity is reached. Repairs and maintenance can vary significantly by home age and condition.</p></div>
      <p class="msh-financial-note">${esc(state.notes.housing)}</p>
    </section>`;
  }

  function prepare(){
    const emergency=state.emergency;
    const months=emergency.monthlyContribution>0?Math.ceil(Math.max(0,emergency.target-emergency.current)/emergency.monthlyContribution):null;
    const familyItems=visibleExpenses().filter(x=>x.module==='family');
    return `<section class="msh-financial-board"><div class="msh-financial-board-head"><div><p>Prepare</p><h2>Make room for what life may need.</h2></div><button data-action="edit-emergency">Edit emergency plan</button></div>
      ${enabled('emergency')?`<div class="msh-emergency-card"><span>Emergency fund</span><strong>${money(emergency.current)} <small>of ${money(emergency.target)}</small></strong><i><b style="width:${pct(emergency.current,emergency.target)}%"></b></i><p>${money(emergency.monthlyContribution)}/month${months!==null?` · about ${months} months to target at this contribution`:''}</p></div>`:''}
      ${enabled('family')?`<div class="msh-family-context"><div><span>Household</span><strong>${state.household.adults} adult${state.household.adults===1?'':'s'} · ${state.household.children} child${state.household.children===1?'':'ren'} · ${state.household.pets} pet${state.household.pets===1?'':'s'}</strong></div><div><span>Family-related monthly items currently included</span><strong>${money(familyItems.reduce((s,x)=>s+(Number(x.amount)||0),0))}</strong></div><button data-action="edit-household">Change household</button></div>`:''}
      <p class="msh-financial-note">${esc(state.notes.emergency)}</p>
    </section>`;
  }

  function build(){
    const activeGoals=state.goals.filter(goal=>enabled(goal.module));
    const accounts=state.investments.filter(item=>enabled('investments')&&item.enabled);
    return `<section class="msh-financial-board"><div class="msh-financial-board-head"><div><p>Build</p><h2>What are you building toward?</h2></div><button data-action="add-goal">+ Add goal</button></div>
      <div class="msh-goal-list">${activeGoals.map(goal=>`<button type="button" data-goal="${esc(goal.id)}"><span>${esc(goal.label)}</span><strong>${money(goal.current)} <small>of ${money(goal.target)}</small></strong><i><b style="width:${pct(goal.current,goal.target)}%"></b></i></button>`).join('')||'<p>No goals included yet.</p>'}</div>
      ${accounts.length?`<div class="msh-investment-section"><header><div><span>Investment plan</span><h3>Accounts you chose to include</h3></div><button data-action="edit-investments">Edit accounts</button></header>${accounts.map(item=>`<div><span>${esc(item.label)}</span><strong>${money(item.monthly)}/mo.</strong><small>${item.annualMax?`${money(item.annualMax)}/yr planning ceiling in this saved scenario`:''}</small></div>`).join('')}<footer><span>Total selected monthly contributions</span><strong>${money(accounts.reduce((s,x)=>s+(Number(x.monthly)||0),0))}</strong></footer></div>`:''}
      <p class="msh-financial-note">Goals are directions, not required stages. Contribution limits and tax rules change over time, so saved account ceilings are planning assumptions, not live regulatory guidance.</p>
    </section>`;
  }

  function learn(){
    return `<section class="msh-financial-board"><div class="msh-financial-board-head"><div><p>Learn</p><h2>Notice patterns without turning them into judgments.</h2></div></div><div class="msh-learning-prompts">
      <article><span>Housing</span><h3>What part of housing changed?</h3><p>Mortgage, taxes, insurance, utilities, maintenance, and one-time costs can move differently.</p></article>
      <article><span>Food & household</span><h3>Was spending higher, or was the household need different?</h3><p>Groceries, toiletries, household supplies, dining, and family size can be separated before drawing a conclusion.</p></article>
      <article><span>Family context</span><h3>What changed around this period?</h3><p>Pregnancy, a baby, healthcare, education, pets, work, transportation, and household capacity can all change the financial picture.</p></article>
      <article><span>Planning</span><h3>Does the current target still fit the life you are planning?</h3><p>Income, emergency savings, housing, and investing targets should remain editable as priorities and circumstances change.</p></article>
    </div></section>`;
  }

  function nav(){
    const views=[['picture','Picture'],['expenses','Expenses']];
    if(enabled('housing')) views.push(['housing','Housing']);
    if(enabled('emergency')||enabled('family')) views.push(['prepare','Prepare']);
    if(enabled('investments')||state.goals.some(g=>enabled(g.module))) views.push(['build','Build']);
    views.push(['learn','Learn']);
    if(!views.some(([id])=>id===view)) view='picture';
    return `<nav class="msh-financial-nav" aria-label="Financial Health">${views.map(([id,label])=>`<button data-view="${id}" ${view===id?'aria-current="page"':''}>${label}</button>`).join('')}</nav>`;
  }

  function customizeDialog(){
    return `<dialog class="msh-financial-dialog" data-customize-dialog><form method="dialog" data-customize-form><header><p>Customize</p><h2>What belongs in your financial picture?</h2></header><p class="msh-dialog-copy">Turn sections on or off. Your saved values stay intact when a section is hidden.</p><div class="msh-module-grid">${MODULES.map(([id,label])=>`<label><input type="checkbox" name="module" value="${id}" ${enabled(id)?'checked':''}><span>${esc(label)}</span></label>`).join('')}</div><div class="msh-dialog-actions"><button value="cancel">Cancel</button><button value="default" data-save-customize>Save sections</button></div></form></dialog>`;
  }

  function addExpenseDialog(){
    return `<dialog class="msh-financial-dialog" data-expense-dialog><form method="dialog" data-expense-form><header><p>Expense</p><h2>Add something that matters.</h2></header><div class="msh-financial-fields"><label>Name<input name="label" required maxlength="80"></label><label>Monthly amount<input name="amount" type="number" min="0" step="0.01" required></label><label>Section<select name="module">${MODULES.map(([id,label])=>`<option value="${id}">${esc(label)}</option>`).join('')}</select></label></div><div class="msh-dialog-actions"><button value="cancel">Cancel</button><button value="default" data-save-expense>Add expense</button></div></form></dialog>`;
  }

  function render(){
    const content={picture,expenses,housing,prepare,build,learn}[view]();
    root.innerHTML=`${toolbar()}${nav()}${content}${customizeDialog()}${addExpenseDialog()}`;
  }

  function promptNumber(label,current){ const value=prompt(label,String(Number(current)||0)); return value===null?null:Math.max(0,Number(value)||0); }

  root.addEventListener('click', event=>{
    const viewButton=event.target.closest('[data-view]'); if(viewButton){view=viewButton.dataset.view;render();return;}
    const action=event.target.closest('[data-action]');
    if(action){
      const type=action.dataset.action;
      if(type==='customize'){root.querySelector('[data-customize-dialog]').showModal();return;}
      if(type==='add-expense'){root.querySelector('[data-expense-dialog]').showModal();return;}
      if(type==='edit-income'){
        const monthly=promptNumber('Monthly net income',state.income.monthlyNet); if(monthly===null)return;
        const gross=promptNumber('Annual gross income',state.income.annualGross); if(gross===null)return;
        const min=promptNumber('Lower annual planning target',state.income.minimumAnnual); if(min===null)return;
        const comfortable=promptNumber('Comfortable annual planning target',state.income.comfortableAnnual); if(comfortable===null)return;
        const max=promptNumber('Higher annual planning target',state.income.maximumAnnual); if(max===null)return;
        Object.assign(state.income,{monthlyNet:monthly,annualGross:gross,minimumAnnual:min,comfortableAnnual:comfortable,maximumAnnual:max});save();render();return;
      }
      if(type==='edit-housing'){
        for(const [key,label] of [['homePrice','Home price'],['downPayment','Down payment'],['mortgagePayment','Monthly mortgage + interest'],['propertyTaxRate','Property tax rate (%)'],['homeownersInsurance','Monthly homeowners insurance'],['hoa','Monthly HOA'],['maintenanceMonthly','Monthly maintenance reserve'],['utilitiesMonthly','Monthly utilities'],['closingCosts','One-time closing costs']]){const value=promptNumber(label,state.housing[key]);if(value===null)return;state.housing[key]=value;} save();render();return;
      }
      if(type==='edit-emergency'){
        const current=promptNumber('Emergency savings currently available',state.emergency.current);if(current===null)return;
        const target=promptNumber('Emergency fund target',state.emergency.target);if(target===null)return;
        const contribution=promptNumber('Monthly emergency fund contribution',state.emergency.monthlyContribution);if(contribution===null)return;
        Object.assign(state.emergency,{current,target,monthlyContribution:contribution});save();render();return;
      }
      if(type==='edit-household'){
        const adults=promptNumber('Adults in household',state.household.adults);if(adults===null)return;
        const children=promptNumber('Children in household',state.household.children);if(children===null)return;
        const pets=promptNumber('Pets in household',state.household.pets);if(pets===null)return;
        Object.assign(state.household,{adults:Math.round(adults),children:Math.round(children),pets:Math.round(pets)});save();render();return;
      }
      if(type==='add-goal'){
        const label=prompt('What are you building toward?');if(!label)return;const target=promptNumber('Target amount',0);if(target===null)return;state.goals.push({id:uid('goal'),label:label.trim().slice(0,80),current:0,target,module:'future'});if(!enabled('future'))state.enabledModules.push('future');save();render();return;
      }
      if(type==='edit-investments'){
        state.investments.forEach(item=>{const active=confirm(`Include ${item.label}?`);item.enabled=active;if(active){const monthly=promptNumber(`Monthly contribution for ${item.label}`,item.monthly);if(monthly!==null)item.monthly=monthly;}});save();render();return;
      }
    }
    const expenseButton=event.target.closest('[data-expense]');if(expenseButton){const item=state.expenses.find(x=>x.id===expenseButton.dataset.expense);if(!item)return;const amount=promptNumber(`${item.label} monthly amount`,item.amount);if(amount===null)return;item.amount=amount;save();render();return;}
    const goalButton=event.target.closest('[data-goal]');if(goalButton){const goal=state.goals.find(x=>x.id===goalButton.dataset.goal);if(!goal)return;const current=promptNumber(`Current amount for ${goal.label}`,goal.current);if(current===null)return;const target=promptNumber(`Target for ${goal.label}`,goal.target);if(target===null)return;goal.current=current;goal.target=target;save();render();}
  });

  root.addEventListener('click',event=>{
    if(event.target.matches('[data-save-customize]')){event.preventDefault();const form=event.target.closest('form');state.enabledModules=[...new FormData(form).getAll('module')];save();form.closest('dialog').close();render();}
    if(event.target.matches('[data-save-expense]')){event.preventDefault();const form=event.target.closest('form');const data=new FormData(form);const label=String(data.get('label')||'').trim();if(!label)return;const module=String(data.get('module')||'personal');state.expenses.push({id:uid('expense'),module,label:label.slice(0,80),amount:Math.max(0,Number(data.get('amount'))||0)});if(!enabled(module))state.enabledModules.push(module);save();form.closest('dialog').close();render();}
  });

  render();
})();