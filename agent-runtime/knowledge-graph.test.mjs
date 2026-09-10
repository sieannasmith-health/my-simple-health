import assert from 'node:assert/strict';
import { neighborhood, projectKnowledgeGraph } from './knowledge-graph.mjs';

const events = [
  {
    event_id: 'e1', event_type: 'objective.created', occurred_at: '2026-09-10T00:00:00Z', actor: 'nomy',
    subject: { type: 'objective', id: 'agent-os-v1' }, objective_id: 'agent-os-v1',
    provenance: { source: 'github', source_id: 'issue-281' }, payload: { label: 'Build MSH Agent OS' }
  },
  {
    event_id: 'e2', event_type: 'assignment.changed', occurred_at: '2026-09-10T00:01:00Z', actor: 'nomy',
    subject: { type: 'objective', id: 'agent-os-v1' }, objective_id: 'agent-os-v1', to_agent: 'selah',
    provenance: { source: 'agent_runtime', source_id: 'transition-1' }, payload: {}
  },
  {
    event_id: 'e3', event_type: 'pr.created', occurred_at: '2026-09-10T00:02:00Z', actor: 'selah',
    subject: { type: 'pull_request', id: 'pr-311' }, objective_id: 'agent-os-v1', relation: 'IMPLEMENTS',
    provenance: { source: 'github', source_id: 'pr-311' },
    payload: { label: 'Agent OS foundation', related_id: 'agent-os-v1', related_type: 'objective' }
  }
];

const graph = projectKnowledgeGraph(events, '2026-09-10T00:03:00Z');
assert.ok(graph.nodes.some(n => n.id === 'agent-os-v1' && n.type === 'objective'));
assert.ok(graph.nodes.some(n => n.id === 'selah' && n.type === 'agent'));
assert.ok(graph.edges.some(e => e.from === 'agent-os-v1' && e.to === 'nomy' && e.type === 'OWNS'));
assert.ok(graph.edges.some(e => e.from === 'agent-os-v1' && e.to === 'selah' && e.type === 'ASSIGNED_TO'));
assert.ok(graph.edges.some(e => e.from === 'pr-311' && e.to === 'agent-os-v1' && e.type === 'IMPLEMENTS'));

const local = neighborhood(graph, 'agent-os-v1', 1);
assert.ok(local.nodes.some(n => n.id === 'nomy'));
assert.ok(local.nodes.some(n => n.id === 'selah'));
assert.ok(local.nodes.some(n => n.id === 'pr-311'));

console.log('knowledge graph tests passed');
