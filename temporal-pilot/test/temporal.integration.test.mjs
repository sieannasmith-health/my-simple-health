import test from 'node:test';
import assert from 'node:assert/strict';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';

const taskQueue = 'msh-foundation-pilot-test';

test('Temporal executes the MSH foundation workflow to terminal completion', async (t) => {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  t.after(async () => env.teardown());

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

  const result = await worker.runUntil(async () => {
    const handle = await env.client.workflow.start('foundationPilot', {
      taskQueue,
      workflowId: `msh-pilot-test-${Date.now()}`,
      args: [{ objectiveId: '203-test' }],
    });
    return handle.result();
  });

  assert.deepEqual(result, {
    objectiveId: '203-test',
    stages: ['NOMY', 'SELAH', 'TESSA', 'NOMY_ACCEPTANCE'],
    terminalStatus: 'COMPLETED',
  });
});
