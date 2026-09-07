export interface StageEvidence {
  stage: 'NOMY' | 'SELAH' | 'TESSA' | 'NOMY_ACCEPTANCE';
  artifactType: 'PRODUCT_OBJECTIVE' | 'PULL_REQUEST' | 'QA_RESULT' | 'PRODUCT_ACCEPTANCE';
  artifactRef: string;
  status: 'READY' | 'PASS' | 'ACCEPTED';
}

export async function recordStage(
  objectiveId: string,
  stage: string,
  idempotencyKey: string,
): Promise<string> {
  if (!idempotencyKey) {
    throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  }

  // Temporal may retry Activities. Durable external side effects must use this
  // stable key against a durable store or an external API's idempotency support.
  // The pilot Activity itself is intentionally side-effect free.
  void objectiveId;
  return stage;
}

export async function runAgentStage(
  objectiveId: string,
  stage: StageEvidence['stage'],
  priorEvidence: StageEvidence[],
  idempotencyKey: string,
): Promise<StageEvidence> {
  if (!idempotencyKey) {
    throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  }

  // Production implementations replace this stub with the approved GitHub/MCP
  // boundary. Evidence is returned to Temporal and becomes part of workflow
  // history, rather than relying on transient comments as the handoff channel.
  void objectiveId;
  void priorEvidence;

  switch (stage) {
    case 'NOMY':
      return { stage, artifactType: 'PRODUCT_OBJECTIVE', artifactRef: `objective:${objectiveId}`, status: 'READY' };
    case 'SELAH':
      return { stage, artifactType: 'PULL_REQUEST', artifactRef: `pr:${objectiveId}`, status: 'READY' };
    case 'TESSA':
      return { stage, artifactType: 'QA_RESULT', artifactRef: `qa:${objectiveId}`, status: 'PASS' };
    case 'NOMY_ACCEPTANCE':
      return { stage, artifactType: 'PRODUCT_ACCEPTANCE', artifactRef: `acceptance:${objectiveId}`, status: 'ACCEPTED' };
  }
}
