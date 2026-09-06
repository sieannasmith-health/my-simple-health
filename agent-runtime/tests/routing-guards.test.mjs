import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const evaluator = await fs.readFile(new URL('../state-evaluator.mjs', import.meta.url), 'utf8');
const reconciler = await fs.readFile(new URL('../post-turn-reconciler.mjs', import.meta.url), 'utf8');
const runV3 = await fs.readFile(new URL('../run-v3.mjs', import.meta.url), 'utf8');
const runtimeWorkflow = await fs.readFile(new URL('../../.github/workflows/msh-agent-runtime.yml', import.meta.url), 'utf8');

assert.match(evaluator, /ORCHESTRATION_BLOCKED/);
assert.match(evaluator, /reconcileLabels\('nomy', 'blocked', false\)/);
assert.match(evaluator, /assigned_agent: 'nomy'/);
assert.doesNotMatch(evaluator, /reconcileLabels\([^\n]+true\)/);
assert.doesNotMatch(evaluator, /Human review is required before execution resumes/);

assert.match(reconciler, /state\.status !== 'EXECUTING'/);
assert.match(reconciler, /updated_at/);
assert.match(reconciler, /runtimeStatus: 'PENDING'/);
assert.match(reconciler, /statusLabel === 'review_requested'/);
assert.match(reconciler, /assignedAgent = 'tessa'/);
assert.match(reconciler, /State atomically consumed/);
assert.match(runV3, /post-turn-reconciler\.mjs/);

assert.match(runtimeWorkflow, /workflow_dispatch:/);
assert.doesNotMatch(runtimeWorkflow, /^\s*issues:/m);
assert.doesNotMatch(runtimeWorkflow, /^\s*issue_comment:/m);

console.log('routing guard regressions passed');
