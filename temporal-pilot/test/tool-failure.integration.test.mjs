import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from '@temporalio/worker';
import { TestWorkflowEnvironment } from '@temporalio/testing';

test('infrastructure/tool failure exhausts bounded retries without becoming a Siea gate', { timeout: 20_000 }, async (t) => {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  const taskQueue = 'msh-tool-failure-test';
  let attempts = 0;

  const worker = await Worker.create({
    connection: env.nativeConnection,
    taskQueue,
    workflowsPath: new URL('../src/workflows.ts', import.meta.url).pathname,
    activities: {
      async recordStage() {
        attempts += 1;
        throw new Error('MCP_TOOL_UNAVAILABLE');
      },
    },
  });

  const workerRun = worker.run();
  t.after(async () => {
    worker.shutdown();
    await workerRun;
    await env.teardown();
  });

  const handle = await env.client.workflow.start('foundationPilot', {
    taskQueue,
    workflowId: `msh-tool-failure-${Date.now()}`,
    args: [{ objectiveId: '203-tool-failure', activityTimeout: '3 seconds' }],
  });

  await assert.rejects(handle.result(), (error) => {
    const text = String(error?.cause?.cause?.message ?? error?.cause?.message ?? error?.message ?? error);
    return text.includes('MCP_TOOL_UNAVAILABLE');
  });

  assert.equal(attempts, 3, 'tool failure must stop after the configured three attempts');
  assert.equal(false, String(await handle.describe()).includes('PAUSED_FOR_SIEA'), 'infrastructure failure must not create a Siea gate');
});
