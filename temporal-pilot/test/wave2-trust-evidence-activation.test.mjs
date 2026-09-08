import test from 'node:test';
import assert from 'node:assert/strict';
import { runWave2TrustEvidenceReview } from '../src/wave2-activities.ts';
import { assertAgentToolPermission, getAgentCard } from '../src/agent-registry.ts';

const agents = ['aiden', 'vera', 'reese', 'eden'];

test('Wave 2 workers have bounded active read-only metadata', () => {
  for (const agentId of agents) {
    const card = getAgentCard(agentId);
    assert.equal(card?.status, 'active');
    assert.deepEqual(card?.allowedTools, ['github_read_issue', 'github_read_repository_file', 'github_read_checks']);
    assert.deepEqual(card?.protocolBindings, ['TEMPORAL_INTERNAL', 'MCP_TOOL_ACCESS']);
    assert.equal(card?.a2aExposure, 'none');
  }
});

test('Wave 2 workers produce provenance-bearing trust/evidence reviews', async () => {
  for (const agentId of agents) {
    const artifact = await runWave2TrustEvidenceReview('237', agentId, `237:${agentId}:test`);
    assert.equal(artifact.agentId, agentId);
    assert.equal(artifact.artifactType, 'TRUST_EVIDENCE_REVIEW');
    assert.equal(artifact.status, 'READY');
    assert.deepEqual(artifact.provenance, ['issue:237', 'repository-file:temporal-pilot/AGENT_INTEROPERABILITY_GATE2.md@main']);
  }
});

test('Wave 2 workers fail closed on repository mutation', () => {
  for (const agentId of agents) {
    for (const tool of ['github_create_branch', 'github_write_repository_file', 'github_open_pull_request']) {
      assert.throws(() => assertAgentToolPermission(agentId, tool), new RegExp(`AGENT_TOOL_FORBIDDEN:${agentId}:${tool}`));
    }
  }
});

test('Wave 2 review rejects invalid objective and missing idempotency', async () => {
  await assert.rejects(() => runWave2TrustEvidenceReview('bad', 'aiden', 'key'), /OBJECTIVE_ISSUE_NUMBER_REQUIRED/);
  await assert.rejects(() => runWave2TrustEvidenceReview('237', 'aiden', ''), /IDEMPOTENCY_KEY_REQUIRED/);
});
