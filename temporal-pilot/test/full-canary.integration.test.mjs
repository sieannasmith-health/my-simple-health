import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from '@temporalio/worker';
import { TestWorkflowEnvironment } from '@temporalio/testing';

test('unattended canary recovers from transient Selah failure and reaches Product acceptance', async () => {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  const taskQueue = 'msh-full-canary-test';
  const attempts = new Map();
  const idempotencyKeys = [];

  try {
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath: new URL('../src/workflows.ts', import.meta.url).pathname,
      activities: {
        async runAgentStage(objectiveId, stage, priorEvidence, idempotencyKey) {
          idempotencyKeys.push(idempotencyKey);
          const attempt = (attempts.get(stage) ?? 0) + 1;
          attempts.set(stage, attempt);

          // Adversarial fault: Selah's first tool execution fails transiently.
          // Temporal must retry without human intervention or duplicate identity.
          if (stage === 'SELAH' && attempt === 1) {
            throw new Error('TRANSIENT_GITHUB_TOOL_FAILURE');
          }

          switch (stage) {
            case 'NOMY':
              assert.equal(priorEvidence.length, 0);
              return {
                stage,
                artifactType: 'PRODUCT_OBJECTIVE',
                artifactRef: `objective:${objectiveId}`,
                status: 'READY',
              };
            case 'SELAH':
              assert.equal(priorEvidence.at(-1)?.stage, 'NOMY');
              return {
                stage,
                artifactType: 'PULL_REQUEST',
                artifactRef: 'pr:219',
                status: 'READY',
              };
            case 'TESSA':
              assert.equal(priorEvidence.at(-1)?.stage, 'SELAH');
              return {
                stage,
                artifactType: 'QA_RESULT',
                artifactRef: 'qa:canary-pass',
                status: 'PASS',
              };
            case 'NOMY_ACCEPTANCE':
              assert.equal(priorEvidence.at(-1)?.stage, 'TESSA');
              return {
                stage,
                artifactType: 'PRODUCT_ACCEPTANCE',
                artifactRef: 'acceptance:203-canary',
                status: 'ACCEPTED',
              };
            default:
              throw new Error(`UNEXPECTED_STAGE:${stage}`);
          }
        },
      },
    });

    await worker.runUntil(async () => {
      const result = await env.client.workflow.execute('foundationArtifactPilot', {
        taskQueue,
        workflowId: `msh-full-canary-${Date.now()}`,
        args: [{ objectiveId: '203-canary' }],
      });

      assert.equal(result.terminalStatus, 'COMPLETED');
      assert.deepEqual(
        result.evidence.map((entry) => entry.stage),
        ['NOMY', 'SELAH', 'TESSA', 'NOMY_ACCEPTANCE'],
      );
      assert.equal(attempts.get('SELAH'), 2);
      assert.equal(result.evidence.at(-1)?.status, 'ACCEPTED');

      const selahKeys = idempotencyKeys.filter((key) => key.includes(':SELAH:'));
      assert.equal(selahKeys.length, 2);
      assert.equal(new Set(selahKeys).size, 1);
    });
  } finally {
    await env.teardown();
  }
});
