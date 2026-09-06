// State-hydrated runtime compatibility entry point.
await import('./state-hydrated-runner.mjs');
const { normalizeHumanGate } = await import('./human-gate-normalizer.mjs');
await normalizeHumanGate();
await import('./post-turn-reconciler.mjs');
