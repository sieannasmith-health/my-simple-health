// Compatibility entry point. Guard pathological orchestration loops before invoking the bounded runtime.
await import('./runtime-preflight-guard.mjs');
await import('./run-v3.mjs');
