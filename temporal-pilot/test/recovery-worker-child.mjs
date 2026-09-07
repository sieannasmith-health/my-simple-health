import { Worker } from '@temporalio/worker';

const address = process.env.TEMPORAL_ADDRESS;
const taskQueue = process.env.MSH_TEMPORAL_TASK_QUEUE;
const mode = process.env.MSH_RECOVERY_MODE ?? 'replacement';

const worker = await Worker.create({
  connection: await (await import('@temporalio/worker')).NativeConnection.connect({ address }),
  taskQueue,
  workflowsPath: new URL('../src/workflows.ts', import.meta.url).pathname,
  activities: {
    async recordStage(_objectiveId, stage) {
      if (mode === 'crash') {
        process.send?.({ type: 'activity-started', stage });
        await new Promise(() => {});
      }
      return stage;
    },
  },
});

await worker.run();
