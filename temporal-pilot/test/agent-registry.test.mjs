import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MSH_AGENT_REGISTRY,
  assertAgentToolPermission,
  canAgentUseTool,
  discoverAgents,
  getAgentCard,
} from '../src/agent-registry.ts';

const expectedWorkers = [
  'nomy', 'selah', 'sage', 'clara', 'mira', 'eden', 'vera', 'aiden', 'ellis',
  'genesis', 'newton', 'harper', 'june', 'atlas', 'reese', 'iris', 'tessa',
];
const wave1Workers = ['mira', 'sage', 'clara'];
const bootstrapWorkers = ['nomy', 'selah', 'tessa'];

test('registry contains the authoritative 17-worker roster with stable unique IDs', () => {
  assert.equal(MSH_AGENT_REGISTRY.length, 17);
  assert.deepEqual(
    [...MSH_AGENT_REGISTRY.map((card) => card.id)].sort(),
    [...expectedWorkers].sort(),
  );
  assert.equal(new Set(MSH_AGENT_REGISTRY.map((card) => card.id)).size, 17);
  assert.ok(MSH_AGENT_REGISTRY.every((card) => card.version === '1.0.0'));
  assert.ok(MSH_AGENT_REGISTRY.every((card) => card.a2aExposure === 'none'));
});

test('Wave 1 provisionally activates Mira, Sage, and Clara on the proven Temporal boundary', () => {
  assert.deepEqual(
    discoverAgents({ status: 'active' }).map((card) => card.id).sort(),
    [...bootstrapWorkers, ...wave1Workers].sort(),
  );
  assert.equal(discoverAgents({ status: 'registered' }).length, 11);
});

test('discovery selects workers by declared capability rather than hard-coded handoff order', () => {
  assert.deepEqual(discoverAgents({ capability: 'security_engineering' }).map((card) => card.id), ['aiden']);
  assert.deepEqual(discoverAgents({ capability: 'product_design' }).map((card) => card.id), ['mira']);
  assert.deepEqual(discoverAgents({ capability: 'health_informatics' }).map((card) => card.id), ['clara']);
});

test('Selah alone holds bounded repository write authority', () => {
  for (const tool of ['github_create_branch', 'github_write_repository_file', 'github_open_pull_request']) {
    assert.equal(canAgentUseTool('selah', tool), true);
    for (const agentId of ['nomy', 'tessa', ...wave1Workers]) {
      assert.equal(canAgentUseTool(agentId, tool), false);
    }
  }

  assert.deepEqual(
    discoverAgents({ requiredTool: 'github_open_pull_request' }).map((card) => card.id),
    ['selah'],
  );
});

test('Nomy, Tessa, and Wave 1 specialists retain read-only MCP authority', () => {
  for (const agentId of ['nomy', 'tessa', ...wave1Workers]) {
    assert.equal(canAgentUseTool(agentId, 'github_read_issue'), true);
    assert.equal(canAgentUseTool(agentId, 'github_read_repository_file'), true);
    assert.equal(canAgentUseTool(agentId, 'github_read_checks'), true);
    assert.equal(canAgentUseTool(agentId, 'github_write_repository_file'), false);
  }
});

test('later-wave specialists remain discoverable with zero live tool authority', () => {
  for (const agentId of expectedWorkers.filter((id) => ![...bootstrapWorkers, ...wave1Workers].includes(id))) {
    const card = getAgentCard(agentId);
    assert.equal(card?.status, 'registered');
    assert.deepEqual(card?.allowedTools, []);
    assert.equal(canAgentUseTool(agentId, 'github_read_issue'), false);
  }
});

test('forbidden tool use fails closed with auditable agent and tool identity', () => {
  for (const agentId of wave1Workers) {
    assert.throws(
      () => assertAgentToolPermission(agentId, 'github_write_repository_file'),
      new RegExp(`AGENT_TOOL_FORBIDDEN:${agentId}:github_write_repository_file`),
    );
  }
  assert.throws(
    () => assertAgentToolPermission('aiden', 'github_read_issue'),
    /AGENT_TOOL_FORBIDDEN:aiden:github_read_issue/,
  );
});
