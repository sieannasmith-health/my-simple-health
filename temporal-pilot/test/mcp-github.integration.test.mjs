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
      [
        'github_create_branch',
        'github_open_pull_request',
        'github_read_checks',
        'github_read_issue',
        'github_write_repository_file',
      ],
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

    const checksResult = await connection.client.callTool({
      name: 'github_read_checks',
      arguments: { ref: 'test-commit-sha' },
    });
    assert.notEqual(checksResult.isError, true);
    assert.equal(jsonText(checksResult).conclusion, 'success');
    assert.equal(jsonText(checksResult).checks[0].name, 'temporal-pilot');

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

    const fileFirst = await connection.client.callTool({
      name: 'github_write_repository_file',
      arguments: {
        branch: 'mcp-idempotency-test',
        path: 'temporal-pilot/canary/203.txt',
        content: 'objective=203\n',
        message: 'Add autonomy canary artifact',
        idempotencyKey: '203:SELAH:write-file',
      },
    });
    const fileSecond = await connection.client.callTool({
      name: 'github_write_repository_file',
      arguments: {
        branch: 'mcp-idempotency-test',
        path: 'temporal-pilot/canary/203.txt',
        content: 'objective=203\n',
        message: 'Add autonomy canary artifact',
        idempotencyKey: '203:SELAH:write-file',
      },
    });

    assert.equal(jsonText(fileFirst).changed, true);
    assert.equal(jsonText(fileSecond).changed, false);
    assert.equal(jsonText(fileSecond).idempotencyKey, '203:SELAH:write-file');

    const prFirst = await connection.client.callTool({
      name: 'github_open_pull_request',
      arguments: {
        head: 'mcp-idempotency-test',
        base: 'main',
        title: 'MSH autonomy canary #203',
        body: 'Bounded MCP autonomy canary.',
        idempotencyKey: '203:SELAH:open-pr',
      },
    });
    const prSecond = await connection.client.callTool({
      name: 'github_open_pull_request',
      arguments: {
        head: 'mcp-idempotency-test',
        base: 'main',
        title: 'MSH autonomy canary #203',
        body: 'Bounded MCP autonomy canary.',
        idempotencyKey: '203:SELAH:open-pr',
      },
    });

    assert.equal(jsonText(prFirst).created, true);
    assert.equal(jsonText(prSecond).created, false);
    assert.equal(jsonText(prSecond).number, jsonText(prFirst).number);
    assert.equal(jsonText(prSecond).idempotencyKey, '203:SELAH:open-pr');
  } finally {
    await connection.close();
  }
});
