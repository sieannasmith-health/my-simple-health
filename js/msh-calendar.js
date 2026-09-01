/* My Simple Health — Calendar: health in time, composed from user-selected layers */
(function () {
  'use strict';
  const root = document.querySelector('[data-msh-calendar]');
  if (!root || !window.MSHStorage || !window.MSHCalendarData || !window.MSHCalendarAppearance || !window.MSHCycle || !window.MSHMovementDirectory || !window.MSHMovement) return;
  const today = MSHCycle.toDateKey(new Date());
  const routeParameters = new URLSearchParams(location.search);
  const requestedView = routeParameters.get('view');
  const demoMode = routeParameters.get('demo') === 'cycle-v2';
  let visibleMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let selectedDate = today;
  let activeView = requestedView==='timeline' ? 'timeline' : 'calendar';
  let customizationOpen = requestedView==='cycle' || routeParameters.get('customize')==='layers';
  let sheetOpen = false;
  let movementSheet = requestedView === 'movement' ? 'plan' : null;
  let movementEventId = null;
  let pointerStart = null;
  let timelinePage = 0;
  let nativeRangeKey = '';
  let nativeRangePending = '';
  let nativeRangeRecords = [];
  let renderCount = 0;
  const TIMELINE_WINDOW_DAYS = 90;
  const TIMELINE_RENDER_LIMIT = 60;
  const EVENT_META = MSHCalendarData.EVENT_META;
  const debugPerformance = detail => { if(window.MSH_DEBUG===true) console.debug('[MSHCalendarPerformance]',detail); };

  const esc = value => String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const prettyDate = (date, options) => MSHCycle.toDateKey(date) ? new Date(`${MSHCycle.toDateKey(date)}T12:00:00`).toLocaleDateString(undefined, options || {month:'short',day:'numeric'}) : '';
  function datesInRange(start, end) { const result=[]; for (let date=start; date<=end; date=MSHCycle.addDays(date,1)) result.push(date); return result; }
  function predictionsByDate(state, range) {
    const result = {};
    (state.calendar.predictions || []).filter(prediction=>prediction.endDate>=range.startDate&&prediction.startDate<=range.endDate).forEach(prediction => {
      const start=prediction.startDate<range.startDate?range.startDate:prediction.startDate, end=prediction.endDate>range.endDate?range.endDate:prediction.endDate;
      datesInRange(start,end).forEach(date => { (result[date] ||= []).push(prediction.type); });
    });
    return result;
  }
  function monthRange() {
    const year=visibleMonth.getFullYear(),month=visibleMonth.getMonth();
    return {startDate:`${year}-${String(month+1).padStart(2,'0')}-01`,endDate:MSHCycle.toDateKey(new Date(year,month+1,0))};
  }
  function timelineRange() {
    if(timelinePage===0)return {startDate:MSHCycle.addDays(today,-TIMELINE_WINDOW_DAYS+1),endDate:MSHCycle.addDays(today,31)};
    const endDate=MSHCycle.addDays(today,-TIMELINE_WINDOW_DAYS*timelinePage);
    return {startDate:MSHCycle.addDays(endDate,-TIMELINE_WINDOW_DAYS+1),endDate};
  }
  const currentRange = () => activeView==='timeline'?timelineRange():monthRange();
  function nativeAreas(state) {
    const layers=state.calendar.settings.layers,areas=[];
    if(layers.movement!==false)areas.push('movement');
    if(layers.observations!==false)areas.push('sleep');
    if(layers.measurements!==false)areas.push('body_measurements');
    return areas;
  }
  function requestNativeRange(state,range) {
    if(!window.MSHConnectedHealth?.calendarRange)return;
    const areas=nativeAreas(state),key=`${range.startDate}|${range.endDate}|${areas.join(',')}`;
    if(!areas.length){nativeRangeRecords=[];nativeRangeKey=key;return;}
    if(key===nativeRangeKey||key===nativeRangePending)return;
    nativeRangePending=key;
    MSHConnectedHealth.calendarRange({areas,startDate:range.startDate,endDate:range.endDate}).then(result=>{
      if(nativeRangePending!==key)return;
      nativeRangeRecords=result.records||[];
      nativeRangeKey=key;
      nativeRangePending='';
      render();
    }).catch(()=>{if(nativeRangePending===key)nativeRangePending='';});
  }
  function layerControls(state) {
    const layers=state.calendar.settings.layers;
    const options=[['movement','Movement'],['cycle','Cycle'],['symptoms','Symptoms'],['medications','Medications'],['sexualHealth','Sexual health'],['care','Care & appointments'],['measurements','Measurements'],['life','Life context'],['observations','Observations']];
    return `<fieldset class="msh-calendar-layers"><legend>Visible health layers</legend>${options.map(([key,label])=>`<label><input type="checkbox" data-calendar-layer="${key}" ${layers[key]!==false?'checked':''}><span>${label}</span></label>`).join('')}</fieldset>`;
  }
  function calendarGrid(state,eventIndex,cycleEvents,range) {
    const year=visibleMonth.getFullYear(), month=visibleMonth.getMonth();
    const first=new Date(year,month,1), offset=first.getDay(), count=new Date(year,month+1,0).getDate();
    const cycleVisible=state.calendar.settings.layers.cycle!==false;
    const observed = cycleVisible?Object.fromEntries(cycleEvents.filter(event => event.type === 'cycle_day_observation'&&MSHCalendarData.inRange(event.date,range)).map(event => [event.date,event])):{};
    const predicted = cycleVisible?predictionsByDate(state,range):{};
    let cells = Array.from({length:offset},() => '<span class="msh-calendar-empty" aria-hidden="true"></span>').join('');
    for (let day=1;day<=count;day++) {
      const key=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const event=observed[key], types=predicted[key] || [], dayEvents=eventIndex.get(key)||[], categories=[...new Set(dayEvents.map(item=>item.category))].slice(0,3);
      const classes=['msh-calendar-day', key===today?'is-today':'', key===selectedDate?'is-selected':'', event&&event.value.bleeding!=='none'?'is-recorded-period':'', types.includes('predicted_period')?'is-predicted-period':'', types.includes('estimated_fertile_window')?'is-estimated-fertile':''].filter(Boolean).join(' ');
      const labels=[event&&event.value.bleeding!=='none'?'period recorded':'',types.includes('predicted_period')?'period estimated':'',types.includes('estimated_fertile_window')?'fertile window estimated':'',event&&event.value.symptoms.length?'symptoms recorded':'',...categories.map(category=>EVENT_META[category].label)].filter(Boolean).join(', ');
      cells += `<button type="button" class="${classes}" data-date="${key}" aria-label="${prettyDate(key,{weekday:'long',month:'long',day:'numeric'})}${labels?`, ${labels}`:''}"><span>${day}</span><i class="msh-calendar-event-dots" aria-hidden="true">${categories.map(category=>`<b class="is-${category}"></b>`).join('')}</i></button>`;
    }
    return `<div class="msh-calendar-weekdays" aria-hidden="true">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=>`<span>${day}</span>`).join('')}</div><div class="msh-calendar-grid">${cells}</div>`;
  }
  function tabButton(view,label) { return `<button type="button" role="tab" data-view="${view}" aria-selected="${activeView===view}">${label}</button>`; }
  function timeSymbol() { return `<span class="msh-kinetic-symbol msh-kinetic-symbol--orbit" aria-hidden="true"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="31" fill="none" stroke="currentColor" opacity=".24"/><circle cx="50" cy="50" r="4" fill="currentColor" opacity=".8"/><g class="msh-symbol-traveler"><circle cx="50" cy="19" r="4" fill="var(--msh-personal-accent)"/></g><path d="M50 29v21l15 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>`; }
  function calendarAppearanceControl(state) {
    const preference=MSHCalendarAppearance.getPreference(state),customValue=preference.accentId==='custom'?preference.customColor:'#65717a';
    return `<section class="msh-calendar-appearance"><p class="msh-calendar-customize-label">Appearance</p><h2>Calendar color</h2><p>Choose a restrained accent for this Calendar view.</p><div class="msh-calendar-color-presets" role="group" aria-label="Calendar color presets">${MSHCalendarAppearance.PRESETS.map(option=>`<button type="button" data-calendar-accent="${option.id}" aria-pressed="${preference.accentId===option.id}"><i style="--swatch:${option.color}" aria-hidden="true"></i><span>${option.label}</span></button>`).join('')}</div><label class="msh-calendar-custom-color"><input type="color" data-calendar-custom-color value="${customValue}" aria-label="Custom Calendar color"><span>Custom</span><small>${preference.accentId==='custom'?'Selected':'Choose a color'}</small></label><button type="button" class="msh-text-button" data-calendar-accent-reset ${preference.accentId==='default'?'disabled':''}>Reset to default</button></section>`;
  }
  function calendarCustomizationControl(state) {
    const preference=MSHCalendarAppearance.getPreference(state),swatch=MSHCalendarAppearance.chosenColor(preference)||'#496b3c';
    return `<details class="msh-calendar-customization" data-calendar-customize ${customizationOpen?'open':''}><summary><span class="msh-calendar-color-preview" style="--swatch:${esc(swatch)}" aria-hidden="true"></span><span>Customize</span></summary><div class="msh-calendar-customization-menu"><section class="msh-calendar-layer-settings"><p class="msh-calendar-customize-label">Visible layers</p><h2>What belongs in view?</h2><p>Visibility changes this Calendar only. It never changes or deletes the underlying records.</p>${layerControls(state)}</section>${calendarAppearanceControl(state)}</div></details>`;
  }
  function movementStatusLabel(status) { return ({planned:'Planned',completed:'Completed',skipped:'Skipped',modified:'Modified'})[status]||'Recorded'; }
  function movementExperienceDetail(item) {
    const movement=item.movement||{}, experience=movement.experience||{}, details=[];
    if(movement.durationMinutes)details.push(`${movement.durationMinutes} min`);
    if(experience.perceivedEffort)details.push(`${experience.perceivedEffort.value}/10 · ${experience.perceivedEffort.description}`);
    if(experience.energy)details.push(`Energy ${experience.energy.label.toLowerCase()}`);
    return details.join(' · ');
  }
  function movementCalendarCard(item,context='date') {
    const movement=item.movement||{}, status=movement.status||'planned', experience=movement.experience||{}, influences=experience.possibleInfluences||[];
    const action=status==='planned'?`<button type="button" class="msh-text-button" data-complete-movement="${esc(item.id)}">Record how it went</button>`:'';
    const attribution=influences.length?`<small>You selected these as possible influences: ${esc(influences.join(', '))}. This records your view; it does not establish cause.</small>`:'';
    const reflection=experience.reflection?`<p>${esc(experience.reflection)}</p>`:'';
    if(context==='timeline')return `<article class="is-movement"><time datetime="${item.date}">${prettyDate(item.date,{month:'short',day:'numeric'})}</time><div><span>Movement · ${movementStatusLabel(status)}</span><strong>${esc(item.title||'Movement')}</strong>${movementExperienceDetail(item)?`<p>${esc(movementExperienceDetail(item))}</p>`:''}${attribution}</div></article>`;
    return `<article class="is-movement"><span>Movement · ${movementStatusLabel(status)}</span><strong>${esc(item.title||'Movement')}</strong>${movementExperienceDetail(item)?`<p>${esc(movementExperienceDetail(item))}</p>`:''}${reflection}${attribution}${action}</article>`;
  }
  function genericCalendarEvent(item,context='date') {
    if(context==='timeline')return `<article class="is-${item.category}"><time datetime="${item.date}">${prettyDate(item.date,{month:'short',day:'numeric'})}</time><div><span>${esc(EVENT_META[item.category]?.label||'Health')}</span><strong>${esc(item.title||'Health observation')}</strong>${item.detail?`<p>${esc(item.detail)}</p>`:''}</div></article>`;
    return `<article class="is-${item.category} ${item.recordStatus==='predicted'?'is-predicted':''}"><span>${esc(EVENT_META[item.category]?.label||'Health')}</span><strong>${esc(item.title)}</strong>${item.detail?`<p>${esc(item.detail)}</p>`:''}${item.recordStatus==='predicted'?'<small>Estimated, not recorded</small>':''}</article>`;
  }
  function renderCalendarEvent(item,context='date') { return item.category==='movement'?movementCalendarCard(item,context):genericCalendarEvent(item,context); }
  function dateInspector(state,eventIndex) {
    const recorded=eventIndex.get(selectedDate)||[];
    const cycleEvent=state.calendar.settings.layers.cycle!==false?MSHCycle.dailyObservation(state,selectedDate):null;
    const predicted=state.calendar.settings.layers.cycle!==false?(state.calendar.predictions||[]).filter(item=>selectedDate>=item.startDate&&selectedDate<=item.endDate):[];
    const cycleItems=[];
    if(cycleEvent){const value=cycleEvent.value;cycleItems.push({category:'cycle',title:value.periodMarker==='start'?'Period started':value.bleeding!=='none'?`${value.bleeding} flow recorded`:'Cycle observation',detail:'',recordStatus:'recorded'});}
    predicted.forEach(item=>cycleItems.push({category:'cycle',title:item.type==='predicted_period'?'Estimated period':'Estimated fertile window',detail:'Calculated from recorded period dates',recordStatus:'predicted'}));
    const items=[...cycleItems,...recorded];
    return `<aside class="msh-date-inspector" aria-live="polite"><p class="msh-eyebrow">${selectedDate===today?'Today · ':''}${prettyDate(selectedDate,{weekday:'long',month:'long',day:'numeric'})}</p><h2>What was happening around this time?</h2>${items.length?`<div class="msh-date-events">${items.map(item=>renderCalendarEvent(item)).join('')}</div>`:'<p class="msh-date-empty">Nothing is recorded here yet. An open day is still part of the picture.</p>'}<div class="msh-date-actions"><button type="button" class="msh-button" data-add-movement>Add movement</button><button type="button" class="msh-button-secondary" data-open-sheet>Add cycle information</button></div></aside>`;
  }
  function calendarView(state,eventIndex,cycleEvents,range) {
    const month = visibleMonth.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    const cycleVisible=state.calendar.settings.layers.cycle!==false;
    return `<section class="msh-calendar-workspace"><div class="msh-cycle-calendar-panel"><header class="msh-calendar-toolbar"><button type="button" data-month="-1" aria-label="Previous month">←</button><h2>${month}</h2><button type="button" data-month="1" aria-label="Next month">→</button></header><div class="msh-cycle-legend">${cycleVisible?'<span class="recorded">Recorded cycle</span><span class="predicted">Estimated cycle</span>':''}<span class="health">Visible health event</span><span class="today">Today</span></div><div class="msh-calendar-swipe" data-calendar-swipe>${calendarGrid(state,eventIndex,cycleEvents,range)}</div><p class="msh-cycle-estimate-note">Only the health layers you choose are shown. Calendar projects dated information from its original records without changing their meaning or copying them into a second history.${cycleVisible?' Cycle predictions remain estimated; fertile-window estimates should not be relied upon as contraception.':''}</p></div>${dateInspector(state,eventIndex)}</section>`;
  }
  function cycleIntelligence(state) {
    const status=MSHCycle.getStatusViewModel(state,today),education=MSHCycle.getPhaseEducation(status.estimatedPhase),avg=Math.round(MSHCycle.calculateStats(state).averageCycleLength||28),day=Math.max(1,Math.min(avg,status.cycleDay||1)),angle=(day/avg)*360;
    return `<section class="msh-cycle-intelligence"><div class="msh-cycle-ring" style="--cycle-angle:${angle}deg"><div><span>Today</span><strong>${status.cycleDay?`Day ${status.cycleDay}`:'—'}</strong><small>${status.estimatedPhase?`Estimated ${status.estimatedPhase}`:'More history needed'}</small></div></div><div class="msh-cycle-phase-story"><p class="msh-information-label estimated">Estimated / predicted</p><h2>${education?education.title:'Your cycle position will come into focus.'}</h2><p>${education?education.summary:'Record period dates to support a calendar-based estimate.'}</p>${education?`<details><summary>What’s happening during this phase</summary><p>${education.physiology}</p><div class="msh-hormone-illustration" role="img" aria-label="Typical educational hormone pattern, not personal measurements"><svg viewBox="0 0 320 90"><path d="M5 72 C70 70 84 24 128 38 S195 78 230 35 S286 22 315 64"/><path d="M5 68 C92 70 142 66 174 18 S245 26 315 72"/></svg><small>${education.label}</small></div><p><strong>What some people notice</strong><br>${education.experiences}</p></details>`:''}<p class="msh-cycle-boundary">This position is estimated from recorded dates. Hormone levels were not measured. Fertile-window estimates should not be relied upon as contraception.</p></div></section>`;
  }
  function analyticsVisuals(state){const stats=MSHCycle.calculateStats(state),lengths=stats.cycleLengths||[],freq=Object.entries(stats.symptomFrequency||{}).sort((a,b)=>b[1]-a[1]).slice(0,6),max=Math.max(1,...freq.map(x=>x[1]));return `<section class="msh-cycle-charts"><article><h3>Recent cycle lengths</h3>${lengths.length?`<div class="msh-length-chart">${lengths.map((v,i)=>`<span style="--bar:${Math.max(20,v*2)}%"><i></i><small>Cycle ${i+1}<b>${v}d</b></small></span>`).join('')}</div>`:'<p>Record at least two period starts to compare cycle lengths.</p>'}</article><article><h3>Recorded symptom frequency</h3>${freq.length?`<div class="msh-frequency-chart">${freq.map(([name,count])=>`<p><span>${esc(name)}</span><i><b style="width:${count/max*100}%"></b></i><strong>${count}</strong></p>`).join('')}</div>`:'<p>Record symptoms on several days to see a frequency view.</p>'}</article></section>`}
  function timelineView(state,visibleEvents,cycleEvents,range) {
    const cycleItems=state.calendar.settings.layers.cycle===false?[]:cycleEvents.filter(event=>MSHCalendarData.inRange(event.date,range)).map(event=>{const value=event.value;return{date:event.date,category:'cycle',title:value.periodMarker==='start'?'Period started':value.bleeding!=='none'?`${value.bleeding} flow recorded`:'Cycle observation',detail:''}});
    const items=MSHCalendarData.boundedTimeline([...visibleEvents,...cycleItems],TIMELINE_RENDER_LIMIT);
    const navigation=`<nav class="msh-calendar-timeline-pages" aria-label="Timeline date window">${timelinePage?'<button type="button" data-timeline-page="newer">Newer dates</button>':''}<span>${prettyDate(range.startDate,{month:'short',day:'numeric',year:'numeric'})}–${prettyDate(range.endDate,{month:'short',day:'numeric',year:'numeric'})}</span><button type="button" data-timeline-page="earlier">Earlier dates</button></nav>`;
    return {itemCount:items.length,html:`<section class="msh-cycle-content"><header><p class="msh-eyebrow">Health timeline</p><h2>What has unfolded through time.</h2><p>This view brings together dated records without grading them or claiming that one event caused another.</p></header><div class="msh-cycle-timeline">${items.length?items.map(event=>renderCalendarEvent(event,'timeline')).join(''):'<p>No dated health events are visible in this window. Choose layers in Customize or look at another period.</p>'}</div>${navigation}</section>`};
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
    return `<details class="msh-cycle-privacy"><summary>Cycle privacy and use</summary><div><p>Cycle and reproductive-health information is especially sensitive. Access for one purpose does not grant access elsewhere.</p>${[['workspace','Show in Calendar and Workspace'],['patternAnalysis','Use in broader personal pattern analysis']].map(([key,label])=>`<label><input type="checkbox" data-privacy="${key}" ${privacy[key]?'checked':''}> <span>${label}</span></label>`).join('')}</div></details>`;
  }
  function loggingSheet(state) {
    if (!sheetOpen) return '';
    const event=MSHCycle.dailyObservation(state,selectedDate), value=event&&event.value||{bleeding:'none',symptoms:[]};
    return `<div class="msh-sheet-backdrop" data-close-sheet></div><section class="msh-cycle-sheet" role="dialog" aria-modal="true" aria-labelledby="cycle-sheet-title"><header><div><p class="msh-eyebrow">Daily record · ${prettyDate(selectedDate,{weekday:'long',month:'long',day:'numeric'})}</p><h2 id="cycle-sheet-title">What would you like to record?</h2></div><button type="button" data-close-sheet aria-label="Close">×</button></header><form data-cycle-form><input type="hidden" name="date" value="${selectedDate}"><fieldset><legend>Bleeding / flow</legend><div class="msh-cycle-chips">${['none','spotting','light','medium','heavy'].map(item=>`<label><input type="radio" name="bleeding" value="${item}" ${value.bleeding===item?'checked':''}><span>${item[0].toUpperCase()+item.slice(1)}</span></label>`).join('')}</div></fieldset><details open><summary>Symptoms and comfort</summary><div class="msh-cycle-chips">${MSHCycle.SYMPTOMS.slice(0,8).map(item=>`<label><input type="checkbox" name="symptoms" value="${item}" ${(value.symptoms||[]).includes(item)?'checked':''}><span>${item[0].toUpperCase()+item.slice(1)}</span></label>`).join('')}<label><input type="checkbox" name="noSymptoms" ${value.noSymptoms?'checked':''}><span>No symptoms</span></label></div></details><details><summary>Mood, energy, and sleep</summary><div class="msh-cycle-chips">${MSHCycle.SYMPTOMS.slice(8).map(item=>`<label><input type="checkbox" name="symptoms" value="${item}" ${(value.symptoms||[]).includes(item)?'checked':''}><span>${item[0].toUpperCase()+item.slice(1)}</span></label>`).join('')}</div><label class="msh-cycle-field">Sleep note<input name="sleep" value="${esc(value.sleep||'')}" placeholder="Optional"></label></details><details><summary>Reproductive health and relief</summary><p>Optional fields are stored only when you choose to use them.</p><label class="msh-cycle-field">Discharge or cervical mucus<input name="discharge" value="${esc(value.discharge||'')}" placeholder="Optional"></label><label class="msh-cycle-field">Medication or pain relief<input name="medication" value="${esc(value.medication||'')}" placeholder="Optional"></label></details><label class="msh-cycle-field">Note<textarea name="note" rows="3" placeholder="Anything you want to remember">${esc(value.note||'')}</textarea></label><footer><button type="button" class="msh-text-button" data-remove-entry ${event?'':'disabled'}>Remove entry</button><button class="msh-button" type="submit">Save record</button></footer></form></section>`;
  }
  function movementDirectoryView() {
    return `<details class="msh-movement-directory"><summary>Browse Movement Directory</summary><p>Movement can include exercise, recreation, daily life, sports, mobility, and meaningful physical events.</p><div>${MSHMovementDirectory.DIRECTORY.map(category=>`<details><summary>${esc(category.label)} <span>${category.items.length}</span></summary><div class="msh-directory-items">${category.items.map(item=>`<button type="button" data-movement-directory-item="${item.id}">${esc(item.label)}</button>`).join('')}</div></details>`).join('')}</div></details>`;
  }
  function movementSearchResults(query) {
    const value=String(query||'').trim(), items=MSHMovementDirectory.search(value,7);
    if(!value)return '';
    if(!items.length)return '<p class="msh-movement-search-note">No directory match. Your own wording will be preserved.</p>';
    return `<div class="msh-movement-search-results" role="listbox" aria-label="Movement Directory matches">${items.map(item=>`<button type="button" role="option" data-movement-directory-item="${item.id}"><span>${esc(item.label)}</span><small>${esc(item.categoryLabel)}</small></button>`).join('')}</div>`;
  }
  function movementSheetView(state) {
    if(!movementSheet)return '';
    const event=movementEventId?MSHMovement.getEvent(movementEventId,state):null;
    if(movementSheet==='plan')return `<div class="msh-sheet-backdrop" data-close-movement></div><section class="msh-cycle-sheet msh-movement-sheet" role="dialog" aria-modal="true" aria-labelledby="movement-plan-title"><header><div><p class="msh-eyebrow">Movement · ${prettyDate(selectedDate,{weekday:'long',month:'long',day:'numeric'})}</p><h2 id="movement-plan-title">Add movement</h2></div><button type="button" data-close-movement aria-label="Close">×</button></header><form data-movement-plan-form><label class="msh-cycle-field msh-movement-entry">What are you planning?<input required name="movementLabel" autocomplete="off" placeholder="Search or type a movement…" aria-describedby="movement-entry-help"></label><input type="hidden" name="directoryItemId"><input type="hidden" name="directoryCategory"><p id="movement-entry-help" class="msh-movement-search-note">Use your own words, or choose an exact activity from the directory.</p><div data-movement-search-results aria-live="polite"></div>${movementDirectoryView()}<div class="msh-movement-fields"><label class="msh-cycle-field">Date<input required type="date" name="date" value="${selectedDate}"></label><label class="msh-cycle-field">Time<input type="time" name="time"></label><label class="msh-cycle-field">Planned duration<input type="number" min="1" max="1440" name="durationMinutes" inputmode="numeric" placeholder="Minutes"></label></div><label class="msh-cycle-field">Planning note<textarea name="notes" rows="3" placeholder="Optional"></textarea></label><p class="msh-movement-boundary">Planning records the activity and timing only. You can record how it felt afterward.</p><footer><button type="button" class="msh-text-button" data-close-movement>Cancel</button><button class="msh-button" type="submit">Add to Calendar</button></footer></form></section>`;
    if(!event)return '';
    const movement=event.movement||{};
    const statusChoices=['completed','modified','skipped'].map(status=>`<label><input type="radio" name="status" value="${status}" ${status==='completed'?'checked':''}><span>${movementStatusLabel(status)}</span></label>`).join('');
    const energyChoices=MSHMovement.EXPERIENCE_LEVELS.map(value=>`<label><input type="radio" name="energy" value="${value}"><span>${esc(MSHMovement.EXPERIENCE_LABELS[value])}</span></label>`).join('');
    const attributionChoices=MSHMovement.ATTRIBUTIONS.map(value=>`<label><input type="checkbox" name="attributions" value="${value}"><span>${esc(value[0].toUpperCase()+value.slice(1))}</span></label>`).join('');
    const rpeChoices=Array.from({length:10},(_,index)=>{const value=index+1;return `<label><input type="radio" name="rpe" value="${value}"><span>${value}</span></label>`}).join('');
    return `<div class="msh-sheet-backdrop" data-close-movement></div><section class="msh-cycle-sheet msh-movement-sheet" role="dialog" aria-modal="true" aria-labelledby="movement-experience-title"><header><div><p class="msh-eyebrow">Movement experience</p><h2 id="movement-experience-title">How did ${esc(event.title)} go?</h2></div><button type="button" data-close-movement aria-label="Close">×</button></header><form data-movement-experience-form><input type="hidden" name="eventId" value="${esc(event.id)}"><fieldset><legend>What happened?</legend><div class="msh-cycle-chips">${statusChoices}</div></fieldset><label class="msh-cycle-field">Actual duration<input type="number" min="1" max="1440" name="durationMinutes" inputmode="numeric" value="${movement.durationMinutes||''}" placeholder="Minutes"></label><fieldset class="msh-rpe-field"><legend>How hard did it feel?</legend><div class="msh-rpe-scale">${rpeChoices}</div><p><output data-rpe-output>Choose 1–10</output><small>1 feels very light. 10 feels like maximum effort.</small></p></fieldset><fieldset><legend>How was your energy?</legend><div class="msh-cycle-chips">${energyChoices}</div></fieldset><details><summary>What do you think may have influenced how it felt?</summary><p>Choose any possibilities that fit, including not sure. These remain your attribution—not a system conclusion.</p><div class="msh-cycle-chips msh-attribution-choices">${attributionChoices}</div></details><label class="msh-cycle-field">Anything you want to remember?<textarea name="reflection" rows="4" placeholder="Optional reflection"></textarea></label><p class="msh-movement-boundary">This records your experience. It does not claim that an influence caused the result or turn the reflection into a Discovery.</p><footer><button type="button" class="msh-text-button" data-close-movement>Not now</button><button class="msh-button" type="submit">Save experience</button></footer></form></section>`;
  }
  function render() {
    const renderStarted=performance.now();
    renderCount+=1;
    const storedState=MSHStorage.getState();
    const state=demoMode?MSHCycle.createSyntheticDemoState(storedState,today):storedState;
    MSHCalendarAppearance.apply(MSHCalendarAppearance.getPreference(state));
    if (!demoMode && !state.calendar.predictions.length && MSHCycle.periodSegments(state).length) {
      MSHStorage.updateState(next=>{next.calendar.predictions=MSHCycle.calculatePredictions(next);return next;});
      return render();
    }
    const range=currentRange();
    const importedEvents=window.MSHHealthRecords?MSHHealthRecords.calendarEvents(nativeRangeRecords):[];
    const cycleEvents=MSHCycle.recordedCycleEvents(state);
    const projection=MSHCalendarData.visibleHealthEvents({state,importedEvents,cycleEvents,range});
    const eventIndex=MSHCalendarData.indexByDate(projection.events);
    const timelineResult=activeView==='timeline'?timelineView(state,projection.events,cycleEvents,range):null;
    const view=timelineResult?timelineResult.html:calendarView(state,eventIndex,cycleEvents,range);
    root.innerHTML=`${demoMode?'<aside class="msh-demo-banner"><strong>Synthetic QA demo</strong><span>Five illustrative cycles · not saved to My Health</span><a href="calendar.html">Exit demo</a></aside>':''}<header class="msh-cycle-hero msh-calendar-hero"><div><p class="msh-eyebrow">Calendar · Health in time</p><h1>What is happening when?</h1><p>See health events and life context together through time. Calendar brings forward what you have already recorded without deciding what it means.</p></div>${timeSymbol()}<div class="msh-calendar-today"><span>${prettyDate(today,{weekday:'long',month:'long',day:'numeric'})}</span><strong>Health in time</strong><small>Choose a date to see what was happening around it.</small></div></header><div class="msh-information-key" aria-label="Information classes"><span class="recorded">Recorded</span><span class="estimated">Estimated / predicted</span><span class="education">General education</span><span class="observation">Personal observation</span></div><div class="msh-calendar-view-controls"><nav class="msh-cycle-tabs" role="tablist" aria-label="Calendar views">${tabButton('calendar','Month')}${tabButton('timeline','Timeline')}</nav>${calendarCustomizationControl(state)}</div>${view}${loggingSheet(state)}${movementSheetView(state)}`;
    if (sheetOpen) {
      const flowFieldset=root.querySelector('.msh-cycle-sheet fieldset');
      if(flowFieldset) flowFieldset.insertAdjacentHTML('beforeend',`<label class="msh-cycle-field">Record period through <span>(optional)</span><input type="date" name="endDate" min="${selectedDate}" max="${MSHCycle.addDays(selectedDate,14)}"></label>`);
      const reproductiveDetails=[...root.querySelectorAll('.msh-cycle-sheet details')].find(item=>item.querySelector('summary')?.textContent.includes('Reproductive'));
      if(reproductiveDetails) reproductiveDetails.insertAdjacentHTML('beforeend',`<label class="msh-cycle-field">Sexual activity<select name="sexualActivity"><option value="">Not recorded</option><option>No sexual activity</option><option>Sexual activity recorded</option></select></label><label class="msh-cycle-field">Contraception / protection<input name="contraception" placeholder="Optional"></label><label class="msh-cycle-field">Reproductive-health context<input name="reproductiveHealth" value="${esc((MSHCycle.dailyObservation(state,selectedDate)?.value.sexualReproductive.context)||'')}" placeholder="Optional"></label><label class="msh-cycle-field">Basal / body temperature<input type="number" step="0.01" name="temperature" placeholder="Optional"></label><label class="msh-cycle-field">Weight<input type="number" step="0.1" name="weight" placeholder="Optional"></label>`);
      root.querySelectorAll('.msh-cycle-chips label').forEach(label=>{label.classList.add('msh-cycle-picture-choice');label.querySelector('span')?.insertAdjacentHTML('afterbegin','<i aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M8 13c2-3 5-4 8-2"/></svg></i>')});
      root.querySelector('.msh-cycle-sheet input:not([type=hidden])')?.focus();
    }
    if(movementSheet)root.querySelector('.msh-movement-sheet input:not([type=hidden])')?.focus();
    const durationMs=performance.now()-renderStarted;
    debugPerformance({
      renderCount,
      view:activeView,
      range,
      availableEventCount:projection.availableCount+cycleEvents.length,
      deriveProcessedCount:projection.processedCount,
      visibleEventCount:projection.events.length,
      nativeRecordsConsidered:nativeRangeRecords.length,
      displayedRangeRecordCount:importedEvents.length,
      timelineItemsRendered:timelineResult?.itemCount||0,
      durationMs:Number(durationMs.toFixed(2)),
      domElementCount:root.getElementsByTagName('*').length
    });
    if(!demoMode)requestNativeRange(state,range);
  }
  function changeMonth(delta) { visibleMonth=new Date(visibleMonth.getFullYear(),visibleMonth.getMonth()+delta,1); render(); }
  root.addEventListener('click', event => {
    const semantic=event.target.closest('[data-date],[data-view],[data-month],[data-timeline-page],[data-open-sheet],[data-add-movement],[data-close-sheet],[data-close-movement]');
    if(semantic&&window.MSHFeedback){const type=semantic.matches('[data-close-sheet],[data-close-movement]')?'return':semantic.matches('[data-date],[data-view]')?'select':'reveal';MSHFeedback.emit(type,{source:'calendar',target:semantic});}
    const accentChoice=event.target.closest('[data-calendar-accent]');if(accentChoice){customizationOpen=true;MSHCalendarAppearance.savePreference({accentId:accentChoice.dataset.calendarAccent});render();return;}
    if(event.target.closest('[data-calendar-accent-reset]')){customizationOpen=true;MSHCalendarAppearance.reset();render();return;}
    const directoryChoice=event.target.closest('[data-movement-directory-item]');if(directoryChoice){const item=MSHMovementDirectory.get(directoryChoice.dataset.movementDirectoryItem),form=root.querySelector('[data-movement-plan-form]');if(item&&form){form.elements.namedItem('movementLabel').value=item.label;form.dataset.directoryItemId=item.id;form.dataset.directoryCategory=item.categoryId;const results=form.querySelector('[data-movement-search-results]');if(results)results.innerHTML=`<p class="msh-movement-search-note">Selected from Movement Directory · ${esc(item.categoryLabel)}</p>`;}return;}
    const view=event.target.closest('[data-view]'); if(view){activeView=view.dataset.view;render();return;}
    const timelineNavigation=event.target.closest('[data-timeline-page]');if(timelineNavigation){timelinePage=Math.max(0,timelinePage+(timelineNavigation.dataset.timelinePage==='earlier'?1:-1));render();return;}
    const month=event.target.closest('[data-month]'); if(month){changeMonth(Number(month.dataset.month));return;}
    const date=event.target.closest('[data-date]'); if(date){selectedDate=date.dataset.date;render();return;}
    if(event.target.closest('[data-add-movement]')){sheetOpen=false;movementSheet='plan';movementEventId=null;render();return;}
    const completeMovement=event.target.closest('[data-complete-movement]');if(completeMovement){sheetOpen=false;movementSheet='experience';movementEventId=completeMovement.dataset.completeMovement;render();return;}
    if(event.target.closest('[data-close-movement]')){movementSheet=null;movementEventId=null;render();return;}
    if(event.target.closest('[data-open-sheet]')){movementSheet=null;sheetOpen=true;render();return;}
    if(event.target.closest('[data-log-period]')){selectedDate=today;movementSheet=null;sheetOpen=true;render();return;}
    if(event.target.closest('[data-close-sheet]')){sheetOpen=false;render();return;}
    if(event.target.closest('[data-remove-entry]')){MSHCycle.removeDailyObservation(selectedDate);sheetOpen=false;render();}
  });
  root.addEventListener('change', event => {
    if(event.target.matches('[data-calendar-custom-color]')){customizationOpen=true;MSHCalendarAppearance.savePreference({accentId:'custom',customColor:event.target.value});render();return;}
    if(event.target.matches('[data-calendar-layer]')){customizationOpen=true;MSHStorage.updateState(state=>{state.calendar.settings.layers[event.target.dataset.calendarLayer]=event.target.checked;return state;});render();}
    if(event.target.matches('[data-privacy]')){MSHCycle.updatePrivacy({[event.target.dataset.privacy]:event.target.checked});render();}
    if(event.target.matches('[data-setting="mixHealthTimeline"]')){MSHStorage.updateState(state=>{state.calendar.settings.cycle.mixHealthTimeline=event.target.checked;return state;});render();}
    if(event.target.name==='noSymptoms'&&event.target.checked) root.querySelectorAll('input[name="symptoms"]').forEach(input=>input.checked=false);
    if(event.target.name==='symptoms'&&event.target.checked){const no=root.querySelector('input[name="noSymptoms"]');if(no)no.checked=false;}
  });
  root.addEventListener('submit', event => {
    if(event.target.matches('[data-movement-plan-form]')){event.preventDefault();const data=new FormData(event.target);const saved=MSHMovement.plan({movementLabel:data.get('movementLabel'),directoryItemId:event.target.dataset.directoryItemId||data.get('directoryItemId'),directoryCategory:event.target.dataset.directoryCategory||data.get('directoryCategory'),date:data.get('date'),time:data.get('time'),durationMinutes:data.get('durationMinutes'),notes:data.get('notes')});if(saved){window.MSHFeedback?.emit('record',{source:'calendar-movement'});selectedDate=saved.date;movementSheet=null;movementEventId=null;render();}return;}
    if(event.target.matches('[data-movement-experience-form]')){event.preventDefault();const data=new FormData(event.target);const saved=MSHMovement.recordExperience(data.get('eventId'),{status:data.get('status'),durationMinutes:data.get('durationMinutes'),rpe:data.get('rpe'),energy:data.get('energy'),attributions:data.getAll('attributions'),reflection:data.get('reflection')});if(saved){selectedDate=saved.date;movementSheet=null;movementEventId=null;render();}return;}
    if(!event.target.matches('[data-cycle-form]'))return; event.preventDefault(); const data=new FormData(event.target);
    const value={bleeding:data.get('bleeding'),symptoms:data.getAll('symptoms'),noSymptoms:data.get('noSymptoms')==='on',discharge:data.get('discharge'),moodExperience:{sleep:data.get('sleep')},sexualReproductive:{sexualActivity:data.get('sexualActivity'),contraception:data.get('contraception'),context:data.get('reproductiveHealth')},measurements:{temperature:data.get('temperature'),weight:data.get('weight')},care:{medication:data.get('medication')},note:data.get('note')};
    if(data.get('endDate')&&data.get('bleeding')!=='none') MSHCycle.recordPeriod(data.get('date'),data.get('endDate'),data.get('bleeding'));
    MSHCycle.saveDailyObservation(data.get('date'),value);
    window.MSHFeedback?.emit('record',{source:'calendar-cycle'});
    sheetOpen=false;render();
  });
  root.addEventListener('input',event=>{if(event.target.name==='rpe'){const output=root.querySelector('[data-rpe-output]');if(output)output.textContent=`${event.target.value} / 10 · ${MSHMovement.rpeDescription(event.target.value)}`;}if(event.target.name==='movementLabel'){const form=event.target.form;if(form){form.elements.namedItem('directoryItemId').value='';form.elements.namedItem('directoryCategory').value='';delete form.dataset.directoryItemId;delete form.dataset.directoryCategory;const results=form.querySelector('[data-movement-search-results]');if(results)results.innerHTML=movementSearchResults(event.target.value);}}});
  root.addEventListener('toggle',event=>{if(event.target.matches('[data-calendar-customize]'))customizationOpen=event.target.open;},true);
  root.addEventListener('pointerdown',event=>{if(event.target.closest('[data-calendar-swipe]'))pointerStart={x:event.clientX,id:event.pointerId};});
  root.addEventListener('pointerup',event=>{if(!pointerStart||pointerStart.id!==event.pointerId)return;const delta=event.clientX-pointerStart.x;pointerStart=null;if(Math.abs(delta)>55)changeMonth(delta<0?1:-1);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&(sheetOpen||movementSheet)){sheetOpen=false;movementSheet=null;movementEventId=null;render();}});
  if(window.MSHTheme)MSHTheme.onChange(()=>MSHCalendarAppearance.apply(MSHCalendarAppearance.getPreference()));
  render();
})();
