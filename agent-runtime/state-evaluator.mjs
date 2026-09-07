import fs from 'node:fs/promises';
import { authorizeMaintenanceFromEvent } from './maintenance-authorization.mjs';

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const issueNumber = Number(process.env.ISSUE_NUMBER || 0);
const workflowFile = process.env.AGENT_TURN_WORKFLOW || 'msh-agent-runtime.yml';
const ref = process.env.AGENT_TURN_REF || 'main';
const leaseMinutes = Number(process.env.AGENT_LEASE_MINUTES || 20);
const maxRetriesDefault = Number(process.env.AGENT_MAX_RETRIES || 3);
const maxAttempts = 4;

if (!token || !repository || !issueNumber) throw new Error('Missing GITHUB_TOKEN, GITHUB_REPOSITORY, or ISSUE_NUMBER.');
const [owner, repo] = repository.split('/');
const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' };
const START = '<!-- MSH_STATE_LOCK -->';
const END = '<!-- MSH_STATE_LOCK_END -->';

function retryable(status) { return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500; }
function delay(attempt, retryAfter) {
  const headerMs = Number(retryAfter || 0) * 1000;
  const exponential = Math.min(8000, 250 * (2 ** attempt));
  const jitter = Math.floor(Math.random() * 125);
  return Math.max(headerMs, exponential + jitter);
}

async function request(path, options = {}, attempt = 0) {
  const response = await fetch(`${apiBase}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (response.ok) {
    if (response.status === 204) return null;
    return { data: await response.json(), etag: response.headers.get('etag') };
  }
  const text = await response.text();
  if (retryable(response.status) && attempt < maxAttempts - 1) {
    await new Promise(resolve => setTimeout(resolve, delay(attempt, response.headers.get('retry-after'))));
    return request(path, options, attempt + 1);
  }
  throw new Error(`GitHub ${response.status}: ${text}`);
}

async function getIssue() { return request(`/issues/${issueNumber}`); }
async function mutate(path, options = {}) { return (await request(path, options)).data; }
function labels(issue) { return (issue.labels || []).map(x => typeof x === 'string' ? x : x.name).filter(Boolean); }

async function readEventContext() {
  const eventName = process.env.GITHUB_EVENT_NAME || '';
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return { eventName, payload: {} };
  try { return { eventName, payload: JSON.parse(await fs.readFile(eventPath, 'utf8')) }; }
  catch (error) { console.warn(`[MSH Evaluator] Could not read event payload: ${error.message}`); return { eventName, payload: {} }; }
}

function isEventEligibleForStateWrite({ eventName, payload }) {
  if (!eventName || eventName === 'workflow_dispatch' || eventName === 'issues' || eventName === 'schedule') return true;
  if (eventName !== 'issue_comment') return false;
  const senderType = String(payload?.sender?.type || '');
  const senderLogin = String(payload?.sender?.login || '').toLowerCase();
  const commentBody = String(payload?.comment?.body || '');
  if (senderType === 'Bot' || senderLogin.includes('vercel') || senderLogin.includes('github-actions')) return false;
  return commentBody.trimStart().startsWith('/') || commentBody.includes(START);
}

function parseState(body = '') {
  const escapedStart = START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = body.match(new RegExp(`${escapedStart}\\s*```json\\s*([\\s\\S]*?)\\s*```\\s*${escapedEnd}`));
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function assignedAgentFromIssue(issue) {
  const agentLabel = labels(issue).find(x => x.startsWith('agent:'));
  if (agentLabel) return agentLabel.slice(6).toLowerCase();
  const ownerMatch = String(issue.body || '').match(/^## Owner\s*$[\s\S]*?^- Responsible:\s*([A-Za-z][A-Za-z0-9_-]*)\s*\//mi);
  return ownerMatch ? ownerMatch[1].toLowerCase() : 'nomy';
}

function defaultState(issue) {
  return {
    version: 2,
    task_id: String(issue.number),
    revision: 0,
    current_stage: 'COORDINATION',
    assigned_agent: assignedAgentFromIssue(issue),
    status: 'PENDING',
    retry_count: 0,
    max_retries: maxRetriesDefault,
    history: [],
    artifacts: [],
    execution: null,
    updated_at: new Date().toISOString()
  };
}
function stateBlock(state) { return `${START}\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\`\n${END}`; }
function replaceState(body, state) {
  const pattern = new RegExp(`${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  return pattern.test(body || '') ? body.replace(pattern, stateBlock(state)) : `${body || ''}\n\n${stateBlock(state)}`.trim();
}

async function persist(state) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const snapshot = await getIssue();
    const current = parseState(snapshot.data.body || '') || state;
    const currentRevision = Number(current.revision || 0);
    const next = {
      ...state,
      revision: Math.max(Number(state.revision || 0), currentRevision) + 1,
      transition_id: state.transition_id || `transition:${issueNumber}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      updated_at: new Date().toISOString()
    };
    const body = replaceState(snapshot.data.body || '', next);
    try {
      await mutate(`/issues/${issueNumber}`, {
        method: 'PATCH',
        headers: { ...(snapshot.etag ? { 'If-Match': snapshot.etag } : {}) },
        body: JSON.stringify({ body })
      });
      return next;
    } catch (error) {
      if (!String(error.message).startsWith('GitHub 409') && !String(error.message).startsWith('GitHub 412')) throw error;
      if (attempt === maxAttempts - 1) throw new Error(`Durable state CAS failed after ${maxAttempts} attempts.`);
      await new Promise(resolve => setTimeout(resolve, delay(attempt)));
    }
  }
  throw new Error('Durable state persistence failed.');
}

