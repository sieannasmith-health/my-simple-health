import test from 'node:test';
import assert from 'node:assert/strict';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';

const taskQueue = 'msh-bounded-retry-test';

test('Temporal retries a failed activity twice and succeeds on the third attempt', async () => {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  const attempts = new Map();

  try {
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath: new URL('../src/workflows.ts', import.meta.url).pathname,
      activities: {
        async recordStage(objectiveId, stage) {
          const key = `${objectiveId}:${stage}`;
          const count = (attempts.get(key) ?? 0) + 1;
          attempts.set(key, count);

          if (stage === 'NOMY' && count < 3) {
            throw new Error(`simulated transient failure ${count}`);
          }

          return stage;
        },
      },
    });

    const result = await worker.runUntil(() =>
      env.client.workflow.execute('foundationPilot', {
        taskQueue,
        workflowId: `msh-bounded-retry-${Date.now()}`,
        args: [{ objectiveId: '203-retry-proof', activityTimeout: '3 seconds' }],
      }),
    );

    assert.equal(attempts.get('203-retry-proof:NOMY'), 3);
    assert.deepEqual(result, {
      objectiveId: '203-retry-proof',
      stages: ['NOMY', 'SELAH', 'TESSA', 'NOMY_ACCEPTANCE'],
      terminalStatus: 'COMPLETED',
    });
  } finally {
    await env.teardown();
  }
});
