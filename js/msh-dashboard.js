/* My Simple Health — My Health dashboard V1 */
(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderDashboard() {
    const root = document.querySelector('[data-msh-dashboard]');
    if (!root || !window.MSHStorage) return;

    const state = MSHStorage.getState();
    const landscape = MSHStorage.getCurrentLandscape(state);
    const project = MSHStorage.getActiveProject(state);
    const practice = MSHStorage.getActivePractice(state);
    const learning = MSHStorage.getCurrentLearning(state);
    const vision = state.visionEntries.filter(entry => entry.status === 'current');
    const focus = state.focuses.find(item => item.status === 'active') || null;
    const progress = [...state.progressEvents].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const nowText = project ? project.pointA : (focus ? focus.label : 'Start by noticing what is true for you right now.');
    const headedText = project ? project.pointB : (vision[0] ? vision[0].statement : 'Clarify what you want to protect, change, or make more room for.');
    const learningText = learning[0] ? learning[0].statement : 'As you try things and reflect, useful learning can collect here.';

    root.innerHTML = `
      <section class="msh-journey-strip" aria-label="Your My Simple Health journey">
        <div class="msh-journey-step">
          <span class="msh-journey-label">Now</span>
          <strong>${escapeHtml(nowText)}</strong>
        </div>
        <div class="msh-journey-arrow" aria-hidden="true">→</div>
        <div class="msh-journey-step">
          <span class="msh-journey-label">Where I'm headed</span>
          <strong>${escapeHtml(headedText)}</strong>
        </div>
        <div class="msh-journey-arrow" aria-hidden="true">→</div>
        <div class="msh-journey-step">
          <span class="msh-journey-label">What I'm learning</span>
          <strong>${escapeHtml(learningText)}</strong>
        </div>
      </section>

      <section class="msh-dashboard-grid">
        <article class="msh-card msh-card-wide">
          <p class="msh-card-kicker">Where I am</p>
          <h2>Your Landscape</h2>
          ${landscape ? `
            <p>Your latest Landscape is ready to revisit. This dashboard will surface its most useful current signals here.</p>
            <div class="msh-card-actions"><a class="msh-button" href="my-landscape.html">View My Landscape</a></div>
          ` : `
            <div class="msh-empty-state">
              <strong>Want a broader picture of where you are?</strong>
              <p>Your Landscape will help you notice what's working, what feels mixed, and what may be worth your attention. It is not a grade.</p>
            </div>
            <div class="msh-card-actions">
              <span class="msh-button" aria-disabled="true">Explore My Landscape — coming next</span>
              <a class="msh-button-secondary" href="hello.html">I already know what I need help with</a>
            </div>
          `}
        </article>

        <article class="msh-card">
          <p class="msh-card-kicker">Chosen by me</p>
          <h2>What Matters Now</h2>
          ${focus ? `
            <h3>${escapeHtml(focus.label)}</h3>
            <p>This is something you chose as worth your attention.</p>
          ` : `
            <div class="msh-empty-state">
              <strong>Nothing needs your active attention right now.</strong>
              <p>A difficult area never has to become a goal just because the app noticed it.</p>
            </div>
          `}
        </article>

        <article class="msh-card">
          <p class="msh-card-kicker">Capacity</p>
          <h2>My Plate</h2>
          <div class="msh-empty-state">
            <strong>No capacity check yet.</strong>
            <p>When you decide to work on something, My Simple Health can consider how much room you actually have before adding more.</p>
          </div>
        </article>

        <article class="msh-card msh-card-wide">
          <p class="msh-card-kicker">Direction</p>
          <h2>My Vision</h2>
          ${vision.length ? `
            <p>${escapeHtml(vision[0].statement)}</p>
          ` : `
            <div class="msh-empty-state">
              <strong>You don't need to have everything figured out.</strong>
              <p>Add to your Vision whenever something becomes clearer: what matters, what you want to protect, what you want more room for, or what you're building toward.</p>
            </div>
          `}
        </article>

        <article class="msh-card msh-card-wide">
          <p class="msh-card-kicker">Point A → Point B</p>
          <h2>Current Project</h2>
          ${project ? `
            <h3>${escapeHtml(project.title)}</h3>
            <ul class="msh-status-list">
              <li><span class="msh-status-label">Now</span>${escapeHtml(project.pointA)}</li>
              <li><span class="msh-status-label">Where I'm headed</span>${escapeHtml(project.pointB)}</li>
            </ul>
          ` : `
            <div class="msh-empty-state">
              <strong>No active Project.</strong>
              <p>Something only becomes a Project when you decide it is worth actively working on.</p>
            </div>
          `}
        </article>

        <article class="msh-card">
          <p class="msh-card-kicker">Applied practice</p>
          <h2>What I'm Trying</h2>
          ${practice ? `
            <h3>${escapeHtml(practice.title)}</h3>
            <p>${escapeHtml(practice.description)}</p>
          ` : `
            <div class="msh-empty-state">
              <strong>Nothing to try right now.</strong>
              <p>When you choose a small practice, experiment, boundary, or change, it will live here.</p>
            </div>
          `}
        </article>

        <article class="msh-card">
          <p class="msh-card-kicker">Personal knowledge</p>
          <h2>What I'm Learning</h2>
          ${learning.length ? `
            <ul class="msh-learning-list">${learning.slice(0, 2).map(item => `<li>${escapeHtml(item.statement)}</li>`).join('')}</ul>
          ` : `
            <div class="msh-empty-state">
              <strong>This grows from experience.</strong>
              <p>Useful things you confirm about what fits, helps, matters, or remains uncertain can collect here.</p>
            </div>
          `}
        </article>

        <article class="msh-card msh-card-wide">
          <p class="msh-card-kicker">Movement over time</p>
          <h2>Progress</h2>
          ${progress.length ? `
            <ul class="msh-status-list">${progress.slice(0, 4).map(item => `<li><span class="msh-status-label">${escapeHtml(item.progressType)}</span>${escapeHtml(item.statement)}</li>`).join('')}</ul>
          ` : `
            <div class="msh-empty-state">
              <strong>Progress is more than completion.</strong>
              <p>Movement, learning, preserving what works, and adapting when something doesn't fit can all appear here.</p>
            </div>
          `}
        </article>

        <article class="msh-card">
          <p class="msh-card-kicker">Open questions</p>
          <h2>Still Figuring Out</h2>
          <div class="msh-empty-state">
            <strong>Nothing here yet.</strong>
            <p>Questions do not have to become tasks. My Simple Health can hold uncertainty while you learn.</p>
          </div>
        </article>

        <article class="msh-card">
          <p class="msh-card-kicker">Science + your life</p>
          <h2>Hello</h2>
          <p>Ask a health question, understand something in your Landscape, or think through what makes sense next.</p>
          <div class="msh-card-actions"><a class="msh-button" href="hello.html">Talk to Hello</a></div>
        </article>
      </section>

      <p class="msh-local-note"><strong>Prototype privacy:</strong> My Health workspace data is stored in this browser on this device. Clearing site data may remove it.</p>
    `;
  }

  document.addEventListener('DOMContentLoaded', renderDashboard);
})();