async function reconcileLabels(agent, status, needsHuman = false) {
  const fresh = (await getIssue()).data;
  const preserved = labels(fresh).filter(x => !x.startsWith('agent:') && !x.startsWith('status:') && x !== 'needs:siea');
  const next = [...preserved, `agent:${agent}`, `status:${status}`];
  if (needsHuman) next.push('needs:siea');
  await mutate(`/issues/${issueNumber}/labels`, { method: 'PUT', body: JSON.stringify({ labels: [...new Set(next)] }) });
}
function leaseExpired(state) { return state.status === 'EXECUTING' && state.execution?.lease_expires_at && Date.parse(state.execution.lease_expires_at) <= Date.now(); }
function hasHistoryEvent(state, event) { return Array.isArray(state.history) && state.history.some(entry => entry?.event === event); }
function executionGateSatisfied(issue, state) { return state.status === 'HUMAN_APPROVAL_REQUIRED' && state.human_gate?.reason_code === 'EXECUTION_APPROVAL_REQUIRED' && labels(issue).includes('execution:approved'); }
function legacyHumanGateNeedsReevaluation(issue, state) {
  if (state.status !== 'HUMAN_APPROVAL_REQUIRED' || state.human_gate || state.current_stage !== 'IMPLEMENTATION' || state.assigned_agent !== 'human' || !labels(issue).includes('execution:approved') || hasHistoryEvent(state, 'LEGACY_HUMAN_GATE_REEVALUATION')) return false;
  const last = Array.isArray(state.history) ? state.history.at(-1) : null;
  return last?.agent === 'selah' && last?.result_status === 'blocked';
}
function recoverHumanGate(issue, state) {
  if (executionGateSatisfied(issue, state)) return { ...state, status: 'PENDING', assigned_agent: state.human_gate?.resume_agent || 'selah', current_stage: state.human_gate?.resume_stage || 'IMPLEMENTATION', execution: null, human_gate: null, history: [...(state.history || []), { at: new Date().toISOString(), event: 'HUMAN_GATE_SATISFIED', reason_code: 'EXECUTION_APPROVAL_REQUIRED', satisfied_by: 'execution:approved' }].slice(-20) };
  if (legacyHumanGateNeedsReevaluation(issue, state)) return { ...state, status: 'PENDING', assigned_agent: 'selah', current_stage: 'IMPLEMENTATION', execution: null, history: [...(state.history || []), { at: new Date().toISOString(), event: 'LEGACY_HUMAN_GATE_REEVALUATION', reason_code: 'UNTYPED_LEGACY_GATE', satisfied_by: 'bounded_revalidation_after_runtime_upgrade' }].slice(-20) };
  return state;
}
async function dispatch(state) {
  await mutate(`/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`, { method: 'POST', body: JSON.stringify({ ref, inputs: { issue_number: String(issueNumber), agent: state.assigned_agent } }) });
}

const eventContext = await readEventContext();
if (!isEventEligibleForStateWrite(eventContext)) process.exit(0);
const issueSnapshot = await getIssue();
const issue = issueSnapshot.data;
let state = parseState(issue.body || '') || defaultState(issue);
if (['COMPLETED', 'ORCHESTRATION_BLOCKED'].includes(state.status)) process.exit(0);

const authorization = authorizeMaintenanceFromEvent({ eventName: eventContext.eventName, payload: eventContext.payload, repositoryOwner: owner, issueNumber, state });
if (authorization.matchedCommand && !authorization.authorized) process.exit(0);
if (authorization.authorized) state = authorization.state;
if (state.status === 'HUMAN_APPROVAL_REQUIRED') state = recoverHumanGate(issue, state);

if (leaseExpired(state)) {
  const nextRetry = Number(state.retry_count || 0) + 1;
  state = { ...state, retry_count: nextRetry, status: 'PENDING', execution: null, history: [...(state.history || []), { at: new Date().toISOString(), event: 'WATCHDOG_LEASE_RECOVERED', reason_code: 'STALE_EXECUTION_LEASE', retry_count: nextRetry, retryable: nextRetry < state.max_retries, human_required: false }].slice(-20) };
}
if (state.retry_count >= state.max_retries) {
  state = { ...state, status: 'ORCHESTRATION_BLOCKED', current_stage: 'PRODUCT_COORDINATION', assigned_agent: 'nomy', execution: null, history: [...(state.history || []), { at: new Date().toISOString(), event: 'CIRCUIT_BREAKER_TO_COORDINATOR', reason_code: 'MAX_RETRIES_EXCEEDED', retry_count: state.retry_count, human_required: false }].slice(-20) };
  await persist(state);
  await reconcileLabels('nomy', 'blocked', false);
  await mutate(`/issues/${issueNumber}/comments`, { method: 'POST', body: JSON.stringify({ body: '**ORCHESTRATION CIRCUIT BREAKER**\n\nMaximum bounded-turn retries reached. Routing this operational failure to Nomy for coordinator diagnosis. This is not a Siea gate.' }) });
  await dispatch({ ...state, assigned_agent: 'nomy' });
  process.exit(0);
}
if (state.status !== 'PENDING') { await persist(state); process.exit(0); }

const now = new Date();
state = { ...state, status: 'EXECUTING', execution: { claimed_at: now.toISOString(), lease_expires_at: new Date(now.getTime() + leaseMinutes * 60_000).toISOString(), attempt: Number(state.retry_count || 0) + 1 } };
state = await persist(state);
await reconcileLabels(state.assigned_agent, 'in_progress');
await dispatch(state);
console.log(`Dispatched bounded turn for ${state.assigned_agent} on issue #${issueNumber}, revision ${state.revision}, transition ${state.transition_id}.`);
