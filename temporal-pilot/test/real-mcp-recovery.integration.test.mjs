import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker } from '@temporalio/worker';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import * as actualActivities from '../src/activities.ts';

test('real MCP stdio dependency failure retries, recovers, and completes the same #203 workflow once', async (t) => {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  const taskQueue = `msh-real-mcp-recovery-${Date.now()}`;
  const tempDirectory = mkdtempSync(join(tmpdir(), 'msh-mcp-recovery-'));
  const statePath = join(tempDirectory, 'github-state.json');
  const recoveryServerPath = 'test/recovery-mcp-server.ts';
  const missingServerPath = 'test/missing-recovery-mcp-server.ts';
  const attempts = new Map();
  const selahIdempotencyKeys = [];

  const previousEnv = {
    MSH_REAL_MCP_CANARY: process.env.MSH_REAL_MCP_CANARY,
    MSH_MCP_SERVER_PATH: process.env.MSH_MCP_SERVER_PATH,
    MSH_MCP_RECOVERY_STATE_FILE: process.env.MSH_MCP_RECOVERY_STATE_FILE,
    MSH_CANARY_BASE_REF: process.env.MSH_CANARY_BASE_REF,
    GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  };

  process.env.MSH_REAL_MCP_CANARY = '1';
  process.env.MSH_MCP_SERVER_PATH = recoveryServerPath;
  process.env.MSH_MCP_RECOVERY_STATE_FILE = statePath;
  process.env.MSH_CANARY_BASE_REF = 'main';
  process.env.GITHUB_REPOSITORY = 'sieannasmith-health/my-simple-health';
  process.env.GITHUB_TOKEN = 'test-token';

  t.after(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(tempDirectory, { recursive: true, force: true });
  });

  try {
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath: new URL('../src/workflows.ts', import.meta.url).pathname,
      activities: {
        ...actualActivities,
        async runAgentStage(objectiveId, stage, priorEvidence, idempotencyKey) {
          const attempt = (attempts.get(stage) ?? 0) + 1;
          attempts.set(stage, attempt);

          if (stage === 'SELAH') {
            selahIdempotencyKeys.push(idempotencyKey);
            process.env.MSH_MCP_SERVER_PATH = attempt === 1 ? missingServerPath : recoveryServerPath;
          } else {
            process.env.MSH_MCP_SERVER_PATH = recoveryServerPath;
          }

          try {
            return await actualActivities.runAgentStage(objectiveId, stage, priorEvidence, idempotencyKey);
          } finally {
            process.env.MSH_MCP_SERVER_PATH = recoveryServerPath;
          }
        },
      },
    });

    await worker.runUntil(async () => {
      const result = await env.client.workflow.execute('foundationArtifactPilot', {
        taskQueue,
        workflowId: `msh-real-mcp-recovery-203-${Date.now()}`,
        args: [{ objectiveId: '203', activityTimeout: '30 seconds' }],
      });

      assert.equal(result.terminalStatus, 'COMPLETED');
      assert.deepEqual(
        result.evidence.map((entry) => [entry.stage, entry.status]),
        [
          ['NOMY', 'READY'],
          ['SELAH', 'READY'],
          ['TESSA', 'PASS'],
          ['NOMY_ACCEPTANCE', 'ACCEPTED'],
        ],
      );
      assert.equal(attempts.get('SELAH'), 2, 'Temporal should recover on the second bounded Selah attempt');
      assert.equal(selahIdempotencyKeys.length, 2);
      assert.equal(new Set(selahIdempotencyKeys).size, 1, 'the Selah idempotency key must remain stable across retry');

      const state = JSON.parse(readFileSync(statePath, 'utf8'));
      assert.equal(state.counters.branchCreates, 1, 'recovery must create exactly one branch');
      assert.equal(state.counters.filePuts, 1, 'recovery must write exactly one repository file');
      assert.equal(state.counters.prPosts, 1, 'recovery must open exactly one pull request');
      assert.equal(state.branches.length, 1);
      assert.equal(Object.keys(state.files).length, 1);
      assert.equal(state.pullRequests.length, 1);
      assert.equal(attempts.get('TESSA'), 1, 'recovered workflow should proceed directly to Tessa without a human gate');
      assert.equal(attempts.get('NOMY_ACCEPTANCE'), 1, 'the same workflow should reach Product acceptance');
    });
  } finally {
    await env.teardown();
  }
});
