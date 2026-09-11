import assert from 'node:assert/strict';
import { bootstrapLegacyBlockedState, deriveLegacyRecovery } from '../recovery-redrive-bootstrap.mjs';

const now = new Date('2026-09-10T22:00:00Z');
const base = {
  status: 'ORCHESTRATION_BLOCKED',
  current_stage: 'IMPLEMENTATION',
  assigned_agent: 'selah',
  human_gate: null,
  recovery: null,
  history: [{ stage: 'IMPLEMENTATION', agent: 'selah', result_status: 'blocked' }],
  retry_count: 3,
  max_retries: 3,
  max_redrives: 2
};

const below = bootstrapLegacyBlockedState({ ...base, redrive_count: 1 }, now);
assert.ok(below);
assert.equal(below.status, 'PENDING');
assert.equal(below.assigned_agent, 'selah');
assert.equal(below.redrive_count, 2);
assert.equal(below.max_redrives, 2);
assert.equal(below.human_gate, null);
assert.equal(below.recovery.resume_agent, 'selah');
assert.equal(below.recovery.resume_stage, 'IMPLEMENTATION');

assert.equal(deriveLegacyRecovery({ ...base, redrive_count: 0, max_redrives: 0 }, now), null);
assert.equal(bootstrapLegacyBlockedState({ ...base, redrive_count: 0, max_redrives: 0 }, now), null);
assert.equal(deriveLegacyRecovery({ ...base, redrive_count: 2 }, now), null);
assert.equal(bootstrapLegacyBlockedState({ ...base, redrive_count: 2 }, now), null);
assert.equal(deriveLegacyRecovery({ ...base, redrive_count: 3 }, now), null);
assert.equal(bootstrapLegacyBlockedState({ ...base, redrive_count: 3 }, now), null);

assert.equal(bootstrapLegacyBlockedState({ ...base, redrive_count: 0, human_gate: { assignee: 'siea' } }, now), null);
assert.equal(bootstrapLegacyBlockedState({ ...base, redrive_count: 0, status: 'COMPLETED' }, now), null);

console.log('Legacy recovery redrive budget conformance tests passed.');
