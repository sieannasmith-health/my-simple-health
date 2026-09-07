import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from '@temporalio/worker';
import { TestWorkflowEnvironment } from '@temporalio/testing';

test('malformed agent result fails explicitly without becoming a Siea gate', async () => {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  const taskQueue = 'msh-malformed-result-test';

  try {
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath: new URL('../src/workflows.ts', import.meta.url).pathname,
      activities: {
        async recordStage() {
          return 'WRONG_STAGE';
        },
      },
    });

    await worker.runUntil(async () => {
      const handle = await env.client.workflow.start('foundationPilot', {
        taskQueue,
        workflowId: `msh-malformed-result-${Date.now()}`,
        args: [{ objectiveId: '203-malformed-result' }],
      });

      await assert.rejects(
        handle.result(),
        (error) => {
          const text = String(error);
          assert.match(text, /MALFORMED_AGENT_RESULT:NOMY/);
          assert.doesNotMatch(text, /SIEA|HUMAN_APPROVAL_REQUIRED|PAUSED_FOR_SIEA/);
          return true;
        },
      );
    });
  } finally {
    await env.teardown();
  }
});
