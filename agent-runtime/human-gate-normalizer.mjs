import {
  isExecutionApprovalCoordinationGate,
  reasonCodeOf
} from './orchestration-policy.mjs';

export const HumanGateSignal = Object.freeze({
  NO_OP: 'NO_OP',
  NORMALIZED: 'NORMALIZED'
});

export async function normalizeHumanGate({
  token = process.env.GITHUB_TOKEN,
  repository = process.env.GITHUB_REPOSITORY,
  issueNumber = Number(process.env.ISSUE_NUMBER || 0),
  structuredResult = null,
  fetchImpl = fetch
} = {}) {
  if (!token || !repository || !issueNumber) {
    throw new Error('Missing required runtime environment for human-gate normalization.');
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
    const response = await fetchImpl(`${apiBase}${path}`, {
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

  const issue = await request(`/issues/${issueNumber}`);
  const comments = await request(`/issues/${issueNumber}/comments?per_page=100`);
  const labels = labelNames(issue);
  const reasonCode = reasonCodeOf(structuredResult);

  if (!isExecutionApprovalCoordinationGate(labels, structuredResult)) {
    console.log(`[MSH Runtime] Human-gate normalization NO_OP on issue #${issueNumber} (reason_code=${reasonCode || 'none'}).`);
    return HumanGateSignal.NO_OP;
  }

  const preserved = labels.filter(
    name => !name.startsWith('agent:') && !name.startsWith('status:') && name !== 'needs:siea'
  );

  await request(`/issues/${issueNumber}/labels`, {
    method: 'PUT',
    body: JSON.stringify({ labels: [...new Set([...preserved, 'agent:nomy', 'status:blocked'])] })
  });

  await request(`/issues/${issueNumber}/comments`, {
    method: 'POST',
    body: JSON.stringify({
      body: '**RUNTIME AUTHORITY NORMALIZATION**\n\nStructured reason code `EXECUTION_APPROVAL_REQUIRED` identifies missing execution authority. This is a Product coordination gate, not a Siea-only action. The execution safety gate remains enforced.'
    })
  });

  console.log(`[MSH Runtime] Normalized ${reasonCode} to Nomy on issue #${issueNumber}.`);
  return HumanGateSignal.NORMALIZED;
}
