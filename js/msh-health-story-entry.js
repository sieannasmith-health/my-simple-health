/* My Simple Health — doorway from My Health into the living health story */
(function () {
  'use strict';

  function addDoor(directory) {
    if (!directory || directory.querySelector('[data-msh-health-story-door]')) return;
    const section = document.createElement('section');
    section.dataset.mshHealthStoryDoor = '';
    section.dataset.mshToolId = 'my-health-story';
    section.setAttribute('aria-labelledby', 'my-health-story-tool');
    section.innerHTML = `
      <p class="msh-glass-category">Bigger picture</p>
      <h2 id="my-health-story-tool">My Health Story</h2>
      <p>Bring your reflections, experiences, practices, learning, and health-in-time together into one living picture.</p>
      <a href="my-health-story.html">Open My Health Story <span aria-hidden="true">→</span></a>
      <small>You decide what belongs. Source information stays connected so the story can be reviewed and corrected.</small>`;
    directory.appendChild(section);
    directory.dispatchEvent(new CustomEvent('msh:tools-changed', { bubbles: true }));
  }

  function mount() {
    document.querySelectorAll('.msh-tools-directory').forEach(addDoor);
  }

  function initialize() {
    mount();
    if (!window.MutationObserver) return;
    const target = document.querySelector('[data-msh-dashboard]') || document.body;
    const observer = new MutationObserver(mount);
    observer.observe(target, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
