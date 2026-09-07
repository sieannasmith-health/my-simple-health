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
const START = '<!-- MSH_STATE_LOCK -->';
const END = '<!-- MSH_STATE_LOCK_END -->';
const execFileAsync = promisify(execFile);
const root = path.resolve(process.env.GITHUB_WORKSPACE || process.cwd());
const MAX_FILES = 8;
const MAX_EXCERPT = 7000;
const SAFE_EXTENSIONS = new Set(['.md', '.mjs', '.js', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.yml', '.yaml', '.sh', '.py', '.swift', '.kt', '.java', '.rb', '.go', '.rs', '.sql', '.html', '.css', '.scss', '.txt']);
const EXCLUDED = [/(^|\\/)\\.env(?:\\.|$)/i, /(^|\\/)(?:secrets?|credentials?)(?:\\/|\\.|$)/i, /\\.(?:pem|p12|pfx|key|der|cer|crt)$/i, /(^|\\/)(?:node_modules|Pods|build|dist)(\\/|$)/i];
if (!githubToken || !openaiKey || !repository || !issueNumber) throw new Error('Missing required runtime environment.');
const [owner, repo] = repository.split('/');
const api = `https://api.github.com/repos/${owner}/${repo}`;
const headers = { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' };
async function gh(pathname, options = {}) { const response = await fetch(`${api}${pathname}`, { ...options, headers: { ...headers, ...(options.headers || {}) } }); if (!response.ok) throw new Error(`GitHub ${response.status}: ${await response.text()}`); return response.status === 204 ? null : response.json(); }
const labels = issue => (issue.labels || []).map(x => typeof x === 'string' ? x : x.name).filter(Boolean);
function escape(value) { return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'); }
function parseState(body = '') { const match = body.match(new RegExp(`${escape(START)}\\s*\\`\\`\\`json\\s*([\\s\\S]*?)\\s*\\`\\`\\`\\s*${escape(END)}`)); try { return match ? JSON.parse(match[1]) : null; } catch { return null; } }
function stateBlock(state) { return `${START}\\n\\`\\`\\`json\\n${JSON.stringify(state, null, 2)}\\n\\`\\`\\`\\n${END}`; }
function agentFor(issue) { if (requestedAgent) return requestedAgent; return labels(issue).find(x => x.startsWith('agent:'))?.slice(6).toLowerCase() || 'nomy'; }
function safe(file) { const normalized = file.replaceAll('\\\\', '/'); return !EXCLUDED.some(pattern => pattern.test(normalized)) && SAFE_EXTENSIONS.has(path.posix.extname(normalized).toLowerCase()); }
async function workspaceFile(file) { try { const absolute = path.resolve(root, file); if (path.relative(root, absolute).startsWith('..')) return ''; return (await fs.readFile(absolute, 'utf8')).slice(0, MAX_EXCERPT); } catch { return ''; } }
async function context(issue, comments, state) {
  const grant = state?.maintenance_grant;
  const granted = grant?.reason_code === 'RUNTIME_MAINTENANCE_APPROVED' && !grant.consumed_at ? [...new Set(grant.allowed_paths || [])].filter(safe) : [];
  let paths = granted;
  if (!paths.length) { try { const { stdout } = await execFileAsync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 4 * 1024 * 1024 }); paths = stdout.split('\\0').filter(Boolean).filter(safe).slice(0, MAX_FILES); } catch { paths = []; } }
  const files = []; for (const file of paths) { const content = await workspaceFile(file); if (content) files.push(`FILE: ${file}\\n${content}`); }
  return files.join('\\n\\n---\\n\\n') || '(No repository source files available in current workspace)';
}
function outputText(payload) { if (typeof payload.output_text === 'string') return payload.output_text; return (payload.output || []).flatMap(x => x.type === 'message' ? (x.content || []) : []).find(x => x.type === 'output_text')?.text || ''; }
const agents = JSON.parse(await fs.readFile(new URL('./agents.json', import.meta.url), 'utf8'));
const issue = await gh(`/issues/${issueNumber}`);
const comments = await gh(`/issues/${issueNumber}/comments?per_page=100`);
const agentKey = agentFor(issue);
if (!agents[agentKey]) throw new Error(`Unknown agent: ${agentKey}`);
const state = parseState(issue.body || '') || { version: 1, current_stage: 'INITIAL_TRIAGE', assigned_agent: agentKey, status: 'PENDING', history: [], execution: null };
const evidence = await resolveRequiredEvidence({ state, issue, comments, eventPayload: {}, github: gh });
const maintenance = state.maintenance_grant?.allowed_paths || [];
const prompt = `You are ${agents[agentKey].name}, MSH ${agents[agentKey].role}.\\nMission: ${agents[agentKey].mission}\\nReturn one concise operational result for issue #${issueNumber}.\\nExecution is ${executionApproved(issue, agentKey, labels) ? 'approved' : 'not approved'}.\\nThe implementation payload must contain complete UTF-8 replacements only for authorized files.\\nAllowed maintenance paths: ${maintenance.join(', ') || '(none)'}\\nObjective: ${issue.title}\\n${issue.body || ''}\\nRecent comments:\\n${comments.slice(-12).map(c => `${c.user?.login || 'unknown'}: ${c.body || ''}`).join('\\n\\n')}\\nRepository context:\\n${await context(issue, comments, state)}`;
const reasonCodes = ['NONE', 'EXECUTION_APPROVAL_REQUIRED', 'HUMAN_APPROVAL_REQUIRED'];
const schema = { type: 'object', additionalProperties: false, properties: { status: { type: 'string', enum: ['in_progress', 'blocked', 'review_requested', 'changes_requested', 'ready_for_product', 'completed'] }, reason_code: { type: 'string', enum: reasonCodes }, message: { type: 'string' }, next_agent: { anyOf: [{ type: 'string', enum: Object.keys(agents) }, { type: 'null' }] }, requires_human: { type: 'boolean' }, human_request: { anyOf: [{ type: 'string' }, { type: 'null' }] }, implementation: { anyOf: [{ type: 'null' }, { type: 'object', additionalProperties: false, properties: { summary: { type: 'string' }, files: { type: 'array', minItems: 1, maxItems: MAX_FILES, items: { type: 'object', additionalProperties: false, properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } }, required: ['summary', 'files'] }] } }, required: ['status', 'reason_code', 'message', 'next_agent', 'requires_human', 'human_request', 'implementation'] };
const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, input: prompt, reasoning: { effort: 'medium' }, text: { format: { type: 'json_schema', name: 'msh_agent_result', strict: true, schema } } }) });
if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
const result = JSON.parse(outputText(await response.json()));
if (result.implementation) { if (agentKey !== 'selah') throw new Error('Only Selah may return implementation payloads.'); await applyImplementation({ issue, state, result, github: gh, labelNames: labels }); result.status = 'review_requested'; result.next_agent = null; result.requires_human = false; result.human_request = null; }
const reason = result.reason_code || 'NONE';
const marker = `<!-- MSH_RESULT ${JSON.stringify({ reason_code: reason })} -->`;
let body = `${marker}\\n\\n**${result.status === 'blocked' ? 'BLOCKER' : result.status === 'review_requested' ? 'REVIEW REQUEST' : 'STATUS'}: ${agents[agentKey].name}**\\n\\n${result.message}`;
if (result.requires_human && result.human_request) body += `\\n\\n**SIEA CHECK:** ${result.human_request}`;
await gh(`/issues/${issueNumber}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
for (const key of Object.keys(agents)) await gh(`/labels`, { method: 'POST', body: JSON.stringify({ name: `agent:${key}`, color: '5B6F63' }) }).catch(() => {});
const fresh = await gh(`/issues/${issueNumber}`);
const preserved = labels(fresh).filter(x => !x.startsWith('agent:') && !x.startsWith('status:') && x !== 'needs:siea');
const next = [...preserved, `status:${result.status}`]; if (result.next_agent) next.push(`agent:${result.next_agent}`); if (result.requires_human) next.push('needs:siea');
await gh(`/issues/${issueNumber}/labels`, { method: 'PUT', body: JSON.stringify({ labels: [...new Set(next)] }) });
console.log(JSON.stringify({ issue: issueNumber, agent: agentKey, status: result.status, reason_code: reason, next_agent: result.next_agent }));
