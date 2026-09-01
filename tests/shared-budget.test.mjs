import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../financial-health.html', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../js/msh-shared-budget.js', import.meta.url), 'utf8');
const sql = fs.readFileSync(new URL('../supabase/migrations/20260901024000_shared_budget.sql', import.meta.url), 'utf8');

test('Financial Health exposes personal and shared modes', () => {
  assert.match(html, /data-financial-mode="personal"/);
  assert.match(html, /data-financial-mode="shared"/);
  assert.match(html, /data-shared-budget/);
});

test('shared budget uses authenticated Supabase-backed records', () => {
  assert.match(js, /shared_budgets/);
  assert.match(js, /shared_budget_members/);
  assert.match(js, /shared_budget_items/);
  assert.doesNotMatch(js, /msh_shared_budget_data/);
});

test('shared budget schema enables RLS and collaborator checks', () => {
  assert.match(sql, /alter table public\.shared_budgets enable row level security/i);
  assert.match(sql, /alter table public\.shared_budget_members enable row level security/i);
  assert.match(sql, /alter table public\.shared_budget_items enable row level security/i);
  assert.match(sql, /can_edit_shared_budget/);
  assert.match(sql, /invitees accept their own invitation/);
  assert.match(sql, /owners manage memberships/);
});
