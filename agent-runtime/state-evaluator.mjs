import fs from 'node:fs/promises';
import { authorizeMaintenanceFromEvent } from './maintenance-authorization.mjs';

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const issueNumber = Number(process.env.ISSUE_NUMBER || 0);
const workflowFile = process.env.AGENT_TURN_WORKFLOW || 'msh-agent-runtime.yml';
const ref = process.env.AGENT_TURN_REF || 'main';
const leaseMinutes = Number(process.env.AGENT_LEASE_MINUTES || 20);
const maxRetriesDefault = Number(process.env.AGENT_MAX_RETRIES || 3);

if (!token || !repository || !issueNumber) throw new Error('Missing GITHUB_TOKEN, GITHUB_REPOSITORY, or ISSUE_NUMBER.');
const [owner, repo] = repository.split('/');
const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' };
const START = '<!-- MSH_STATE_LOCK -->';
const END = '<!-- MSH_STATE_LOCK_END -->';

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${await response.text()}`);
  if (response.status === 204) return null;
  return response.json();
}

function labels(issue) { return (issue.labels || []).map(x => typeof x === 'string' ? x : x.name).filter(Boolean); }

async function readEventContext() {
  const eventName = process.env.GITHUB_EVENT_NAME || '';
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return { eventName, payload: {} };
  try {
    return { eventName, payload: JSON.parse(await fs.readFile(eventPath, 'utf8')) };
  } catch (error) {
    console.warn(`[MSH Evaluator] Could not read event payload: ${error.message}`);
    return { eventName, payload: {} };
  }
}

function isEventEligibleForStateWrite({ eventName, payload }) {
  if (!eventName || eventName === 'workflow_dispatch' || eventName === 'issues' || eventName === 'schedule') return true;
  if (eventName !== 'issue_comment') return false;

  const senderType = String(payload?.sender?.type || '');
  const senderLogin = String(payload?.sender?.login || '').toLowerCase();
  const commentBody = String(payload?.comment?.body || '');

  if (senderType === 'Bot' || senderLogin.includes('vercel') || senderLogin.includes('github-actions')) {
    console.log(`[MSH Evaluator] Ignored non-authoritative bot trigger from: ${senderLogin || '(unknown bot)'}`);
    return false;
  }

  const trimmed = commentBody.trimStart();
  const isOrchestrationCommand = trimmed.startsWith('/') || commentBody.includes(START);
  if (!isOrchestrationCommand) {
    console.log('[MSH Evaluator] Ignored organic comment thread event (not a structured command).');
    return false;
  }

  return true;
}

function isSieaApprovalEvent({ eventName, payload }) {
  if (eventName !== 'issue_comment') return false;
  const senderLogin = String(payload?.sender?.login || '').toLowerCase();
  const commentBody = String(payload?.comment?.body || '').trim().toLowerCase();
  return senderLogin === owner.toLowerCase() && commentBody.startsWith('/siea approve');
}

function parseState(body = '') {
  const escapedStart = START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fence = '```';
  const match = body.match(new RegExp(`${escapedStart}\\s*${fence}json\\s*([\\s\\S]*?)\\s*${fence}\\s*${escapedEnd}`));
  return match ? JSON.parse(match[1]) : null;
}

function sequenceOf(state) {
  return Number.isInteger(state?.sequence_version) ? state.sequence_version : 0;
}

