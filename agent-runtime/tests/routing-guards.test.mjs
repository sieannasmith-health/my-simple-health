import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const runner = await fs.readFile(new URL('../state-hydrated-runner.mjs', import.meta.url), 'utf8');
const evaluator = await fs.readFile(new URL('../state-evaluator.mjs', import.meta.url), 'utf8');
const reconciler = await fs.readFile(new URL('../post-turn-reconciler.mjs', import.meta.url), 'utf8');
const normalizer = await fs.readFile(new URL('../human-gate-normalizer.mjs', import.meta.url), 'utf8');
assert.match(runner, /reason_code/);
assert.match(runner, /MSH_RESULT/);
assert.match(runner, /EXECUTION_APPROVAL_REQUIRED/);
assert.match(evaluator, /ORCHESTRATION_BLOCKED/);
assert.match(evaluator, /assigned_agent: 'nomy'/);
assert.match(reconciler, /state\.status !== 'EXECUTING'/);
assert.match(reconciler, /updated_at/);
assert.match(reconciler, /State atomically consumed/);
assert.match(normalizer, /parseStructuredResult/);
assert.doesNotMatch(normalizer, /execution is not approved|not authorized|authorization.*absent/i);
console.log('routing guard regressions passed');
