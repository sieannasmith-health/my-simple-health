import assert from 'node:assert/strict';
import { resolveFanoutTransition } from './fanout-transition.mjs';

const base = { assigned_agent: 'nomy', current_stage: 'PRODUCT_COORDINATION', status: 'EXECUTING' };
const started = resolveFanoutTransition({ status: 'completed', next_agents: ['sage', 'atlas', 'sage'], join_agent: 'nomy' }, base, '2026-09-10T00:00:00.000Z');
assert.equal(started.handled, true);
assert.equal(started.transition.assignedAgent, 'sage');
assert.deepEqual(started.fanout.pending, ['atlas']);
assert.deepEqual(started.fanout.completed, []);

const afterSage = resolveFanoutTransition({ status: 'completed' }, { ...base, assigned_agent: 'sage', fanout: started.fanout }, '2026-09-10T00:01:00.000Z');
assert.equal(afterSage.transition.assignedAgent, 'atlas');
assert.equal(afterSage.transition.graphTransition.source, 'fanout_sequence');
assert.deepEqual(afterSage.fanout.completed, ['sage']);

const afterAtlas = resolveFanoutTransition({ status: 'completed' }, { ...base, assigned_agent: 'atlas', fanout: afterSage.fanout }, '2026-09-10T00:02:00.000Z');
assert.equal(afterAtlas.transition.assignedAgent, 'nomy');
assert.equal(afterAtlas.transition.graphTransition.source, 'fanout_join');
assert.deepEqual(afterAtlas.fanout.completed, ['sage', 'atlas']);
assert.ok(afterAtlas.fanout.joined_at);

assert.throws(() => resolveFanoutTransition({ status: 'completed', next_agents: ['nomy', 'bogus', 'tessa'] }, base), /disallowed destinations/);
console.log('Agent OS fan-out transition conformance passed.');
