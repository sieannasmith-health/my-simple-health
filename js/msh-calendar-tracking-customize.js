/* My Simple Health — Calendar tracking choices */
(function () {
  'use strict';

  const root = document.querySelector('[data-msh-calendar]');
  if (!root || !window.MSHStorage) return;

  const OPTIONS = Object.freeze([
    ['movement', 'Movement'],
    ['cycle', 'Cycle'],
    ['symptoms', 'Symptoms'],
    ['medications', 'Medication'],
    ['sexualHealth', 'Sexual health'],
    ['care', 'Care & appointments'],
    ['measurements', 'Measurements'],
    ['life', 'Life context'],
    ['observations', 'Observations']
  ]);

  function selected() {
    return MSHStorage.getState()?.settings?.memory?.calendarQuickAdd || {};
  }

  function render() {
    const menu = root.querySelector('.msh-calendar-customization-menu');
    if (!menu) return;
    let section = menu.querySelector('[data-calendar-tracking-choices]');
    const choices = selected();
    const markup = `
      <p class="msh-calendar-customize-label">Tracking</p>
      <h2>What do you want to track?</h2>
      <p>Choose only what you want available when you select a day. You can change this anytime.</p>
      <fieldset class="msh-calendar-layers">
        <legend>Calendar add options</legend>
        ${OPTIONS.map(([key, label]) => `<label><input type="checkbox" data-calendar-quick-add="${key}" ${choices[key] === true ? 'checked' : ''}><span>${label}</span></label>`).join('')}
      </fieldset>`;

    if (!section) {
      section = document.createElement('section');
      section.className = 'msh-calendar-layer-settings';
      section.dataset.calendarTrackingChoices = '';
      menu.prepend(section);
    }
    if (section.innerHTML !== markup) section.innerHTML = markup;
  }

  root.addEventListener('change', event => {
    const input = event.target.closest('[data-calendar-quick-add]');
    if (!input) return;
    const key = input.dataset.calendarQuickAdd;
    MSHStorage.updateState(state => {
      state.settings ||= {};
      state.settings.memory ||= {};
      state.settings.memory.calendarQuickAdd ||= {};
      state.settings.memory.calendarQuickAdd[key] = input.checked;
      return state;
    });
    window.dispatchEvent(new CustomEvent('msh:calendar-quick-actions-changed'));
  });

  const observer = new MutationObserver(render);
  observer.observe(root, { childList: true });
  render();
})();
