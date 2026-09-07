import assert from 'node:assert/strict';
import { assertSafeProtectedReplacement } from '../engineering-execution.mjs';
import { recoverRuntimeFailureState } from '../maintenance-cleanup.mjs';

const baseline = Array.from({ length: 500 }, (_, index) => `export const line${index} = '${'x'.repeat(32)}';`).join('\n');
const destructive = Array.from({ length: 60 }, (_, index) => `export const line${index} = true;`).join('\n');
const scoped = baseline.split('\n').slice(0, 470).join('\n');

assert.throws(
  () => assertSafeProtectedReplacement({
    filePath: 'agent-runtime/state-hydrated-runner.mjs',
    currentContent: baseline,
    proposedContent: destructive
  }),
  /preservation guard/
);

assert.doesNotThrow(() => assertSafeProtectedReplacement({
  filePath: 'agent-runtime/state-hydrated-runner.mjs',
  currentContent: baseline,
  proposedContent: scoped
}));

assert.doesNotThrow(() => assertSafeProtectedReplacement({
  filePath: 'ios/App.swift',
  currentContent: baseline,
  proposedContent: destructive
}));

const executing = {
  current_stage: 'IMPLEMENTATION',
  assigned_agent: 'selah',
  status: 'EXECUTING',
  execution: { claimed_at: '2026-09-07T00:00:00Z', lease_expires_at: '2026-09-07T00:20:00Z', attempt: 1 },
  human_gate: null,
  history: []
};

const recovered = recoverRuntimeFailureState(executing, {
  outcome: 'runtime_failure',
  at: '2026-09-07T00:01:00Z'
});
assert.equal(recovered.status, 'PENDING');
assert.equal(recovered.execution, null);
assert.equal(recovered.assigned_agent, 'selah');
assert.equal(recovered.history.at(-1)?.event, 'RUNTIME_FAILURE_EXECUTION_RECOVERED');

const unchanged = recoverRuntimeFailureState(executing, { outcome: 'runtime_complete' });
assert.equal(unchanged, executing);

console.log('runtime failure safety regression tests passed');
