import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from '@temporalio/worker';
import { TestWorkflowEnvironment } from '@temporalio/testing';

test('typed Siea gate pauses only when explicitly requested and resumes by signal', async () => {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  const taskQueue = 'msh-siea-gate-test';
  const observedStages = [];

  try {
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath: new URL('../src/workflows.ts', import.meta.url).pathname,
      activities: {
        async recordStage(_objectiveId, stage) {
          observedStages.push(stage);
          return stage;
        },
      },
    });

    await worker.runUntil(async () => {
      const handle = await env.client.workflow.start('foundationPilot', {
        taskQueue,
        workflowId: `msh-siea-gate-${Date.now()}`,
        args: [{ objectiveId: '203-siea-gate', requireSieaApproval: true }],
      });

      while (observedStages.length < 2) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      assert.deepEqual(observedStages, ['NOMY', 'SELAH']);
      assert.equal((await handle.describe()).status.name, 'RUNNING');

      await handle.signal('sieaApprove');
      const result = await handle.result();

      assert.deepEqual(result, {
        objectiveId: '203-siea-gate',
        stages: ['NOMY', 'SELAH', 'TESSA', 'NOMY_ACCEPTANCE'],
        terminalStatus: 'COMPLETED',
      });
    });
  } finally {
    await env.teardown();
  }
});
