import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { applyImplementation, executionApproved } from './engineering-execution.mjs';
import { resolveRequiredEvidence } from './evidence-resolver.mjs';

const githubToken = process.env.GITHUB_TOKEN;
const openaiKey = process.env.OPENAI_API_KEY;
const repository = process.env.GITHUB_REPOSITORY;
const issueNumber = Number(process.env.ISSUE_NUMBER || 0);
const requestedAgent = (process.env.AGENT_NAME || '').trim().toLowerCase();
const model = process.env.AGENT_MODEL || 'gpt-5.6-luna';
const STATE_START = '<!-- MSH_STATE_LOCK -->';
const STATE_END = '<!-- MSH_STATE_LOCK_END -->';
const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(process.env.GITHUB_WORKSPACE || process.cwd());
const MAX_CONTEXT_EXCERPTS = 8;
const MAX_EXCERPT_CHARS = 7000;
const SAFE_TEXT_EXTENSIONS = new Set([
  '.md', '.mjs', '.js', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.yml', '.yaml', '.sh', '.py',
  '.swift', '.kt', '.kts', '.java', '.rb', '.go', '.rs', '.sql', '.html', '.css', '.scss', '.txt'
]);
const EXCLUDED_CONTEXT_PATHS = [
  /(^|\/)\.env(?:\.|$)/i,
  /(^|\/)(?:secrets?|credentials?)(?:\/|\.|$)/i,
  /\.(?:pem|p12|pfx|key|der|cer|crt)$/i,
  /(^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Podfile\.lock)$/i,
  /(^|\/)(?:vendor|Pods|DerivedData|node_modules|build|dist)(\/|$)/i
];

if (!githubToken || !openaiKey || !repository || !issueNumber) {
  throw new Error('Missing required runtime environment.');
}

const [owner, repo] = repository.split('/');
const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
const githubHeaders = {
  Authorization: `Bearer ${githubToken}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json'
};

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...githubHeaders, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${await response.text()}`);
  if (response.status === 204) return null;
  return response.json();
}

async function gh(apiPath, options = {}) {
  return request(`${apiBase}${apiPath}`, options);
}

function labelNames(issue) {
  return (issue.labels || []).map(item => typeof item === 'string' ? item : item.name).filter(Boolean);
}

async function ensureLabel(name, color) {
  const encoded = encodeURIComponent(name);
  const response = await fetch(`${apiBase}/labels/${encoded}`, { headers: githubHeaders });
  if (response.ok) return;
  if (response.status !== 404) throw new Error(`GitHub label lookup ${response.status}: ${await response.text()}`);
  await gh('/labels', { method: 'POST', body: JSON.stringify({ name, color }) });
}

