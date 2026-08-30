/* My Simple Health — comprehensive, customizable Financial Health workspace */
(function () {
  'use strict';
  const root = document.querySelector('[data-financial-health]');
  if (!root) return;

  const KEY = 'msh_financial_health_v3';
  const PREVIOUS_KEYS = ['msh_financial_health_v2','msh_financial_health_v1'];
  const BASE_MODULES = [
    ['income','Income & targets'],['housing','Housing'],['household','Food & household'],['transportation','Transportation'],
    ['insurance','Insurance & healthcare'],['family','Family & children'],['pets','Pets'],['personal','Personal & lifestyle'],
    ['debt','Debt'],['emergency','Emergency savings'],['investments','Investments'],['future','Long-term planning']
  ];
  const SUGGESTED_AREAS = ['Toiletries','Skincare','Makeup','Menstrual care','Medicine','Subscriptions','Diapers & baby supplies','Candles & home fragrance','Hair care','Clothing & shoes','Dining out','Pet supplies'];

  const defaults = {
    household:{adults:2,children:0,pets:2},
    income:{monthlyNet:10000,annualGross:160000,minimumAnnual:96000,comfortableAnnual:120000,maximumAnnual:190000},
    enabledModules:BASE_MODULES.map(([id])=>id),
    customAreas:[],
    expenses:[
      {id:'housing',module:'housing',label:'Housing',amount:3100,type:'recurring'},
      {id:'utilities',module:'housing',label:'Utilities',amount:425,type:'variable'},
      {id:'groceries',module:'household',label:'Groceries',amount:1300,type:'variable'},
      {id:'household',module:'household',label:'Household supplies',amount:300,type:'regular'},
      {id:'transportation',module:'transportation',label:'Transportation',amount:1000,type:'variable'},
      {id:'health-insurance',module:'insurance',label:'Health / dental / vision insurance',amount:750,type:'recurring'},
      {id:'life-insurance',module:'insurance',label:'Life insurance',amount:70,type:'recurring'},
      {id:'pets',module:'pets',label:'Pet care',amount:300,type:'regular'},
      {id:'debt',module:'debt',label:'Debt payments',amount:500,type:'recurring'},
      {id:'emergency',module:'emergency',label:'Emergency fund contribution',amount:1000,type:'recurring'},
      {id:'retirement',module:'investments',label:'Retirement contributions',amount:1950,type:'recurring'}
    ],
    housing:{homePrice:400000,downPayment:80000,mortgageRate:7.1,mortgageYears:30,mortgagePayment:2059,propertyTaxRate:0.85,homeownersInsurance:220,hoa:250,maintenanceMonthly:400,utilitiesMonthly:425,closingCosts:3600},
    emergency:{current:0,target:60000,monthlyContribution:1000,monthsOfExpenses:6},
    investments:[
      {id:'retirement',label:'401(k) / workplace retirement',monthly:1958,annualMax:23500,enabled:true},
      {id:'ira',label:'Roth / spousal IRA',monthly:1166,annualMax:14000,enabled:true},
      {id:'hsa',label:'HSA',monthly:712,annualMax:8550,enabled:false},
      {id:'life',label:'Life insurance / long-term protection',monthly:100,annualMax:0,enabled:true}
    ],
    goals:[
      {id:'emergency',label:'Emergency fund',current:0,target:60000,module:'emergency'},
      {id:'home',label:'Home / housing reserve',current:0,target:80000,module:'housing'},
      {id:'retirement',label:'Retirement',current:0,target:150000,module:'investments'}
    ],
    notes:{
      lifestyle:'Planning assumptions are personal. Income targets and category amounts are editable and are not universal requirements.',
      housing:'Housing can include mortgage principal and interest, property taxes, homeowners insurance, HOA, PMI when applicable, maintenance, utilities, and one-time closing costs.',
      emergency:'Emergency savings may cover home and car repairs, deductibles, medical costs, and pet emergencies.'
    },
    updatedAt:null
  };

  const clone=v=>JSON.parse(JSON.stringify(v));
  const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(v)||0);
  const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const uid=p=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;

  function modules(){ return [...BASE_MODULES,...state.customAreas.map(a=>[a.id,a.label])]; }
  function moduleLabel(id){ return (modules().find(([key])=>key===id)||[id,id])[1]; }
  function enabled(id){ return state.enabledModules.includes(id); }
  function merge(saved){
    const next=clone(defaults); Object.assign(next,saved);
    next.household={...defaults.household,...(saved.household||{})};
    next.income={...defaults.income,...(saved.income||{})};
    next.housing={...defaults.housing,...(saved.housing||{})};
    next.emergency={...defaults.emergency,...(saved.emergency||{})};
    next.notes={...defaults.notes,...(saved.notes||{})};
    next.customAreas=Array.isArray(saved.customAreas)?saved.customAreas:[];
    next.enabledModules=Array.isArray(saved.enabledModules)?saved.enabledModules:defaults.enabledModules.slice();
    next.expenses=Array.isArray(saved.expenses)?saved.expenses:clone(defaults.expenses);
    next.investments=Array.isArray(saved.investments)?saved.investments:clone(defaults.investments);
    next.goals=Array.isArray(saved.goals)?saved.goals:clone(defaults.goals);
    return next;
  }
  function load(){
    try{
      const current=JSON.parse(localStorage.getItem(KEY)||'null'); if(current&&typeof current==='object') return merge(current);
      for(const oldKey of PREVIOUS_KEYS){const old=JSON.parse(localStorage.getItem(oldKey)||'null');if(old&&typeof old==='object')return merge(old);}
    }catch(_){ }
    return clone(defaults);
  }

  let state=load(); let view='picture';
  function save(){state.updatedAt=new Date().toISOString();localStorage.setItem(KEY,JSON.stringify(state));}
  function visibleExpenses(){return state.expenses.filter(item=>enabled(item.module));}
  function totalExpenses(){return visibleExpenses().reduce((s,x)=>s+(Number(x.amount)||0),0);}
  function available(){return (Number(state.income.monthlyNet)||0)-totalExpenses();}
  function pct(a,b){return Number(b)>0?Math.min(100,Math.max(0,(Number(a)||0)/(Number(b)||1)*100)):0;}

  function toolbar(){
    const total=modules().length;
    return `<div class="msh-financial-toolbar"><div><span>${state.enabledModules.length} of ${total} areas included</span><small>Build a financial picture around the things you actually pay for.</small></div><div class="msh-toolbar-actions"><button type="button" data-action="add-area">+ Add custom area</button><button type="button" data-action="customize">Customize</button></div></div>`;
  }

  function picture(){
    const expenses=totalExpenses();
    return `<section class="msh-financial-board"><div class="msh-financial-board-head"><div><p>Current picture</p><h2>Your money, in context.</h2></div><button data-action="edit-income">Edit income</button></div>
      <div class="msh-financial-summary-grid"><article><span>Monthly net income</span><strong>${money(state.income.monthlyNet)}</strong></article><article><span>Included monthly expenses</span><strong>${money(expenses)}</strong></article><article><span>Available to direct</span><strong>${money(available())}</strong></article><article><span>Annualized included expenses</span><strong>${money(expenses*12)}</strong></article></div>
      ${enabled('income')?`<div class="msh-income-targets"><div><span>Planning range</span><strong>${money(state.income.minimumAnnual)} – ${money(state.income.comfortableAnnual)}</strong><small>Editable lower / more comfortable target</small></div><div><span>Higher target</span><strong>${money(state.income.maximumAnnual)}</strong><small>Editable lifestyle / investing target</small></div></div>`:''}
      <p class="msh-financial-note">${esc(state.notes.lifestyle)}</p></section>`;
  }

  function expenses(){
    const groups=modules().map(([id,label])=>({id,label,items:visibleExpenses().filter(x=>x.module===id)})).filter(g=>g.items.length||state.customAreas.some(a=>a.id===g.id&&enabled(a.id)));
    return `<section class="msh-financial-board"><div class="msh-financial-board-head"><div><p>Expenses</p><h2>What does your life actually cost?</h2></div><button data-action="add-expense">+ Add item</button></div>
      <div class="msh-expense-groups">${groups.map(group=>`<section class="msh-expense-area"><header><div><h3>${esc(group.label)}</h3><small>${group.items.length} item${group.items.length===1?'':'s'}</small></div><strong>${money(group.items.reduce((s,x)=>s+(Number(x.amount)||0),0))}/mo.</strong></header>${group.items.map(item=>`<button class="msh-expense-row" data-expense="${esc(item.id)}"><span><b>${esc(item.label)}</b><small>${esc(item.type||'expense')}</small></span><strong>${money(item.amount)}</strong></button>`).join('')||'<p class="msh-area-empty">Nothing tracked here yet.</p>'}${state.customAreas.some(a=>a.id===group.id)?`<footer><button data-add-to-area="${esc(group.id)}">+ Add to ${esc(group.label)}</button><button data-edit-area="${esc(group.id)}">Edit area</button></footer>`:''}</section>`).join('')}</div>
      <p class="msh-financial-note">Custom areas can be as specific as you want: Toiletries, Skincare, Makeup, Menstrual Care, Medicine, Subscriptions, Diapers, Candles, or anything else that regularly costs money.</p></section>`;
  }

  function housing(){
    const h=state.housing, downPct=h.homePrice?Math.round(h.downPayment/h.homePrice*100):0;
    const monthly=h.mortgagePayment+h.homeownersInsurance+h.hoa+h.maintenanceMonthly+h.utilitiesMonthly+(h.homePrice*h.propertyTaxRate/100/12);
    return `<section class="msh-financial-board"><div class="msh-financial-board-head"><div><p>Housing</p><h2>See the whole cost of home.</h2></div><button data-action="edit-housing">Adjust scenario</button></div><div class="msh-housing-hero"><div><span>Home price</span><strong>${money(h.homePrice)}</strong><small>${money(h.downPayment)} down · ${downPct}%</small></div><div><span>Estimated monthly housing</span><strong>${money(monthly)}</strong><small>Selected ownership costs + utilities</small></div></div><div class="msh-detail-grid">${[['Mortgage + interest',h.mortgagePayment],['Property tax',h.homePrice*h.propertyTaxRate/100/12],['Homeowners insurance',h.homeownersInsurance],['HOA',h.hoa],['Maintenance reserve',h.maintenanceMonthly],['Utilities',h.utilitiesMonthly]].map(([l,v])=>`<div><span>${l}</span><strong>${money(v)}</strong></div>`).join('')}</div><div class="msh-housing-note"><strong>Also plan for one-time and conditional costs.</strong><p>Closing costs ${money(h.closingCosts)} in this scenario. PMI can apply until sufficient equity is reached.</p></div><p class="msh-financial-note">${esc(state.notes.housing)}</p></section>`;
  }

  function prepare(){
    const e=state.emergency, months=e.monthlyContribution>0?Math.ceil(Math.max(0,e.target-e.current)/e.monthlyContribution):null;
    return `<section class="msh-financial-board"><div class="msh-financial-board-head"><div><p>Prepare</p><h2>Make room for what life may need.</h2></div><button data-action="edit-emergency">Edit emergency plan</button></div>${enabled('emergency')?`<div class="msh-emergency-card"><span>Emergency fund</span><strong>${money(e.current)} <small>of ${money(e.target)}</small></strong><i><b style="width:${pct(e.current,e.target)}%"></b></i><p>${money(e.monthlyContribution)}/month${months!==null?` · about ${months} months to target`:''}</p></div>`:''}${enabled('family')?`<div class="msh-family-context"><div><span>Household</span><strong>${state.household.adults} adult${state.household.adults===1?'':'s'} · ${state.household.children} child${state.household.children===1?'':'ren'} · ${state.household.pets} pet${state.household.pets===1?'':'s'}</strong></div><button data-action="edit-household">Change household</button></div>`:''}<p class="msh-financial-note">${esc(state.notes.emergency)}</p></section>`;
  }

  function build(){
    const goals=state.goals.filter(g=>enabled(g.module)), accounts=state.investments.filter(i=>enabled('investments')&&i.enabled);
    return `<section class="msh-financial-board"><div class="msh-financial-board-head"><div><p>Build</p><h2>What are you building toward?</h2></div><button data-action="add-goal">+ Add goal</button></div><div class="msh-goal-list">${goals.map(g=>`<button data-goal="${esc(g.id)}"><span>${esc(g.label)}</span><strong>${money(g.current)} <small>of ${money(g.target)}</small></strong><i><b style="width:${pct(g.current,g.target)}%"></b></i></button>`).join('')||'<p>No goals included yet.</p>'}</div>${accounts.length?`<div class="msh-investment-section"><header><div><span>Investment plan</span><h3>Accounts you chose to include</h3></div><button data-action="edit-investments">Edit accounts</button></header>${accounts.map(i=>`<div><span>${esc(i.label)}</span><strong>${money(i.monthly)}/mo.</strong></div>`).join('')}<footer><span>Total selected monthly contributions</span><strong>${money(accounts.reduce((s,x)=>s+(Number(x.monthly)||0),0))}</strong></footer></div>`:''}</section>`;
  }

  function learn(){return `<section class="msh-financial-board"><div class="msh-financial-board-head"><div><p>Learn</p><h2>Notice patterns without turning them into judgments.</h2></div></div><div class="msh-learning-prompts"><article><span>Everyday costs</span><h3>What actually changed?</h3><p>Track specific recurring purchases so “miscellaneous” does not hide where money went.</p></article><article><span>Regular purchases</span><h3>Which costs repeat?</h3><p>Medicine, toiletries, skincare, subscriptions, diapers, pet supplies, and household products can each have their own history.</p></article></div></section>`;}

  function nav(){const views=[['picture','Picture'],['expenses','Expenses']];if(enabled('housing'))views.push(['housing','Housing']);if(enabled('emergency')||enabled('family'))views.push(['prepare','Prepare']);if(enabled('investments')||state.goals.some(g=>enabled(g.module)))views.push(['build','Build']);views.push(['learn','Learn']);if(!views.some(([id])=>id===view))view='picture';return `<nav class="msh-financial-nav" aria-label="Financial Health">${views.map(([id,l])=>`<button data-view="${id}" ${view===id?'aria-current="page"':''}>${l}</button>`).join('')}</nav>`;}

  function customizeDialog(){return `<dialog class="msh-financial-dialog" data-customize-dialog><form method="dialog" data-customize-form><header><p>Customize</p><h2>What belongs in your financial picture?</h2></header><p class="msh-dialog-copy">Turn areas on or off. Hidden areas keep their saved data.</p><div class="msh-module-grid">${modules().map(([id,label])=>`<label><input type="checkbox" name="module" value="${esc(id)}" ${enabled(id)?'checked':''}><span>${esc(label)}</span></label>`).join('')}</div><div class="msh-dialog-actions"><button value="cancel">Cancel</button><button value="default" data-save-customize>Save areas</button></div></form></dialog>`;}
  function areaDialog(){return `<dialog class="msh-financial-dialog" data-area-dialog><form method="dialog" data-area-form><header><p>Custom area</p><h2>Add a place your money goes.</h2></header><p class="msh-dialog-copy">Create your own category instead of forcing purchases into Miscellaneous.</p><label>Area name<input name="label" maxlength="60" required placeholder="Skincare"></label><div class="msh-suggestion-chips">${SUGGESTED_AREAS.map(x=>`<button type="button" data-area-suggestion="${esc(x)}">${esc(x)}</button>`).join('')}</div><div class="msh-dialog-actions"><button value="cancel">Cancel</button><button value="default" data-save-area>Add area</button></div></form></dialog>`;}
  function expenseDialog(prefillModule=''){return `<dialog class="msh-financial-dialog" data-expense-dialog><form method="dialog" data-expense-form><header><p>Expense item</p><h2>Track something you buy.</h2></header><div class="msh-financial-fields"><label>Name<input name="label" required maxlength="80" placeholder="Prescription medication"></label><label>Monthly amount<input name="amount" type="number" min="0" step="0.01" required></label><label>Area<select name="module">${modules().map(([id,label])=>`<option value="${esc(id)}" ${prefillModule===id?'selected':''}>${esc(label)}</option>`).join('')}</select></label><label>Pattern<select name="type"><option value="recurring">Recurring bill</option><option value="regular">Regular purchase</option><option value="variable">Variable</option><option value="occasional">Occasional</option><option value="annual">Annual / periodic</option><option value="one-time">One-time</option></select></label></div><div class="msh-dialog-actions"><button value="cancel">Cancel</button><button value="default" data-save-expense>Add item</button></div></form></dialog>`;}

  function render(){const content={picture,expenses,housing,prepare,build,learn}[view]();root.innerHTML=`${toolbar()}${nav()}${content}${customizeDialog()}${areaDialog()}${expenseDialog()}`;}
  function promptNumber(label,current){const v=prompt(label,String(Number(current)||0));return v===null?null:Math.max(0,Number(v)||0);}

  root.addEventListener('click',event=>{
    const viewButton=event.target.closest('[data-view]');if(viewButton){view=viewButton.dataset.view;render();return;}
    const suggestion=event.target.closest('[data-area-suggestion]');if(suggestion){const input=suggestion.closest('form').querySelector('[name="label"]');input.value=suggestion.dataset.areaSuggestion;input.focus();return;}
    const addToArea=event.target.closest('[data-add-to-area]');if(addToArea){const dialog=root.querySelector('[data-expense-dialog]');dialog.outerHTML=expenseDialog(addToArea.dataset.addToArea);root.querySelector('[data-expense-dialog]').showModal();return;}
    const editArea=event.target.closest('[data-edit-area]');if(editArea){const area=state.customAreas.find(a=>a.id===editArea.dataset.editArea);if(!area)return;const label=prompt('Area name',area.label);if(label===null)return;const trimmed=label.trim().slice(0,60);if(trimmed)area.label=trimmed;save();render();return;}
    const expenseButton=event.target.closest('[data-expense]');if(expenseButton){const item=state.expenses.find(x=>x.id===expenseButton.dataset.expense);if(!item)return;const label=prompt('Expense name',item.label);if(label===null)return;const amount=promptNumber(`${label||item.label} monthly amount`,item.amount);if(amount===null)return;item.label=(label.trim()||item.label).slice(0,80);item.amount=amount;save();render();return;}
    const goalButton=event.target.closest('[data-goal]');if(goalButton){const g=state.goals.find(x=>x.id===goalButton.dataset.goal);if(!g)return;const current=promptNumber(`Current amount for ${g.label}`,g.current);if(current===null)return;const target=promptNumber(`Target for ${g.label}`,g.target);if(target===null)return;g.current=current;g.target=target;save();render();return;}
    const action=event.target.closest('[data-action]');if(!action)return;const type=action.dataset.action;
    if(type==='customize'){root.querySelector('[data-customize-dialog]').showModal();return;}
    if(type==='add-area'){root.querySelector('[data-area-dialog]').showModal();return;}
    if(type==='add-expense'){root.querySelector('[data-expense-dialog]').showModal();return;}
    if(type==='edit-income'){const monthly=promptNumber('Monthly net income',state.income.monthlyNet);if(monthly===null)return;const gross=promptNumber('Annual gross income',state.income.annualGross);if(gross===null)return;Object.assign(state.income,{monthlyNet:monthly,annualGross:gross});save();render();return;}
    if(type==='edit-housing'){for(const [key,label] of [['homePrice','Home price'],['downPayment','Down payment'],['mortgagePayment','Monthly mortgage + interest'],['propertyTaxRate','Property tax rate (%)'],['homeownersInsurance','Monthly homeowners insurance'],['hoa','Monthly HOA'],['maintenanceMonthly','Monthly maintenance reserve'],['utilitiesMonthly','Monthly utilities'],['closingCosts','One-time closing costs']]){const value=promptNumber(label,state.housing[key]);if(value===null)return;state.housing[key]=value;}save();render();return;}
    if(type==='edit-emergency'){const current=promptNumber('Emergency savings currently available',state.emergency.current);if(current===null)return;const target=promptNumber('Emergency fund target',state.emergency.target);if(target===null)return;const contribution=promptNumber('Monthly emergency contribution',state.emergency.monthlyContribution);if(contribution===null)return;Object.assign(state.emergency,{current,target,monthlyContribution:contribution});save();render();return;}
    if(type==='edit-household'){const adults=promptNumber('Adults in household',state.household.adults);if(adults===null)return;const children=promptNumber('Children in household',state.household.children);if(children===null)return;const pets=promptNumber('Pets in household',state.household.pets);if(pets===null)return;Object.assign(state.household,{adults:Math.round(adults),children:Math.round(children),pets:Math.round(pets)});save();render();return;}
    if(type==='add-goal'){const label=prompt('What are you building toward?');if(!label)return;const target=promptNumber('Target amount',0);if(target===null)return;state.goals.push({id:uid('goal'),label:label.trim().slice(0,80),current:0,target,module:'future'});if(!enabled('future'))state.enabledModules.push('future');save();render();return;}
    if(type==='edit-investments'){state.investments.forEach(item=>{item.enabled=confirm(`Include ${item.label}?`);if(item.enabled){const monthly=promptNumber(`Monthly contribution for ${item.label}`,item.monthly);if(monthly!==null)item.monthly=monthly;}});save();render();}
  });

  root.addEventListener('click',event=>{
    if(event.target.matches('[data-save-customize]')){event.preventDefault();const form=event.target.closest('form');state.enabledModules=[...new FormData(form).getAll('module')];save();form.closest('dialog').close();render();}
    if(event.target.matches('[data-save-area]')){event.preventDefault();const form=event.target.closest('form');const label=String(new FormData(form).get('label')||'').trim();if(!label)return;const area={id:uid('area'),label:label.slice(0,60)};state.customAreas.push(area);state.enabledModules.push(area.id);save();form.closest('dialog').close();view='expenses';render();}
    if(event.target.matches('[data-save-expense]')){event.preventDefault();const form=event.target.closest('form');const data=new FormData(form);const label=String(data.get('label')||'').trim();if(!label)return;const module=String(data.get('module')||'personal');state.expenses.push({id:uid('expense'),module,label:label.slice(0,80),amount:Math.max(0,Number(data.get('amount'))||0),type:String(data.get('type')||'regular')});if(!enabled(module))state.enabledModules.push(module);save();form.closest('dialog').close();view='expenses';render();}
  });

  render();
})();