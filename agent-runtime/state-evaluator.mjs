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
function parseState(body = '') {
  const escapedStart = START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = body.match(new RegExp(`${escapedStart}\\s*\\`\\`\\`json\\s*([\\s\\S]*?)\\s*\\`\\`\\`\\s*${escapedEnd}`));
  return match ? JSON.parse(match[1]) : null;
}
function defaultState(issue) {
  const agentLabel = labels(issue).find(x => x.startsWith('agent:'));
  return {
    version: 1,
    current_stage: 'COORDINATION',
    assigned_agent: agentLabel ? agentLabel.slice(6) : 'nomy',
    status: 'PENDING',
    retry_count: 0,
    max_retries: maxRetriesDefault,
    history: [],
    execution: null,
    updated_at: new Date().toISOString()
  };
}
function stateBlock(state) { return `${START}\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\`\n${END}`; }
async function persist(state) {
  const fresh = await request(`/issues/${issueNumber}`);
  const pattern = new RegExp(`${START}[\\s\\S]*?${END}`);
  const block = stateBlock({ ...state, updated_at: new Date().toISOString() });
  const body = pattern.test(fresh.body || '') ? (fresh.body || '').replace(pattern, block) : `${fresh.body || ''}\n\n${block}`.trim();
  await request(`/issues/${issueNumber}`, { method: 'PATCH', body: JSON.stringify({ body }) });
}
async function reconcileLabels(agent, status, needsHuman = false) {
  const fresh = await request(`/issues/${issueNumber}`);
  const preserved = labels(fresh).filter(x => !x.startsWith('agent:') && !x.startsWith('status:') && x !== 'needs:siea');
  const next = [...preserved, `agent:${agent}`, `status:${status}`];
  if (needsHuman) next.push('needs:siea');
  await request(`/issues/${issueNumber}/labels`, { method: 'PUT', body: JSON.stringify({ labels: [...new Set(next)] }) });
}
function leaseExpired(state) {
  if (state.status !== 'EXECUTING' || !state.execution?.lease_expires_at) return false;
  return Date.parse(state.execution.lease_expires_at) <= Date.now();
}
async function dispatch(state) {
  await request(`/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ ref, inputs: { issue_number: String(issueNumber), agent: state.assigned_agent } })
  });
}

const issue = await request(`/issues/${issueNumber}`);
let state = parseState(issue.body || '') || defaultState(issue);
if (['COMPLETED', 'HUMAN_APPROVAL_REQUIRED'].includes(state.status)) process.exit(0);

if (leaseExpired(state)) {
  state.retry_count += 1;
  state.status = 'PENDING';
  state.execution = null;
  await request(`/issues/${issueNumber}/comments`, { method: 'POST', body: JSON.stringify({ body: `**WATCHDOG RECOVERY**\n\nExpired execution lease recovered. Retry ${state.retry_count}/${state.max_retries}.` }) });
}
if (state.retry_count >= state.max_retries) {
  state.status = 'HUMAN_APPROVAL_REQUIRED';
  await persist(state);
  await reconcileLabels(state.assigned_agent, 'blocked', true);
  await request(`/issues/${issueNumber}/comments`, { method: 'POST', body: JSON.stringify({ body: '**ORCHESTRATION CIRCUIT BREAKER**\n\nMaximum bounded-turn retries reached. Human review is required before execution resumes.' }) });
  process.exit(0);
}
if (state.status !== 'PENDING') { await persist(state); process.exit(0); }

const now = new Date();
state.status = 'EXECUTING';
state.execution = {
  claimed_at: now.toISOString(),
  lease_expires_at: new Date(now.getTime() + leaseMinutes * 60_000).toISOString(),
  attempt: state.retry_count + 1
};
await persist(state);
await reconcileLabels(state.assigned_agent, 'in_progress');
await dispatch(state);
console.log(`Dispatched bounded turn for ${state.assigned_agent} on issue #${issueNumber}.`);
