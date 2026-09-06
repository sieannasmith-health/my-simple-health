import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

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

async function gh(apiPath, options = {}) {
  return request(`${apiBase}${apiPath}`, options);
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

async function readRepoFile(filePath) {
  try {
    const file = await gh(`/contents/${encodeURIComponent(filePath).replaceAll('%2F', '/')}?ref=main`);
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
  for (const filePath of [...paths].slice(0, 8)) {
    const content = await readRepoFile(filePath);
    if (content) excerpts.push(`FILE: ${filePath}\n${content.slice(0, 7000)}`);
  }

  return `REPOSITORY WORKING AGREEMENT:\n${workingAgreement || '(not available)'}\n\nRELEVANT REPOSITORY EXCERPTS:\n${excerpts.join('\n\n---\n\n') || '(no scoped excerpts found)'}`;
}

function labelNames(issue) {
  return (issue.labels || []).map(x => typeof x === 'string' ? x : x.name).filter(Boolean);
}

function executionApproved(issue, agentKey) {
  return agentKey === 'selah' && labelNames(issue).includes('execution:approved');
}

function validateImplementationFiles(files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > 8) {
    throw new Error('Implementation must contain 1-8 file replacements.');
  }

  const forbiddenPrefixes = ['.github/', 'agent-runtime/'];
  const forbiddenNames = ['.env', '.npmrc', '.pypirc'];
  let totalBytes = 0;

  for (const file of files) {
    if (!file || typeof file.path !== 'string' || typeof file.content !== 'string') {
      throw new Error('Each implementation file requires path and content strings.');
    }
    const normalized = path.posix.normalize(file.path).replace(/^\.\//, '');
    if (!normalized || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
      throw new Error(`Unsafe implementation path: ${file.path}`);
    }
    if (forbiddenPrefixes.some(prefix => normalized.startsWith(prefix)) || forbiddenNames.includes(path.posix.basename(normalized))) {
      throw new Error(`Implementation path is protected from self-modification or secrets: ${normalized}`);
    }
    if (/secret|credential|token/i.test(path.posix.basename(normalized))) {
      throw new Error(`Implementation path rejected because it may contain sensitive material: ${normalized}`);
    }
    totalBytes += Buffer.byteLength(file.content, 'utf8');
  }

  if (totalBytes > 250_000) throw new Error('Implementation payload exceeds 250 KB safety limit.');
}

function safeBranchName(issueNumber) {
  return `agent/issue-${issueNumber}-selah-${Date.now()}`;
}

async function applyImplementation(issue, result) {
  const impl = result.implementation;
  if (!impl) return null;
  if (!executionApproved(issue, 'selah')) throw new Error('Implementation returned without execution:approved authority.');

  validateImplementationFiles(impl.files);
  const branch = safeBranchName(issue.number);

  execFileSync('git', ['config', 'user.name', 'MSH Selah Agent'], { stdio: 'inherit' });
  execFileSync('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], { stdio: 'inherit' });
  execFileSync('git', ['checkout', '-b', branch], { stdio: 'inherit' });

  for (const file of impl.files) {
    const normalized = path.posix.normalize(file.path).replace(/^\.\//, '');
    const localPath = path.resolve(process.cwd(), normalized);
    const root = `${path.resolve(process.cwd())}${path.sep}`;
    if (!localPath.startsWith(root)) throw new Error(`Resolved path escaped repository root: ${normalized}`);
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, file.content, 'utf8');
  }

  execFileSync('git', ['add', '--', ...impl.files.map(file => path.posix.normalize(file.path).replace(/^\.\//, ''))], { stdio: 'inherit' });
  const diff = execFileSync('git', ['diff', '--cached', '--stat'], { encoding: 'utf8' }).trim();
  if (!diff) throw new Error('Implementation produced no repository changes.');

  const commitMessage = `Agent implementation for #${issue.number}: ${issue.title}`.slice(0, 200);
  execFileSync('git', ['commit', '-m', commitMessage], { stdio: 'inherit' });
  execFileSync('git', ['push', '--set-upstream', 'origin', branch], { stdio: 'inherit' });

  const pr = await gh('/pulls', {
    method: 'POST',
    body: JSON.stringify({
      title: `[Agent] ${issue.title}`.slice(0, 240),
      head: branch,
      base: 'main',
      body: `Automated engineering proposal for #${issue.number}.\n\n${impl.summary}\n\nThis PR was created by the MSH agent runtime under the explicit \`execution:approved\` gate. CI and Tessa review remain required before Product acceptance.`,
      maintainer_can_modify: true
    })
  });

  return { branch, prNumber: pr.number, prUrl: pr.html_url, diff };
}

const agents = JSON.parse(await fs.readFile(new URL('./agents.json', import.meta.url), 'utf8'));
const issue = await gh(`/issues/${issueNumber}`);
const comments = await gh(`/issues/${issueNumber}/comments?per_page=100`);
const agentKey = parseAgentFromIssue(issue, requestedAgent);
const agent = agents[agentKey];
if (!agent) throw new Error(`Unknown or missing agent: ${agentKey || '(none)'}`);
const repositoryContext = await collectRepositoryContext(issue);
const canExecute = executionApproved(issue, agentKey);

const operationsRules = `
MSH agent-operations rules:
- Stay inside the objective and stated scope in the GitHub issue.
- Do not widen product scope without a Product decision from Nomy.
- Do not place member health, financial, credential, or secret data into issue comments or implementation payloads.
- Treat GitHub Issues as coordination records, PRs as implementation proposals, and CI as verification evidence.
- Return concrete work/status, not role-play filler.
- Ground repository claims in the supplied repository excerpts. If the excerpts are insufficient, say exactly what must be inspected next.
- Never claim code was changed, tests ran, CI passed, or an external action occurred unless the task context actually demonstrates it.
- Choose next_agent only when a real handoff is ready. Valid agents: ${Object.keys(agents).join(', ')}.
- Use requires_human only when Siea must make a decision, supply a secret/credential, perform a physical-device check, or grant access that automation cannot provide.
- Engineering execution is permitted only to Selah when the issue carries the execution:approved label.
- Even when execution is approved, never modify .github/**, agent-runtime/**, credential/secret/token files, or anything outside the repository.
- Automated engineering must create a PR. It must not merge its own work.
`;

const executionInstructions = canExecute ? `
EXECUTION MODE IS APPROVED FOR THIS SELAH RUN.
You may return an implementation proposal only when the supplied repository context is sufficient to make a scoped, defensible change.
If you implement, return complete UTF-8 replacement contents for 1-8 files in implementation.files. Do not use patches or ellipses. Keep the change strictly inside this issue's approved scope.
Do not modify .github/** or agent-runtime/**. Do not include secrets, credentials, tokens, generated binaries, or large generated files.
If context is insufficient for a safe implementation, return implementation=null and explain the exact repository evidence needed next.
The runtime will put valid file replacements on a new branch and open a PR. CI and Tessa review are separate gates.
` : `
EXECUTION MODE IS NOT APPROVED FOR THIS RUN.
Return implementation=null. For implementation work, provide concrete engineering findings or the smallest exact next request; do not claim code was changed.
`;

const transcript = comments.slice(-30).map(c => `${c.user?.login || 'unknown'}: ${c.body || ''}`).join('\n\n');
const prompt = `
You are ${agent.name}, MSH ${agent.role}.
Mission: ${agent.mission}
Normal handoff: ${agent.handoff}
${operationsRules}
${executionInstructions}

GitHub task #${issue.number}: ${issue.title}

${issue.body || ''}

Recent task conversation:
${transcript || '(none)'}

${repositoryContext}

Return a concise operational result. Do the task to the extent supported by the supplied task and repository context.
`;

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['in_progress', 'blocked', 'review_requested', 'changes_requested', 'ready_for_product', 'completed'] },
    message: { type: 'string' },
    next_agent: { anyOf: [{ type: 'string', enum: Object.keys(agents) }, { type: 'null' }] },
    requires_human: { type: 'boolean' },
    human_request: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    implementation: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            summary: { type: 'string' },
            files: {
              type: 'array',
              minItems: 1,
              maxItems: 8,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  path: { type: 'string' },
                  content: { type: 'string' }
                },
                required: ['path', 'content']
              }
            }
          },
          required: ['summary', 'files']
        }
      ]
    }
  },
  required: ['status', 'message', 'next_agent', 'requires_human', 'human_request', 'implementation']
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

