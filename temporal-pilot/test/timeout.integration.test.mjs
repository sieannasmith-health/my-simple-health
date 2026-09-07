import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from '@temporalio/worker';
import { TestWorkflowEnvironment } from '@temporalio/testing';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('activity Start-To-Close timeout is bounded and never becomes a Siea gate', { timeout: 20_000 }, async () => {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  const taskQueue = 'msh-activity-timeout-test';
  let attempts = 0;

  try {
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath: new URL('../src/workflows.ts', import.meta.url).pathname,
      activities: {
        async recordStage() {
          attempts += 1;
          await sleep(500);
          return 'NOMY';
        },
      },
    });

    await worker.runUntil(async () => {
      const handle = await env.client.workflow.start('foundationPilot', {
        taskQueue,
        workflowId: `msh-activity-timeout-${Date.now()}`,
        args: [{ objectiveId: '203-timeout-proof', activityTimeout: '100 milliseconds' }],
      });

      await assert.rejects(handle.result(), (error) => {
        const chain = [];
        let current = error;
        while (current && chain.length < 8) {
          chain.push(String(current?.message ?? current));
          current = current?.cause;
        }
        const text = chain.join(' | ');
        assert.match(text, /timed out|timeout/i);
        assert.doesNotMatch(text, /SIEA|HUMAN_APPROVAL_REQUIRED|PAUSED_FOR_SIEA/);
        return true;
      });

      assert.equal(attempts, 3, 'Start-To-Close timeout must stop after the configured three attempts');
    });
  } finally {
    await env.teardown();
  }
});
