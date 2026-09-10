import assert from 'node:assert/strict';
import { answerProjectStatus, currentStateSnapshot } from './current-state.mjs';

const event = {
  event_id: 'evt-1', event_type: 'handoff.executed', occurred_at: '2026-09-10T15:00:00.000Z', actor: 'nomy',
  subject: { type: 'objective', id: 'agent-os' }, objective_id: 'agent-os', from_agent: 'nomy', to_agent: 'selah',
  relation: null, payload: { runtime_status: 'PENDING', public_status: 'completed' },
  provenance: { source: 'agent_runtime', source_id: 'github:281:run:1', source_url: 'https://github.com/sieannasmith-health/my-simple-health/issues/281', commit_sha: null },
  correlation_id: 'issue:281', causation_id: 'run:1'
};
const state = {
  objective_id: 'agent-os', status: 'PENDING', current_stage: 'engineering', assigned_agent: 'selah', human_gate: null,
  retry_count: 0, sequence_version: 12, last_graph_transition: { from: 'nomy', to: 'selah', source: 'dynamic' },
  last_knowledge_event: event, history: [{ knowledge_event: event }]
};
const snapshot = currentStateSnapshot(state, '2026-09-10T15:01:00.000Z');
assert.equal(snapshot.objective.assigned_agent, 'selah');
assert.equal(snapshot.event_count, 1);
assert.ok(snapshot.graph.edges.some(edge => edge.type === 'HANDED_OFF_TO'));
const result = answerProjectStatus(state, '2026-09-10T15:01:00.000Z');
assert.equal(result.question, 'Where are we in the project now?');
assert.equal(result.answer.status, 'PENDING');
assert.equal(result.answer.current_stage, 'engineering');
assert.equal(result.answer.current_owner, 'selah');
assert.equal(result.answer.needs_siea, false);
assert.equal(result.answer.evidence_event_id, 'evt-1');
assert.equal(result.provenance.source, 'agent_runtime');
console.log('Agent OS current-state retrieval benchmark passed.');
