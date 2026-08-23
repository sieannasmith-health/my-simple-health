/* My Simple Health — My Vision */
(function () {
  'use strict';

  const mount = document.querySelector('[data-msh-vision]');
  const storage = window.MSHStorage;
  if (!mount || !storage) return;

  const prompts = [
    { key: 'life', label: 'The life I want to live', prompt: 'When life is fitting well, what does it feel like or make room for?' },
    { key: 'protect', label: 'What I want to protect', prompt: 'What is already important or working well that you do not want growth or change to crowd out?' },
    { key: 'more', label: 'What I want more room for', prompt: 'What would you like to have more space, time, energy, or attention for?' },
    { key: 'less', label: 'What I want less of', prompt: 'What would you like to carry less of, reduce, simplify, or no longer organize your life around?' },
    { key: 'becoming', label: 'Who I am becoming', prompt: 'What qualities, ways of living, or ways of relating to yourself and others matter to you?' },
    { key: 'future', label: 'What I am building toward', prompt: 'Is there anything you hope becomes true in the future, even if you do not know the path yet?' }
  ];

  function esc(value) {
    return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return `vision_${crypto.randomUUID()}`;
    return `vision_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  }

  function currentVision() {
    return [...storage.getState().visionEntries]
      .filter(entry => entry.status === 'current')
      .sort((a,b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0] || null;
  }

  function render() {
    const vision = currentVision();
    mount.innerHTML = `
      <section class="msh-vision-header">
        <p class="msh-eyebrow">Where I'm headed</p>
        <h1>My Vision</h1>
        <p>Your Vision is not a perfect future you have to achieve. It is a place to keep what becomes clear about the life you want to live.</p>
      </section>

      <section class="msh-vision-editor">
        <div class="msh-vision-intro-card">
          <strong>You do not need to answer everything.</strong>
          <p>Write what you know now. Leave the rest open. Your Vision can change as you learn more about yourself and your life.</p>
        </div>

        <form data-vision-form>
          ${prompts.map(item => `
            <div class="msh-vision-prompt">
              <label for="vision-${item.key}">
                <span>${esc(item.label)}</span>
                <strong>${esc(item.prompt)}</strong>
              </label>
              <textarea id="vision-${item.key}" data-vision-field="${item.key}" rows="4" placeholder="Write what feels true to you right now...">${esc(vision && vision.responses ? vision.responses[item.key] || '' : '')}</textarea>
            </div>`).join('')}

          <div class="msh-vision-statement">
            <label for="vision-statement"><span>Your current direction</span><strong>If you wanted to say it simply, what kind of life are you trying to build?</strong></label>
            <textarea id="vision-statement" data-vision-statement rows="4" placeholder="For example: I want a life that...">${esc(vision ? vision.statement || '' : '')}</textarea>
            <p>This does not have to sound polished. It is for navigation, not performance.</p>
          </div>

          <div class="msh-card-actions">
            <button class="msh-button" type="submit">${vision ? 'Update My Vision' : 'Save My Vision'}</button>
            <a class="msh-button-secondary" href="my-health.html">Return to My Health</a>
          </div>
        </form>
      </section>

      ${vision ? `
        <section class="msh-vision-current">
          <p class="msh-eyebrow">Current Vision</p>
          <blockquote>${esc(vision.statement || 'Your detailed reflections are saved even without a one-sentence direction.')}</blockquote>
          <p>Last updated ${new Date(vision.updatedAt || vision.createdAt).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}</p>
        </section>` : ''}
    `;
  }

  mount.addEventListener('submit', event => {
    if (!event.target.matches('[data-vision-form]')) return;
    event.preventDefault();

    const responses = {};
    prompts.forEach(item => {
      const field = mount.querySelector(`[data-vision-field="${item.key}"]`);
      responses[item.key] = field ? field.value.trim() : '';
    });
    const statement = mount.querySelector('[data-vision-statement]').value.trim();
    const hasContent = statement || Object.values(responses).some(Boolean);
    if (!hasContent) return;

    const existing = currentVision();
    storage.updateState(state => {
      if (existing) {
        const entry = state.visionEntries.find(item => item.id === existing.id);
        entry.responses = responses;
        entry.statement = statement;
        entry.updatedAt = new Date().toISOString();
      } else {
        state.visionEntries.forEach(entry => { if (entry.status === 'current') entry.status = 'historical'; });
        state.visionEntries.push({ id: uid(), status: 'current', statement, responses, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      }
      return state;
    });
    render();
    window.scrollTo({top:0,behavior:'smooth'});
  });

  render();
})();