function parseAgentFromIssue(issue, explicit) {
  if (explicit) return explicit;
  const label = labelNames(issue).find(name => name.startsWith('agent:'));
  return label ? label.slice('agent:'.length).trim().toLowerCase() : '';
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseStateBlock(body = '') {
  const pattern = new RegExp(escapeRegExp(STATE_START) + '\\s*```json\\s*([\\s\\S]*?)\\s*```\\s*' + escapeRegExp(STATE_END));
  const match = body.match(pattern);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function inferStage(issue, agentKey) {
  const labels = labelNames(issue);
  if (agentKey === 'tessa' || labels.includes('status:review_requested') || labels.includes('status:changes_requested')) return 'QA';
  if (agentKey === 'selah' && labels.includes('execution:approved')) return 'IMPLEMENTATION';
  if (agentKey === 'nomy') return 'PRODUCT_COORDINATION';
  return 'INITIAL_TRIAGE';
}

function loadState(issue, agentKey) {
  return parseStateBlock(issue.body || '') || {
    version: 1,
    task_id: String(issue.number),
    current_stage: inferStage(issue, agentKey),
    assigned_agent: agentKey,
    status: 'PENDING',
    retry_count: 0,
    max_retries: 3,
    history: [],
    execution: null,
    evidence: null
  };
}

function stateBlock(state) {
  return STATE_START + '\n```json\n' + JSON.stringify(state, null, 2) + '\n```\n' + STATE_END;
}

async function readEventPayload() {
  const file = process.env.GITHUB_EVENT_PATH;
  if (!file) return {};
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return {}; }
}

async function persistEvidence(state, resolution) {
  if (!resolution?.pr) return;
  const fresh = await gh(`/issues/${issueNumber}`);
  const current = parseStateBlock(fresh.body || '') || state;
  const evidence = {
    pr_number: resolution.pr.pr_number,
    head_sha: resolution.pr.head_sha,
    changed_files: resolution.pr.changed_files.map(file => file.filename),
    check_runs: resolution.pr.check_runs,
    combined_status: resolution.pr.combined_status,
    resolved_via: resolution.resolved_via
  };
  const next = { ...current, evidence, updated_at: new Date().toISOString() };
  const block = stateBlock(next);
  const pattern = new RegExp(escapeRegExp(STATE_START) + '[\\s\\S]*?' + escapeRegExp(STATE_END));
  const body = pattern.test(fresh.body || '') ? (fresh.body || '').replace(pattern, block) : `${fresh.body || ''}\n\n${block}`.trim();
  await gh(`/issues/${issueNumber}`, { method: 'PATCH', body: JSON.stringify({ body }) });
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

function explicitRepoPaths(issue, comments) {
  const text = [issue.body || '', ...comments.slice(-12).map(comment => comment.body || '')].join('\n');
  const pattern = /(?:^|[`\s(])((?:\.github\/|agent-runtime\/|ios\/|src\/|app\/|scripts\/|tests\/)[A-Za-z0-9_./-]+\.[A-Za-z0-9]+)(?=$|[`\s),:])/gm;
  const matches = text.match(pattern) || [];
  return [...new Set(matches.map(value => value.trim().replace(/^`|`$/g, '')))].filter(Boolean).slice(0, MAX_CONTEXT_EXCERPTS);
}

function objectiveTerms(issue, comments) {
  const text = [issue.title || '', issue.body || '', ...comments.slice(-6).map(comment => comment.body || '')].join(' ').toLowerCase();
  const stopWords = new Set(['about', 'after', 'agent', 'again', 'also', 'been', 'being', 'from', 'have', 'into', 'issue', 'only', 'should', 'that', 'their', 'there', 'these', 'they', 'this', 'through', 'when', 'where', 'which', 'with', 'would']);
  return [...new Set((text.match(/[a-z0-9][a-z0-9_-]{2,}/g) || []).filter(term => !stopWords.has(term)))].slice(0, 80);
}

function isSafeContextPath(filePath) {
  const normalized = filePath.replaceAll('\\', '/');
  if (EXCLUDED_CONTEXT_PATHS.some(pattern => pattern.test(normalized))) return false;
  const extension = path.posix.extname(normalized).toLowerCase();
  return SAFE_TEXT_EXTENSIONS.has(extension) || ['AGENTS.md', 'README.md', 'Dockerfile', 'Makefile'].includes(path.posix.basename(normalized));
}

function rankContextPath(filePath, terms) {
  const normalized = filePath.toLowerCase();
  const basename = path.posix.basename(normalized);
  let score = 0;
  if (normalized.startsWith('agent-runtime/')) score += 5;
  if (normalized.startsWith('.github/workflows/')) score += 4;
  if (/(^|\/)(tests?|specs?)(\/|\.|$)/.test(normalized)) score += 2;
  for (const term of terms) {
    if (basename.includes(term)) score += 5;
    else if (normalized.includes(term)) score += 2;
  }
  return score;
}

async function discoverWorkspaceContextPaths(issue, comments) {
  try {
    const { stdout } = await execFileAsync('git', ['ls-files', '-z'], { cwd: repositoryRoot, maxBuffer: 4 * 1024 * 1024 });
    const terms = objectiveTerms(issue, comments);
    return stdout
      .split('\0')
      .map(value => value.trim())
      .filter(Boolean)
      .filter(isSafeContextPath)
      .map(filePath => ({ filePath, score: rankContextPath(filePath, terms) }))
      .sort((a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath))
      .slice(0, MAX_CONTEXT_EXCERPTS)
      .map(item => item.filePath);
  } catch (error) {
    console.warn(`[CONTEXT] git ls-files fallback unavailable: ${error?.message || String(error)}`);
    return [];
  }
}

async function readWorkspaceExcerpt(filePath) {
  try {
    const absolutePath = path.resolve(repositoryRoot, filePath);
    const relativePath = path.relative(repositoryRoot, absolutePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return '';
    const content = await fs.readFile(absolutePath, 'utf8');
    if (content.includes('\0')) return '';
    return content.slice(0, MAX_EXCERPT_CHARS);
  } catch {
    return '';
  }
}

async function collectDeterministicContext(issue, comments, resolution) {
  const workingAgreement = (await readRepoFile('AGENTS.md')).slice(0, 14000);
  let filePaths = explicitRepoPaths(issue, comments);
  let contextSource = 'explicit references';

  if (!filePaths || filePaths.length === 0 || (filePaths.length === 1 && filePaths[0].trim() === '(none)')) {
    console.log('[CONTEXT] No explicit references found. Invoking git ls-files tree fallback...');
    filePaths = await discoverWorkspaceContextPaths(issue, comments);
    contextSource = 'ranked checked-out workspace fallback';
  }

  const excerpts = [];
  for (const filePath of filePaths.slice(0, MAX_CONTEXT_EXCERPTS)) {
    const content = contextSource === 'explicit references' ? await readRepoFile(filePath) : await readWorkspaceExcerpt(filePath);
    if (content) excerpts.push(`FILE: ${filePath}\n${content.slice(0, MAX_EXCERPT_CHARS)}`);
  }

  const repositoryFiles = excerpts.length > 0 ? excerpts.join('\n\n---\n\n') : '(No repository source files available in current workspace)';
  const prContext = resolution?.pr
    ? `DETERMINISTIC PR EVIDENCE (${resolution.resolved_via}):\n${JSON.stringify(resolution.pr, null, 2)}`
    : `DETERMINISTIC PR EVIDENCE:\n${resolution?.required ? '(required but unresolved)' : '(not required for this stage)'}`;
  return `REPOSITORY WORKING AGREEMENT:\n${workingAgreement || '(not available)'}\n\n${prContext}\n\nREPOSITORY FILE CONTEXT (${contextSource}; max ${MAX_CONTEXT_EXCERPTS} excerpts):\n${repositoryFiles}`;
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

async function routeMissingEvidence(issue, resolution) {
  const body = `**BLOCKER: Runtime Evidence Resolver**\n\nWHO: Runtime / Nomy\nWHAT: Required PR evidence could not be resolved.\nWHERE: Issue #${issue.number}.\nWHY: ${resolution.reason}\nHOW: Event payload, durable state history, explicit PR references, issue association, and runtime branch mapping were checked deterministically.\n\n**Next handoff:** Nomy\n\nNo Siea action is required.`;
  await gh(`/issues/${issue.number}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
  const fresh = await gh(`/issues/${issue.number}`);
  const preserved = labelNames(fresh).filter(name => !name.startsWith('agent:') && !name.startsWith('status:') && name !== 'needs:siea');
  await gh(`/issues/${issue.number}`, { method: 'PATCH', body: JSON.stringify({ labels: [...preserved, 'agent:nomy', 'status:blocked'] }) });
}

const agents = JSON.parse(await fs.readFile(new URL('./agents.json', import.meta.url), 'utf8'));
const issue = await gh(`/issues/${issueNumber}`);
const comments = await gh(`/issues/${issueNumber}/comments?per_page=100`);
const agentKey = parseAgentFromIssue(issue, requestedAgent);
const agent = agents[agentKey];
if (!agent) throw new Error(`Unknown or missing agent: ${agentKey || '(none)'}`);

const state = loadState(issue, agentKey);
const eventPayload = await readEventPayload();
const evidenceResolution = await resolveRequiredEvidence({ state, issue, comments, eventPayload, github: gh });

if (evidenceResolution.routeToCoordinator) {
  await routeMissingEvidence(issue, evidenceResolution);
  console.log(JSON.stringify({ issue: issueNumber, agent: agentKey, stage: state.current_stage, status: 'blocked', next_agent: 'nomy', requires_human: false, pull_request: null, evidence_resolution: 'UNRESOLVED' }));
  process.exit(0);
}

await persistEvidence(state, evidenceResolution);
const repositoryContext = await collectDeterministicContext(issue, comments, evidenceResolution);
const canExecute = executionApproved(issue, agentKey, labelNames);

const operationsRules = `
MSH agent-operations rules:
- Stay inside the objective and stated scope in the GitHub issue.
- Treat wake payloads as signals, not task memory. Durable state and deterministic GitHub evidence are authoritative.
- Do not widen product scope without a Product decision from Nomy.
- Do not place private member data or credentials into issue comments or implementation payloads.
- Never claim code changes, tests, CI, or external actions unless the supplied evidence demonstrates them.
- Choose next_agent only when a real handoff is ready. Valid agents: ${Object.keys(agents).join(', ')}.
- Use requires_human only for a decision, credential/access grant, explicit approval, or physical-device check that automation cannot perform.
- Engineering execution is permitted only to Selah when execution:approved is present.
- Automated engineering must create a PR and must not merge its own work.
`;

const executionInstructions = canExecute ? `
EXECUTION MODE IS APPROVED FOR THIS SELAH RUN.
Return implementation only when the supplied deterministic context is sufficient for a scoped change.
Implementation files must be complete UTF-8 replacements. Protected runtime paths remain unavailable to ordinary autonomous engineering.
` : `
EXECUTION MODE IS NOT APPROVED FOR THIS RUN.
Return implementation=null. Do not claim code was changed.
`;

const transcript = comments.slice(-12).map(comment => `${comment.user?.login || 'unknown'}: ${comment.body || ''}`).join('\n\n');
const prompt = `
You are ${agent.name}, MSH ${agent.role}.
Mission: ${agent.mission}
Normal handoff: ${agent.handoff}
${operationsRules}
${executionInstructions}

Original objective — GitHub task #${issue.number}: ${issue.title}\n${issue.body || ''}

Current durable stage: ${state.current_stage}

Recent bounded task conversation:\n${transcript || '(none)'}

${repositoryContext}

Return one concise operational result for this bounded turn.
`;

const schema = {
  type: 'object', additionalProperties: false,
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
          type: 'object', additionalProperties: false,
          properties: {
            summary: { type: 'string' },
            files: {
              type: 'array', minItems: 1, maxItems: 8,
              items: {
                type: 'object', additionalProperties: false,
                properties: { path: { type: 'string' }, content: { type: 'string' } },
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
  headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model, input: prompt, reasoning: { effort: 'medium' }, text: { format: { type: 'json_schema', name: 'msh_agent_result', strict: true, schema } } })
});
if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
const payload = await response.json();
const text = extractOutputText(payload);
if (!text) throw new Error('OpenAI response contained no output text.');
const result = JSON.parse(text);

let implementationEvidence = null;
if (result.implementation) {
  if (agentKey !== 'selah') throw new Error('Only Selah may return implementation payloads.');
  implementationEvidence = await applyImplementation({ issue, result, github: gh, labelNames });
  result.status = 'review_requested';
  result.next_agent = null;
  result.requires_human = false;
  result.human_request = null;
}

const prefix = result.status === 'blocked' ? 'BLOCKER' : result.status === 'review_requested' ? 'REVIEW REQUEST' : result.status === 'changes_requested' ? 'REVIEW RESULT' : result.status === 'ready_for_product' ? 'HANDOFF' : 'STATUS';
let comment = `**${prefix}: ${agent.name}**\n\n${result.message}`;
if (evidenceResolution.pr) comment += `\n\n**Deterministic evidence:** PR #${evidenceResolution.pr.pr_number}, head \`${evidenceResolution.pr.head_sha}\`, resolved via ${evidenceResolution.resolved_via}.`;
if (implementationEvidence) comment += `\n\n**Implementation evidence:** PR #${implementationEvidence.prNumber} ${implementationEvidence.prUrl}\n\nBranch: \`${implementationEvidence.branch}\`\n\nChanged-file summary:\n\`\`\`\n${implementationEvidence.diff}\n\`\`\``;
if (result.requires_human && result.human_request) comment += `\n\n**SIEA CHECK:** ${result.human_request}`;
if (result.next_agent) comment += `\n\n**Next handoff:** ${agents[result.next_agent].name}`;
await gh(`/issues/${issueNumber}/comments`, { method: 'POST', body: JSON.stringify({ body: comment }) });

for (const key of Object.keys(agents)) await ensureLabel(`agent:${key}`, '5B6F63');
for (const status of ['in_progress', 'blocked', 'review_requested', 'changes_requested', 'ready_for_product', 'completed']) await ensureLabel(`status:${status}`, 'D8D4C4');
await ensureLabel('needs:siea', 'B65C4A');
await ensureLabel('execution:approved', '6F42C1');

const freshIssue = await gh(`/issues/${issueNumber}`);
const preserved = labelNames(freshIssue).filter(name => !name.startsWith('agent:') && !name.startsWith('status:') && name !== 'needs:siea');
const nextLabels = [...preserved, `status:${result.status}`];
if (result.next_agent) nextLabels.push(`agent:${result.next_agent}`);
if (result.requires_human) nextLabels.push('needs:siea');
await gh(`/issues/${issueNumber}`, { method: 'PATCH', body: JSON.stringify({ labels: nextLabels }) });

console.log(JSON.stringify({
  issue: issueNumber,
  agent: agentKey,
  stage: state.current_stage,
  status: result.status,
  next_agent: result.next_agent,
  requires_human: result.requires_human,
  execution_approved: canExecute,
  pull_request: evidenceResolution.pr?.pr_number || implementationEvidence?.prNumber || null,
  evidence_resolution: evidenceResolution.resolved_via
}));