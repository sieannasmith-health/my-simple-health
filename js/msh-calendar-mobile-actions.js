/* Calendar mobile action affordances. Keeps the existing Calendar event handlers as source of truth. */
(function(){
  'use strict';
  const root=document.querySelector('[data-msh-calendar]');
  if(!root)return;

  const icons={
    add:'<path d="M12 4v16M4 12h16"/>',
    cycle:'<path d="M12 3c-3.2 4.4-5.4 7.2-5.4 10.2a5.4 5.4 0 0 0 10.8 0C17.4 10.2 15.2 7.4 12 3Z"/>',
    movement:'<path d="M9 4a2 2 0 1 0 0 .1M9 7l3 3 4-1M12 10l-2 4-4 3M11 13l4 5"/>',
    symptoms:'<path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18"/>',
    workouts:'<path d="M5 7h14v10H5zM9 4h6M9 20h6"/>'
  };
  const svg=body=>`<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

  function quickActions(){
    if(root.querySelector('.msh-calendar-quick-actions'))return;
    const bar=document.createElement('nav');
    bar.className='msh-calendar-quick-actions';
    bar.setAttribute('aria-label','Calendar shortcuts');
    bar.innerHTML=`
      <button type="button" class="msh-calendar-quick-action" data-open-health-event aria-label="Add health event">${svg(icons.add)}</button>
      <button type="button" class="msh-calendar-quick-action" data-open-sheet aria-label="Cycle">${svg(icons.cycle)}</button>
      <button type="button" class="msh-calendar-quick-action" data-add-movement aria-label="Movement">${svg(icons.movement)}</button>
      <button type="button" class="msh-calendar-quick-action" data-open-health-event aria-label="Symptoms">${svg(icons.symptoms)}</button>
      <a class="msh-calendar-quick-action" href="movement-library.html#your-workouts-title" aria-label="Workout playlists">${svg(icons.workouts)}</a>`;
    root.prepend(bar);
  }

  function healthIcon(key){
    const map={
      movement:icons.movement,
      cycle:icons.cycle,
      symptoms:'<path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18"/>',
      sexualHealth:'<path d="M12 20 4.5 12.6A4.8 4.8 0 0 1 11 5.5l1 1.3 1-1.3a4.8 4.8 0 0 1 6.5 7.1Z"/>',
      measurements:'<circle cx="12" cy="12" r="8"/><path d="M12 12l3-4M8 17h8"/>'
    };
    return map[key]||icons.add;
  }

  function repairHealthChoices(){
    root.querySelectorAll('.msh-calendar-generic-entry .msh-cycle-chips>button').forEach(button=>{
      if(button.dataset.mshChoiceRepaired==='true')return;
      const key=button.dataset.addCalendarLayer || (button.hasAttribute('data-add-movement')?'movement':button.hasAttribute('data-open-sheet')?'cycle':'');
      if(!key)return;
      const label=button.textContent.trim();
      button.innerHTML=`<span class="msh-health-choice-icon" aria-hidden="true">${svg(healthIcon(key))}</span><span class="msh-health-choice-label">${label}</span>`;
      button.dataset.mshChoiceRepaired='true';
    });
  }

  function sync(){quickActions();repairHealthChoices();}
  sync();
  new MutationObserver(sync).observe(root,{childList:true,subtree:true});
})();
