import test from 'node:test';
import assert from 'node:assert/strict';
import { runWave4BusinessPeopleReview } from '../src/wave4-activities.ts';
import { assertAgentToolPermission, getAgentCard } from '../src/agent-registry.ts';

const agents = ['genesis', 'newton', 'harper'];

test('Wave 4 workers have bounded active read-only metadata', () => {
  for (const agentId of agents) {
    const card = getAgentCard(agentId);
    assert.equal(card?.status, 'active');
    assert.deepEqual(card?.allowedTools, ['github_read_issue', 'github_read_repository_file', 'github_read_checks']);
    assert.deepEqual(card?.protocolBindings, ['TEMPORAL_INTERNAL', 'MCP_TOOL_ACCESS']);
    assert.equal(card?.a2aExposure, 'none');
  }
});

test('Wave 4 workers produce provenance-bearing business/people reviews', async () => {
  for (const agentId of agents) {
    const artifact = await runWave4BusinessPeopleReview('241', agentId, `241:${agentId}:test`);
    assert.equal(artifact.agentId, agentId);
    assert.equal(artifact.artifactType, 'BUSINESS_PEOPLE_REVIEW');
    assert.equal(artifact.status, 'READY');
    assert.deepEqual(artifact.provenance, ['issue:241', 'repository-file:temporal-pilot/AGENT_INTEROPERABILITY_GATE2.md@main']);
  }
});

test('Wave 4 workers fail closed on repository mutation', () => {
  for (const agentId of agents) {
    for (const tool of ['github_create_branch', 'github_write_repository_file', 'github_open_pull_request']) {
      assert.throws(() => assertAgentToolPermission(agentId, tool), new RegExp(`AGENT_TOOL_FORBIDDEN:${agentId}:${tool}`));
    }
  }
});

test('Wave 4 review rejects invalid objective and missing idempotency', async () => {
  await assert.rejects(() => runWave4BusinessPeopleReview('bad', 'genesis', 'key'), /OBJECTIVE_ISSUE_NUMBER_REQUIRED/);
  await assert.rejects(() => runWave4BusinessPeopleReview('241', 'genesis', ''), /IDEMPOTENCY_KEY_REQUIRED/);
});
