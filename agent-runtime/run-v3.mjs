// State-hydrated runtime compatibility entry point.
import { spawn } from 'node:child_process';
import readline from 'node:readline';

const durableAuthorityEnabled = (process.env.MSH_RUNTIME_LIFECYCLE_AUTHORITY || '').trim().toLowerCase() === 'postgres';
let convergenceBridge = null;
let durableTurn = null;

async function openDurableTurn() {
  if (!durableAuthorityEnabled) return null;
  const { RuntimeConvergenceBridge } = await import('./durable-core/src/convergence-bridge.mjs');
  convergenceBridge = new RuntimeConvergenceBridge();
  const issueNumber = Number(process.env.ISSUE_NUMBER || 0);
  const agentKey = (process.env.AGENT_NAME || '').trim().toLowerCase();
  const sequenceVersion = Number(process.env.MSH_RUNTIME_SEQUENCE_VERSION || process.env.GITHUB_RUN_ATTEMPT || 0);
  const correlationId = process.env.MSH_RUNTIME_CORRELATION_ID || process.env.GITHUB_RUN_ID || null;
  const causationId = process.env.MSH_RUNTIME_CAUSATION_ID || process.env.GITHUB_RUN_NUMBER || null;
  durableTurn = await convergenceBridge.ensureTurn({
    repository: process.env.GITHUB_REPOSITORY || 'unknown/unknown',
    issueNumber,
    issueTitle: process.env.MSH_RUNTIME_OBJECTIVE || `GitHub issue #${issueNumber}`,
    agentKey,
    stage: process.env.MSH_RUNTIME_STAGE || 'BOUNDED_AGENT_TURN',
    sequenceVersion,
    correlationId,
    causationId,
  });
  console.log(`[MSH Runtime] Durable lifecycle bound objective=${durableTurn.objectiveId} task=${durableTurn.taskId} attempt=${durableTurn.attemptId} duplicate=${durableTurn.duplicate}.`);
  return durableTurn;
}

function runBoundedWorker() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['agent-runtime/state-hydrated-runner.mjs'], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let structuredResult = null;
    const stdout = readline.createInterface({ input: child.stdout });
    stdout.on('line', line => {
      console.log(line);
      try {
        const parsed = JSON.parse(line);
        if (parsed && Number(parsed.issue) === Number(process.env.ISSUE_NUMBER || 0) && parsed.agent && parsed.status) {
          structuredResult = parsed;
        }
      } catch {
        // Non-JSON worker telemetry remains ordinary stdout.
      }
    });

    child.stderr.on('data', chunk => process.stderr.write(chunk));
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(`Bounded worker exited with code ${code}.`));
        return;
      }
      if (!structuredResult) {
        reject(new Error('Bounded worker completed without a structured result envelope.'));
        return;
      }
      resolve(structuredResult);
    });
  });
}

function enrichReasonCode(result) {
  if (!result || typeof result !== 'object') return result;
  if (typeof result.reason_code === 'string' && result.reason_code.trim()) {
    return { ...result, reason_code: result.reason_code.trim() };
  }

  // Compatibility mapping for the one authority fact that can be derived
  // without consulting prose. Missing execution approval is operational and
  // must route to Product coordination, never to a Siea pause.
  if (
    result.agent === 'selah' &&
    result.status === 'blocked' &&
    result.execution_approved === false
  ) {
    return { ...result, reason_code: 'EXECUTION_APPROVAL_REQUIRED' };
  }

  // A generic requires_human boolean is intentionally insufficient authority
  // to manufacture a human-only reason code. Explicit Siea-only escalation
  // requires a typed reason_code from a trusted structured producer.
  return { ...result, reason_code: null };
}

function durableMetadata(result) {
  return {
    correlationId: result?.correlation_id || process.env.MSH_RUNTIME_CORRELATION_ID || process.env.GITHUB_RUN_ID || null,
    causationId: result?.causation_id || process.env.MSH_RUNTIME_CAUSATION_ID || process.env.GITHUB_RUN_NUMBER || null,
  };
}

async function completeDurableTurn(result) {
  if (!convergenceBridge || !durableTurn) return;
  const metadata = durableMetadata(result);
  await convergenceBridge.completeTurn({
    taskId: durableTurn.taskId,
    attemptId: durableTurn.attemptId,
    status: result.status,
    nextAgent: result.next_agent ?? null,
    requiresHuman: Boolean(result.requires_human),
    reasonCode: result.reason_code ?? null,
    message: result.message ?? '',
    ...metadata,
  });
  console.log(`[MSH Runtime] Durable lifecycle completed task=${durableTurn.taskId} status=${result.status} requires_human=${Boolean(result.requires_human)}.`);
}

async function failDurableTurn(error) {
  if (!convergenceBridge || !durableTurn) return;
  await convergenceBridge.failTurn({
    taskId: durableTurn.taskId,
    attemptId: durableTurn.attemptId,
    error: error?.stack || error?.message || String(error),
    correlationId: process.env.MSH_RUNTIME_CORRELATION_ID || process.env.GITHUB_RUN_ID || null,
    causationId: process.env.MSH_RUNTIME_CAUSATION_ID || process.env.GITHUB_RUN_NUMBER || null,
  });
  console.log(`[MSH Runtime] Durable lifecycle recorded retryable failure task=${durableTurn.taskId}.`);
}

let runtimeError = null;
try {
  await openDurableTurn();
  const structuredWorkerResult = enrichReasonCode(await runBoundedWorker());
  console.log(`[MSH Runtime] Structured reason_code=${structuredWorkerResult.reason_code || 'none'}.`);
  const { normalizeHumanGate } = await import('./human-gate-normalizer.mjs');
  await normalizeHumanGate({ structuredResult: structuredWorkerResult });
  const { reconcileTurn } = await import('./post-turn-reconciler.mjs');
  await reconcileTurn(structuredWorkerResult);
  await completeDurableTurn(structuredWorkerResult);
} catch (error) {
  runtimeError = error;
  console.error(`[MSH Runtime] Bounded turn failed before normal completion: ${error?.stack || error?.message || String(error)}`);
  try {
    await failDurableTurn(error);
  } catch (durableFailure) {
    console.error(`[MSH Runtime] Durable failure projection failed: ${durableFailure?.stack || durableFailure?.message || String(durableFailure)}`);
  }
} finally {
  try {
    const { clearMaintenanceGrant } = await import('./maintenance-cleanup.mjs');
    await clearMaintenanceGrant({ outcome: runtimeError ? 'runtime_failure' : 'runtime_complete' });
  } catch (cleanupError) {
    console.error(`[MSH Runtime] Maintenance grant cleanup failed: ${cleanupError?.stack || cleanupError?.message || String(cleanupError)}`);
    if (!runtimeError) runtimeError = cleanupError;
  }
  if (convergenceBridge) {
    try { await convergenceBridge.close(); }
    catch (closeError) { console.error(`[MSH Runtime] Durable bridge close failed: ${closeError?.message || String(closeError)}`); }
  }
}

if (runtimeError) throw runtimeError;
