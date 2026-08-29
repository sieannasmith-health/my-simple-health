/* My Simple Health — YouTube workout Calendar doorway (preview-safe v1) */
(function () {
  'use strict';

  const root = document.querySelector('[data-msh-calendar]');
  if (!root || !window.MSHYouTubeWorkout) return;

  let sheet = null;

  function selectedDate() {
    return root.querySelector('[data-date].is-selected')?.dataset.date ||
      root.querySelector('[data-date][aria-current="date"]')?.dataset.date ||
      new Date().toISOString().slice(0, 10);
  }

  function closeSheet() {
    sheet?.remove();
    sheet = null;
  }

  function ensureDoorway() {
    const actions = root.querySelector('.msh-date-actions');
    if (!actions || actions.querySelector('[data-add-youtube-workout]')) return;
    const movementButton = actions.querySelector('[data-add-movement]');
    if (!movementButton) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'msh-button-secondary';
    button.dataset.addYoutubeWorkout = '';
    button.textContent = 'Add YouTube workout';
    movementButton.insertAdjacentElement('afterend', button);
  }

  function openSheet() {
    closeSheet();
    const date = selectedDate();
    sheet = document.createElement('div');
    sheet.className = 'msh-calendar-generic-entry';
    sheet.innerHTML = `
      <div class="msh-sheet-backdrop" data-close-youtube-workout></div>
      <section class="msh-cycle-sheet" role="dialog" aria-modal="true" aria-labelledby="youtube-workout-title">
        <header>
          <div>
            <p class="msh-eyebrow">Movement · ${date}</p>
            <h2 id="youtube-workout-title">Add YouTube workout</h2>
          </div>
          <button type="button" data-close-youtube-workout aria-label="Close">×</button>
        </header>
        <form data-youtube-workout-form>
          <label class="msh-cycle-field">YouTube link
            <input name="url" type="url" required inputmode="url" autocomplete="url" placeholder="https://youtube.com/watch?v=...">
          </label>
          <p class="msh-date-action-empty" data-youtube-preview-status>Paste a YouTube workout link. In this GitHub preview, MSH recognizes the video but does not call the YouTube API yet.</p>
          <label class="msh-cycle-field">Workout name
            <input name="title" maxlength="160" placeholder="YouTube workout">
          </label>
          <label class="msh-cycle-field">Movement type
            <select name="movementType">
              <option value="strength">Strength training</option>
              <option value="mobility">Mobility</option>
              <option value="yoga">Yoga</option>
              <option value="cycling">Cycling</option>
              <option value="other" selected>Other movement</option>
            </select>
          </label>
          <label class="msh-cycle-field">Duration in minutes
            <input name="durationMinutes" type="number" min="1" max="1440" inputmode="numeric" placeholder="Optional">
          </label>
          <label class="msh-cycle-field">Time
            <input name="time" type="time">
          </label>
          <label class="msh-cycle-field">Anything you want to remember?
            <textarea name="notes" rows="3" maxlength="500" placeholder="Optional"></textarea>
          </label>
          <footer>
            <button type="button" class="msh-text-button" data-close-youtube-workout>Cancel</button>
            <button class="msh-button" type="submit">Add to Calendar</button>
          </footer>
        </form>
      </section>`;
    root.appendChild(sheet);
    sheet.querySelector('input[name="url"]')?.focus();
  }

  function updatePreview(input) {
    const status = sheet?.querySelector('[data-youtube-preview-status]');
    if (!status) return;
    const preview = window.MSHYouTubeWorkout.preview(input.value);
    status.textContent = preview
      ? `Recognized YouTube video ${preview.videoId}. Title, creator and exact duration will populate when the YouTube API is connected.`
      : input.value.trim()
        ? 'That does not look like a supported YouTube video link.'
        : 'Paste a YouTube workout link. In this GitHub preview, MSH recognizes the video but does not call the YouTube API yet.';
  }

  function save(form) {
    const data = new FormData(form);
    const event = window.MSHYouTubeWorkout.plan({
      url: String(data.get('url') || '').trim(),
      date: selectedDate(),
      time: String(data.get('time') || ''),
      title: String(data.get('title') || '').trim(),
      movementType: String(data.get('movementType') || 'other'),
      durationMinutes: String(data.get('durationMinutes') || ''),
      notes: String(data.get('notes') || '').trim()
    });
    if (!event) {
      updatePreview(form.elements.url);
      return;
    }
    window.MSHFeedback?.emit('record', { source: 'calendar-youtube-workout' });
    closeSheet();
    location.reload();
  }

  root.addEventListener('click', event => {
    if (event.target.closest('[data-add-youtube-workout]')) {
      event.preventDefault();
      openSheet();
      return;
    }
    if (event.target.closest('[data-close-youtube-workout]')) {
      event.preventDefault();
      closeSheet();
    }
  });

  root.addEventListener('input', event => {
    if (event.target.matches('[data-youtube-workout-form] input[name="url"]')) updatePreview(event.target);
  });

  root.addEventListener('submit', event => {
    if (!event.target.matches('[data-youtube-workout-form]')) return;
    event.preventDefault();
    save(event.target);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sheet) closeSheet();
  });

  const observer = new MutationObserver(() => {
    if (!sheet) ensureDoorway();
  });
  observer.observe(root, { childList: true });
  ensureDoorway();
})();
