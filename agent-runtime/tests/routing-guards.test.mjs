import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const evaluator = await fs.readFile(new URL('../state-evaluator.mjs', import.meta.url), 'utf8');
const reconciler = await fs.readFile(new URL('../post-turn-reconciler.mjs', import.meta.url), 'utf8');
const transitionPolicy = await fs.readFile(new URL('../turn-transition.mjs', import.meta.url), 'utf8');
const runV3 = await fs.readFile(new URL('../run-v3.mjs', import.meta.url), 'utf8');
const runtimeWorkflow = await fs.readFile(new URL('../../.github/workflows/msh-agent-runtime.yml', import.meta.url), 'utf8');

assert.match(evaluator, /ORCHESTRATION_BLOCKED/);
assert.match(evaluator, /reconcileLabels\('nomy', 'blocked', false\)/);
assert.match(evaluator, /assigned_agent: 'nomy'/);
assert.doesNotMatch(evaluator, /reconcileLabels\([^\n]+true\)/);
assert.doesNotMatch(evaluator, /Human review is required before execution resumes/);

assert.match(reconciler, /state\.status !== 'EXECUTING'/);
assert.match(reconciler, /updated_at/);
assert.match(reconciler, /deriveTransitionFromResult\(structuredWorkerResult, state\)/);
assert.match(reconciler, /State atomically consumed/);

assert.match(transitionPolicy, /runtimeStatus: 'PENDING'/);
assert.match(transitionPolicy, /result\.status === 'review_requested'/);
assert.match(transitionPolicy, /assignedAgent = 'tessa'/);

assert.match(runV3, /post-turn-reconciler\.mjs/);
assert.match(runV3, /await reconcileTurn\(structuredWorkerResult\)/);

assert.match(runtimeWorkflow, /on:\n  workflow_dispatch:/);
assert.doesNotMatch(runtimeWorkflow, /on:\n[\s\S]*?\n  issues:\n\s+types:\s*\[labeled\]/);
assert.doesNotMatch(runtimeWorkflow, /issue_comment:\n\s+types:\s*\[created\]/);
assert.doesNotMatch(runtimeWorkflow, /github\.event_name\s*==\s*['"]issues['"]/);

console.log('routing guard regressions passed');
