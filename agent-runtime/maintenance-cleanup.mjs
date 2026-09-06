import { drainMaintenanceGrant } from './maintenance-authorization.mjs';

const START = '<!-- MSH_STATE_LOCK -->';
const END = '<!-- MSH_STATE_LOCK_END -->';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseState(body = '') {
  const fence = '```';
  const pattern = new RegExp(`${escapeRegExp(START)}\\s*${fence}json\\s*([\\s\\S]*?)\\s*${fence}\\s*${escapeRegExp(END)}`);
  const match = String(body || '').match(pattern);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function stateBlock(state) {
  return `${START}\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\`\n${END}`;
}

export async function clearMaintenanceGrant({
  token = process.env.GITHUB_TOKEN,
  repository = process.env.GITHUB_REPOSITORY,
  issueNumber = Number(process.env.ISSUE_NUMBER || 0),
  fetchImpl = fetch,
  outcome = 'runtime_finally'
} = {}) {
  if (!token || !repository || !issueNumber) return false;

  const [owner, repo] = repository.split('/');
  const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };

  const request = async (apiPath, options = {}) => {
    const response = await fetchImpl(`${apiBase}${apiPath}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    if (!response.ok) throw new Error(`GitHub ${response.status}: ${await response.text()}`);
    if (response.status === 204) return null;
    return response.json();
  };

  const fresh = await request(`/issues/${issueNumber}`);
  const state = parseState(fresh.body || '');
  if (!state?.maintenance_grant) return false;

  const drained = drainMaintenanceGrant(state, { outcome });
  const nextState = { ...drained, updated_at: new Date().toISOString() };
  const pattern = new RegExp(`${escapeRegExp(START)}[\\s\\S]*?${escapeRegExp(END)}`);
  const body = pattern.test(fresh.body || '')
    ? (fresh.body || '').replace(pattern, stateBlock(nextState))
    : `${fresh.body || ''}\n\n${stateBlock(nextState)}`.trim();

  await request(`/issues/${issueNumber}`, { method: 'PATCH', body: JSON.stringify({ body }) });
  console.log(`[MAINTENANCE_ELEVATION] Cleared single-use maintenance grant on issue #${issueNumber} (${outcome}).`);
  return true;
}
