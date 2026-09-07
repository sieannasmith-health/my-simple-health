import { ApplicationFailure } from '@temporalio/common';
import { proxyActivities, sleep } from '@temporalio/workflow';
import type * as activities from './activities.js';

const FOUNDATION_STAGES = ['NOMY', 'SELAH', 'TESSA', 'NOMY_ACCEPTANCE'] as const;
type FoundationStage = (typeof FOUNDATION_STAGES)[number];

export interface FoundationPilotInput {
  objectiveId: string;
  activityTimeout?: string;
  startDelay?: string;
  resumeFromStage?: FoundationStage;
}

export interface FoundationPilotResult {
  objectiveId: string;
  stages: string[];
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

  const stages: string[] = [];
  const { recordStage } = stageActivities(input.activityTimeout);
  const startIndex = input.resumeFromStage
    ? FOUNDATION_STAGES.indexOf(input.resumeFromStage)
    : 0;

  if (startIndex < 0) {
    throw ApplicationFailure.nonRetryable('INVALID_RESUME_STAGE');
  }

  for (const stage of FOUNDATION_STAGES.slice(startIndex)) {
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