function assignedAgentFromIssue(issue) {
  const agentLabel = labels(issue).find(x => x.startsWith('agent:'));
  if (agentLabel) return agentLabel.slice(6).toLowerCase();
  const ownerMatch = String(issue.body || '').match(/^## Owner\s*$[\s\S]*?^- Responsible:\s*([A-Za-z][A-Za-z0-9_-]*)\s*\//mi);
  return ownerMatch ? ownerMatch[1].toLowerCase() : 'nomy';
}

function defaultState(issue) {
  return {
    version: 1,
    sequence_version: 0,
    current_stage: 'COORDINATION',
    assigned_agent: assignedAgentFromIssue(issue),
    status: 'PENDING',
    retry_count: 0,
    max_retries: maxRetriesDefault,
    history: [],
    execution: null,
    human_gate: null,
    updated_at: new Date().toISOString()
  };
}

function stateBlock(state) { return `${START}\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\`\n${END}`; }

async function persist(expectedState, nextState) {
  const fresh = await request(`/issues/${issueNumber}`);
  const current = parseState(fresh.body || '');
  const expectedSequence = sequenceOf(expectedState);
  const currentSequence = sequenceOf(current);
  if (current && currentSequence !== expectedSequence) {
    console.log(`[MSH Evaluator] Stale writer no-op on issue #${issueNumber}: expected sequence=${expectedSequence}, current=${currentSequence}.`);
    return false;
  }
  if (!current && expectedSequence !== 0) {
    console.log(`[MSH Evaluator] Missing expected durable state on issue #${issueNumber}; no-op success.`);
    return false;
  }

  const versioned = {
    ...nextState,
    sequence_version: expectedSequence + 1,
    updated_at: new Date().toISOString()
  };
  const pattern = new RegExp(`${START}[\\s\\S]*?${END}`);
  const block = stateBlock(versioned);
  const body = pattern.test(fresh.body || '') ? (fresh.body || '').replace(pattern, block) : `${fresh.body || ''}\n\n${block}`.trim();
  await request(`/issues/${issueNumber}`, { method: 'PATCH', body: JSON.stringify({ body }) });
  return true;
}

async function reconcileLabels(agent, status, needsHuman = false) {
  const fresh = await request(`/issues/${issueNumber}`);
  const preserved = labels(fresh).filter(x => !x.startsWith('agent:') && !x.startsWith('status:') && x !== 'needs:siea');
  const next = [...preserved, `status:${status}`];
  if (agent) next.push(`agent:${agent}`);
  if (needsHuman) next.push('needs:siea');
  await request(`/issues/${issueNumber}/labels`, { method: 'PUT', body: JSON.stringify({ labels: [...new Set(next)] }) });
}

function leaseExpired(state) {
  if (state.status !== 'EXECUTING' || !state.execution?.lease_expires_at) return false;
  return Date.parse(state.execution.lease_expires_at) <= Date.now();
}

function hasHistoryEvent(state, event) {
  return Array.isArray(state.history) && state.history.some(entry => entry?.event === event);
}

function executionGateSatisfied(issue, state) {
  if (state.status !== 'HUMAN_APPROVAL_REQUIRED') return false;
  if (state.human_gate?.reason_code !== 'EXECUTION_APPROVAL_REQUIRED') return false;
  return labels(issue).includes('execution:approved');
}

function legacyHumanGateRecoveryTarget(issue, state) {
  if (state.status !== 'HUMAN_APPROVAL_REQUIRED' || state.human_gate) return null;
  if (state.assigned_agent !== 'human') return null;
  if (!labels(issue).includes('execution:approved')) return null;
  if (hasHistoryEvent(state, 'LEGACY_HUMAN_GATE_REEVALUATION')) return null;

  const history = Array.isArray(state.history) ? state.history : [];
  const last = history.at(-1);
  if (state.current_stage === 'IMPLEMENTATION' && last?.agent === 'selah' && last?.result_status === 'blocked') {
    return { assigned_agent: 'selah', current_stage: 'IMPLEMENTATION' };
  }
  if (state.current_stage === 'PRODUCT_COORDINATION' && last?.agent === 'nomy' && last?.result_status === 'blocked') {
    return { assigned_agent: 'nomy', current_stage: 'PRODUCT_COORDINATION' };
  }
  return null;
}

function recoverLegacyHumanGate(issue, state) {
  if (executionGateSatisfied(issue, state)) {
    return {
      ...state,
      status: 'PENDING',
      assigned_agent: state.human_gate?.resume_agent || 'selah',
      current_stage: state.human_gate?.resume_stage || 'IMPLEMENTATION',
      execution: null,
      human_gate: null,
      history: [...(Array.isArray(state.history) ? state.history : []), {
        at: new Date().toISOString(),
        event: 'HUMAN_GATE_SATISFIED',
        reason_code: 'EXECUTION_APPROVAL_REQUIRED',
        satisfied_by: 'execution:approved'
      }].slice(-20)
    };
  }

  const legacyTarget = legacyHumanGateRecoveryTarget(issue, state);
  if (legacyTarget) {
    return {
      ...state,
      status: 'PENDING',
      assigned_agent: legacyTarget.assigned_agent,
      current_stage: legacyTarget.current_stage,
      execution: null,
      human_gate: null,
      history: [...(Array.isArray(state.history) ? state.history : []), {
        at: new Date().toISOString(),
        event: 'LEGACY_HUMAN_GATE_REEVALUATION',
        reason_code: 'UNTYPED_LEGACY_GATE',
        satisfied_by: 'bounded_revalidation_after_runtime_upgrade',
        resume_agent: legacyTarget.assigned_agent,
        resume_stage: legacyTarget.current_stage
      }].slice(-20)
    };
  }

  return state;
}

function resumeSieaGate(state) {
  const gate = state.human_gate;
  if (state.status !== 'PAUSED_FOR_SIEA' || gate?.assignee !== 'siea' || !gate?.resume_agent) return null;
  return {
    ...state,
    status: 'PENDING',
    assigned_agent: gate.resume_agent,
    current_stage: gate.resume_stage || state.current_stage,
    execution: null,
    human_gate: null,
    history: [...(Array.isArray(state.history) ? state.history : []), {
      at: new Date().toISOString(),
      event: 'SIEA_GATE_APPROVED',
      satisfied_by: '/siea approve',
      resume_agent: gate.resume_agent,
      resume_stage: gate.resume_stage || state.current_stage
    }].slice(-20)
  };
}

async function dispatch(state) {
  await request(`/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ ref, inputs: { issue_number: String(issueNumber), agent: state.assigned_agent } })
  });
}

const eventContext = await readEventContext();
if (!isEventEligibleForStateWrite(eventContext)) {
  console.log(`[MSH Evaluator] No-op success for ineligible ${eventContext.eventName || 'unknown'} event on issue #${issueNumber}.`);
  process.exit(0);
}

const issue = await request(`/issues/${issueNumber}`);
let state = parseState(issue.body || '') || defaultState(issue);
const expectedState = structuredClone(state);
if (state.status === 'COMPLETED') process.exit(0);

if (state.status === 'PAUSED_FOR_SIEA') {
  if (!isSieaApprovalEvent(eventContext)) {
    console.log(`[MSH Evaluator] Issue #${issueNumber} is PAUSED_FOR_SIEA; unrelated event is a no-op success.`);
    process.exit(0);
  }
  const resumed = resumeSieaGate(state);
  if (!resumed) {
    console.log(`[MSH Evaluator] Issue #${issueNumber} has malformed Siea gate state; leaving paused for review.`);
    process.exit(0);
  }
  state = resumed;
  console.log(`[MSH Evaluator] Owner-authenticated Siea approval accepted; resuming ${state.assigned_agent}.`);
}

const maintenanceAuthorization = authorizeMaintenanceFromEvent({
  eventName: eventContext.eventName,
  payload: eventContext.payload,
  repositoryOwner: owner,
  issueNumber,
  state
});
if (maintenanceAuthorization.matchedCommand && !maintenanceAuthorization.authorized) {
  console.log(`[SECURITY] Rejected runtime-maintenance command on issue #${issueNumber}: sender is not the repository owner or command scope is invalid.`);
  process.exit(0);
}
if (maintenanceAuthorization.authorized) {
  state = maintenanceAuthorization.state;
  console.log(`[SECURITY] Accepted owner-authenticated runtime-maintenance grant ${maintenanceAuthorization.grant.grant_id} for issue #${issueNumber}.`);
} else if (state.status === 'ORCHESTRATION_BLOCKED') {
  console.log(`[MSH Evaluator] Orchestration-blocked issue #${issueNumber} remains terminal without a fresh owner-authenticated maintenance grant.`);
  process.exit(0);
}

if (state.status === 'HUMAN_APPROVAL_REQUIRED') {
  const recovered = recoverLegacyHumanGate(issue, state);
  if (recovered !== state) {
    console.log(`[AUTONOMY] Reconciled satisfied or legacy human gate on issue #${issueNumber}; resuming ${recovered.assigned_agent}.`);
    state = recovered;
  }
}

if (leaseExpired(state)) {
  state.retry_count += 1;
  state.status = 'PENDING';
  state.execution = null;
  await request(`/issues/${issueNumber}/comments`, { method: 'POST', body: JSON.stringify({ body: `**WATCHDOG RECOVERY**\n\nExpired execution lease recovered. Retry ${state.retry_count}/${state.max_retries}.` }) });
}

if (state.retry_count >= state.max_retries) {
  state.status = 'ORCHESTRATION_BLOCKED';
  state.current_stage = 'PRODUCT_COORDINATION';
  state.assigned_agent = 'nomy';
  state.execution = null;
  state.human_gate = null;
  state.history = [...(state.history || []), {
    at: new Date().toISOString(),
    event: 'CIRCUIT_BREAKER_TO_COORDINATOR',
    retry_count: state.retry_count
  }].slice(-20);
  const persisted = await persist(expectedState, state);
  if (!persisted) process.exit(0);
  await reconcileLabels('nomy', 'blocked', false);
  await request(`/issues/${issueNumber}/comments`, { method: 'POST', body: JSON.stringify({ body: '**ORCHESTRATION CIRCUIT BREAKER**\n\nMaximum bounded-turn retries reached. Routing this operational failure to Nomy for coordinator diagnosis. This is not a Siea gate.' }) });
  await dispatch({ ...state, assigned_agent: 'nomy' });
  process.exit(0);
}

if (state.status !== 'PENDING') {
  if (JSON.stringify(state) !== JSON.stringify(expectedState)) await persist(expectedState, state);
  process.exit(0);
}

const now = new Date();
state.status = 'EXECUTING';
state.execution = {
  claimed_at: now.toISOString(),
  lease_expires_at: new Date(now.getTime() + leaseMinutes * 60_000).toISOString(),
  attempt: state.retry_count + 1
};
const persisted = await persist(expectedState, state);
if (!persisted) process.exit(0);
await reconcileLabels(state.assigned_agent, 'in_progress');
await dispatch(state);
console.log(`Dispatched bounded turn for ${state.assigned_agent} on issue #${issueNumber}.`);
