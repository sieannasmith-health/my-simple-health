const START = '<!-- MSH_STATE_LOCK -->';
const END = '<!-- MSH_STATE_LOCK_END -->';

export function parseStateBlock(body = '') {
  const escapedStart = START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fence = '```';
  const match = body.match(new RegExp(`${escapedStart}\\s*${fence}json\\s*([\\s\\S]*?)\\s*${fence}\\s*${escapedEnd}`));
  return match ? JSON.parse(match[1]) : null;
}

export function renderStateBlock(state) {
  return `${START}\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\`\n${END}`;
}

function recoveryOwnerFor({ failedAgent, failedStage }) {
  if (failedAgent === 'tessa' || failedStage === 'QA') return 'selah';
  if (failedAgent === 'selah' || failedStage === 'IMPLEMENTATION') return 'selah';
  return failedAgent || 'nomy';
}

export function deriveLegacyRecovery(state, now = new Date()) {
  if (!state || state.status !== 'ORCHESTRATION_BLOCKED') return null;
  if (state.human_gate) return null;
  if (state.recovery?.resume_agent && state.recovery?.resume_stage) return null;

  const redriveCount = Number(state.redrive_count ?? 0);
  const maxRedrives = Number(state.max_redrives ?? 2);
  if (redriveCount >= maxRedrives) return null;

  const history = Array.isArray(state.history) ? state.history : [];
  const lastBlockedWorker = [...history].reverse().find(entry => entry?.agent && entry?.result_status === 'blocked');
  const failedAgent = lastBlockedWorker?.agent || state.last_graph_transition?.to || state.assigned_agent || 'nomy';
  const failedStage = lastBlockedWorker?.stage || state.current_stage || 'PRODUCT_COORDINATION';
  const recoveryOwner = recoveryOwnerFor({ failedAgent, failedStage });
  const resumeStage = recoveryOwner === 'selah' ? 'IMPLEMENTATION' : failedStage;

  return {
    failed_agent: failedAgent,
    failed_stage: failedStage,
    recovery_owner: recoveryOwner,
    resume_agent: recoveryOwner,
    resume_stage: resumeStage,
    reason_code: 'LEGACY_ORCHESTRATION_BLOCKED_WITHOUT_RECOVERY_CHECKPOINT',
    failed_at: now.toISOString(),
    not_before: now.toISOString()
  };
}

export function bootstrapLegacyBlockedState(state, now = new Date()) {
  const recovery = deriveLegacyRecovery(state, now);
  if (!recovery) return null;

  const currentRedrives = Number(state.redrive_count ?? 0);
  const maxRedrives = Number(state.max_redrives ?? 2);
  if (currentRedrives >= maxRedrives) return null;

  return {
    ...state,
    status: 'PENDING',
    assigned_agent: recovery.resume_agent,
    current_stage: recovery.resume_stage,
    retry_count: 0,
    redrive_count: currentRedrives + 1,
    max_redrives: maxRedrives,
    execution: null,
    human_gate: null,
    recovery: { ...recovery, redriven_at: now.toISOString() },
    history: [...historyOf(state), {
      at: now.toISOString(),
      event: 'LEGACY_BLOCKED_STATE_RECOVERED',
      failed_agent: recovery.failed_agent,
      failed_stage: recovery.failed_stage,
      recovery_owner: recovery.recovery_owner,
      resume_agent: recovery.resume_agent,
      resume_stage: recovery.resume_stage,
      redrive_count: currentRedrives + 1
    }].slice(-20),
    updated_at: now.toISOString()
  };
}

function historyOf(state) {
  return Array.isArray(state?.history) ? state.history : [];
}

async function request(apiBase, token, path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${await response.text()}`);
  if (response.status === 204) return null;
  return response.json();
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const issueNumber = Number(process.env.ISSUE_NUMBER || 0);
  const evaluatorWorkflow = process.env.AGENT_EVALUATOR_WORKFLOW || 'msh-agent-state-evaluator.yml';
  const evaluatorRef = process.env.AGENT_EVALUATOR_REF || 'main';
  const inlineEvaluator = process.env.MSH_INLINE_EVALUATOR === '1';
  if (!token || !repository || !issueNumber) throw new Error('Missing GITHUB_TOKEN, GITHUB_REPOSITORY, or ISSUE_NUMBER.');

  const [owner, repo] = repository.split('/');
  const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
  const issue = await request(apiBase, token, `/issues/${issueNumber}`);
  const state = parseStateBlock(issue.body || '');
  const nextState = bootstrapLegacyBlockedState(state);

  if (!nextState) {
    console.log(`[MSH Recovery] Issue #${issueNumber} does not need legacy blocked-state bootstrap.`);
    return;
  }

  const expectedSequence = Number.isInteger(state.sequence_version) ? state.sequence_version : 0;
  const fresh = await request(apiBase, token, `/issues/${issueNumber}`);
  const freshState = parseStateBlock(fresh.body || '');
  const freshSequence = Number.isInteger(freshState?.sequence_version) ? freshState.sequence_version : 0;
  if (freshSequence !== expectedSequence) {
    console.log(`[MSH Recovery] Stale bootstrap writer on issue #${issueNumber}; expected sequence=${expectedSequence}, current=${freshSequence}.`);
    return;
  }

  nextState.sequence_version = expectedSequence + 1;
  const pattern = new RegExp(`${START}[\\s\\S]*?${END}`);
  const body = (fresh.body || '').replace(pattern, renderStateBlock(nextState));
  await request(apiBase, token, `/issues/${issueNumber}`, { method: 'PATCH', body: JSON.stringify({ body }) });

  if (!inlineEvaluator) {
    await request(apiBase, token, `/actions/workflows/${encodeURIComponent(evaluatorWorkflow)}/dispatches`, {
      method: 'POST',
      body: JSON.stringify({ ref: evaluatorRef, inputs: { issue_number: String(issueNumber) } })
    });
  }

  console.log(`[AUTONOMY] Legacy ORCHESTRATION_BLOCKED state on issue #${issueNumber} recovered and redriven to ${nextState.assigned_agent} / ${nextState.current_stage}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
