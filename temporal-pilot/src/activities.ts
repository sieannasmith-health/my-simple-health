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
