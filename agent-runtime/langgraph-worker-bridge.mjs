import { spawn } from 'node:child_process';
import readline from 'node:readline';

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

function runWorker(payload) {
  return new Promise((resolve, reject) => {
    const issueNumber = issueNumberFromPayload(payload);
    const agent = String(payload.agent || '').trim().toLowerCase();
    if (!issueNumber || !agent) {
      reject(new Error('LangGraph bridge requires issue_number/objective_id and agent.'));
      return;
    }

    const child = spawn(process.execPath, ['agent-runtime/state-hydrated-runner.mjs'], {
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

try {
  const payload = await readJsonFromStdin();
  const result = await runWorker(payload);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${error?.stack || error?.message || String(error)}\n`);
  process.exitCode = 1;
}
