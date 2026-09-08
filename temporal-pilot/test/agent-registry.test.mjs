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

test('only proven Temporal workers are active at Gate 2 bootstrap', () => {
  assert.deepEqual(
    discoverAgents({ status: 'active' }).map((card) => card.id).sort(),
    ['nomy', 'selah', 'tessa'],
  );
  assert.equal(discoverAgents({ status: 'registered' }).length, 14);
});

test('discovery selects workers by declared capability rather than hard-coded handoff order', () => {
  assert.deepEqual(discoverAgents({ capability: 'security_engineering' }).map((card) => card.id), ['aiden']);
  assert.deepEqual(discoverAgents({ capability: 'product_design' }).map((card) => card.id), ['mira']);
  assert.deepEqual(discoverAgents({ capability: 'health_informatics' }).map((card) => card.id), ['clara']);
});

test('Selah alone holds bounded repository write authority', () => {
  for (const tool of ['github_create_branch', 'github_write_repository_file', 'github_open_pull_request']) {
    assert.equal(canAgentUseTool('selah', tool), true);
    assert.equal(canAgentUseTool('nomy', tool), false);
    assert.equal(canAgentUseTool('tessa', tool), false);
  }

  assert.deepEqual(
    discoverAgents({ requiredTool: 'github_open_pull_request' }).map((card) => card.id),
    ['selah'],
  );
});

test('Nomy and Tessa retain only read-only MCP authority', () => {
  for (const agentId of ['nomy', 'tessa']) {
    assert.equal(canAgentUseTool(agentId, 'github_read_issue'), true);
    assert.equal(canAgentUseTool(agentId, 'github_read_repository_file'), true);
    assert.equal(canAgentUseTool(agentId, 'github_read_checks'), true);
    assert.equal(canAgentUseTool(agentId, 'github_write_repository_file'), false);
  }
});

test('registered specialists are discoverable but receive no live tool authority before onboarding', () => {
  for (const agentId of expectedWorkers.filter((id) => !['nomy', 'selah', 'tessa'].includes(id))) {
    const card = getAgentCard(agentId);
    assert.equal(card?.status, 'registered');
    assert.deepEqual(card?.allowedTools, []);
    assert.equal(canAgentUseTool(agentId, 'github_read_issue'), false);
  }
});

test('forbidden tool use fails closed with auditable agent and tool identity', () => {
  assert.throws(
    () => assertAgentToolPermission('tessa', 'github_open_pull_request'),
    /AGENT_TOOL_FORBIDDEN:tessa:github_open_pull_request/,
  );
  assert.throws(
    () => assertAgentToolPermission('aiden', 'github_read_issue'),
    /AGENT_TOOL_FORBIDDEN:aiden:github_read_issue/,
  );
});
