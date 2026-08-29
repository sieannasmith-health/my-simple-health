import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../my-food.html', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../js/msh-my-food.js', import.meta.url), 'utf8');
const seed = fs.readFileSync(new URL('../data/my-food-seed.js', import.meta.url), 'utf8');

test('My Food is a private-style MSH workspace using shared shell and storage', () => {
  assert.match(html, /data-msh-page="food"/);
  assert.match(html, /js\/msh-storage\.js/);
  assert.match(html, /js\/msh-shell\.js/);
  assert.match(html, /css\/msh-foundation\.css/);
});

test('food model keeps foods, on-hand items, meals, recipes, and groceries separate', () => {
  assert.match(js, /foods:\[\], onHand:\[\], meals:\[\], recipes:\[\], groceries:\[\]/);
  assert.match(js, /foodId/);
  assert.match(js, /recipeId/);
});

test('meal capture requires user-entered ingredient confirmation rather than claiming photo certainty', () => {
  assert.match(js, /The photo is a memory aid, not a nutrition measurement\. You confirm the ingredients\./);
  assert.match(js, /What was in it\?/);
  assert.doesNotMatch(js, /calorie score|meal score|good food|bad food/i);
});

test('master inventory seed contains supplied food categories and representative ingredients', () => {
  for (const value of ['Baking','Cheeses','Seafood','Fruits','Legumes','Proteins','Grains & starches','Sauces','Seasonings','Vegetables','Vinegars']) assert.match(seed, new RegExp(value.replace(/[&]/g, '\\&')));
  for (const value of ['salmon','chicken breast','wild rice','sweet potatoes','spinach','olive oil','black pepper']) assert.match(seed, new RegExp(`['\"]${value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}['\"]`));
});

test('on-hand state supports location, quantity, use-soon, and used-up transitions', () => {
  assert.match(js, /Fridge/);
  assert.match(js, /Freezer/);
  assert.match(js, /Pantry/);
  assert.match(js, /useSoon/);
  assert.match(js, /Used up/);
});

test('Your Food is an editable directory with non-destructive archive and restore', () => {
  assert.match(js, /Your editable food directory/);
  assert.match(js, /data-edit-food/);
  assert.match(js, /data-archive-food/);
  assert.match(js, /data-restore-food/);
  assert.match(js, /status:'archived'/);
  assert.match(js, /status='active'/);
  assert.match(js, /Historical meals and recipes stay connected/);
});
