import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

function readJsonFromStdin() {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { input += chunk; });
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(input || '{}'));
      } catch (error) {
        reject(new Error(`Invalid LangGraph bridge input: ${error.message}`));
      }
    });
    process.stdin.on('error', reject);
  });
}

function issueNumberFromPayload(payload) {
  const explicit = Number(payload.issue_number || 0);
  if (Number.isInteger(explicit) && explicit > 0) return explicit;
  const match = String(payload.objective_id || '').match(/^github-issue-(\d+)$/);
  return match ? Number(match[1]) : 0;
}

export function shouldSuppressWorkerWrite({ url, method = 'GET', env = process.env }) {
  if (env.MSH_ORCHESTRATION_OWNER !== 'langgraph') return false;

  const normalizedMethod = String(method || 'GET').toUpperCase();
  if (normalizedMethod === 'GET' || normalizedMethod === 'HEAD') return false;

  const repository = String(env.GITHUB_REPOSITORY || '');
  const issueNumber = String(env.ISSUE_NUMBER || '');
  if (!repository || !/^\d+$/.test(issueNumber)) return false;

  const apiBase = `https://api.github.com/repos/${repository}`;
  const issueBase = `${apiBase}/issues/${issueNumber}`;
  const repositoryLabels = `${apiBase}/labels`;
  const normalizedUrl = String(url || '');

  const isCurrentIssueWrite = normalizedUrl === issueBase || normalizedUrl.startsWith(`${issueBase}/`);
  const isRepositoryLabelCreate = normalizedUrl === repositoryLabels;
  return isCurrentIssueWrite || isRepositoryLabelCreate;
}

export function createOrchestrationFetchGuard({ realFetch, env = process.env, writeLog = message => process.stderr.write(message) }) {
  if (typeof realFetch !== 'function') throw new Error('createOrchestrationFetchGuard requires realFetch.');

  return async function guardedFetch(input, init = {}) {
    const url = typeof input === 'string' ? input : (input?.url || String(input));
    const method = String(init?.method || (typeof input !== 'string' ? input?.method : '') || 'GET').toUpperCase();

    if (shouldSuppressWorkerWrite({ url, method, env })) {
      writeLog(`[LANGGRAPH_AUTHORITY] Suppressed worker orchestration write ${method} ${url}\n`);
      return new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }

    return realFetch(input, init);
  };
}

export function installOrchestrationFetchGuard({ env = process.env, writeLog } = {}) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = createOrchestrationFetchGuard({ realFetch, env, writeLog });
}

function workerBootstrap() {
  return String.raw`
const { installOrchestrationFetchGuard } = await import('./agent-runtime/langgraph-worker-bridge.mjs');
installOrchestrationFetchGuard();
await import('./agent-runtime/state-hydrated-runner.mjs');
`;
}

export function runWorker(payload) {
  return new Promise((resolve, reject) => {
    const issueNumber = issueNumberFromPayload(payload);
    const agent = String(payload.agent || '').trim().toLowerCase();
    if (!issueNumber || !agent) {
      reject(new Error('LangGraph bridge requires issue_number/objective_id and agent.'));
      return;
    }

    const child = spawn(process.execPath, ['--input-type=module', '--eval', workerBootstrap()], {
      env: {
        ...process.env,
        ISSUE_NUMBER: String(issueNumber),
        AGENT_NAME: agent,
        MSH_ORCHESTRATION_OWNER: 'langgraph'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let structuredResult = null;
    const stderr = [];
    const stdout = readline.createInterface({ input: child.stdout });
    stdout.on('line', line => {
      try {
        const parsed = JSON.parse(line);
        if (parsed && Number(parsed.issue) === issueNumber && parsed.agent && parsed.status) {
          structuredResult = parsed;
        }
      } catch {
        // Worker telemetry is intentionally not forwarded to bridge stdout.
      }
    });
    child.stderr.on('data', chunk => stderr.push(String(chunk)));
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(stderr.join('').trim() || `Bounded worker exited with code ${code}.`));
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

async function main() {
  try {
    const payload = await readJsonFromStdin();
    const result = await runWorker(payload);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error?.stack || error?.message || String(error)}\n`);
    process.exitCode = 1;
  }
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsScript) await main();
