import { Connection, Client } from '@temporalio/client';
import { foundationArtifactPilot } from './workflows.js';

const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
const namespace = process.env.TEMPORAL_NAMESPACE ?? 'default';
const taskQueue = process.env.MSH_TEMPORAL_TASK_QUEUE ?? 'msh-foundation-pilot';
const objectiveId = process.argv[2] ?? '203';

const connection = await Connection.connect({ address });
const client = new Client({ connection, namespace });

const handle = await client.workflow.start(foundationArtifactPilot, {
  taskQueue,
  workflowId: `msh-artifact-objective-${objectiveId}`,
  args: [{ objectiveId }],
});

console.log(`Started ${handle.workflowId}`);
console.log(JSON.stringify(await handle.result(), null, 2));
