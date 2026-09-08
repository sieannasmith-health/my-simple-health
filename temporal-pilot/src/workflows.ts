import { ApplicationFailure } from '@temporalio/common';
import {
  condition,
  defineSignal,
  proxyActivities,
  setHandler,
  sleep,
} from '@temporalio/workflow';
import type * as activities from './activities.js';
import type { StageEvidence } from './activities.js';

const FOUNDATION_STAGES = ['NOMY', 'SELAH', 'TESSA', 'NOMY_ACCEPTANCE'] as const;
type FoundationStage = (typeof FOUNDATION_STAGES)[number];

export const sieaApproveSignal = defineSignal('sieaApprove');

export interface FoundationPilotInput {
  objectiveId: string;
  activityTimeout?: string;
  startDelay?: string;
  resumeFromStage?: FoundationStage;
  requireSieaApproval?: boolean;
}

export interface FoundationPilotResult {
  objectiveId: string;
  stages: string[];
  terminalStatus: 'COMPLETED';
}

export interface FoundationArtifactPilotResult {
  objectiveId: string;
  evidence: StageEvidence[];
  terminalStatus: 'COMPLETED';
}

function stageActivities(activityTimeout = '30 seconds') {
  return proxyActivities<typeof activities>({
    startToCloseTimeout: activityTimeout,
    retry: {
      initialInterval: '1 second',
      maximumAttempts: 3,
    },
  });
}

export async function foundationPilot(
  input: FoundationPilotInput,
): Promise<FoundationPilotResult> {
  if (input.startDelay) {
    await sleep(input.startDelay);
  }

  let sieaApproved = !input.requireSieaApproval;
  setHandler(sieaApproveSignal, () => {
    sieaApproved = true;
  });

  const stages: string[] = [];
  const { recordStage } = stageActivities(input.activityTimeout);
  const startIndex = input.resumeFromStage
    ? FOUNDATION_STAGES.indexOf(input.resumeFromStage)
    : 0;

  if (startIndex < 0) {
    throw ApplicationFailure.nonRetryable('INVALID_RESUME_STAGE');
  }

  for (const stage of FOUNDATION_STAGES.slice(startIndex)) {
    if (input.requireSieaApproval && stage === 'TESSA') {
      await condition(() => sieaApproved);
    }

    const idempotencyKey = `${input.objectiveId}:${stage}:record-stage`;
    const recorded = await recordStage(input.objectiveId, stage, idempotencyKey);
    if (recorded !== stage) {
      throw ApplicationFailure.nonRetryable(`MALFORMED_AGENT_RESULT:${stage}`);
    }
    stages.push(recorded);
  }

  return {
    objectiveId: input.objectiveId,
    stages,
    terminalStatus: 'COMPLETED',
  };
}

export async function foundationArtifactPilot(
  input: FoundationPilotInput,
): Promise<FoundationArtifactPilotResult> {
  const evidence: StageEvidence[] = [];
  const { runAgentStage } = stageActivities(input.activityTimeout);

  for (const stage of FOUNDATION_STAGES) {
    const idempotencyKey = `${input.objectiveId}:${stage}:artifact-stage`;
    const artifact = await runAgentStage(input.objectiveId, stage, evidence, idempotencyKey);

    if (artifact.stage !== stage || !artifact.artifactRef) {
      throw ApplicationFailure.nonRetryable(`INVALID_STAGE_EVIDENCE:${stage}`);
    }

    if (stage === 'TESSA' && artifact.status !== 'PASS') {
      throw ApplicationFailure.nonRetryable('QA_NOT_PASSED');
    }

    if (stage === 'NOMY_ACCEPTANCE' && artifact.status !== 'ACCEPTED') {
      throw ApplicationFailure.nonRetryable('PRODUCT_NOT_ACCEPTED');
    }

    evidence.push(artifact);
  }

  return {
    objectiveId: input.objectiveId,
    evidence,
    terminalStatus: 'COMPLETED',
  };
}
