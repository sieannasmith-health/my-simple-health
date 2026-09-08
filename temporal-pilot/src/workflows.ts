import { ApplicationFailure } from '@temporalio/common';
import { condition, defineSignal, proxyActivities, setHandler, sleep } from '@temporalio/workflow';
import type * as activities from './activities.js';
import type * as wave2Activities from './wave2-activities.js';
import type * as wave3Activities from './wave3-activities.js';
import type * as wave4Activities from './wave4-activities.js';
import type { SpecialistReviewEvidence, StageEvidence, Wave1AgentId } from './activities.js';
import type { Wave2AgentId, Wave2ReviewEvidence } from './wave2-activities.js';
import type { Wave3AgentId, Wave3ReviewEvidence } from './wave3-activities.js';
import type { Wave4AgentId, Wave4ReviewEvidence } from './wave4-activities.js';

const FOUNDATION_STAGES = ['NOMY', 'SELAH', 'TESSA', 'NOMY_ACCEPTANCE'] as const;
type FoundationStage = (typeof FOUNDATION_STAGES)[number];
const WAVE1_AGENTS: readonly Wave1AgentId[] = ['mira', 'sage', 'clara'];
const WAVE2_AGENTS: readonly Wave2AgentId[] = ['aiden', 'vera', 'reese', 'eden'];
const WAVE3_AGENTS: readonly Wave3AgentId[] = ['atlas', 'iris', 'june', 'ellis'];
const WAVE4_AGENTS: readonly Wave4AgentId[] = ['genesis', 'newton', 'harper'];
export const sieaApproveSignal = defineSignal('sieaApprove');

export interface FoundationPilotInput { objectiveId: string; activityTimeout?: string; startDelay?: string; resumeFromStage?: FoundationStage; requireSieaApproval?: boolean; }
export interface FoundationPilotResult { objectiveId: string; stages: string[]; terminalStatus: 'COMPLETED'; }
export interface FoundationArtifactPilotResult { objectiveId: string; evidence: StageEvidence[]; terminalStatus: 'COMPLETED'; }
export interface Wave1ActivationResult { objectiveId: string; evidence: SpecialistReviewEvidence[]; terminalStatus: 'COMPLETED'; }
export interface Wave2ActivationResult { objectiveId: string; evidence: Wave2ReviewEvidence[]; terminalStatus: 'COMPLETED'; }
export interface Wave3ActivationResult { objectiveId: string; evidence: Wave3ReviewEvidence[]; terminalStatus: 'COMPLETED'; }
export interface Wave4ActivationResult { objectiveId: string; evidence: Wave4ReviewEvidence[]; terminalStatus: 'COMPLETED'; }

function stageActivities(activityTimeout = '30 seconds') { return proxyActivities<typeof activities>({ startToCloseTimeout: activityTimeout, retry: { initialInterval: '1 second', maximumAttempts: 3 } }); }
function wave2StageActivities(activityTimeout = '30 seconds') { return proxyActivities<typeof wave2Activities>({ startToCloseTimeout: activityTimeout, retry: { initialInterval: '1 second', maximumAttempts: 3 } }); }
function wave3StageActivities(activityTimeout = '30 seconds') { return proxyActivities<typeof wave3Activities>({ startToCloseTimeout: activityTimeout, retry: { initialInterval: '1 second', maximumAttempts: 3 } }); }
function wave4StageActivities(activityTimeout = '30 seconds') { return proxyActivities<typeof wave4Activities>({ startToCloseTimeout: activityTimeout, retry: { initialInterval: '1 second', maximumAttempts: 3 } }); }

export async function foundationPilot(input: FoundationPilotInput): Promise<FoundationPilotResult> {
  if (input.startDelay) await sleep(input.startDelay);
  let sieaApproved = !input.requireSieaApproval;
  setHandler(sieaApproveSignal, () => { sieaApproved = true; });
  const stages: string[] = [];
  const { recordStage } = stageActivities(input.activityTimeout);
  const startIndex = input.resumeFromStage ? FOUNDATION_STAGES.indexOf(input.resumeFromStage) : 0;
  if (startIndex < 0) throw ApplicationFailure.nonRetryable('INVALID_RESUME_STAGE');
  for (const stage of FOUNDATION_STAGES.slice(startIndex)) {
    if (input.requireSieaApproval && stage === 'TESSA') await condition(() => sieaApproved);
    const idempotencyKey = `${input.objectiveId}:${stage}:record-stage`;
    const recorded = await recordStage(input.objectiveId, stage, idempotencyKey);
    if (recorded !== stage) throw ApplicationFailure.nonRetryable(`MALFORMED_AGENT_RESULT:${stage}`);
    stages.push(recorded);
  }
  return { objectiveId: input.objectiveId, stages, terminalStatus: 'COMPLETED' };
}

