const PR_REQUIRED_STAGES = new Set([
  'IMPLEMENTATION_REVIEW',
  'CI_VERIFICATION',
  'QA',
  'PRODUCT_REVIEW_AFTER_IMPLEMENTATION'
]);

export function stageRequiresPR(stage = '') {
  return PR_REQUIRED_STAGES.has(String(stage).toUpperCase());
}

export function normalizePRNumber(value) {
  const candidate = typeof value === 'object' && value ? value.number : value;
  const number = Number(candidate);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function historicalPRNumber(state = {}) {
  const direct = normalizePRNumber(state?.evidence?.pr_number);
  if (direct) return direct;

  for (const entry of [...(state.history || [])].reverse()) {
    for (const candidate of [entry?.pr_number, entry?.evidence?.pr_number, entry?.evidence?.reference_id]) {
      const number = normalizePRNumber(candidate);
      if (number) return number;
    }
  }
  return null;
}

export function explicitPRNumbers(issue = {}, comments = []) {
  const text = [issue.body || '', ...comments.map(comment => comment.body || '')].join('\n');
  const found = new Set();
  const patterns = [/\bPR\s*#(\d+)\b/gi, /\/pull\/(\d+)\b/gi, /pull request\s*#(\d+)\b/gi];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) found.add(Number(match[1]));
  }
  return [...found].filter(Number.isInteger);
}

export async function fetchPREvidence(prNumber, github) {
  const pr = await github(`/pulls/${prNumber}`);
  const files = await github(`/pulls/${prNumber}/files?per_page=100`);
  const headSha = pr.head?.sha || null;
  let checks = { check_runs: [] };
  let status = { state: 'unknown', statuses: [] };

  if (headSha) {
    try { checks = await github(`/commits/${headSha}/check-runs?per_page=100`); } catch {}
    try { status = await github(`/commits/${headSha}/status`); } catch {}
  }

  return {
    pr_number: pr.number,
    url: pr.html_url,
    state: pr.state,
    draft: Boolean(pr.draft),
    head_sha: headSha,
    head_ref: pr.head?.ref || null,
    base_ref: pr.base?.ref || null,
    mergeable: pr.mergeable,
    changed_files: (files || []).slice(0, 25).map(file => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: typeof file.patch === 'string' ? file.patch.slice(0, 3500) : null
    })),
    check_runs: (checks.check_runs || []).map(check => ({
      name: check.name,
      status: check.status,
      conclusion: check.conclusion
    })),
    combined_status: status.state || 'unknown',
    statuses: (status.statuses || []).map(item => ({
      context: item.context,
      state: item.state,
      description: item.description
    }))
  };
}

async function associatedPRNumbers(issue, github) {
  const pulls = await github('/pulls?state=all&per_page=100&sort=updated&direction=desc');
  const issueRef = new RegExp(`(?:#${issue.number}\\b|issues/${issue.number}\\b)`, 'i');
  const branchRef = new RegExp(`issue-${issue.number}(?:-|$)`, 'i');
  return (pulls || [])
    .filter(pr => issueRef.test(`${pr.title || ''}\n${pr.body || ''}`) || branchRef.test(pr.head?.ref || ''))
    .map(pr => pr.number);
}

async function activeCandidateEvidence(issue, comments, github, excludedNumber = null) {
  const explicit = explicitPRNumbers(issue, comments);
  const associated = await associatedPRNumbers(issue, github);
  const candidates = [...new Set([...explicit, ...associated])]
    .filter(number => number !== excludedNumber);

  const evidence = [];
  for (const number of candidates) {
    try {
      const candidate = await fetchPREvidence(number, github);
      if (candidate.state === 'open') evidence.push(candidate);
    } catch {}
  }

  return { candidates, evidence };
}

export async function resolveRequiredEvidence({ state, issue, comments, eventPayload, github }) {
  const stage = String(state.current_stage || '').toUpperCase();
  if (!stageRequiresPR(stage)) {
    return { required: false, pr: null, resolved_via: 'NOT_REQUIRED' };
  }

  const payloadNumber = normalizePRNumber(eventPayload?.pull_request);
  if (payloadNumber) {
    return { required: true, pr: await fetchPREvidence(payloadNumber, github), resolved_via: 'EVENT_PAYLOAD' };
  }

  // GitHub issue_comment events on pull requests expose the PR marker on
  // issue.pull_request while issue.number remains the canonical PR number.
  // Resolve that thread directly instead of requiring the PR to self-reference.
  const currentThreadPRNumber = issue?.pull_request ? normalizePRNumber(issue) : null;
  if (currentThreadPRNumber) {
    return {
      required: true,
      pr: await fetchPREvidence(currentThreadPRNumber, github),
      resolved_via: 'CURRENT_PR_THREAD'
    };
  }

  const historicalNumber = historicalPRNumber(state);
  let historicalEvidence = null;
  if (historicalNumber) {
    historicalEvidence = await fetchPREvidence(historicalNumber, github);
    if (historicalEvidence.state === 'open') {
      return { required: true, pr: historicalEvidence, resolved_via: 'STATE_HISTORY' };
    }
  }

  const { candidates, evidence: activeEvidence } = await activeCandidateEvidence(
    issue,
    comments,
    github,
    historicalNumber
  );
  if (activeEvidence.length === 1) {
    return {
      required: true,
      pr: activeEvidence[0],
      resolved_via: historicalEvidence ? 'ACTIVE_ISSUE_ASSOCIATION' : 'ISSUE_ASSOCIATION'
    };
  }

  if (activeEvidence.length > 1) {
    return {
      required: true,
      pr: null,
      routeToCoordinator: true,
      reason: `Multiple active deterministic PR candidates found for stage ${stage}: ${activeEvidence.map(pr => pr.pr_number).join(', ')}`
    };
  }

  if (historicalEvidence) {
    return { required: true, pr: historicalEvidence, resolved_via: 'STATE_HISTORY_FALLBACK' };
  }

  return {
    required: true,
    pr: null,
    routeToCoordinator: true,
    reason: candidates.length > 1
      ? `Multiple deterministic PR candidates found for stage ${stage}: ${candidates.join(', ')}`
      : `Missing implementation evidence required for stage ${stage}`
  };
}
