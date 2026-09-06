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
const current = labelNames(issue);
const hasOwner = current.some(label => label.startsWith('agent:'));

if (current.includes('status:review_requested') && !hasOwner) {
  const preserved = current.filter(label => !label.startsWith('agent:') && label !== 'needs:siea');
  await request(`/issues/${issueNumber}/labels`, {
    method: 'PUT',
    body: JSON.stringify({ labels: [...new Set([...preserved, 'agent:tessa'])] })
  });
  console.log(`Reconciled issue #${issueNumber}: review_requested -> agent:tessa.`);
}
