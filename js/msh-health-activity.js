/* My Simple Health — real Apple Health Activity, projected from the existing in-memory bridge. */
(function () {
  'use strict';
  const root = document.querySelector('[data-msh-health-activity]');
  if (!root || new URLSearchParams(location.search).get('view') !== 'activity') return;
  const dashboard = document.querySelector('[data-msh-dashboard]');
  const connections = document.querySelector('[data-msh-health-connections]');
  if (dashboard) dashboard.hidden = true;
  if (connections) connections.hidden = true;
  root.hidden = false;
  let range = 7;
  let initialSyncRequested = false;

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[character]);
  const number = (value, digits=0) => new Intl.NumberFormat(undefined,{maximumFractionDigits:digits}).format(value);
  const dateTime = value => new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value));
  const dayLabel = value => new Intl.DateTimeFormat(undefined,{weekday:range===7?'short':undefined,month:range===30?'numeric':undefined,day:'numeric'}).format(new Date(`${value}T12:00:00`));
  const distance = meters => {
    const usesMiles = /^en-US\b/i.test(navigator.language || '');
    return usesMiles ? {value:meters/1609.344,unit:'mi'} : {value:meters/1000,unit:'km'};
  };
  const duration = seconds => {
    const minutes = Math.max(0,Math.round(Number(seconds || 0)/60));
    if (minutes < 60) return `${number(minutes)} min`;
    const hours = Math.floor(minutes/60); const remainder = minutes%60;
    return `${hours} hr${remainder ? ` ${remainder} min` : ''}`;
  };
  function metricCard(label, metric, formatter, detail) {
    if (!metric) return `<article><p>${esc(label)}</p><strong>—</strong><span>No value shared for today</span></article>`;
    const formatted = formatter(metric.value);
    return `<article><p>${esc(label)}</p><strong>${esc(formatted.value)}</strong><span>${esc(formatted.unit)}${detail ? ` · ${esc(detail)}` : ''}</span></article>`;
  }
  function chartMetric(days) {
    const choices = [
      {key:'steps',label:'Steps',unit:'steps',format:value=>number(Math.round(value))},
      {key:'exerciseTime',label:'Exercise time',unit:'minutes',format:value=>number(Math.round(value/60))},
      {key:'activeEnergy',label:'Active energy',unit:'kcal',format:value=>number(Math.round(value))},
      {key:'distanceWalkingRunning',label:'Walking + running distance',unit:'km',format:value=>number(value/1000,2)}
    ];
    return choices.map(choice => ({...choice,count:days.filter(day=>day[choice.key]).length})).sort((a,b)=>b.count-a.count)[0];
  }
  function chart(snapshot) {
    const days = snapshot.days.slice(-range);
    const metric = chartMetric(days);
    if (!metric || !metric.count) return '<div class="msh-activity-empty"><p>No daily movement values are available for this period.</p><span>If you chose not to share a type, or nothing was recorded, MSH leaves that space open.</span></div>';
    const values = days.map(day => day[metric.key]?.value ?? null);
    const maximum = Math.max(...values.filter(value=>value != null),1);
    return `<div class="msh-activity-chart-legend"><span><i></i>${esc(metric.label)}</span><span><b></b>Workout recorded</span></div><div class="msh-activity-chart" style="--activity-days:${range}" role="img" aria-label="${esc(metric.label)} over ${range} days">
      ${days.map((day,index) => {
        const value = values[index];
        const height = value == null ? 0 : Math.max(4,(value/maximum)*100);
        const workout = day.workoutCount>0;
        const spoken = value == null ? `No ${metric.label.toLowerCase()} value shared` : `${metric.format(value)} ${metric.unit}`;
        return `<div class="msh-activity-day" aria-label="${esc(`${dayLabel(day.day)}: ${spoken}${workout ? `; ${day.workoutCount} workout${day.workoutCount===1?'':'s'} recorded` : ''}`)}"><div class="msh-activity-bar-track"><span style="height:${height}%"></span>${workout?'<i></i>':''}</div><small>${range===7 || index%5===0 || index===days.length-1 ? esc(dayLabel(day.day)) : ''}</small></div>`;
      }).join('')}
    </div><p class="msh-activity-chart-note">Bars scale to the values available in this period. They are not progress toward a goal.</p>`;
  }
  function workouts(snapshot) {
    const cutoff = Date.now()-30*86400000;
    const recent = snapshot.workouts.filter(workout=>new Date(workout.eventStart).getTime()>=cutoff).slice(0,20);
    if (!recent.length) return '<div class="msh-activity-empty"><p>No workouts were recorded in the last 30 days.</p><span>That is simply what is available from Apple Health, not a missed target.</span></div>';
    return `<div class="msh-activity-workouts">${recent.map(workout => {
      const details = [duration(workout.durationSeconds)];
      if (workout.activeEnergy) details.push(`${number(Math.round(workout.activeEnergy.value))} kcal`);
      if (workout.distance) { const shown=distance(workout.distance.value); details.push(`${number(shown.value,2)} ${shown.unit}`); }
      return `<article><div><p>${esc(workout.activityName)}</p><time datetime="${esc(workout.eventStart)}">${esc(dateTime(workout.eventStart))}</time></div><span>${esc(details.join(' · '))}</span></article>`;
    }).join('')}</div>`;
  }
  function unavailable(state) {
    const native = state.available;
    return `<div class="msh-activity-shell"><nav><a href="my-health.html?view=tools">← Tools</a></nav><header><p class="msh-eyebrow">My Health · Activity</p><h1>Movement, as it was recorded.</h1><p>${native ? 'Connect the Movement area in Apple Health to bring recorded activity into this on-device view.' : 'Activity from Apple Health is available in the My Simple Health iPhone app.'}</p></header><div class="msh-activity-empty"><p>${native ? 'Movement is not connected yet.' : 'Apple Health is not available in this browser.'}</p><a href="my-health.html#apple-health-connection">${native ? 'Open Apple Health connection' : 'Back to My Health'} →</a></div></div>`;
  }
  function render() {
    const state = window.MSHConnectedHealth?.status() || {available:false,connected:false,selectedAreas:[],records:[]};
    if (!state.available || !state.connected || !state.selectedAreas.includes('movement')) { root.innerHTML=unavailable(state); return; }
    const snapshot = window.MSHHealthRecords.activity(state.records,{days:30});
    const today = snapshot.today;
    const shownDistance = today.distanceWalkingRunning ? distance(today.distanceWalkingRunning.value) : null;
    root.innerHTML = `<div class="msh-activity-shell">
      <nav><a href="my-health.html?view=tools">← Tools</a><button type="button" data-activity-refresh>Refresh from Apple Health</button></nav>
      <header><p class="msh-eyebrow">My Health · Activity</p><h1>Movement, as it was recorded.</h1><p>Today, workouts, and recent movement from the Apple Health information you chose to share. No goals or streaks are applied.</p></header>
      <section aria-labelledby="activity-today"><div class="msh-activity-heading"><div><p class="msh-eyebrow">Today</p><h2 id="activity-today">What is available today</h2></div><span>${esc(new Intl.DateTimeFormat(undefined,{month:'long',day:'numeric'}).format(new Date()))}</span></div>
        <div class="msh-activity-metrics">
          ${metricCard('Steps',today.steps,value=>({value:number(Math.round(value)),unit:'steps'}))}
          ${metricCard('Active energy',today.activeEnergy,value=>({value:number(Math.round(value)),unit:'kcal'}))}
          ${metricCard('Exercise time',today.exerciseTime,value=>({value:number(Math.round(value/60)),unit:'minutes'}))}
          ${shownDistance ? metricCard('Walking + running',today.distanceWalkingRunning,()=>({value:number(shownDistance.value,2),unit:shownDistance.unit})) : metricCard('Walking + running',null,()=>({}))}
          <article><p>Recorded workouts</p><strong>${number(today.workoutCount)}</strong><span>${today.workoutCount===1?'workout':'workouts'} today</span></article>
        </div>
      </section>
      <section aria-labelledby="activity-workouts"><div class="msh-activity-heading"><div><p class="msh-eyebrow">Workouts</p><h2 id="activity-workouts">Recent recorded workouts</h2></div><span>Last 30 days</span></div>${workouts(snapshot)}</section>
      <section aria-labelledby="activity-over-time"><div class="msh-activity-heading"><div><p class="msh-eyebrow">Movement over time</p><h2 id="activity-over-time">A recent view</h2></div><div class="msh-activity-range" role="group" aria-label="Movement time range"><button type="button" data-activity-range="7" aria-pressed="${range===7}">7 days</button><button type="button" data-activity-range="30" aria-pressed="${range===30}">30 days</button></div></div>${chart(snapshot)}</section>
      <section class="msh-activity-context" aria-labelledby="activity-context"><p class="msh-eyebrow">In Context</p><h2 id="activity-context">Movement is one part of the picture.</h2><p>As enough information becomes available, My Simple Health will be able to place movement alongside the broader health picture. This space does not make causal or personalized interpretations yet.</p></section>
      <footer><p>Imported Apple Health information remains on this device in Phase 1. MSH does not write this information back to HealthKit.</p></footer>
    </div>`;
  }
  function update() {
    render();
    const state = window.MSHConnectedHealth?.status();
    if (!initialSyncRequested && state?.available && state.connected && state.selectedAreas.includes('movement')) {
      initialSyncRequested = true;
      window.MSHConnectedHealth.sync(['movement']).catch(()=>{});
    }
  }
  root.addEventListener('click', event => {
    const rangeButton = event.target.closest('[data-activity-range]');
    if (rangeButton) { range=Number(rangeButton.dataset.activityRange); render(); return; }
    const refresh = event.target.closest('[data-activity-refresh]');
    if (refresh) { refresh.disabled=true; window.MSHConnectedHealth.sync(['movement']).catch(()=>{}); }
  });
  window.addEventListener('msh:connected-health-changed', update);
  render();
})();
