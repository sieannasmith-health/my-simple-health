const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const issueNumber = Number(process.env.ISSUE_NUMBER || 0);
const START = '<!-- MSH_STATE_LOCK -->';
const END = '<!-- MSH_STATE_LOCK_END -->';
const BLOCKED_TURN_LIMIT = Number(process.env.MSH_BLOCKED_TURN_LIMIT || 3);

if (!token || !repository || !issueNumber) {
  throw new Error('Missing GITHUB_TOKEN, GITHUB_REPOSITORY, or ISSUE_NUMBER.');
}

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
  return (issue.labels || []).map(label => typeof label === 'string' ? label : label.name).filter(Boolean);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseState(body = '') {
  const fence = '```';
  const pattern = new RegExp(`${escapeRegExp(START)}\\s*${fence}json\\s*([\\s\\S]*?)\\s*${fence}\\s*${escapeRegExp(END)}`);
  const match = body.match(pattern);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function stateBlock(state) {
  return `${START}\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\`\n${END}`;
}

function isBlockedWithoutNewEvidence(entry) {
  if (!entry || entry.event) return false;
  if (entry.status !== 'COMPLETED' || entry.result_status !== 'blocked') return false;
  return !entry.evidence;
}

function hasLivelock(state) {
  if (state?.maintenance_grant && !state.maintenance_grant.consumed_at) return false;
  const turns = (Array.isArray(state?.history) ? state.history : []).filter(entry => !entry?.event);
  if (turns.length < BLOCKED_TURN_LIMIT) return false;
  return turns.slice(-BLOCKED_TURN_LIMIT).every(isBlockedWithoutNewEvidence);
}

async function stopLivelock(issue, state) {
  const now = new Date().toISOString();
  const history = Array.isArray(state.history) ? state.history : [];
  const alreadyRecorded = history.some(entry => entry?.event === 'LIVELOCK_CIRCUIT_BREAKER');
  const nextState = {
    ...state,
    current_stage: 'PRODUCT_COORDINATION',
    assigned_agent: 'nomy',
    status: 'ORCHESTRATION_BLOCKED',
    execution: null,
    human_gate: null,
    updated_at: now,
    history: alreadyRecorded ? history : [...history, {
      at: now,
      event: 'LIVELOCK_CIRCUIT_BREAKER',
      reason_code: 'REPEATED_BLOCKED_NO_NEW_EVIDENCE',
      blocked_turn_limit: BLOCKED_TURN_LIMIT,
      requires_human: false
    }].slice(-20)
  };

  const pattern = new RegExp(`${escapeRegExp(START)}[\\s\\S]*?${escapeRegExp(END)}`);
  const body = pattern.test(issue.body || '')
    ? (issue.body || '').replace(pattern, stateBlock(nextState))
    : `${issue.body || ''}\n\n${stateBlock(nextState)}`.trim();

  await request(`/issues/${issueNumber}`, { method: 'PATCH', body: JSON.stringify({ body }) });

  const fresh = await request(`/issues/${issueNumber}`);
  const preserved = labelNames(fresh).filter(name => !name.startsWith('agent:') && !name.startsWith('status:') && name !== 'needs:siea');
  await request(`/issues/${issueNumber}/labels`, {
    method: 'PUT',
    body: JSON.stringify({ labels: [...new Set([...preserved, 'agent:nomy', 'status:blocked'])] })
  });

  if (!alreadyRecorded) {
    await request(`/issues/${issueNumber}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        body: `**ORCHESTRATION LIVELOCK CIRCUIT BREAKER**\n\nStopped ${BLOCKED_TURN_LIMIT} consecutive blocked turns with no new structured evidence. The task is routed to Nomy for runtime/coordinator diagnosis. This is an operational failure and does **not** create a \`needs:siea\` gate.`
      })
    });
  }
}

const issue = await request(`/issues/${issueNumber}`);
const state = parseState(issue.body || '');

if (state && hasLivelock(state)) {
  await stopLivelock(issue, state);
  console.log(`[AUTONOMY] Livelock circuit breaker stopped issue #${issueNumber} before another worker turn.`);
  process.exit(0);
}
