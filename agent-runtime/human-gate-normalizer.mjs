import { isExecutionApprovalCoordinationGate } from './orchestration-policy.mjs';

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const issueNumber = Number(process.env.ISSUE_NUMBER || 0);

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

const issue = await request(`/issues/${issueNumber}`);
const comments = await request(`/issues/${issueNumber}/comments?per_page=100`);
const latestComment = comments.at(-1)?.body || '';
const labels = labelNames(issue);

if (!isExecutionApprovalCoordinationGate(labels, latestComment)) process.exit(0);

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
    body: '**RUNTIME AUTHORITY NORMALIZATION**\n\nMissing `execution:approved` is a Product coordination gate, not a Siea-only action. Routing to Nomy without `needs:siea`. The execution safety gate remains enforced.'
  })
});

console.log(`[MSH Runtime] Normalized missing execution approval to Nomy on issue #${issueNumber}.`);