let implementationEvidence = null;
if (result.implementation) {
  if (agentKey !== 'selah') throw new Error('Only Selah may return implementation payloads.');
  implementationEvidence = await applyImplementation(issue, result);
  result.status = 'review_requested';
  result.next_agent = null;
  result.requires_human = false;
  result.human_request = null;
}

const prefix = result.status === 'blocked' ? 'BLOCKER' : result.status === 'review_requested' ? 'REVIEW REQUEST' : result.status === 'changes_requested' ? 'REVIEW RESULT' : result.status === 'ready_for_product' ? 'HANDOFF' : 'STATUS';
let comment = `**${prefix}: ${agent.name}**\n\n${result.message}`;
if (implementationEvidence) {
  comment += `\n\n**Implementation evidence:** PR #${implementationEvidence.prNumber} ${implementationEvidence.prUrl}\n\nBranch: \`${implementationEvidence.branch}\`\n\nChanged-file summary:\n\`\`\`\n${implementationEvidence.diff}\n\`\`\`\n\nCI must complete before Tessa review is routed.`;
}
if (result.requires_human && result.human_request) comment += `\n\n**SIEA CHECK:** ${result.human_request}`;
if (result.next_agent) comment += `\n\n**Next handoff:** ${agents[result.next_agent].name}`;
await gh(`/issues/${issueNumber}/comments`, { method: 'POST', body: JSON.stringify({ body: comment }) });

for (const key of Object.keys(agents)) await ensureLabel(`agent:${key}`, '5B6F63');
for (const status of ['in_progress', 'blocked', 'review_requested', 'changes_requested', 'ready_for_product', 'completed']) await ensureLabel(`status:${status}`, 'D8D4C4');
await ensureLabel('needs:siea', 'B65C4A');
await ensureLabel('execution:approved', '6F42C1');

const preserved = labelNames(issue).filter(x => !x.startsWith('agent:') && !x.startsWith('status:') && x !== 'needs:siea');
const nextLabels = [...preserved, `status:${result.status}`];
if (result.next_agent) nextLabels.push(`agent:${result.next_agent}`);
if (result.requires_human) nextLabels.push('needs:siea');

await gh(`/issues/${issueNumber}`, {
  method: 'PATCH',
  body: JSON.stringify({ labels: nextLabels })
});

console.log(JSON.stringify({
  issue: issueNumber,
  agent: agentKey,
  status: result.status,
  next_agent: result.next_agent,
  requires_human: result.requires_human,
  execution_approved: canExecute,
  pull_request: implementationEvidence?.prNumber || null
}));
