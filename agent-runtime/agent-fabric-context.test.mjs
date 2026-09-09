import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEventEnvelope, enforceFabricGuards, hydrateAgentContext, loadDurableContext, nextHop } from './agent-fabric-context.mjs';

test('loads canonical durable MSH context', async () => {
  const context = await loadDurableContext();
  assert.equal(context.current_product_objective.id, 'agent-fabric-v1');
  assert.equal(context.operating_model.product_owner, 'Nomy');
  assert.equal(context.operating_model.engineering_owner, 'Selah');
});

test('builds and accepts a bounded typed event', () => {
  const envelope = buildEventEnvelope({
    objective: { id: 'agent-fabric-v1', summary: 'Implement fabric', scope: ['runtime'] },
    actor: { type: 'human', id: 'siea' },
    owner: 'nomy',
    targetAgent: 'selah',
    allowedAgents: ['nomy', 'selah'],
    allowedTools: ['github.read', 'github.write'],
    executionApproved: true
  });
  assert.equal(enforceFabricGuards(envelope).allowed, true);
});

test('rejects disallowed agent, exhausted budget, hop overflow, and expiry', () => {
  const envelope = buildEventEnvelope({
    objective: { id: 'agent-fabric-v1', summary: 'Implement fabric', scope: ['runtime'] },
    actor: { type: 'agent', id: 'nomy' },
    owner: 'nomy',
    targetAgent: 'selah',
    allowedAgents: ['nomy']
  });
  envelope.state.hop_count = 6;
  envelope.state.max_hops = 5;
  envelope.state.remaining_steps = 0;
  envelope.expires_at = '2020-01-01T00:00:00.000Z';
  const result = enforceFabricGuards(envelope);
  assert.equal(result.allowed, false);
  assert.deepEqual(new Set(result.failures), new Set(['target_agent_not_allowed', 'hop_limit_exceeded', 'execution_budget_exhausted', 'event_expired']));
});

test('hydrates agent prompt with canonical context and trace identity', async () => {
  const durableContext = await loadDurableContext();
  const envelope = buildEventEnvelope({
    objective: { id: 'agent-fabric-v1', summary: 'Implement fabric', scope: ['runtime'] },
    actor: { type: 'human', id: 'siea' },
    owner: 'nomy',
    targetAgent: 'selah',
    allowedAgents: ['selah']
  });
  const hydrated = hydrateAgentContext({ durableContext, envelope, issueContext: 'Issue #281' });
  assert.match(hydrated, /MSH Agent Fabric v1/);
  assert.match(hydrated, new RegExp(envelope.correlation_id));
  assert.match(hydrated, /Issue #281/);
});

test('next hop preserves correlation and advances circuit breakers', () => {
  const envelope = buildEventEnvelope({
    objective: { id: 'agent-fabric-v1', summary: 'Implement fabric', scope: ['runtime'] },
    actor: { type: 'agent', id: 'nomy' },
    owner: 'nomy',
    targetAgent: 'selah',
    allowedAgents: ['nomy', 'selah']
  });
  const next = nextHop(envelope, { targetAgent: 'nomy' });
  assert.equal(next.correlation_id, envelope.correlation_id);
  assert.equal(next.causation_id, envelope.event_id);
  assert.equal(next.state.hop_count, 1);
  assert.equal(next.state.remaining_steps, envelope.state.remaining_steps - 1);
});
