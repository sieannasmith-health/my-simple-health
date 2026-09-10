import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const evaluator = await fs.readFile(new URL('../state-evaluator.mjs', import.meta.url), 'utf8');
const reconciler = await fs.readFile(new URL('../post-turn-reconciler.mjs', import.meta.url), 'utf8');
const transitionPolicy = await fs.readFile(new URL('../turn-transition.mjs', import.meta.url), 'utf8');
const agentGraph = await fs.readFile(new URL('../agent-graph.mjs', import.meta.url), 'utf8');
const runV3 = await fs.readFile(new URL('../run-v3.mjs', import.meta.url), 'utf8');
const runtimeWorkflow = await fs.readFile(new URL('../../.github/workflows/msh-agent-runtime.yml', import.meta.url), 'utf8');

assert.match(evaluator, /ORCHESTRATION_BLOCKED/);
assert.match(evaluator, /reconcileLabels\('nomy', 'blocked', false\)/);
assert.match(evaluator, /assigned_agent: 'nomy'/);
assert.doesNotMatch(evaluator, /reconcileLabels\([^\n]+true\)/);
assert.doesNotMatch(evaluator, /Human review is required before execution resumes/);

const maintenanceIndex = evaluator.indexOf('authorizeMaintenanceFromEvent({');
const blockedRecoveryIndex = evaluator.indexOf("else if (state.status === 'ORCHESTRATION_BLOCKED')");
assert.ok(maintenanceIndex >= 0 && blockedRecoveryIndex > maintenanceIndex,
  'Owner-authenticated maintenance recovery must be evaluated before automatic ORCHESTRATION_BLOCKED redrive');
assert.match(evaluator, /Automatic redrive accepted on issue/);
assert.match(evaluator, /redriveEligible\(state\)/);
assert.match(evaluator, /redriveFromCheckpoint\(state\)/);
assert.match(evaluator, /AUTOMATIC_REDRIVE_STARTED/);
assert.match(evaluator, /Redrive budget exhausted on issue/);

assert.match(evaluator, /legacyHumanGateRecoveryTarget/);
assert.match(evaluator, /lastWorkerTurn/);
assert.match(evaluator, /\[\.\.\.history\]\.reverse\(\)\.find\(entry => entry\?\.agent && entry\?\.result_status\)/);
assert.match(evaluator, /state\.current_stage === 'IMPLEMENTATION' && lastWorkerTurn\?\.agent === 'selah'/);
assert.match(evaluator, /state\.current_stage === 'PRODUCT_COORDINATION' && lastWorkerTurn\?\.agent === 'nomy'/);
assert.match(evaluator, /lastWorkerTurn\?\.result_status === 'blocked'/);
assert.doesNotMatch(evaluator, /hasHistoryEvent\(state, 'LEGACY_HUMAN_GATE_REEVALUATION'\)/);
assert.match(evaluator, /assigned_agent: legacyTarget\.assigned_agent/);
assert.match(evaluator, /current_stage: legacyTarget\.current_stage/);
assert.match(evaluator, /human_gate: null/);
assert.match(evaluator, /repeatable_revalidation_after_runtime_upgrade/);

assert.match(reconciler, /state\.status !== 'EXECUTING'/);
assert.match(reconciler, /updated_at/);
assert.match(reconciler, /deriveTransitionFromResult\(structuredWorkerResult, state\)/);
assert.match(reconciler, /State atomically consumed/);
assert.match(reconciler, /reason_code/);
assert.match(reconciler, /last_graph_transition/);
assert.match(reconciler, /Explicitly igniting evaluator for next owner/);

assert.match(transitionPolicy, /import \{ resolveAgentEdge \} from '\.\/agent-graph\.mjs'/);
assert.match(transitionPolicy, /runtimeStatus: 'PENDING'/);
assert.match(transitionPolicy, /const edge = resolveAgentEdge\(result, state\)/);
assert.match(transitionPolicy, /graphTransition/);
assert.match(transitionPolicy, /PHYSICAL_DEVICE_ACTION/);
assert.match(transitionPolicy, /ACCOUNT_OWNER_ACTION/);
assert.doesNotMatch(transitionPolicy, /'HUMAN_APPROVAL_REQUIRED'/);

assert.match(agentGraph, /if \(result\?\.status === 'review_requested'\) return 'tessa'/);
assert.match(agentGraph, /if \(result\?\.status === 'changes_requested' && state\?\.assigned_agent === 'tessa'\) return 'selah'/);
assert.match(agentGraph, /Human-readable `message` is intentionally ignored/);
assert.match(agentGraph, /Self-handoff is not allowed/);
assert.match(agentGraph, /Disallowed agent graph edge/);

assert.match(runV3, /post-turn-reconciler\.mjs/);
assert.match(runV3, /enrichReasonCode\(await runBoundedWorker\(\)\)/);
assert.match(runV3, /EXECUTION_APPROVAL_REQUIRED/);
assert.doesNotMatch(runV3, /reason_code:\s*'HUMAN_APPROVAL_REQUIRED'/);
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
