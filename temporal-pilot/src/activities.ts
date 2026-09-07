const completed = new Set<string>();

export async function recordStage(objectiveId: string, stage: string): Promise<string> {
  const key = `${objectiveId}:${stage}`;

  // Pilot idempotency boundary. Production persistence will replace this
  // in-memory store after the Temporal execution proof is accepted.
  if (completed.has(key)) return stage;

  completed.add(key);
  return stage;
}