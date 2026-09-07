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

const maintenanceIndex = evaluator.indexOf('authorizeMaintenanceFromEvent({');
const blockedTerminalIndex = evaluator.indexOf("else if (state.status === 'ORCHESTRATION_BLOCKED')");
assert.ok(maintenanceIndex >= 0 && blockedTerminalIndex > maintenanceIndex,
  'Owner-authenticated maintenance recovery must be evaluated before ORCHESTRATION_BLOCKED becomes terminal');
assert.match(evaluator, /Orchestration-blocked issue .* remains terminal without a fresh owner-authenticated maintenance grant/);

assert.match(evaluator, /legacyHumanGateRecoveryTarget/);
assert.match(evaluator, /state\.current_stage === 'IMPLEMENTATION' && last\?\.agent === 'selah'/);
assert.match(evaluator, /state\.current_stage === 'PRODUCT_COORDINATION' && last\?\.agent === 'nomy'/);
assert.match(evaluator, /last\?\.result_status === 'blocked'/);
assert.match(evaluator, /assigned_agent: legacyTarget\.assigned_agent/);
assert.match(evaluator, /current_stage: legacyTarget\.current_stage/);
assert.match(evaluator, /human_gate: null/);

assert.match(reconciler, /state\.status !== 'EXECUTING'/);
assert.match(reconciler, /updated_at/);
assert.match(reconciler, /deriveTransitionFromResult\(structuredWorkerResult, state\)/);
assert.match(reconciler, /State atomically consumed/);
assert.match(reconciler, /reason_code/);

assert.match(transitionPolicy, /runtimeStatus: 'PENDING'/);
assert.match(transitionPolicy, /result\.status === 'review_requested'/);
assert.match(transitionPolicy, /assignedAgent = 'tessa'/);

assert.match(runV3, /post-turn-reconciler\.mjs/);
assert.match(runV3, /enrichReasonCode\(await runBoundedWorker\(\)\)/);
assert.match(runV3, /EXECUTION_APPROVAL_REQUIRED/);
assert.match(runV3, /HUMAN_APPROVAL_REQUIRED/);
assert.match(runV3, /normalizeHumanGate\(\{ structuredResult: structuredWorkerResult \}\)/);
assert.match(runV3, /await reconcileTurn\(structuredWorkerResult\)/);
assert.ok(
  runV3.indexOf('normalizeHumanGate({ structuredResult: structuredWorkerResult })') < runV3.indexOf('await reconcileTurn(structuredWorkerResult)'),
  'Structured reason code must reach normalization before reconciliation'
);

assert.match(runtimeWorkflow, /on:\n  workflow_dispatch:/);
assert.doesNotMatch(runtimeWorkflow, /on:\n[\s\S]*?\n  issues:\n\s+types:\s*\[labeled\]/);
assert.doesNotMatch(runtimeWorkflow, /issue_comment:\n\s+types:\s*\[created\]/);
assert.doesNotMatch(runtimeWorkflow, /github\.event_name\s*==\s*['"]issues['"]/);

console.log('routing guard regressions passed');
