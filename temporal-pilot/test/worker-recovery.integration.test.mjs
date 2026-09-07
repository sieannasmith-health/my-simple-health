import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { TestWorkflowEnvironment } from '@temporalio/testing';

const taskQueue = 'msh-worker-recovery-child-test';
const childPath = new URL('./recovery-worker-child.mjs', import.meta.url);

function spawnWorker(address, mode) {
  return fork(childPath, [], {
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    env: {
      ...process.env,
      TEMPORAL_ADDRESS: address,
      MSH_TEMPORAL_TASK_QUEUE: taskQueue,
      MSH_RECOVERY_MODE: mode,
    },
  });
}

test('Temporal workflow survives hard worker process loss', { timeout: 30_000 }, async (t) => {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  t.after(async () => env.teardown());

  const address = env.address;
  const firstWorker = spawnWorker(address, 'crash');
  t.after(() => firstWorker.kill('SIGKILL'));

  const activityStarted = new Promise((resolve, reject) => {
    firstWorker.once('message', (message) => {
      if (message?.type === 'activity-started') resolve(message);
    });
    firstWorker.once('exit', (code, signal) => {
      if (code !== null || signal) reject(new Error(`first worker exited before activity: ${code}/${signal}`));
    });
  });

  const handle = await env.client.workflow.start('foundationPilot', {
    taskQueue,
    workflowId: `msh-hard-recovery-${Date.now()}`,
    args: [{ objectiveId: '203-hard-recovery' }],
  });

  await activityStarted;
  firstWorker.kill('SIGKILL');

  const replacement = spawnWorker(address, 'replacement');
  t.after(() => replacement.kill('SIGKILL'));

  const result = await handle.result();

  assert.deepEqual(result, {
    objectiveId: '203-hard-recovery',
    stages: ['NOMY', 'SELAH', 'TESSA', 'NOMY_ACCEPTANCE'],
    terminalStatus: 'COMPLETED',
  });
});
