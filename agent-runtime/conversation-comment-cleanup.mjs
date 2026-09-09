const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const issueNumber = Number(process.env.ISSUE_NUMBER || 0);
const triggerCommentId = Number(process.env.TRIGGER_COMMENT_ID || 0);
const agentName = (process.env.AGENT_DISPLAY_NAME || '').trim();

if (!token || !repository || !issueNumber || !triggerCommentId || !agentName) {
  throw new Error('Missing required environment for conversation comment cleanup.');
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

function cleanConversationBody(body) {
  let text = String(body || '');
  const escapedName = agentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  text = text.replace(new RegExp(`^\\*\\*STATUS: ${escapedName}\\*\\*\\s*`, 'i'), '');

  // Remove only narrow no-op runtime boilerplate from routine conversation.
  // Real blockers, handoffs, review requests, evidence, and SIEA CHECK sections are untouched.
  text = text
    .replace(/\s*No new product decision, engineering handoff, or Siea action is required\. Implementation remains unchanged\.?\s*/gi, ' ')
    .replace(/\s*No engineering work or handoff is required for this turn\.?\s*/gi, ' ')
    .replace(/\s*and there(?:'|’)s no new product decision or engineering handoff needed on this turn\.?\s*/gi, '. ')
    .replace(/\s*Implementation remains unchanged\.?\s*/gi, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim();

  if (!text) return text;

  // GitHub Actions is the transport identity. Keep the named MSH agent visibly
  // attributable in the rendered conversation so humans can audit who spoke.
  return `**${agentName}**\n\n${text}`;
}

const comments = await request(`/issues/${issueNumber}/comments?per_page=100`);
const triggerIndex = comments.findIndex(comment => Number(comment.id) === triggerCommentId);
if (triggerIndex < 0) {
  console.log('[CONVERSATION_CLEANUP] Trigger comment not found; leaving output unchanged.');
  process.exit(0);
}

const candidate = comments
  .slice(triggerIndex + 1)
  .find(comment =>
    comment.user?.login === 'github-actions[bot]' &&
    typeof comment.body === 'string' &&
    new RegExp(`^\\*\\*STATUS: ${agentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*\\*`, 'i').test(comment.body)
  );

if (!candidate) {
  console.log('[CONVERSATION_CLEANUP] No conversational STATUS comment found; operational output remains untouched.');
  process.exit(0);
}

const cleaned = cleanConversationBody(candidate.body);
if (!cleaned || cleaned === candidate.body) {
  console.log('[CONVERSATION_CLEANUP] Nothing to change.');
  process.exit(0);
}

await request(`/issues/comments/${candidate.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ body: cleaned })
});

console.log(`[CONVERSATION_CLEANUP] Rewrote conversational ${agentName} reply with visible agent attribution.`);
