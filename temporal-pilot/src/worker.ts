import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities.js';

const taskQueue = process.env.MSH_TEMPORAL_TASK_QUEUE ?? 'msh-foundation-pilot';

const connection = await NativeConnection.connect({
  address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
});

const worker = await Worker.create({
  connection,
  namespace: process.env.TEMPORAL_NAMESPACE ?? 'default',
  workflowsPath: new URL('./workflows.js', import.meta.url).pathname,
  activities,
  taskQueue,
});

await worker.run();