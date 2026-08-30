/* My Simple Health — expanded Cycle symptom and observation vocabulary */
(function (root) {
  'use strict';
  if (!root.MSHCycle) return;

  const GROUPS = Object.freeze([
    Object.freeze({
      summary: 'Symptoms and comfort',
      items: Object.freeze([
        'abdominal cramps','backache','body aches','breast tenderness','muscle pain','pelvic pain','ovulation pain','joint pain','swelling',
        'bloating','gas','constipation','diarrhea','nausea','reflux','stomach pain','hunger','low appetite','cravings','indigestion',
        'headache','migraine','dizziness','smell sensitivity','fatigue','night sweats','hot flashes','acne','itching','skin changes','painful urination'
      ])
    }),
    Object.freeze({
      summary: 'Mood, energy, and sleep',
      items: Object.freeze([
        'anxiety','irritability','mood changes','lower mood','stress','tension','difficulty focusing','insomnia','poor sleep'
      ])
    })
  ]);

  const ALL = Object.freeze([...new Set(GROUPS.flatMap(group => group.items))]);
  root.MSHCycle = Object.freeze({...root.MSHCycle, SYMPTOMS: ALL, SYMPTOM_GROUPS: GROUPS});

  const title = value => value.replace(/\b\w/g, letter => letter.toUpperCase());
  const escapeHtml = value => String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  function selectedSymptoms(form) {
    const event = root.MSHStorage && root.MSHCycle.dailyObservation(root.MSHStorage.getState(), form.elements.namedItem('date')?.value);
    return new Set(event?.value?.symptoms || []);
  }

  function chip(item, checked) {
    const safe = escapeHtml(item);
    return `<label class="msh-cycle-picture-choice"><input type="checkbox" name="symptoms" value="${safe}" ${checked ? 'checked' : ''}><span><i aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M8 13c2-3 5-4 8-2"/></svg></i>${escapeHtml(title(item))}</span></label>`;
  }

  function enhanceSheet() {
    const form = document.querySelector('[data-cycle-form]');
    if (!form || form.dataset.expandedSymptoms === 'true') return;
    form.dataset.expandedSymptoms = 'true';
    const selected = selectedSymptoms(form);

    GROUPS.forEach(group => {
      const details = [...form.querySelectorAll('details')].find(node => node.querySelector('summary')?.textContent.trim() === group.summary);
      const chips = details?.querySelector('.msh-cycle-chips');
      if (!chips) return;
      chips.innerHTML = group.items.map(item => chip(item, selected.has(item))).join('');
      if (group.summary === 'Symptoms and comfort') {
        chips.insertAdjacentHTML('beforeend', `<label class="msh-cycle-picture-choice"><input type="checkbox" name="noSymptoms"><span><i aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M8 13c2-3 5-4 8-2"/></svg></i>No symptoms</span></label>`);
      }
    });

    const reproductive = [...form.querySelectorAll('details')].find(node => node.querySelector('summary')?.textContent.includes('Reproductive'));
    const discharge = reproductive?.querySelector('input[name="discharge"]');
    if (discharge && !reproductive.querySelector('[data-cycle-discharge-choices]')) {
      discharge.setAttribute('list','msh-cycle-discharge-options');
      discharge.insertAdjacentHTML('afterend', '<datalist id="msh-cycle-discharge-options"><option value="None"><option value="Sticky"><option value="Creamy"><option value="Watery"><option value="Egg-white"><option value="Blood"><option value="Unusual change"></datalist>');
      reproductive.insertAdjacentHTML('beforeend', '<p data-cycle-discharge-choices class="msh-cycle-field"><small>Cervical observations can also be recorded here, including firmness, mucus, or opening, in your own words.</small></p>');
    }
  }

  const host = document.querySelector('[data-msh-calendar]');
  if (!host) return;
  new MutationObserver(enhanceSheet).observe(host,{childList:true,subtree:true});
  enhanceSheet();
})(window);