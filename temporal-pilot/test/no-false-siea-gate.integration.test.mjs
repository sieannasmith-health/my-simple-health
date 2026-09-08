import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from '@temporalio/worker';
import { TestWorkflowEnvironment } from '@temporalio/testing';

test('infrastructure failure terminates without entering a Siea approval wait', async () => {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  const taskQueue = 'msh-no-false-siea-gate-test';
  let attempts = 0;

  try {
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath: new URL('../src/workflows.ts', import.meta.url).pathname,
      activities: {
        async recordStage() {
          attempts += 1;
          throw new Error('simulated infrastructure failure');
        },
      },
    });

    await assert.rejects(
      worker.runUntil(() =>
        env.client.workflow.execute('foundationPilot', {
          taskQueue,
          workflowId: `msh-no-false-siea-gate-${Date.now()}`,
          args: [{ objectiveId: '203-no-false-gate', activityTimeout: '3 seconds' }],
        }),
      ),
    );

    assert.equal(attempts, 3, 'infrastructure failure must use the bounded retry policy');
  } finally {
    await env.teardown();
  }
});
