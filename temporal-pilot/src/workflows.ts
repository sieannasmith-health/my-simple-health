import { ApplicationFailure } from '@temporalio/common';
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './activities.js';

export interface FoundationPilotInput {
  objectiveId: string;
  activityTimeout?: string;
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
  const stages: string[] = [];
  const { recordStage } = stageActivities(input.activityTimeout);

  for (const stage of ['NOMY', 'SELAH', 'TESSA', 'NOMY_ACCEPTANCE']) {
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
