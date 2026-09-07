// State-hydrated runtime compatibility entry point.
import { spawn } from 'node:child_process';
import readline from 'node:readline';

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

let runtimeError = null;
try {
  const structuredWorkerResult = enrichReasonCode(await runBoundedWorker());
  console.log(`[MSH Runtime] Structured reason_code=${structuredWorkerResult.reason_code || 'none'}.`);
  const { normalizeHumanGate } = await import('./human-gate-normalizer.mjs');
  await normalizeHumanGate({ structuredResult: structuredWorkerResult });
  const { reconcileTurn } = await import('./post-turn-reconciler.mjs');
  await reconcileTurn(structuredWorkerResult);
} catch (error) {
  runtimeError = error;
  console.error(`[MSH Runtime] Bounded turn failed before normal completion: ${error?.stack || error?.message || String(error)}`);
} finally {
  try {
    const { clearMaintenanceGrant } = await import('./maintenance-cleanup.mjs');
    await clearMaintenanceGrant({ outcome: runtimeError ? 'runtime_failure' : 'runtime_complete' });
  } catch (cleanupError) {
    console.error(`[MSH Runtime] Maintenance grant cleanup failed: ${cleanupError?.stack || cleanupError?.message || String(cleanupError)}`);
    if (!runtimeError) runtimeError = cleanupError;
  }
}

if (runtimeError) throw runtimeError;
