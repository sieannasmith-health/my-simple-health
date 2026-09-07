import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './activities.js';

export interface FoundationPilotInput {
  objectiveId: string;
}

export interface FoundationPilotResult {
  objectiveId: string;
  stages: string[];
  terminalStatus: 'COMPLETED';
}

const { recordStage } = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
  retry: {
    initialInterval: '1 second',
    maximumAttempts: 3,
  },
});

export async function foundationPilot(
  input: FoundationPilotInput,
): Promise<FoundationPilotResult> {
  const stages: string[] = [];

  for (const stage of ['NOMY', 'SELAH', 'TESSA', 'NOMY_ACCEPTANCE']) {
    const recorded = await recordStage(input.objectiveId, stage);
    stages.push(recorded);
  }

  return {
    objectiveId: input.objectiveId,
    stages,
    terminalStatus: 'COMPLETED',
  };
}