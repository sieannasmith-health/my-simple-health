import test from 'node:test';
import assert from 'node:assert/strict';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';

const taskQueue = 'msh-worker-recovery-test';

test('workflow survives worker shutdown and completes on replacement worker', async (t) => {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  t.after(async () => env.teardown());

  let markFirstActivityStarted;
  const firstActivityStarted = new Promise((resolve) => {
    markFirstActivityStarted = resolve;
  });
  let firstCall = true;

  const worker1 = await Worker.create({
    connection: env.nativeConnection,
    taskQueue,
    workflowsPath: new URL('../src/workflows.ts', import.meta.url).pathname,
    activities: {
      async recordStage(_objectiveId, stage) {
        if (firstCall) {
          firstCall = false;
          markFirstActivityStarted();
          throw new Error('simulated worker loss');
        }
        return stage;
      },
    },
  });

  const worker1Run = worker1.run();
  const handle = await env.client.workflow.start('foundationPilot', {
    taskQueue,
    workflowId: `msh-recovery-${Date.now()}`,
    args: [{ objectiveId: '203-recovery' }],
  });

  await firstActivityStarted;
  worker1.shutdown();
  await worker1Run;

  const worker2 = await Worker.create({
    connection: env.nativeConnection,
    taskQueue,
    workflowsPath: new URL('../src/workflows.ts', import.meta.url).pathname,
    activities: {
      async recordStage(_objectiveId, stage) {
        return stage;
      },
    },
  });

  const result = await worker2.runUntil(() => handle.result());

  assert.deepEqual(result, {
    objectiveId: '203-recovery',
    stages: ['NOMY', 'SELAH', 'TESSA', 'NOMY_ACCEPTANCE'],
    terminalStatus: 'COMPLETED',
  });
});
