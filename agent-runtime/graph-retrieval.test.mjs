import assert from 'node:assert/strict';
import { retrieveGraphContext, rejectStaleContext } from './graph-retrieval.mjs';

const graph = {
  nodes: [
    { id: 'objective:agent-os', type: 'objective', label: 'Agent OS setup', status: 'PENDING', properties: {}, provenance: ['event:current'] },
    { id: 'nomy', type: 'agent', label: 'Nomy', status: null, properties: {}, provenance: ['event:current'] },
    { id: 'pr:313', type: 'pull_request', label: 'Current state retrieval', status: 'merged', properties: {}, provenance: ['github:313'] }
  ],
  edges: [
    { from: 'objective:agent-os', to: 'nomy', type: 'ASSIGNED_TO', properties: {}, provenance: ['event:current'] },
    { from: 'objective:agent-os', to: 'pr:313', type: 'IMPLEMENTED_BY', properties: {}, provenance: ['github:313'] }
  ]
};

const result = retrieveGraphContext(graph, 'Agent OS current state Nomy', { depth: 2 });
assert.ok(result.ranked_matches.some(item => item.id === 'objective:agent-os'));
assert.ok(result.context.nodes.some(node => node.id === 'nomy'));
assert.ok(result.provenance.includes('event:current'));

const canonical = { generated_at: '2026-09-10T15:00:00.000Z', objective: { sequence_version: 8 } };
assert.deepEqual(rejectStaleContext({ canonical, candidate: { generated_at: '2026-09-10T15:01:00.000Z', objective: { sequence_version: 7 } } }), { accepted: false, reason: 'STALE_SEQUENCE' });
assert.deepEqual(rejectStaleContext({ canonical, candidate: { generated_at: '2026-09-10T14:59:00.000Z', objective: { sequence_version: 8 } } }), { accepted: false, reason: 'STALE_GENERATION' });
assert.deepEqual(rejectStaleContext({ canonical, candidate: canonical }), { accepted: true, reason: 'CURRENT' });
console.log('graph retrieval tests passed');
