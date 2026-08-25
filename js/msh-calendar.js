/* My Simple Health — Calendar presentation with Cycle layer */
(function () {
  'use strict';
  const root = document.querySelector('[data-msh-calendar]');
  if (!root || !window.MSHStorage || !window.MSHCycle) return;
  const today = MSHCycle.toDateKey(new Date());
  const demoMode = new URLSearchParams(location.search).get('demo') === 'cycle-v2';
  let visibleMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let selectedDate = today;
  let activeView = 'calendar';
  let sheetOpen = false;
  let pointerStart = null;

  const esc = value => String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const prettyDate = (date, options) => MSHCycle.toDateKey(date) ? new Date(`${MSHCycle.toDateKey(date)}T12:00:00`).toLocaleDateString(undefined, options || {month:'short',day:'numeric'}) : '';
  function datesInRange(start, end) { const result=[]; for (let date=start; date<=end; date=MSHCycle.addDays(date,1)) result.push(date); return result; }
  function predictionsByDate(state) {
    const result = {};
    (state.calendar.predictions || []).forEach(prediction => datesInRange(prediction.startDate, prediction.endDate).forEach(date => { (result[date] ||= []).push(prediction.type); }));
    return result;
  }
  function overview(state) {
    const status=MSHCycle.getStatusViewModel(state,today);
    const title=status.fertileEstimate?status.fertileEstimate.label:status.periodRecorded?'Period recorded today':status.cycleDay?`Cycle day ${status.cycleDay}`:'Bring your cycle picture into focus';
    const details=[status.estimatedPhase?`Estimated ${status.estimatedPhase} phase`:'',status.periodEstimate?`Period estimated ${status.periodEstimate.daysAway===0?'today':`in ${status.periodEstimate.daysAway} days`}`:''].filter(Boolean).join(' · ');
    return {label:status.periodRecorded?'Recorded today':status.cycleDay?`Cycle day ${status.cycleDay}`:'Cycle layer',title,detail:details||'Record a period to begin building your own timeline'};
  }
  function calendarGrid(state) {
    const year=visibleMonth.getFullYear(), month=visibleMonth.getMonth();
    const first=new Date(year,month,1), offset=first.getDay(), count=new Date(year,month+1,0).getDate();
    const observed = Object.fromEntries(MSHCycle.recordedCycleEvents(state).filter(event => event.type === 'cycle_day_observation').map(event => [event.date,event]));
    const predicted = predictionsByDate(state);
    const otherEvents = (state.calendar.events || []).filter(event => event.category !== 'cycle');
    let cells = Array.from({length:offset},() => '<span class="msh-calendar-empty" aria-hidden="true"></span>').join('');
    for (let day=1;day<=count;day++) {
      const key=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const event=observed[key], types=predicted[key] || [], hasOther=otherEvents.some(item => item.date===key);
      const classes=['msh-calendar-day', key===today?'is-today':'', key===selectedDate?'is-selected':'', event&&event.value.bleeding!=='none'?'is-recorded-period':'', types.includes('predicted_period')?'is-predicted-period':'', types.includes('estimated_fertile_window')?'is-estimated-fertile':''].filter(Boolean).join(' ');
      const labels=[event&&event.value.bleeding!=='none'?'period recorded':'',types.includes('predicted_period')?'period estimated':'',types.includes('estimated_fertile_window')?'fertile window estimated':'',event&&event.value.symptoms.length?'symptoms recorded':'',hasOther?'other calendar event':''].filter(Boolean).join(', ');
      cells += `<button type="button" class="${classes}" data-date="${key}" aria-label="${prettyDate(key,{weekday:'long',month:'long',day:'numeric'})}${labels?`, ${labels}`:''}"><span>${day}</span><i>${event&&event.value.symptoms.length?'•':''}${hasOther?'·':''}</i></button>`;
    }
    return `<div class="msh-calendar-weekdays" aria-hidden="true">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=>`<span>${day}</span>`).join('')}</div><div class="msh-calendar-grid">${cells}</div>`;
  }
  function tabButton(view,label) { return `<button type="button" role="tab" data-view="${view}" aria-selected="${activeView===view}">${label}</button>`; }
  function calendarView(state) {
    const month = visibleMonth.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    return `<section class="msh-cycle-calendar-panel"><header class="msh-calendar-toolbar"><button type="button" data-month="-1" aria-label="Previous month">←</button><h2>${month}</h2><button type="button" data-month="1" aria-label="Next month">→</button></header><div class="msh-cycle-legend"><span class="recorded">Recorded</span><span class="predicted">Predicted period</span><span class="fertile">Estimated fertile window</span><span class="today">Today</span></div><div class="msh-calendar-swipe" data-calendar-swipe>${calendarGrid(state)}</div><p class="msh-cycle-estimate-note">Predictions are estimates calculated from recorded period dates. They never replace what you recorded and should not be relied upon as contraception.</p></section>`;
  }
  function cycleIntelligence(state) {
    const status=MSHCycle.getStatusViewModel(state,today),education=MSHCycle.getPhaseEducation(status.estimatedPhase),avg=Math.round(MSHCycle.calculateStats(state).averageCycleLength||28),day=Math.max(1,Math.min(avg,status.cycleDay||1)),angle=(day/avg)*360;
    return `<section class="msh-cycle-intelligence"><div class="msh-cycle-ring" style="--cycle-angle:${angle}deg"><div><span>Today</span><strong>${status.cycleDay?`Day ${status.cycleDay}`:'—'}</strong><small>${status.estimatedPhase?`Estimated ${status.estimatedPhase}`:'More history needed'}</small></div></div><div class="msh-cycle-phase-story"><p class="msh-information-label estimated">Estimated / predicted</p><h2>${education?education.title:'Your cycle position will come into focus.'}</h2><p>${education?education.summary:'Record period dates to support a calendar-based estimate.'}</p>${education?`<details><summary>What’s happening during this phase</summary><p>${education.physiology}</p><div class="msh-hormone-illustration" role="img" aria-label="Typical educational hormone pattern, not personal measurements"><svg viewBox="0 0 320 90"><path d="M5 72 C70 70 84 24 128 38 S195 78 230 35 S286 22 315 64"/><path d="M5 68 C92 70 142 66 174 18 S245 26 315 72"/></svg><small>${education.label}</small></div><p><strong>What some people notice</strong><br>${education.experiences}</p></details>`:''}<p class="msh-cycle-boundary">This position is estimated from recorded dates. Hormone levels were not measured.</p></div></section>`;
  }
  function analyticsVisuals(state){const stats=MSHCycle.calculateStats(state),lengths=stats.cycleLengths||[],freq=Object.entries(stats.symptomFrequency||{}).sort((a,b)=>b[1]-a[1]).slice(0,6),max=Math.max(1,...freq.map(x=>x[1]));return `<section class="msh-cycle-charts"><article><h3>Recent cycle lengths</h3>${lengths.length?`<div class="msh-length-chart">${lengths.map((v,i)=>`<span style="--bar:${Math.max(20,v*2)}%"><i></i><small>Cycle ${i+1}<b>${v}d</b></small></span>`).join('')}</div>`:'<p>Record at least two period starts to compare cycle lengths.</p>'}</article><article><h3>Recorded symptom frequency</h3>${freq.length?`<div class="msh-frequency-chart">${freq.map(([name,count])=>`<p><span>${esc(name)}</span><i><b style="width:${count/max*100}%"></b></i><strong>${count}</strong></p>`).join('')}</div>`:'<p>Record symptoms on several days to see a frequency view.</p>'}</article></section>`}
  function timelineView(state) {
    const events = MSHCycle.recordedCycleEvents(state).sort((a,b)=>b.date.localeCompare(a.date));
    const mix = state.calendar.settings.cycle.mixHealthTimeline;
    const items = [...events, ...(mix ? state.calendar.events.filter(event=>event.category!=='cycle') : [])].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    return `<section class="msh-cycle-content"><header><p class="msh-eyebrow">Cycle timeline</p><h2>What you recorded, through time.</h2><label class="msh-cycle-toggle"><input type="checkbox" data-setting="mixHealthTimeline" ${mix?'checked':''}> Include other health observations</label></header><div class="msh-cycle-timeline">${items.length?items.map(event=>{if(event.category!=='cycle')return`<article><time>${prettyDate(event.date,{month:'short',day:'numeric'})}</time><div><strong>${esc(event.title||'Health observation')}</strong></div></article>`;const v=event.value,cycle=MSHCycle.estimatedStatus(state,event.date),title=v.periodMarker==='start'?'Period started':v.bleeding!=='none'?`Period · Day ${cycle.cycleDay||''}`:v.symptoms.length?esc(v.symptoms.join(' · ')):'Cycle observation',details=[v.bleeding!=='none'?`${v.bleeding} flow`:'',...v.symptoms,v.moodExperience.energy?`${v.moodExperience.energy} energy`:'',v.care.painRelief||v.care.medication].filter(Boolean);return`<article><time datetime="${event.date}">${prettyDate(event.date,{month:'short',day:'numeric'})}</time><div><strong>${title}</strong>${details.length?`<p>${details.map(esc).join(' · ')}</p>`:''}${v.note?`<p>${esc(v.note)}</p>`:''}</div></article>`}).join(''):'<p>No cycle entries yet. What you choose to record will appear here.</p>'}</div></section>`;
  }
  function statsView(state) {
    const stats=MSHCycle.calculateStats(state), patterns=state.calendar.privacy.patternAnalysis?MSHCycle.calculatePatterns(state):[];
    const range=stats.observedCycleRange?`${stats.observedCycleRange[0]}–${stats.observedCycleRange[1]} days`:'More recorded cycles needed';
    return `<section class="msh-cycle-content"><header><p class="msh-eyebrow">Personal observation</p><h2>Your recorded cycles, described—not graded.</h2><p>These statistics use recorded observations only. They do not label your cycle normal or abnormal.</p></header><div class="msh-cycle-stat-grid"><article><span>Cycle length</span><strong>${stats.averageCycleLength?`${stats.averageCycleLength} days`:'—'}</strong><p>Observed range · ${range}</p></article><article><span>Recorded period length</span><strong>${stats.averagePeriodLength?`${stats.averagePeriodLength} days`:'—'}</strong><p>Across ${stats.recordedCycles} recorded cycle${stats.recordedCycles===1?'':'s'}</p></article><article><span>Cycle-to-cycle variability</span><strong>${stats.cycleVariability!=null?`${stats.cycleVariability} days`:'—'}</strong><p>Descriptive variation between recorded starts</p></article></div>${analyticsVisuals(state)}<section class="msh-patterns"><h3>What seems to repeat</h3>${!state.calendar.privacy.patternAnalysis?'<p>Broader pattern analysis is off. You control whether cycle information is used here.</p>':patterns.length?patterns.map(pattern=>`<article><p>${esc(pattern.statement)}</p><small>${pattern.cyclesIncluded} cycles · ${esc(pattern.cycleRelativeTiming)} · ${pattern.sourceData.length} source records</small><p class="msh-uncertainty">${esc(pattern.uncertainty)}</p></article>`).join(''):`<p>Personal observations appear only after at least ${MSHCycle.MIN_PATTERN_CYCLES} recorded cycles and repeated observations. No correlation or diagnosis is inferred from insufficient data.</p>`}</section></section>`;
  }
  function summaryView(state) {
    const segments=MSHCycle.periodSegments(state), stats=MSHCycle.calculateStats(state), symptomCount={};
    MSHCycle.recordedCycleEvents(state).forEach(event=>(event.value.symptoms||[]).forEach(symptom=>symptomCount[symptom]=(symptomCount[symptom]||0)+1));
    const current=MSHCycle.getStatusViewModel(state,today),todayEvent=MSHCycle.dailyObservation(state,today),patterns=state.calendar.privacy.patternAnalysis?MSHCycle.calculatePatterns(state):[];
    return `<section class="msh-cycle-content"><header><p class="msh-eyebrow">Cycle summary</p><h2>Your current cycle, in plain language.</h2><p>This is an on-screen personal summary, not a clinical report.</p></header><div class="msh-cycle-summary"><article><h3>Your current cycle</h3><p><strong>Started</strong><br>${segments.length?prettyDate(segments.at(-1).start,{month:'long',day:'numeric',year:'numeric'}):'Not recorded'}</p><p><strong>Where you are</strong><br>${current.cycleDay?`Cycle day ${current.cycleDay} · estimated ${current.estimatedPhase} phase`:'More recorded history needed'}</p></article><article><h3>What you’ve recorded today</h3><p>${todayEvent?[todayEvent.value.bleeding!=='none'?`${todayEvent.value.bleeding} flow`:'',...todayEvent.value.symptoms].filter(Boolean).join(' · ')||'A note without symptoms or bleeding.':'Nothing recorded today.'}</p><p><strong>Relief & care</strong><br>${todayEvent?.value.care.painRelief||todayEvent?.value.care.medication||'Nothing recorded yet.'}</p></article><article><h3>What seems to repeat</h3>${patterns.length?patterns.slice(0,2).map(pattern=>`<p>${esc(pattern.statement)}</p>`).join(''):'<p>More repeated observations are needed before anything is described as recurring.</p>'}</article></div></section>`;
  }
  function privacyPanel(state) {
    const privacy=state.calendar.privacy;
    return `<details class="msh-cycle-privacy"><summary>Cycle privacy and use</summary><div><p>Cycle and reproductive-health information is especially sensitive. Access for one purpose does not grant access elsewhere.</p>${[['workspace','Show in Calendar and Workspace'],['hello','Allow Hello to read and record through controlled actions'],['patternAnalysis','Use in broader personal pattern analysis']].map(([key,label])=>`<label><input type="checkbox" data-privacy="${key}" ${privacy[key]?'checked':''}> <span>${label}</span></label>`).join('')}</div></details>`;
  }
  function loggingSheet(state) {
    if (!sheetOpen) return '';
    const event=MSHCycle.dailyObservation(state,selectedDate), value=event&&event.value||{bleeding:'none',symptoms:[]};
    return `<div class="msh-sheet-backdrop" data-close-sheet></div><section class="msh-cycle-sheet" role="dialog" aria-modal="true" aria-labelledby="cycle-sheet-title"><header><div><p class="msh-eyebrow">Daily record · ${prettyDate(selectedDate,{weekday:'long',month:'long',day:'numeric'})}</p><h2 id="cycle-sheet-title">What would you like to record?</h2></div><button type="button" data-close-sheet aria-label="Close">×</button></header><form data-cycle-form><input type="hidden" name="date" value="${selectedDate}"><fieldset><legend>Bleeding / flow</legend><div class="msh-cycle-chips">${['none','spotting','light','medium','heavy'].map(item=>`<label><input type="radio" name="bleeding" value="${item}" ${value.bleeding===item?'checked':''}><span>${item[0].toUpperCase()+item.slice(1)}</span></label>`).join('')}</div></fieldset><details open><summary>Symptoms and comfort</summary><div class="msh-cycle-chips">${MSHCycle.SYMPTOMS.slice(0,8).map(item=>`<label><input type="checkbox" name="symptoms" value="${item}" ${(value.symptoms||[]).includes(item)?'checked':''}><span>${item[0].toUpperCase()+item.slice(1)}</span></label>`).join('')}<label><input type="checkbox" name="noSymptoms" ${value.noSymptoms?'checked':''}><span>No symptoms</span></label></div></details><details><summary>Mood, energy, and sleep</summary><div class="msh-cycle-chips">${MSHCycle.SYMPTOMS.slice(8).map(item=>`<label><input type="checkbox" name="symptoms" value="${item}" ${(value.symptoms||[]).includes(item)?'checked':''}><span>${item[0].toUpperCase()+item.slice(1)}</span></label>`).join('')}</div><label class="msh-cycle-field">Sleep note<input name="sleep" value="${esc(value.sleep||'')}" placeholder="Optional"></label></details><details><summary>Reproductive health and relief</summary><p>Optional fields are stored only when you choose to use them.</p><label class="msh-cycle-field">Discharge or cervical mucus<input name="discharge" value="${esc(value.discharge||'')}" placeholder="Optional"></label><label class="msh-cycle-field">Medication or pain relief<input name="medication" value="${esc(value.medication||'')}" placeholder="Optional"></label></details><label class="msh-cycle-field">Note<textarea name="note" rows="3" placeholder="Anything you want to remember">${esc(value.note||'')}</textarea></label><footer><button type="button" class="msh-text-button" data-remove-entry ${event?'':'disabled'}>Remove entry</button><button class="msh-button" type="submit">Save record</button></footer></form></section>`;
  }
  function render() {
    const storedState=MSHStorage.getState();
    const state=demoMode?MSHCycle.createSyntheticDemoState(storedState,today):storedState;
    if (!demoMode && !state.calendar.predictions.length && MSHCycle.periodSegments(state).length) {
      MSHStorage.updateState(next=>{next.calendar.predictions=MSHCycle.calculatePredictions(next);return next;});
      return render();
    }
    const top=overview(state);
    const view=activeView==='calendar'?`${cycleIntelligence(state)}${calendarView(state)}`:activeView==='timeline'?timelineView(state):activeView==='stats'?statsView(state):summaryView(state);
    root.innerHTML=`${demoMode?'<aside class="msh-demo-banner"><strong>Synthetic QA demo</strong><span>Five illustrative cycles · not saved to My Health</span><a href="calendar.html">Exit demo</a></aside>':''}<header class="msh-cycle-hero"><div><p class="msh-eyebrow">Calendar · Cycle layer</p><h1>${esc(top.title)}</h1><p>${esc(top.detail)}. Recorded and estimated information stay visibly distinct.</p></div><div class="msh-cycle-actions"><button class="msh-button" type="button" data-log-period ${demoMode?'disabled':''}>Log period</button><button class="msh-button-secondary" type="button" data-open-sheet ${demoMode?'disabled':''}>Add symptoms</button><button class="msh-button-secondary" type="button" data-open-sheet ${demoMode?'disabled':''}>Add note</button></div></header><div class="msh-information-key" aria-label="Information classes"><span class="recorded">Recorded</span><span class="estimated">Estimated / predicted</span><span class="education">General education</span><span class="observation">Personal observation</span></div><nav class="msh-cycle-tabs" role="tablist" aria-label="Cycle calendar views">${tabButton('calendar','Calendar')}${tabButton('timeline','Timeline')}${tabButton('stats','Statistics')}${tabButton('summary','Summary')}</nav>${view}${activeView==='calendar'?privacyPanel(state):'<a class="msh-privacy-entry" href="calendar.html#cycle-privacy">Privacy & data →</a>'}${loggingSheet(state)}`;
    if (sheetOpen) {
      const flowFieldset=root.querySelector('.msh-cycle-sheet fieldset');
      if(flowFieldset) flowFieldset.insertAdjacentHTML('beforeend',`<label class="msh-cycle-field">Record period through <span>(optional)</span><input type="date" name="endDate" min="${selectedDate}" max="${MSHCycle.addDays(selectedDate,14)}"></label>`);
      const reproductiveDetails=[...root.querySelectorAll('.msh-cycle-sheet details')].find(item=>item.querySelector('summary')?.textContent.includes('Reproductive'));
      if(reproductiveDetails) reproductiveDetails.insertAdjacentHTML('beforeend',`<label class="msh-cycle-field">Sexual activity<select name="sexualActivity"><option value="">Not recorded</option><option>No sexual activity</option><option>Sexual activity recorded</option></select></label><label class="msh-cycle-field">Contraception / protection<input name="contraception" placeholder="Optional"></label><label class="msh-cycle-field">Reproductive-health context<input name="reproductiveHealth" value="${esc((MSHCycle.dailyObservation(state,selectedDate)?.value.sexualReproductive.context)||'')}" placeholder="Optional"></label><label class="msh-cycle-field">Basal / body temperature<input type="number" step="0.01" name="temperature" placeholder="Optional"></label><label class="msh-cycle-field">Weight<input type="number" step="0.1" name="weight" placeholder="Optional"></label>`);
      root.querySelectorAll('.msh-cycle-chips label').forEach(label=>{label.classList.add('msh-cycle-picture-choice');label.querySelector('span')?.insertAdjacentHTML('afterbegin','<i aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M8 13c2-3 5-4 8-2"/></svg></i>')});
      root.querySelector('.msh-cycle-sheet input:not([type=hidden])')?.focus();
    }
  }
  function changeMonth(delta) { visibleMonth=new Date(visibleMonth.getFullYear(),visibleMonth.getMonth()+delta,1); render(); }
  root.addEventListener('click', event => {
    const view=event.target.closest('[data-view]'); if(view){activeView=view.dataset.view;render();return;}
    const month=event.target.closest('[data-month]'); if(month){changeMonth(Number(month.dataset.month));return;}
    const date=event.target.closest('[data-date]'); if(date){selectedDate=date.dataset.date;sheetOpen=true;render();return;}
    if(event.target.closest('[data-open-sheet]')){sheetOpen=true;render();return;}
    if(event.target.closest('[data-log-period]')){selectedDate=today;sheetOpen=true;render();return;}
    if(event.target.closest('[data-close-sheet]')){sheetOpen=false;render();return;}
    if(event.target.closest('[data-remove-entry]')){MSHCycle.removeDailyObservation(selectedDate);sheetOpen=false;render();}
  });
  root.addEventListener('change', event => {
    if(event.target.matches('[data-privacy]')){MSHCycle.updatePrivacy({[event.target.dataset.privacy]:event.target.checked});render();}
    if(event.target.matches('[data-setting="mixHealthTimeline"]')){MSHStorage.updateState(state=>{state.calendar.settings.cycle.mixHealthTimeline=event.target.checked;return state;});render();}
    if(event.target.name==='noSymptoms'&&event.target.checked) root.querySelectorAll('input[name="symptoms"]').forEach(input=>input.checked=false);
    if(event.target.name==='symptoms'&&event.target.checked){const no=root.querySelector('input[name="noSymptoms"]');if(no)no.checked=false;}
  });
  root.addEventListener('submit', event => {
    if(!event.target.matches('[data-cycle-form]'))return; event.preventDefault(); const data=new FormData(event.target);
    const value={bleeding:data.get('bleeding'),symptoms:data.getAll('symptoms'),noSymptoms:data.get('noSymptoms')==='on',discharge:data.get('discharge'),moodExperience:{sleep:data.get('sleep')},sexualReproductive:{sexualActivity:data.get('sexualActivity'),contraception:data.get('contraception'),context:data.get('reproductiveHealth')},measurements:{temperature:data.get('temperature'),weight:data.get('weight')},care:{medication:data.get('medication')},note:data.get('note')};
    if(data.get('endDate')&&data.get('bleeding')!=='none') MSHCycle.recordPeriod(data.get('date'),data.get('endDate'),data.get('bleeding'));
    MSHCycle.saveDailyObservation(data.get('date'),value);
    sheetOpen=false;render();
  });
  root.addEventListener('pointerdown',event=>{if(event.target.closest('[data-calendar-swipe]'))pointerStart={x:event.clientX,id:event.pointerId};});
  root.addEventListener('pointerup',event=>{if(!pointerStart||pointerStart.id!==event.pointerId)return;const delta=event.clientX-pointerStart.x;pointerStart=null;if(Math.abs(delta)>55)changeMonth(delta<0?1:-1);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&sheetOpen){sheetOpen=false;render();}});
  render();
})();
