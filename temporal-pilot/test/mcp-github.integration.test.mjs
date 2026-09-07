import test from 'node:test';
import assert from 'node:assert/strict';
import { connectMshGitHubMcpClient } from '../src/github-mcp-client.ts';

function jsonText(result) {
  const item = result.content?.find((entry) => entry.type === 'text');
  assert.ok(item && item.type === 'text');
  return JSON.parse(item.text);
}

test('official MCP v2 stdio path exposes bounded GitHub tools with idempotent side effects', async () => {
  const connection = await connectMshGitHubMcpClient({
    env: {
      MSH_MCP_TEST_MODE: '1',
      GITHUB_REPOSITORY: 'sieannasmith-health/my-simple-health',
    },
  });

  try {
    assert.equal(connection.client.getNegotiatedProtocolVersion(), '2026-07-28');

    const { tools } = await connection.client.listTools();
    assert.deepEqual(
      tools.map((tool) => tool.name).sort(),
      ['github_create_branch', 'github_read_issue'],
    );

    const issueResult = await connection.client.callTool({
      name: 'github_read_issue',
      arguments: { issueNumber: 203 },
    });
    assert.notEqual(issueResult.isError, true);
    assert.deepEqual(jsonText(issueResult), {
      number: 203,
      title: 'test issue',
      body: 'test body',
    });

    const first = await connection.client.callTool({
      name: 'github_create_branch',
      arguments: {
        branch: 'mcp-idempotency-test',
        fromRef: 'main',
        idempotencyKey: '203:SELAH:create-branch',
      },
    });
    const second = await connection.client.callTool({
      name: 'github_create_branch',
      arguments: {
        branch: 'mcp-idempotency-test',
        fromRef: 'main',
        idempotencyKey: '203:SELAH:create-branch',
      },
    });

    assert.equal(jsonText(first).created, true);
    assert.equal(jsonText(second).created, false);
    assert.equal(jsonText(second).idempotencyKey, '203:SELAH:create-branch');
  } finally {
    await connection.close();
  }
});
