import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from '@temporalio/worker';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import * as activities from '../src/activities.ts';

test('live #203 Temporal MCP GitHub canary reaches Product acceptance', async (t) => {
  if (process.env.MSH_REAL_MCP_CANARY !== '1') {
    t.skip('live MCP canary requires MSH_REAL_MCP_CANARY=1');
    return;
  }

  const env = await TestWorkflowEnvironment.createTimeSkipping();
  const taskQueue = `msh-live-canary-${Date.now()}`;

  try {
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath: new URL('../src/workflows.ts', import.meta.url).pathname,
      activities,
    });

    await worker.runUntil(async () => {
      const result = await env.client.workflow.execute('foundationArtifactPilot', {
        taskQueue,
        workflowId: `msh-live-objective-203-${Date.now()}`,
        args: [{ objectiveId: '203', activityTimeout: '3 minutes' }],
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
      assert.match(result.evidence[1].artifactRef, /^pr:\d+$/);
      assert.match(result.evidence[2].artifactRef, /^verified-ci:pr:\d+$/);
      assert.match(result.evidence[3].artifactRef, /^accepted:verified-ci:pr:\d+$/);
    });
  } finally {
    await env.teardown();
  }
});
