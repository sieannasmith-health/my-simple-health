import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from '@temporalio/worker';
import { TestWorkflowEnvironment } from '@temporalio/testing';

test('Temporal preserves Nomy to Selah to Tessa to Nomy evidence handoffs', async () => {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  const taskQueue = 'msh-artifact-flow-test';
  const idempotencyKeys = [];

  try {
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath: new URL('../src/workflows.ts', import.meta.url).pathname,
      activities: {
        async runAgentStage(objectiveId, stage, priorEvidence, idempotencyKey) {
          idempotencyKeys.push(idempotencyKey);

          if (stage === 'NOMY') {
            assert.equal(priorEvidence.length, 0);
            return { stage, artifactType: 'PRODUCT_OBJECTIVE', artifactRef: `issue:${objectiveId}`, status: 'READY' };
          }

          if (stage === 'SELAH') {
            assert.equal(priorEvidence.at(-1).artifactType, 'PRODUCT_OBJECTIVE');
            return { stage, artifactType: 'PULL_REQUEST', artifactRef: 'pr:219', status: 'READY' };
          }

          if (stage === 'TESSA') {
            assert.equal(priorEvidence.at(-1).artifactRef, 'pr:219');
            return { stage, artifactType: 'QA_RESULT', artifactRef: 'ci:green', status: 'PASS' };
          }

          assert.equal(priorEvidence.at(-1).status, 'PASS');
          return { stage, artifactType: 'PRODUCT_ACCEPTANCE', artifactRef: 'acceptance:203', status: 'ACCEPTED' };
        },
      },
    });

    await worker.runUntil(async () => {
      const result = await env.client.workflow.execute('foundationArtifactPilot', {
        taskQueue,
        workflowId: `msh-artifact-flow-${Date.now()}`,
        args: [{ objectiveId: '203' }],
      });

      assert.deepEqual(result, {
        objectiveId: '203',
        evidence: [
          { stage: 'NOMY', artifactType: 'PRODUCT_OBJECTIVE', artifactRef: 'issue:203', status: 'READY' },
          { stage: 'SELAH', artifactType: 'PULL_REQUEST', artifactRef: 'pr:219', status: 'READY' },
          { stage: 'TESSA', artifactType: 'QA_RESULT', artifactRef: 'ci:green', status: 'PASS' },
          { stage: 'NOMY_ACCEPTANCE', artifactType: 'PRODUCT_ACCEPTANCE', artifactRef: 'acceptance:203', status: 'ACCEPTED' },
        ],
        terminalStatus: 'COMPLETED',
      });

      assert.deepEqual(idempotencyKeys, [
        '203:NOMY:artifact-stage',
        '203:SELAH:artifact-stage',
        '203:TESSA:artifact-stage',
        '203:NOMY_ACCEPTANCE:artifact-stage',
      ]);
    });
  } finally {
    await env.teardown();
  }
});
