/* My Simple Health — Tools directory additions */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  if (params.get('view') !== 'tools') return;

  const tool = params.get('tool');

  function toolsDirectory() {
    const directory = document.querySelector('.msh-tools-directory');
    if (!directory || directory.dataset.extendedTools === 'true') return;
    directory.dataset.extendedTools = 'true';
    directory.insertAdjacentHTML('beforeend', `
      <section aria-labelledby="food-tools">
        <p class="msh-glass-category">Food & nutrition</p>
        <h2 id="food-tools">My Food</h2>
        <p>Keep your foods, meals, recipes, what you have on hand, and what you need in one personal food workspace.</p>
        <a href="my-health.html?view=tools&tool=food">Open My Food <span aria-hidden="true">→</span></a>
      </section>
      <section aria-labelledby="finance-tools">
        <p class="msh-glass-category">Life context</p>
        <h2 id="finance-tools">Finances</h2>
        <p>Bring financial context into view when it matters to your health, choices, resources, or everyday life.</p>
        <a href="my-health.html?view=tools&tool=finances">Open Finances <span aria-hidden="true">→</span></a>
      </section>`);
  }

  function renderToolPage(kind) {
    const root = document.querySelector('[data-msh-dashboard]');
    if (!root || !window.MSHGlassWorkspace) return;
    const isFood = kind === 'food';
    const body = isFood
      ? `<div class="msh-tools-directory msh-glide" data-msh-interaction="glide" data-msh-glide-label="My Food" data-msh-glide-item="food-tool">
          <section><p class="msh-glass-category">Your food</p><h2>Your Food</h2><p>Your personal ingredient library and foods you use.</p><a href="nutrition.html">Explore nutrition resources <span aria-hidden="true">↗</span></a></section>
          <section><p class="msh-glass-category">Your kitchen</p><h2>On Hand</h2><p>Keep track of what is currently in your fridge, freezer, and pantry.</p></section>
          <section><p class="msh-glass-category">What you make</p><h2>Recipes</h2><p>Save meals and recipes you want to remember and make again.</p><a href="recipes.html">Open Recipes <span aria-hidden="true">↗</span></a></section>
          <section><p class="msh-glass-category">What you need</p><h2>Grocery List</h2><p>Keep what you need connected to the food you already have.</p></section>
        </div>`
      : `<div class="msh-tools-directory msh-glide" data-msh-interaction="glide" data-msh-glide-label="Finances" data-msh-glide-item="finance-tool">
          <section><p class="msh-glass-category">Your context</p><h2>Financial picture</h2><p>Keep the financial information you choose to use in one place without turning it into a health score.</p></section>
          <section><p class="msh-glass-category">Everyday life</p><h2>Spending</h2><p>Notice costs that matter to your routines, food, care, movement, or other parts of life.</p></section>
          <section><p class="msh-glass-category">Looking ahead</p><h2>Planning</h2><p>Keep upcoming costs, priorities, and resources visible when they affect your choices.</p></section>
        </div>`;

    root.innerHTML = `<section class="msh-home-world is-first-door msh-glass-world"><div class="msh-home-environment" aria-hidden="true"><span class="msh-home-cinematic"></span><span class="msh-home-atmosphere"></span><span class="msh-sensory-constellation"></span></div><div class="msh-home-world-content">${MSHGlassWorkspace.markup({
      state:isFood ? 'food' : 'finances',
      manifestation:'workspace',
      eyebrow:`My Health / Tools / ${isFood ? 'My Food' : 'Finances'}`,
      title:isFood ? 'Know your food. Remember what you make. Use what you have.' : 'Money is part of life context.',
      intro:isFood ? 'My Food is your personal food workspace. It can hold what you use, what you make, what you have, and what you need without reducing food to numbers.' : 'Finances can shape access, choices, stress, routines, and opportunities. This space keeps that context available when you choose to use it.',
      body,
      footer:'<a class="msh-glass-back" href="my-health.html?view=tools">← Back to Tools</a>',
      status:isFood ? 'Personal food workspace' : 'Financial context / User controlled'
    })}</div></section>`;
    if (window.MSHGlide) MSHGlide.mount?.(root);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (tool === 'food' || tool === 'finances') {
      renderToolPage(tool);
      return;
    }
    toolsDirectory();
  });
})();