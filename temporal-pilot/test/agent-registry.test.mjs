import test from 'node:test';
import assert from 'node:assert/strict';
import { MSH_AGENT_REGISTRY, assertAgentToolPermission, canAgentUseTool, discoverAgents } from '../src/agent-registry.ts';

const expectedWorkers = ['nomy','selah','sage','clara','mira','eden','vera','aiden','ellis','genesis','newton','harper','june','atlas','reese','iris','tessa'];
const wave1Workers = ['mira','sage','clara'];
const wave2Workers = ['aiden','vera','reese','eden'];
const wave3Workers = ['atlas','iris','june','ellis'];
const wave4Workers = ['genesis','newton','harper'];
const bootstrapWorkers = ['nomy','selah','tessa'];
const activeReadOnlyWorkers = ['nomy','tessa',...wave1Workers,...wave2Workers,...wave3Workers,...wave4Workers];

test('registry contains authoritative 17-worker roster', () => {
  assert.equal(MSH_AGENT_REGISTRY.length, 17);
  assert.deepEqual(MSH_AGENT_REGISTRY.map((card) => card.id).sort(), [...expectedWorkers].sort());
  assert.equal(new Set(MSH_AGENT_REGISTRY.map((card) => card.id)).size, 17);
  assert.ok(MSH_AGENT_REGISTRY.every((card) => card.version === '1.0.0' && card.a2aExposure === 'none'));
});

test('all accepted/provisional workforce waves are active', () => {
  assert.deepEqual(discoverAgents({ status: 'active' }).map((card) => card.id).sort(), [...bootstrapWorkers,...wave1Workers,...wave2Workers,...wave3Workers,...wave4Workers].sort());
  assert.equal(discoverAgents({ status: 'registered' }).length, 0);
});

test('discovery selects workers by declared capability', () => {
  assert.deepEqual(discoverAgents({ capability: 'security_engineering' }).map((card) => card.id), ['aiden']);
  assert.deepEqual(discoverAgents({ capability: 'product_design' }).map((card) => card.id), ['mira']);
  assert.deepEqual(discoverAgents({ capability: 'analytics' }).map((card) => card.id), ['atlas']);
  assert.deepEqual(discoverAgents({ capability: 'growth_strategy' }).map((card) => card.id), ['genesis']);
});

test('Selah alone holds bounded repository write authority', () => {
  for (const tool of ['github_create_branch','github_write_repository_file','github_open_pull_request']) {
    assert.equal(canAgentUseTool('selah', tool), true);
    for (const agentId of activeReadOnlyWorkers) assert.equal(canAgentUseTool(agentId, tool), false);
  }
  assert.deepEqual(discoverAgents({ requiredTool: 'github_open_pull_request' }).map((card) => card.id), ['selah']);
});

test('all non-Selah active workers retain only read MCP authority', () => {
  for (const agentId of activeReadOnlyWorkers) {
    assert.equal(canAgentUseTool(agentId, 'github_read_issue'), true);
    assert.equal(canAgentUseTool(agentId, 'github_read_repository_file'), true);
    assert.equal(canAgentUseTool(agentId, 'github_read_checks'), true);
    assert.equal(canAgentUseTool(agentId, 'github_write_repository_file'), false);
  }
});

test('final activation leaves no registered-only worker', () => {
  assert.deepEqual(discoverAgents({ status: 'registered' }), []);
});

test('forbidden tool use fails closed for every specialist wave', () => {
  for (const agentId of [...wave1Workers,...wave2Workers,...wave3Workers,...wave4Workers]) {
    assert.throws(() => assertAgentToolPermission(agentId, 'github_write_repository_file'), new RegExp(`AGENT_TOOL_FORBIDDEN:${agentId}:github_write_repository_file`));
  }
});
