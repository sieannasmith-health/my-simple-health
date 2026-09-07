import { drainMaintenanceGrant } from './maintenance-authorization.mjs';
import { deriveTransitionFromResult } from './turn-transition.mjs';

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const issueNumber = Number(process.env.ISSUE_NUMBER || 0);
const runId = process.env.GITHUB_RUN_ID || null;
const runStartedAt = Number(process.env.MSH_RUN_STARTED_AT || 0);
const evaluatorWorkflow = process.env.AGENT_EVALUATOR_WORKFLOW || 'msh-agent-state-evaluator.yml';
const evaluatorRef = process.env.AGENT_EVALUATOR_REF || 'main';
const START = '<!-- MSH_STATE_LOCK -->';
const END = '<!-- MSH_STATE_LOCK_END -->';

if (!token || !repository || !issueNumber) process.exit(0);

const [owner, repo] = repository.split('/');
const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json'
};

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${await response.text()}`);
  if (response.status === 204) return null;
  return response.json();
}

function labelNames(issue) {
  return (issue.labels || [])
    .map(label => typeof label === 'string' ? label : label.name)
    .filter(Boolean);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseState(body = '') {
  const fence = '```';
  const pattern = new RegExp(
    `${escapeRegExp(START)}\\s*${fence}json\\s*([\\s\\S]*?)\\s*${fence}\\s*${escapeRegExp(END)}`
  );
  const match = body.match(pattern);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function stateBlock(state) {
  return `${START}\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\`\n${END}`;
}

async function persistWithOptimisticGuard(snapshot, nextState) {
  const verify = await request(`/issues/${issueNumber}`);
  if (verify.updated_at !== snapshot.updated_at) {
    console.log(`[MSH Runtime] Concurrency Guard: issue signature changed from ${snapshot.updated_at} to ${verify.updated_at}. Aborting state consumption to prevent overwrite.`);
    return false;
  }

  const pattern = new RegExp(`${escapeRegExp(START)}[\\s\\S]*?${escapeRegExp(END)}`);
  const block = stateBlock(nextState);
  const body = pattern.test(snapshot.body || '')
    ? (snapshot.body || '').replace(pattern, block)
    : `${snapshot.body || ''}\n\n${block}`.trim();

  await request(`/issues/${issueNumber}`, {
    method: 'PATCH',
    body: JSON.stringify({ body })
  });
  return true;
}

async function reconcileLabels(transition) {
  const fresh = await request(`/issues/${issueNumber}`);
  const preserved = labelNames(fresh).filter(
    name => !name.startsWith('agent:') && !name.startsWith('status:') && name !== 'needs:siea'
  );
  const next = [...preserved, `status:${transition.publicStatus}`];
  if (transition.assignedAgent) next.push(`agent:${transition.assignedAgent}`);
  if (transition.needsHuman) next.push('needs:siea');
  await request(`/issues/${issueNumber}/labels`, {
    method: 'PUT',
    body: JSON.stringify({ labels: [...new Set(next)] })
  });
}

async function dispatchEvaluator() {
  await request(`/actions/workflows/${encodeURIComponent(evaluatorWorkflow)}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({
      ref: evaluatorRef,
      inputs: { issue_number: String(issueNumber) }
    })
  });
}

export async function reconcileTurn(structuredWorkerResult) {
  const freshIssue = await request(`/issues/${issueNumber}`);
  const state = parseState(freshIssue.body || '');
  if (!state) {
    console.log(`[MSH Runtime] No durable state block on issue #${issueNumber}; nothing to consume.`);
    return;
  }

  if (state.status !== 'EXECUTING') {
    console.log(`[MSH Runtime] Concurrency Guard: State is no longer EXECUTING (Current: ${state.status}). Aborting consumption to prevent data overwrite.`);
    return;
  }

  const transition = deriveTransitionFromResult(structuredWorkerResult, state);
  const reasonCode = typeof structuredWorkerResult?.reason_code === 'string'
    ? structuredWorkerResult.reason_code
    : null;
  console.log(`[RECONCILER] Structured result authority: status=${structuredWorkerResult.status}, reason_code=${reasonCode || 'none'}, next_agent=${structuredWorkerResult.next_agent || 'none'}, requires_human=${Boolean(structuredWorkerResult.requires_human)}.`);

  const completedAt = new Date().toISOString();
  const historyEntry = {
    stage: state.current_stage,
    agent: state.assigned_agent,
    status: 'COMPLETED',
    result_status: transition.publicStatus,
    reason_code: reasonCode,
    evidence: state.evidence || null,
    telemetry: {
      run_id: runId,
      duration_ms: runStartedAt > 0 ? Math.max(0, Date.now() - runStartedAt) : null,
      timestamp: completedAt
    }
  };

  let nextState = {
    ...state,
    status: transition.runtimeStatus,
    current_stage: transition.nextStage,
    assigned_agent: transition.assignedAgent,
    human_gate: transition.humanGate,
    execution: null,
    retry_count: transition.runtimeStatus === 'PENDING' ? 0 : state.retry_count,
    history: [...(Array.isArray(state.history) ? state.history : []), historyEntry].slice(-20),
    updated_at: completedAt
  };
  nextState = drainMaintenanceGrant(nextState, { at: completedAt, outcome: `reconciled:${transition.publicStatus}` });

  const persisted = await persistWithOptimisticGuard(freshIssue, nextState);
  if (!persisted) return;

  await reconcileLabels(transition);
  console.log(`[MSH Runtime] State atomically consumed from structured result. Transitioned to ${nextState.current_stage} / ${nextState.assigned_agent || 'none'} / ${nextState.status}.`);

  if (nextState.status === 'PENDING' && nextState.assigned_agent) {
    console.log(`[MSH Runtime] Explicitly igniting evaluator for next owner ${nextState.assigned_agent} on issue #${issueNumber}.`);
    await dispatchEvaluator();
    console.log(`[MSH Runtime] Explicit evaluator dispatch accepted for issue #${issueNumber}.`);
  }
}