export async function foundationArtifactPilot(input: FoundationPilotInput): Promise<FoundationArtifactPilotResult> {
  const evidence: StageEvidence[] = [];
  const { runAgentStage } = stageActivities(input.activityTimeout);
  for (const stage of FOUNDATION_STAGES) {
    const idempotencyKey = `${input.objectiveId}:${stage}:artifact-stage`;
    const artifact = await runAgentStage(input.objectiveId, stage, evidence, idempotencyKey);
    if (artifact.stage !== stage || !artifact.artifactRef) throw ApplicationFailure.nonRetryable(`INVALID_STAGE_EVIDENCE:${stage}`);
    if (stage === 'TESSA' && artifact.status !== 'PASS') throw ApplicationFailure.nonRetryable('QA_NOT_PASSED');
    if (stage === 'NOMY_ACCEPTANCE' && artifact.status !== 'ACCEPTED') throw ApplicationFailure.nonRetryable('PRODUCT_NOT_ACCEPTED');
    evidence.push(artifact);
  }
  return { objectiveId: input.objectiveId, evidence, terminalStatus: 'COMPLETED' };
}

export async function wave1SpecialistActivation(input: FoundationPilotInput): Promise<Wave1ActivationResult> {
  const evidence: SpecialistReviewEvidence[] = [];
  const { runWave1SpecialistReview } = stageActivities(input.activityTimeout);
  for (const agentId of WAVE1_AGENTS) {
    const artifact = await runWave1SpecialistReview(input.objectiveId, agentId, `${input.objectiveId}:${agentId}:specialist-review`);
    if (artifact.agentId !== agentId || artifact.artifactType !== 'SPECIALIST_REVIEW' || artifact.status !== 'READY' || artifact.provenance.length < 2) throw ApplicationFailure.nonRetryable(`INVALID_SPECIALIST_EVIDENCE:${agentId}`);
    evidence.push(artifact);
  }
  return { objectiveId: input.objectiveId, evidence, terminalStatus: 'COMPLETED' };
}

export async function wave2TrustEvidenceActivation(input: FoundationPilotInput): Promise<Wave2ActivationResult> {
  const evidence: Wave2ReviewEvidence[] = [];
  const { runWave2TrustEvidenceReview } = wave2StageActivities(input.activityTimeout);
  for (const agentId of WAVE2_AGENTS) {
    const artifact = await runWave2TrustEvidenceReview(input.objectiveId, agentId, `${input.objectiveId}:${agentId}:trust-evidence-review`);
    if (artifact.agentId !== agentId || artifact.artifactType !== 'TRUST_EVIDENCE_REVIEW' || artifact.status !== 'READY' || artifact.provenance.length < 2) throw ApplicationFailure.nonRetryable(`INVALID_WAVE2_EVIDENCE:${agentId}`);
    evidence.push(artifact);
  }
  return { objectiveId: input.objectiveId, evidence, terminalStatus: 'COMPLETED' };
}

export async function wave3ProductInsightActivation(input: FoundationPilotInput): Promise<Wave3ActivationResult> {
  const evidence: Wave3ReviewEvidence[] = [];
  const { runWave3ProductInsightReview } = wave3StageActivities(input.activityTimeout);
  for (const agentId of WAVE3_AGENTS) {
    const artifact = await runWave3ProductInsightReview(input.objectiveId, agentId, `${input.objectiveId}:${agentId}:product-insight-review`);
    if (artifact.agentId !== agentId || artifact.artifactType !== 'PRODUCT_INSIGHT_REVIEW' || artifact.status !== 'READY' || artifact.provenance.length < 2) throw ApplicationFailure.nonRetryable(`INVALID_WAVE3_EVIDENCE:${agentId}`);
    evidence.push(artifact);
  }
  return { objectiveId: input.objectiveId, evidence, terminalStatus: 'COMPLETED' };
}

export async function wave4BusinessPeopleActivation(input: FoundationPilotInput): Promise<Wave4ActivationResult> {
  const evidence: Wave4ReviewEvidence[] = [];
  const { runWave4BusinessPeopleReview } = wave4StageActivities(input.activityTimeout);
  for (const agentId of WAVE4_AGENTS) {
    const artifact = await runWave4BusinessPeopleReview(input.objectiveId, agentId, `${input.objectiveId}:${agentId}:business-people-review`);
    if (artifact.agentId !== agentId || artifact.artifactType !== 'BUSINESS_PEOPLE_REVIEW' || artifact.status !== 'READY' || artifact.provenance.length < 2) throw ApplicationFailure.nonRetryable(`INVALID_WAVE4_EVIDENCE:${agentId}`);
    evidence.push(artifact);
  }
  return { objectiveId: input.objectiveId, evidence, terminalStatus: 'COMPLETED' };
}
