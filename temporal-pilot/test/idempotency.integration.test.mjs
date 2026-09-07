import test from 'node:test';
import assert from 'node:assert/strict';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';

test('activity retries preserve the same stable idempotency key', async () => {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  const taskQueue = 'msh-idempotency-test';
  const observedKeys = [];
  let nomyAttempts = 0;

  try {
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath: new URL('../src/workflows.ts', import.meta.url).pathname,
      activities: {
        async recordStage(_objectiveId, stage, idempotencyKey) {
          observedKeys.push({ stage, idempotencyKey });
          if (stage === 'NOMY' && ++nomyAttempts === 1) {
            throw new Error('simulated retry before side effect acknowledgement');
          }
          return stage;
        },
      },
    });

    const result = await worker.runUntil(() =>
      env.client.workflow.execute('foundationPilot', {
        taskQueue,
        workflowId: `msh-idempotency-${Date.now()}`,
        args: [{ objectiveId: '203-idempotency-proof', activityTimeout: '3 seconds' }],
      }),
    );

    assert.equal(nomyAttempts, 2);
    assert.deepEqual(
      observedKeys.filter(({ stage }) => stage === 'NOMY').map(({ idempotencyKey }) => idempotencyKey),
      [
        '203-idempotency-proof:NOMY:record-stage',
        '203-idempotency-proof:NOMY:record-stage',
      ],
    );
    assert.deepEqual(result.stages, ['NOMY', 'SELAH', 'TESSA', 'NOMY_ACCEPTANCE']);
  } finally {
    await env.teardown();
  }
});
