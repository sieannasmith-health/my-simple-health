/* My Simple Health — Connections surface */
(function () {
  'use strict';
  const root = document.querySelector('[data-msh-health-connections]');
  if (!root || !window.MSHConnectedHealth) return;
  const areaOptions = [
    ['movement','Movement','Workouts, steps, energy, exercise time, and distance'],
    ['sleep','Sleep','Sleep intervals and sessions'],
    ['heart_activity','Heart activity','Heart rate and resting heart rate'],
    ['body_measurements','Body measurements','Body mass']
  ];
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[character]);
  function render() {
    const state = MSHConnectedHealth.status();
    const statusText = !state.available ? 'Available in the My Simple Health iPhone app' : state.status === 'syncing' ? 'Syncing…' : state.connected ? (state.partialFailures.length ? 'Connected · some information could not be refreshed' : 'Connected') : 'Not connected';
    const summary = window.MSHHealthRecords?.summary(state.records) || {};
    const recent = [summary.workout && 'recent workout', summary.sleep && 'sleep', summary.restingHeartRate && 'resting heart rate', summary.bodyMass && 'body measurement'].filter(Boolean);
    root.innerHTML = `<div class="msh-health-connection-card"><header><div><p class="msh-eyebrow">Connections</p><h2>Apple Health</h2><p>Choose what My Simple Health may read. Nothing is written back to Apple Health.</p></div><span class="msh-health-connection-status">${esc(statusText)}</span></header>
      <p class="msh-health-privacy-note">Your imported health information stays on this device in Phase 1. It is not added to browser storage or uploaded to the MSH website.</p>
      ${state.connected ? `<p class="msh-health-import-summary">${recent.length ? `Bringing together ${esc(recent.join(', '))}.` : 'Connected. There is no shared information to show yet.'}</p>` : ''}
      <fieldset ${state.connected?'disabled':''}><legend>Information to bring into My Health</legend>${areaOptions.map(([value,label,help])=>`<label><input type="checkbox" value="${value}" data-health-area ${state.selectedAreas.includes(value)?'checked':''}><span><strong>${label}</strong><small>${help}</small></span></label>`).join('')}</fieldset>
      <div class="msh-health-connection-actions">${state.connected ? '<button type="button" data-health-sync>Refresh now</button><button type="button" data-health-manage>Manage in Settings</button><button type="button" data-health-disconnect>Disconnect</button><button type="button" class="is-caution" data-health-remove>Remove imported data</button>' : `<button type="button" data-health-connect ${!state.available?'disabled':''}>Connect Apple Health</button>`}</div>
      <p class="msh-health-live-status" role="status" aria-live="polite">${esc(statusText)}${state.lastSuccessfulSyncAt ? ` · Last refreshed ${esc(new Date(state.lastSuccessfulSyncAt).toLocaleString())}` : ''}</p></div>`;
  }
  const act = async (button, operation) => { button.disabled=true; try { await operation(); } catch (_) {} render(); };
  root.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.matches('[data-health-connect]')) return act(button, () => MSHConnectedHealth.connect([...root.querySelectorAll('[data-health-area]:checked')].map(input=>input.value)));
    if (button.matches('[data-health-sync]')) return act(button, () => MSHConnectedHealth.sync());
    if (button.matches('[data-health-manage]')) return act(button, () => MSHConnectedHealth.manage());
    if (button.matches('[data-health-disconnect]')) return act(button, () => MSHConnectedHealth.disconnect());
    if (button.matches('[data-health-remove]')) return act(button, () => MSHConnectedHealth.removeImportedData());
  });
  window.addEventListener('msh:connected-health-changed', render);
  render();
})();
