import fs from 'node:fs/promises';

const token = process.env.GITHUB_TOKEN;
const openaiKey = process.env.OPENAI_API_KEY;
const repository = process.env.GITHUB_REPOSITORY;
const issueNumber = Number(process.env.ISSUE_NUMBER || 0);
const requestedAgent = (process.env.AGENT_NAME || '').trim().toLowerCase();
const model = process.env.AGENT_MODEL || 'gpt-5.6-luna';

if (!token || !openaiKey || !repository || !issueNumber) {
  throw new Error('Missing GITHUB_TOKEN, OPENAI_API_KEY, GITHUB_REPOSITORY, or ISSUE_NUMBER.');
}

const [owner, repo] = repository.split('/');
const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json'
};

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${await response.text()}`);
  if (response.status === 204) return null;
  return response.json();
}

async function gh(path, options = {}) {
  return request(`${apiBase}${path}`, options);
}

async function ensureLabel(name, color) {
  const encoded = encodeURIComponent(name);
  const response = await fetch(`${apiBase}/labels/${encoded}`, { headers });
  if (response.ok) return;
  if (response.status !== 404) throw new Error(`GitHub label lookup ${response.status}: ${await response.text()}`);
  await gh('/labels', { method: 'POST', body: JSON.stringify({ name, color }) });
}

function extractOutputText(payload) {
  if (typeof payload.output_text === 'string') return payload.output_text;
  for (const item of payload.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return '';
}

function parseAgentFromIssue(issue, explicit) {
  if (explicit) return explicit;
  const label = (issue.labels || []).map(x => typeof x === 'string' ? x : x.name).find(x => x?.startsWith('agent:'));
  if (label) return label.slice('agent:'.length).trim().toLowerCase();
  const ownerMatch = issue.body?.match(/## Owner\s*\n([^\n]+)/i);
  if (ownerMatch) return ownerMatch[1].split('/')[0].replace(/[^a-z]/gi, '').toLowerCase();
  return '';
}

async function readRepoFile(path) {
  try {
    const file = await gh(`/contents/${encodeURIComponent(path).replaceAll('%2F', '/')}?ref=main`);
    if (!file?.content || file.encoding !== 'base64') return '';
    return Buffer.from(file.content, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

async function collectRepositoryContext(issue) {
  const workingAgreement = (await readRepoFile('AGENTS.md')).slice(0, 14000);
  const sourceText = `${issue.title}\n${issue.body || ''}`;
  const preferred = ['plaid', 'financial', 'firestore', 'firebase', 'swift', 'onboarding', 'landscape', 'economize', 'simple', 'healthkit'];
  const terms = preferred.filter(term => sourceText.toLowerCase().includes(term)).slice(0, 4);
  const paths = new Set();

  for (const term of terms) {
    try {
      const q = encodeURIComponent(`${term} repo:${repository}`);
      const result = await request(`https://api.github.com/search/code?q=${q}&per_page=5`);
      for (const item of result.items || []) {
        if (item.path && !item.path.startsWith('agent-runtime/')) paths.add(item.path);
        if (paths.size >= 8) break;
      }
    } catch (error) {
      console.warn(`Code search failed for ${term}: ${error.message}`);
    }
    if (paths.size >= 8) break;
  }

  const excerpts = [];
  for (const path of [...paths].slice(0, 8)) {
    const content = await readRepoFile(path);
    if (content) excerpts.push(`FILE: ${path}\n${content.slice(0, 7000)}`);
  }

  return `REPOSITORY WORKING AGREEMENT:\n${workingAgreement || '(not available)'}\n\nRELEVANT REPOSITORY EXCERPTS:\n${excerpts.join('\n\n---\n\n') || '(no scoped excerpts found)'}`;
}

const agents = JSON.parse(await fs.readFile(new URL('./agents.json', import.meta.url), 'utf8'));
const issue = await gh(`/issues/${issueNumber}`);
const comments = await gh(`/issues/${issueNumber}/comments?per_page=100`);
const agentKey = parseAgentFromIssue(issue, requestedAgent);
const agent = agents[agentKey];
if (!agent) throw new Error(`Unknown or missing agent: ${agentKey || '(none)'}`);
const repositoryContext = await collectRepositoryContext(issue);

