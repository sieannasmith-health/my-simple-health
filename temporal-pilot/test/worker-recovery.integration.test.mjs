import test from 'node:test';
import assert from 'node:assert/strict';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';

const taskQueue = 'msh-worker-recovery-test';

test('workflow recovers after first worker stops polling', { timeout: 20_000 }, async (t) => {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  t.after(async () => env.teardown());

  let markFirstAttempt;
  const firstAttempt = new Promise((resolve) => {
    markFirstAttempt = resolve;
  });

  const worker1 = await Worker.create({
    connection: env.nativeConnection,
    taskQueue,
    workflowsPath: new URL('../src/workflows.ts', import.meta.url).pathname,
    activities: {
      async recordStage() {
        markFirstAttempt();
        throw new Error('simulated worker loss');
      },
    },
  });

  const worker1Run = worker1.run();
  const handle = await env.client.workflow.start('foundationPilot', {
    taskQueue,
    workflowId: `msh-recovery-${Date.now()}`,
    args: [{ objectiveId: '203-recovery' }],
  });

  await firstAttempt;

  // Stop worker1 without awaiting its drain. This models loss of the original
  // poller while leaving Temporal's durable workflow execution alive.
  worker1.shutdown();
  void worker1Run.catch(() => {});

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
