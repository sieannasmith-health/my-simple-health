/* My Simple Health — My Food personal food system */
(function () {
  'use strict';
  const root = document.querySelector('[data-msh-food]');
  if (!root || !window.MSHStorage) return;
  const seed = Array.isArray(window.MSHFoodSeed) ? window.MSHFoodSeed : [];
  let view = 'home';
  let search = '';
  let showArchived = false;

  const esc = value => String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const now = () => new Date().toISOString();
  const foodState = state => state.food || { foods:[], onHand:[], meals:[], recipes:[], groceries:[] };
  const icon = (name, extraClass='') => window.MSHAreaIcons?.svg(name, extraClass) || '';

  function ensureSeed() {
    MSHStorage.updateState(state => {
      state.food = foodState(state);
      if (!state.food.foods.length) state.food.foods = seed.map(item => ({ ...item, status:'active', source:'prototype_seed', createdAt:now() }));
      else state.food.foods = state.food.foods.map(item => ({ status:'active', ...item }));
      return state;
    });
  }

  function getFood() { return foodState(MSHStorage.getState()); }
  function titleCase(value) { return String(value || '').replace(/\b\w/g, letter => letter.toUpperCase()); }
  function activeFoods(food) { return food.foods.filter(item => item.status !== 'archived'); }

  function home(food) {
    const useSoon = food.onHand.filter(item => item.useSoon).length;
    return `<section class="msh-food-board">
      <div class="msh-food-board-top"><div><h2>Your food, becoming useful knowledge.</h2><p>Remember what you make, know what is home, and make the next meal easier.</p></div>
      <div class="msh-food-stats"><div class="msh-food-stat"><strong>${activeFoods(food).length}</strong><span>foods you use</span></div><div class="msh-food-stat"><strong>${food.recipes.length}</strong><span>your recipes</span></div><div class="msh-food-stat"><strong>${useSoon}</strong><span>use soon</span></div></div></div>
      <div class="msh-food-doors">
        ${door('foods','Your Food','Foods that belong in your food world.')}
        ${door('recipes','Your Recipes','Meals worth remembering and making again.')}
        ${door('onhand','On Hand','What is actually in your kitchen now.')}
        ${door('groceries','Grocery List','What you need next, and why.')}
      </div>
    </section>
    ${food.meals.length ? recentMeals(food) : `<section class="msh-food-panel"><h2>Start with a meal.</h2><p>Take a photo, upload one you already have, or add the meal in your own words. A meal can stay a meal or become a recipe later.</p><button class="msh-food-secondary" data-add-meal>Capture a meal</button></section>`}`;
  }

  function door(id,title,detail) { return `<button class="msh-food-door" type="button" data-view="${id}"><span>Open</span><strong>${title}</strong><small>${detail}</small></button>`; }

  function foodsView(food) {
    const q = search.trim().toLowerCase();
    const visibleFoods = food.foods.filter(item => showArchived || item.status !== 'archived');
    const matches = visibleFoods.filter(item => !q || item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q));
    const groups = matches.reduce((map,item) => { (map[item.category] ||= []).push(item); return map; },{});
    const archivedCount = food.foods.filter(item => item.status === 'archived').length;
    const controls = `<div class="msh-food-chips"><button class="msh-food-chip" type="button" data-toggle-archived>${showArchived ? 'Hide archived' : `Show archived${archivedCount ? ` · ${archivedCount}` : ''}`}</button>${Object.entries(groups).map(([category,items]) => `<span class="msh-food-chip">${esc(category)} · ${items.length}</span>`).join('')}</div>`;
    const rows = Object.entries(groups).map(([category,items]) => `<div><h3>${esc(category)}</h3>${items.map(item => `<div class="msh-food-row"><div><strong>${esc(titleCase(item.name))}</strong><small>${item.status === 'archived' ? 'Archived from everyday use' : 'In My Foods'}</small></div><div><button class="msh-food-secondary" data-edit-food="${esc(item.id)}">Edit</button> ${item.status === 'archived' ? `<button class="msh-food-secondary" data-restore-food="${esc(item.id)}">Restore</button>` : `<button class="msh-food-secondary" data-stock-food="${esc(item.id)}">Add on hand</button> <button class="msh-food-secondary" data-archive-food="${esc(item.id)}">Archive</button>`}</div></div>`).join('')}</div>`).join('');
    return panel('Your Food','Your editable food directory. Add what fits your life now, change it when your preferences change, and archive foods without erasing your history.', `${controls}<div class="msh-food-list">${rows || '<div class="msh-food-empty">No foods match that search.</div>'}</div><button class="msh-food-secondary" data-add-food>Add food</button>`, true);
  }

  function onHandView(food) {
    const items = food.onHand.map(item => ({...item, food:food.foods.find(f => f.id === item.foodId)})).filter(item => item.food);
    return panel('On Hand','What is physically in your kitchen right now.', `<div class="msh-food-list">${items.map(item => `<div class="msh-food-row"><div><strong>${esc(titleCase(item.food.name))}</strong><small>${esc(item.location)}${item.quantity ? ` · ${esc(item.quantity)}` : ''}${item.useSoon ? ' · Use soon' : ''}${item.food.status === 'archived' ? ' · Archived from Your Food' : ''}</small></div><div><button class="msh-food-secondary" data-toggle-soon="${esc(item.id)}">${item.useSoon ? 'Not urgent' : 'Use soon'}</button> <button class="msh-food-secondary" data-remove-stock="${esc(item.id)}">Used up</button></div></div>`).join('') || '<div class="msh-food-empty">Nothing marked on hand yet. Add foods from Your Food.</div>'}</div>`);
  }

  function groceriesView(food) {
    return panel('Grocery List','What you need next. Keep the reason attached when it matters.', `<div class="msh-food-list">${food.groceries.map(item => `<div class="msh-food-row"><div><strong>${esc(titleCase(item.name))}</strong><small>${esc(item.reason || 'Added to grocery list')}</small></div><button class="msh-food-secondary" data-bought="${esc(item.id)}">Purchased</button></div>`).join('') || '<div class="msh-food-empty">Your grocery list is clear.</div>'}</div><button class="msh-food-secondary" data-add-grocery>Add grocery</button>`);
  }

  function recipesView(food) {
    return panel('Your Recipes','Meals that became yours.', `<div class="msh-food-recipe-grid">${food.recipes.map(recipe => `<article class="msh-food-recipe">${recipe.photo ? `<img src="${esc(recipe.photo)}" alt="${esc(recipe.name)}">` : ''}<div><h3>${esc(recipe.name)}</h3><small>${recipe.ingredients.length} ingredients</small><p>${esc(recipe.notes || '')}</p></div></article>`).join('') || '<div class="msh-food-empty">No personal recipes yet. Capture a meal, then save it as a recipe when it is worth remembering.</div>'}</div>`);
  }

  function recentMeals(food) {
    return `<section class="msh-food-panel"><div class="msh-food-panel-head"><div><h2>Recently yours</h2><p>Meals you captured. They do not have to become recipes.</p></div><button class="msh-food-secondary" data-add-meal>Capture another</button></div><div class="msh-food-recipe-grid">${food.meals.slice().reverse().slice(0,3).map(meal => `<article class="msh-food-recipe">${meal.photo ? `<img src="${esc(meal.photo)}" alt="${esc(meal.name || 'Saved meal')}">` : ''}<div><h3>${esc(meal.name || 'Saved meal')}</h3><small>${meal.ingredients.length} confirmed ingredients</small>${meal.recipeId ? '<p>Saved to Your Recipes</p>' : `<p><button class="msh-food-secondary" data-recipe-from-meal="${esc(meal.id)}">Make this a recipe</button></p>`}</div></article>`).join('')}</div></section>`;
  }

  function panel(title,intro,body,withSearch) {
    return `<section class="msh-food-panel"><div class="msh-food-panel-head"><div><button class="msh-food-secondary" data-view="home">← My Food</button><h2>${title}</h2><p>${intro}</p></div>${withSearch ? `<input class="msh-food-search" type="search" placeholder="Search your foods" value="${esc(search)}" data-food-search>` : ''}</div>${body}</section>`;
  }

  function render() {
    const food = getFood();
    const body = view === 'foods' ? foodsView(food) : view === 'onhand' ? onHandView(food) : view === 'groceries' ? groceriesView(food) : view === 'recipes' ? recipesView(food) : home(food);
    root.innerHTML = `<div class="msh-food"><header class="msh-food-header"><div><p>My Health / My Food</p><h1>My Food</h1><div class="msh-food-lede">Know your food. Remember what you make. Use what you have.</div></div><button class="msh-food-add" type="button" data-open-add>${icon('plus')}<span>Add</span></button></header>${body}<div class="msh-food-dialog" data-food-dialog hidden></div></div>`;
    if (window.MSHRoutes) MSHRoutes.decorate(root);
  }

  function openDialog(markup) { const dialog = root.querySelector('[data-food-dialog]'); dialog.innerHTML = `<div class="msh-food-dialog-card">${markup}</div>`; dialog.hidden = false; }
  function closeDialog() { const dialog = root.querySelector('[data-food-dialog]'); if (dialog) dialog.hidden = true; }
  const dialogHead = (title,copy) => `<div class="msh-food-dialog-head"><div><h2>${title}</h2>${copy ? `<p>${copy}</p>` : ''}</div><button class="msh-food-close" type="button" data-close-dialog aria-label="Close">×</button></div>`;

  function addMenu() {
    openDialog(`${dialogHead('Add to My Food','Choose the smallest thing that matches what happened.')}<div class="msh-food-actions"><button class="msh-food-action" data-add-meal>${icon('camera','msh-area-icon--framed')}<strong>Capture a meal</strong><br><small>Take a photo, upload one, or add the meal in your own words.</small></button><button class="msh-food-action" data-add-food>${icon('plus','msh-area-icon--framed')}<strong>Add food</strong><br><small>Add something to the foods you use.</small></button><button class="msh-food-action" data-add-grocery>${icon('grocery','msh-area-icon--framed')}<strong>Add grocery</strong><br><small>Remember what you need next.</small></button></div>`);
  }

  function mealForm() {
    openDialog(`${dialogHead('Capture a meal','Use your camera or choose a photo you already have. The image is a memory aid, not a nutrition measurement, and you confirm the ingredients.')}<form class="msh-food-form" data-meal-form><fieldset><legend>Meal photo</legend><label>Take a photo<input type="file" name="cameraPhoto" accept="image/*" capture="environment" data-meal-photo></label><label>Upload a photo<input type="file" name="uploadedPhoto" accept="image/*" data-meal-photo></label></fieldset><img class="msh-food-photo-preview" data-photo-preview hidden alt="Meal preview"><label>Name<input name="name" placeholder="Lemon butter salmon"></label><label>What was in it?<textarea name="ingredients" rows="4" placeholder="salmon, lemon, butter, thyme"></textarea></label><label>Anything worth remembering?<textarea name="notes" rows="3" placeholder="Broiled about 7 minutes..."></textarea></label><label><input type="checkbox" name="recipe"> Save this to Your Recipes too</label><button class="msh-food-primary" type="submit">Save meal</button></form>`);
  }

  function foodForm() { openDialog(`${dialogHead('Add food')}<form class="msh-food-form" data-food-form><label>Food<input name="name" required></label><label>Category<input name="category" placeholder="Vegetables"></label><button class="msh-food-primary" type="submit">Add to Your Food</button></form>`); }
  function editFoodForm(foodId) { const item=getFood().foods.find(food=>food.id===foodId); if(!item)return; openDialog(`${dialogHead('Edit food','Change how this food appears in your current directory. Historical meals and recipes stay connected.')}<form class="msh-food-form" data-edit-food-form><input type="hidden" name="foodId" value="${esc(item.id)}"><label>Food<input name="name" required value="${esc(item.name)}"></label><label>Category<input name="category" value="${esc(item.category)}"></label><button class="msh-food-primary" type="submit">Save changes</button></form>`); }
  function groceryForm() { openDialog(`${dialogHead('Add grocery')}<form class="msh-food-form" data-grocery-form><label>Item<input name="name" required></label><label>Why is it here?<input name="reason" placeholder="For lemon butter salmon"></label><button class="msh-food-primary" type="submit">Add to grocery list</button></form>`); }
  function stockForm(foodId) { const item = getFood().foods.find(f => f.id === foodId); if (!item || item.status === 'archived') return; openDialog(`${dialogHead(`Add ${esc(titleCase(item.name))} on hand`)}<form class="msh-food-form" data-stock-form><input type="hidden" name="foodId" value="${esc(foodId)}"><label>Where?<select name="location"><option>Fridge</option><option>Freezer</option><option>Pantry</option></select></label><label>Quantity <input name="quantity" placeholder="2 portions"></label><label><input type="checkbox" name="useSoon"> Use soon</label><button class="msh-food-primary" type="submit">Add on hand</button></form>`); }

  function addIngredients(names) {
    const clean = names.map(name => name.trim()).filter(Boolean);
    const ids = [];
    MSHStorage.updateState(state => {
      state.food = foodState(state);
      clean.forEach(name => {
        let item = state.food.foods.find(food => food.name.toLowerCase() === name.toLowerCase());
        if (!item) { item = { id:MSHStorage.uid('food'), name, category:'Other', status:'active', source:'user', createdAt:now() }; state.food.foods.push(item); }
        ids.push(item.id);
      });
      return state;
    });
    return ids;
  }

  root.addEventListener('click', event => {
    const target = event.target.closest('button'); if (!target) return;
    if (target.dataset.view) { view = target.dataset.view; render(); return; }
    if (target.matches('[data-open-add]')) return addMenu();
    if (target.matches('[data-close-dialog]')) return closeDialog();
    if (target.matches('[data-add-meal]')) return mealForm();
    if (target.matches('[data-add-food]')) return foodForm();
    if (target.matches('[data-add-grocery]')) return groceryForm();
    if (target.dataset.editFood) return editFoodForm(target.dataset.editFood);
    if (target.matches('[data-toggle-archived]')) { showArchived=!showArchived; render(); return; }
    if (target.dataset.archiveFood) { MSHStorage.updateState(state => { const item=state.food.foods.find(food=>food.id===target.dataset.archiveFood); if(item){item.status='archived';item.archivedAt=now();} return state; }); render(); return; }
    if (target.dataset.restoreFood) { MSHStorage.updateState(state => { const item=state.food.foods.find(food=>food.id===target.dataset.restoreFood); if(item){item.status='active';delete item.archivedAt;} return state; }); render(); return; }
    if (target.dataset.stockFood) return stockForm(target.dataset.stockFood);
    if (target.dataset.toggleSoon) { MSHStorage.updateState(state => { const item=state.food.onHand.find(i=>i.id===target.dataset.toggleSoon); if(item)item.useSoon=!item.useSoon; return state; }); render(); }
    if (target.dataset.removeStock) { MSHStorage.updateState(state => { state.food.onHand=state.food.onHand.filter(i=>i.id!==target.dataset.removeStock); return state; }); render(); }
    if (target.dataset.bought) { MSHStorage.updateState(state => { state.food.groceries=state.food.groceries.filter(i=>i.id!==target.dataset.bought); return state; }); render(); }
    if (target.dataset.recipeFromMeal) { MSHStorage.updateState(state => { const meal=state.food.meals.find(m=>m.id===target.dataset.recipeFromMeal); if(!meal||meal.recipeId)return state; const recipe={id:MSHStorage.uid('recipe'),name:meal.name||'Saved meal',photo:meal.photo||'',ingredients:[...meal.ingredients],notes:meal.notes||'',createdAt:now()}; state.food.recipes.push(recipe); meal.recipeId=recipe.id; return state; }); render(); }
  });

  root.addEventListener('input', event => {
    if (event.target.matches('[data-food-search]')) { search=event.target.value; const cursor=event.target.selectionStart; render(); const next=root.querySelector('[data-food-search]'); if(next){next.focus();next.setSelectionRange(cursor,cursor);} }
    if (event.target.matches('[data-meal-photo]') && event.target.files && event.target.files[0]) {
      root.querySelectorAll('[data-meal-photo]').forEach(input => { if (input !== event.target) input.value = ''; });
      const preview=root.querySelector('[data-photo-preview]');
      const reader=new FileReader();
      reader.onload=()=>{preview.src=reader.result;preview.hidden=false;};
      reader.readAsDataURL(event.target.files[0]);
    }
  });

  root.addEventListener('submit', event => {
    event.preventDefault(); const form=event.target; const data=new FormData(form);
    if (form.matches('[data-food-form]')) { MSHStorage.updateState(state => { state.food.foods.push({id:MSHStorage.uid('food'),name:String(data.get('name')).trim(),category:String(data.get('category')||'Other').trim()||'Other',status:'active',source:'user',createdAt:now()}); return state; }); closeDialog(); view='foods'; render(); }
    if (form.matches('[data-edit-food-form]')) { MSHStorage.updateState(state => { const item=state.food.foods.find(food=>food.id===String(data.get('foodId'))); if(item){item.name=String(data.get('name')).trim();item.category=String(data.get('category')||'Other').trim()||'Other';item.updatedAt=now();} return state; }); closeDialog(); view='foods'; render(); }
    if (form.matches('[data-grocery-form]')) { MSHStorage.updateState(state => { state.food.groceries.push({id:MSHStorage.uid('grocery'),name:String(data.get('name')).trim(),reason:String(data.get('reason')||'').trim(),createdAt:now()}); return state; }); closeDialog(); view='groceries'; render(); }
    if (form.matches('[data-stock-form]')) { MSHStorage.updateState(state => { state.food.onHand.push({id:MSHStorage.uid('stock'),foodId:String(data.get('foodId')),location:String(data.get('location')),quantity:String(data.get('quantity')||'').trim(),useSoon:data.get('useSoon')==='on',createdAt:now()}); return state; }); closeDialog(); view='onhand'; render(); }
    if (form.matches('[data-meal-form]')) {
      const ingredientIds=addIngredients(String(data.get('ingredients')||'').split(',')); const preview=root.querySelector('[data-photo-preview]'); const meal={id:MSHStorage.uid('meal'),name:String(data.get('name')||'').trim()||'Saved meal',photo:preview&&!preview.hidden?preview.src:'',ingredients:ingredientIds,notes:String(data.get('notes')||'').trim(),createdAt:now(),provenance:MSHStorage.createProvenance(MSHStorage.PROVENANCE.USER_STATED,{sourceId:'my-food-meal'})};
      MSHStorage.updateState(state => { if(data.get('recipe')==='on'){const recipe={id:MSHStorage.uid('recipe'),name:meal.name,photo:meal.photo,ingredients:[...meal.ingredients],notes:meal.notes,createdAt:meal.createdAt};state.food.recipes.push(recipe);meal.recipeId=recipe.id;} state.food.meals.push(meal); return state; }); closeDialog(); view='home'; render();
    }
  });

  ensureSeed(); render();
})();