const operationsRules = `
MSH agent-operations rules:
- Stay inside the objective and stated scope in the GitHub issue.
- Do not widen product scope without a Product decision from Nomy.
- Do not place member health, financial, credential, or secret data into issue comments.
- Treat GitHub Issues as coordination records, PRs as implementation proposals, and CI as verification evidence.
- Return concrete work/status, not role-play filler.
- Ground repository claims in the supplied repository excerpts. If the excerpts are insufficient, say exactly what must be inspected next.
- Never claim code was changed, tests ran, CI passed, or an external action occurred unless the task context actually demonstrates it.
- Choose next_agent only when a real handoff is ready. Valid agents: ${Object.keys(agents).join(', ')}.
- Use requires_human only when Siea must make a decision, supply a secret/credential, perform a physical-device check, or grant access that automation cannot provide.
`;

const transcript = comments.slice(-30).map(c => `${c.user?.login || 'unknown'}: ${c.body || ''}`).join('\n\n');
const prompt = `
You are ${agent.name}, MSH ${agent.role}.
Mission: ${agent.mission}
Normal handoff: ${agent.handoff}
${operationsRules}

GitHub task #${issue.number}: ${issue.title}

${issue.body || ''}

Recent task conversation:
${transcript || '(none)'}

${repositoryContext}

Return a concise operational result. Do the task to the extent supported by the supplied task and repository context. For audits/reviews, return findings, evidence, exact gap, and next action. For implementation work, describe the concrete implementation request unless the task conversation contains actual implementation evidence.
`;

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['in_progress', 'blocked', 'review_requested', 'changes_requested', 'ready_for_product', 'completed'] },
    message: { type: 'string' },
    next_agent: { anyOf: [{ type: 'string', enum: Object.keys(agents) }, { type: 'null' }] },
    requires_human: { type: 'boolean' },
    human_request: { anyOf: [{ type: 'string' }, { type: 'null' }] }
  },
  required: ['status', 'message', 'next_agent', 'requires_human', 'human_request']
};

const response = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${openaiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model,
    input: prompt,
    reasoning: { effort: 'medium' },
    text: { format: { type: 'json_schema', name: 'msh_agent_result', strict: true, schema } }
  })
});
if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
const payload = await response.json();
const text = extractOutputText(payload);
if (!text) throw new Error('OpenAI response contained no output text.');
const result = JSON.parse(text);

const prefix = result.status === 'blocked' ? 'BLOCKER' : result.status === 'review_requested' ? 'REVIEW REQUEST' : result.status === 'changes_requested' ? 'REVIEW RESULT' : result.status === 'ready_for_product' ? 'HANDOFF' : 'STATUS';
const comment = `**${prefix}: ${agent.name}**\n\n${result.message}${result.requires_human && result.human_request ? `\n\n**SIEA CHECK:** ${result.human_request}` : ''}${result.next_agent ? `\n\n**Next handoff:** ${agents[result.next_agent].name}` : ''}`;
await gh(`/issues/${issueNumber}/comments`, { method: 'POST', body: JSON.stringify({ body: comment }) });

for (const key of Object.keys(agents)) await ensureLabel(`agent:${key}`, '5B6F63');
for (const status of ['in_progress', 'blocked', 'review_requested', 'changes_requested', 'ready_for_product', 'completed']) await ensureLabel(`status:${status}`, 'D8D4C4');
await ensureLabel('needs:siea', 'B65C4A');

const preserved = (issue.labels || []).map(x => typeof x === 'string' ? x : x.name).filter(Boolean).filter(x => !x.startsWith('agent:') && !x.startsWith('status:') && x !== 'needs:siea');
const nextLabels = [...preserved, `status:${result.status}`];
if (result.next_agent) nextLabels.push(`agent:${result.next_agent}`);
if (result.requires_human) nextLabels.push('needs:siea');

await gh(`/issues/${issueNumber}`, {
  method: 'PATCH',
  body: JSON.stringify({ labels: nextLabels })
});

console.log(JSON.stringify({ issue: issueNumber, agent: agentKey, status: result.status, next_agent: result.next_agent, requires_human: result.requires_human }));
