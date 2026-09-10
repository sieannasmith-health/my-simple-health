import assert from 'node:assert/strict';
import { hydrateRuntimeContext } from '../runtime-context-hydration.mjs';
import { planEveryoneFanout, joinEveryoneResults } from '../everyone-fanout.mjs';

const state = {
  sequence_version: 4,
  current_stage: 'IMPLEMENTATION',
  assigned_agent: 'selah',
  status: 'EXECUTING',
  objective_id: 'github-issue-318',
  history: []
};

const hydrated = hydrateRuntimeContext({
  issue: { number: 318, title: 'Agent OS all-hands execution sprint' },
  state,
  agentKey: 'selah',
  generatedAt: '2026-09-10T18:00:00.000Z'
});
assert.equal(hydrated.canonical.objective.id, 'github-issue-318');
assert.equal(hydrated.canonical.objective.sequence_version, 4);
assert.equal(hydrated.canonical.objective.assigned_agent, 'selah');

const stale = hydrateRuntimeContext({
  issue: { number: 318, title: 'Agent OS all-hands execution sprint' },
  state,
  agentKey: 'selah',
  generatedAt: '2026-09-10T18:00:00.000Z',
  candidateSnapshot: {
    generated_at: '2026-09-10T17:00:00.000Z',
    objective: { sequence_version: 3 }
  }
});
assert.equal(stale.candidate, null);
assert.equal(stale.candidate_freshness.accepted, false);
assert.equal(stale.candidate_freshness.reason, 'STALE_SEQUENCE');

const agents = Object.fromEntries(['nomy','selah','sage','clara','mira','eden','vera','aiden','ellis','genesis','newton','harper','june','atlas','reese','iris','tessa'].map(key => [key, {}]));
const plan = planEveryoneFanout({ agents });
assert.equal(plan.coordinator, 'nomy');
assert.equal(plan.expected, 16);
assert.ok(!plan.targets.includes('nomy'));
assert.equal(new Set(plan.targets).size, plan.targets.length);

const partial = joinEveryoneResults(plan, [
  { agent: 'selah', status: 'completed' },
  { agent: 'tessa', status: 'completed' },
  { agent: 'tessa', status: 'duplicate-ignored' }
]);
assert.equal(partial.complete, false);
assert.equal(partial.received, 2);
assert.ok(partial.missing.includes('sage'));

const falseCompleteInputs = plan.targets.map((agent, index) => ({
  agent,
  status: index === 0 ? 'failed' : index === 1 ? 'pending' : 'completed'
}));
const notComplete = joinEveryoneResults(plan, falseCompleteInputs);
assert.equal(notComplete.complete, false);
assert.equal(notComplete.received, 14);
assert.ok(notComplete.missing.includes(plan.targets[0]));
assert.ok(notComplete.missing.includes(plan.targets[1]));
assert.ok(notComplete.unresolved.includes(plan.targets[0]));
assert.ok(notComplete.unresolved.includes(plan.targets[1]));
assert.ok(!notComplete.results.some(result => ['failed', 'pending'].includes(result.status)));

const recovered = joinEveryoneResults(plan, [
  ...falseCompleteInputs,
  { agent: plan.targets[0], status: 'success' },
  { agent: plan.targets[1], status: 'passed' }
]);
assert.equal(recovered.complete, true);
assert.equal(recovered.received, 16);
assert.equal(recovered.missing.length, 0);

const complete = joinEveryoneResults(plan, plan.targets.map(agent => ({ agent, status: 'completed' })));
assert.equal(complete.complete, true);
assert.equal(complete.received, 16);
assert.equal(complete.missing.length, 0);

console.log('PASS: P0 runtime hydration rejects stale context and Everyone fan-out/join only completes for successful worker results.');
