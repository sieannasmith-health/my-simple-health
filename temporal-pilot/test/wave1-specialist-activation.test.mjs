import test from 'node:test';
import assert from 'node:assert/strict';
import { runWave1SpecialistReview } from '../src/activities.ts';
import { assertAgentToolPermission } from '../src/agent-registry.ts';

test('Mira, Sage, and Clara produce bounded specialist evidence with objective + foundation provenance', async () => {
  for (const agentId of ['mira', 'sage', 'clara']) {
    const artifact = await runWave1SpecialistReview('235', agentId, `235:${agentId}:test`);
    assert.equal(artifact.agentId, agentId);
    assert.equal(artifact.artifactType, 'SPECIALIST_REVIEW');
    assert.equal(artifact.status, 'READY');
    assert.deepEqual(artifact.provenance, [
      'issue:235',
      'repository-file:temporal-pilot/AGENT_INTEROPERABILITY_GATE2.md@main',
    ]);
  }
});

test('Wave 1 specialists fail closed on repository mutation', () => {
  for (const agentId of ['mira', 'sage', 'clara']) {
    for (const tool of ['github_create_branch', 'github_write_repository_file', 'github_open_pull_request']) {
      assert.throws(
        () => assertAgentToolPermission(agentId, tool),
        new RegExp(`AGENT_TOOL_FORBIDDEN:${agentId}:${tool}`),
      );
    }
  }
});

test('specialist review requires a valid Product objective and idempotency key', async () => {
  await assert.rejects(
    () => runWave1SpecialistReview('not-an-issue', 'mira', 'key'),
    /OBJECTIVE_ISSUE_NUMBER_REQUIRED/,
  );
  await assert.rejects(
    () => runWave1SpecialistReview('235', 'mira', ''),
    /IDEMPOTENCY_KEY_REQUIRED/,
  );
});
