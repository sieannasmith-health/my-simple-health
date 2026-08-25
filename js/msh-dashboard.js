/* My Simple Health — calm personal workspace home */
(function () {
  'use strict';
  const root = document.querySelector('[data-msh-dashboard]');
  if (!root || !window.MSHStorage) return;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function newest(items) {
    return [...items].sort((a, b) =>
      new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0)
    )[0] || null;
  }

  function wheelSvg(wheel) {
    if (!wheel || !wheel.scores) return '';
    const keys = ['physical','emotional','social','occupational','financial','environmental','intellectual','spiritual'];
    const points = keys.map((key, index) => {
      const angle = -Math.PI / 2 + index * Math.PI / 4;
      const radius = 15 + (Number(wheel.scores[key]) || 0) * 3.4;
      return `${55 + Math.cos(angle) * radius},${55 + Math.sin(angle) * radius}`;
    }).join(' ');
    return `<svg class="msh-dashboard-wheel" viewBox="0 0 110 110" role="img" aria-label="Your populated Wellness Wheel"><g><circle cx="55" cy="55" r="42"></circle><circle cx="55" cy="55" r="27"></circle><circle cx="55" cy="55" r="12"></circle></g><polygon points="${points}"></polygon></svg>`;
  }

  function sectionHeading(title, action, href) {
    return `<header class="msh-dashboard-section-heading"><h2>${esc(title)}</h2>${action && href ? `<a href="${href}">${esc(action)} <span aria-hidden="true">→</span></a>` : ''}</header>`;
  }

  function render() {
    const state = MSHStorage.getState();
    const landscape = MSHStorage.getCurrentLandscape(state);
    const wheel = state.wellnessWheel.current;
    const vision = MSHStorage.getCurrentVision(state);
    const project = MSHStorage.getActiveProject(state);
    const practice = MSHStorage.getActivePractice(state);
    const learning = MSHStorage.getCurrentLearning(state);
    const latestLearning = learning[0];
    const latestReflection = newest(state.reflections);
    const events = [...state.progressEvents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const latestEvent = events[0];
    const focus = state.focuses.find(item => item.status === 'active') || null;
    const cycleStatus = window.MSHCycle && state.calendar.privacy.workspace
      ? MSHCycle.estimatedStatus(state, MSHCycle.toDateKey(new Date())) : null;
    const projectHistory = state.projects.filter(item => item.status !== 'active');
    const started = Boolean(wheel || landscape || vision || project || practice || learning.length || events.length);

    root.innerHTML = `
      <header class="msh-dashboard-home-intro">
        <p class="msh-eyebrow">My Health</p>
        <h1>${started ? 'Your health journey, in one clear place.' : 'Begin with what is true for you.'}</h1>
        <p>${started ? 'See what you have shared, chosen, tried, and learned—then return to the part of your health that matters now.' : 'A calm place to understand where you are, choose what matters, and learn from what happens.'}</p>
      </header>

      <section class="msh-dashboard-section">
        ${sectionHeading('Where I am', 'Open Landscape', 'my-landscape.html')}
        <div class="msh-dashboard-two-column">
          <article class="msh-dashboard-panel msh-dashboard-panel-accent">
            <div class="msh-dashboard-panel-copy">
              <p class="msh-card-kicker">Current picture</p>
              <h3>${wheel ? 'My Wellness Wheel is mapped.' : landscape ? 'My current Landscape is mapped.' : 'My current picture is still open.'}</h3>
              <p>${wheel ? 'Your latest Wellness Wheel is available as one part of your Landscape. It reflects what you shared, not a diagnosis or instruction.' : landscape ? 'Your Landscape holds what appears to fit, what feels mixed, and what may be worth noticing.' : 'Begin with the Wellness Wheel or Landscape when a broader picture would be useful.'}</p>
            </div>
            ${wheelSvg(wheel)}
          </article>
          <article class="msh-dashboard-panel">
            <p class="msh-card-kicker">Where I’m headed</p>
            <h3>${vision ? esc(vision.synthesis.statement) : 'You do not need to have the direction figured out yet.'}</h3>
            <p>${vision ? 'This is the Current Vision you confirmed from your own words.' : 'Your Vision can develop as something becomes clearer.'}</p>
            <a class="msh-dashboard-card-link" href="my-vision.html">${vision ? 'Open My Vision' : 'Explore My Vision'} →</a>
          </article>
        </div>
      </section>

      <section class="msh-dashboard-section">
        ${sectionHeading('What I’m working on', 'Open Project', 'my-project.html')}
        <article class="msh-dashboard-panel msh-dashboard-project-panel">
          <p class="msh-card-kicker">Current Project</p>
          ${project ? `<h3>${esc(project.title)}</h3><div class="msh-dashboard-point-pair"><div><span>Point A · Now</span><p>${esc(project.pointA)}</p></div><i aria-hidden="true"></i><div><span>Point B · Direction</span><p>${esc(project.pointB)}</p></div></div>${project.milestone ? `<p class="msh-dashboard-milestone"><strong>First milestone:</strong> ${esc(project.milestone)}</p>` : ''}` : `<h3>No active Project right now.</h3><p>Something becomes a Project only when you decide it is worth actively working on.</p>${focus ? `<p><strong>Your current focus:</strong> ${esc(focus.label)}</p>` : ''}`}
          ${projectHistory.length ? `<a class="msh-dashboard-card-link" href="my-project.html">View ${projectHistory.length} past or paused Project${projectHistory.length === 1 ? '' : 's'} →</a>` : ''}
        </article>
      </section>

      <section class="msh-dashboard-section">
        ${sectionHeading('What I’m practicing and learning', '', '')}
        <div class="msh-dashboard-two-column">
          <article class="msh-dashboard-panel">
            <p class="msh-card-kicker">Practice</p>
            <h3>${practice ? esc(practice.title) : 'Nothing to try right now.'}</h3>
            <p>${practice ? esc(practice.description) : 'A Practice appears when you choose an experiment worth trying in real life.'}</p>
            <a class="msh-dashboard-card-link" href="my-practice.html">${practice ? 'Open My Practice' : 'View Practice'} →</a>
          </article>
          <article class="msh-dashboard-panel">
            <p class="msh-card-kicker">Learning</p>
            <h3>${latestLearning ? esc(latestLearning.statement) : 'Learning grows from experience.'}</h3>
            <p>${latestLearning ? `Current state: ${esc(latestLearning.confidence === 'confirmed' ? 'established' : latestLearning.confidence)}.` : 'What you notice can remain tentative, be tested, and change over time.'}</p>
            <a class="msh-dashboard-card-link" href="my-learning.html">Open My Learning →</a>
          </article>
        </div>
      </section>

      <section class="msh-dashboard-section">
        ${sectionHeading('What has changed', 'Open Progress', 'my-progress.html')}
        <div class="msh-dashboard-three-column">
          <article class="msh-dashboard-panel"><p class="msh-card-kicker">Latest movement</p><h3>${latestEvent ? esc(latestEvent.statement) : 'No movement has been recorded yet.'}</h3><p>${latestEvent ? new Date(latestEvent.createdAt).toLocaleDateString(undefined, { month:'long', day:'numeric', year:'numeric' }) : 'Progress includes choices, attempts, changes, reflections, learning, pauses, and returns.'}</p></article>
          <article class="msh-dashboard-panel"><p class="msh-card-kicker">Recent reflection</p><h3>${latestReflection ? esc(latestReflection.statement) : 'No reflection recorded yet.'}</h3><p>${latestReflection ? 'This is what you recorded from your experience.' : 'Reflection helps the story behind an action remain visible.'}</p></article>
          <article class="msh-dashboard-panel"><p class="msh-card-kicker">Project history</p><h3>${projectHistory.length ? `${projectHistory.length} past or paused Project${projectHistory.length === 1 ? '' : 's'}` : 'Nothing in history yet.'}</h3><p>Completed and paused Projects stay available instead of disappearing.</p></article>
        </div>
      </section>

      <section class="msh-dashboard-section msh-dashboard-next-section">
        ${sectionHeading('Where I can go next', '', '')}
        <div class="msh-dashboard-next-actions">
          <a href="my-landscape.html">Review My Landscape</a>
          <a href="my-practice.html">Continue My Practice</a>
          <a href="my-progress.html">See My Progress</a>
          <a href="calendar.html">Open Calendar</a>
        </div>
        ${cycleStatus && cycleStatus.cycleDay ? `<article class="msh-dashboard-cycle-note"><span>Today</span><p>Cycle day ${cycleStatus.cycleDay}${cycleStatus.phase ? ` · estimated ${esc(cycleStatus.phase)} phase` : ''}</p><a href="calendar.html">Open Cycle layer →</a></article>` : ''}
        <article class="msh-dashboard-hello-panel">
          <div><p class="msh-card-kicker">Hello</p><h3>Connect the pieces of your health experience.</h3><p>Hello can work across the health information, questions, choices, experiences, and learning you have shared—while keeping your words distinct from system observations and tentative inferences.</p></div>
          <a class="msh-button" href="hello.html?from=my-health">Continue with Hello →</a>
        </article>
      </section>

      <p class="msh-local-note"><strong>Prototype privacy:</strong> My Health data is stored in this browser on this device. Clearing site data may remove it.</p>`;
  }

  document.addEventListener('DOMContentLoaded', render);
})();
