import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from '@temporalio/worker';
import { TestWorkflowEnvironment } from '@temporalio/testing';

test('workflow can be cancelled and resumed from an explicit durable stage boundary', async () => {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  const taskQueue = 'msh-cancel-resume-test';

  try {
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath: new URL('../src/workflows.ts', import.meta.url).pathname,
      activities: {
        async recordStage(_objectiveId, stage) {
          return stage;
        },
      },
    });

    await worker.runUntil(async () => {
      const cancelledHandle = await env.client.workflow.start('foundationPilot', {
        taskQueue,
        workflowId: `msh-cancel-${Date.now()}`,
        args: [{ objectiveId: '203-cancel-resume', startDelay: '1 hour' }],
      });

      await cancelledHandle.cancel();
      await assert.rejects(cancelledHandle.result(), (error) => {
        const text = String(error?.cause?.message ?? error?.message ?? error);
        return /cancel/i.test(text);
      });

      const resumed = await env.client.workflow.execute('foundationPilot', {
        taskQueue,
        workflowId: `msh-resume-${Date.now()}`,
        args: [{ objectiveId: '203-cancel-resume', resumeFromStage: 'SELAH' }],
      });

      assert.deepEqual(resumed, {
        objectiveId: '203-cancel-resume',
        stages: ['SELAH', 'TESSA', 'NOMY_ACCEPTANCE'],
        terminalStatus: 'COMPLETED',
      });
    });
  } finally {
    await env.teardown();
  }
});
