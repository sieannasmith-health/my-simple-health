import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const MAX_PROMPT_CHARS = 5000;
const MAX_OUTPUT_TOKENS = 1200;
const MAX_THREAD_MESSAGES = 12;
const MAX_THREAD_CHARS = 6500;
const MAX_PROJECT_CONTEXT_CHARS = 12000;
const PROJECT_CACHE_MS = 30_000;
const DEFAULT_REPOSITORY = 'sieannasmith-health/my-simple-health';

let registryPromise;
let projectSnapshotCache = { key: null, at: 0, value: null };

async function registry() {
  if (!registryPromise) {
    registryPromise = fs.readFile(new URL('../agent-runtime/agents.json', import.meta.url), 'utf8')
      .then((text) => JSON.parse(text));
  }
  return registryPromise;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

export function bearerToken(headers = {}) {
  const value = String(headers.authorization || headers.Authorization || '');
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

function boundedString(value, max) {
  const text = String(value || '').trim();
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;
}

function csvSet(value) {
  return new Set(String(value || '').split(',').map((item) => item.trim()).filter(Boolean));
}

function tokens(value) {
  return new Set(String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9#_-]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3));
}

function stateLockSummary(body) {
  const text = String(body || '');
  const marker = text.indexOf('<!-- MSH_STATE_LOCK -->');
  if (marker < 0) return null;
  const fenced = text.slice(marker).match(/```json\s*([\s\S]*?)```/i);
  if (!fenced) return null;
  try {
    const state = JSON.parse(fenced[1]);
    return {
      sequence_version: state.sequence_version ?? null,
      current_stage: state.current_stage ?? null,
      assigned_agent: state.assigned_agent ?? null,
      status: state.status ?? null
    };
  } catch {
    return null;
  }
}

function issueLine(issue) {
  const labels = (issue.labels || []).map((label) => typeof label === 'string' ? label : label?.name).filter(Boolean).slice(0, 5);
  const lock = stateLockSummary(issue.body);
  const parts = [`#${issue.number}`, issue.state, boundedString(issue.title, 180)];
  if (labels.length) parts.push(`labels=${labels.join(',')}`);
  if (lock) parts.push(`runtime=${lock.status || 'unknown'}/${lock.current_stage || 'unknown'}/${lock.assigned_agent || 'unassigned'}`);
  if (issue.updated_at) parts.push(`updated=${issue.updated_at}`);
  return parts.join(' | ');
}

function pullLine(pull) {
  const status = pull.merged_at ? 'merged' : pull.state;
  return `PR #${pull.number} | ${status} | ${boundedString(pull.title, 180)}${pull.updated_at ? ` | updated=${pull.updated_at}` : ''}`;
}

async function githubJson(url, env, fetchImpl) {
  const token = String(env.MSH_GITHUB_TOKEN || env.GITHUB_TOKEN || '');
  const response = await fetchImpl(url, {
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(token ? { authorization: `Bearer ${token}` } : {})
    }
  });
  if (!response.ok) throw new Error(`github_context_http_${response.status}`);
  return response.json();
}

async function loadProjectSnapshot(env = process.env, fetchImpl = fetch) {
  const repository = String(env.MSH_GITHUB_REPOSITORY || DEFAULT_REPOSITORY).trim();
  const now = Date.now();
  if (projectSnapshotCache.key === repository && projectSnapshotCache.value && now - projectSnapshotCache.at < PROJECT_CACHE_MS) {
    return projectSnapshotCache.value;
  }
  const encodedRepo = repository.split('/').map(encodeURIComponent).join('/');
  const [issues, pulls] = await Promise.all([
    githubJson(`https://api.github.com/repos/${encodedRepo}/issues?state=all&sort=updated&direction=desc&per_page=50`, env, fetchImpl),
    githubJson(`https://api.github.com/repos/${encodedRepo}/pulls?state=all&sort=updated&direction=desc&per_page=30`, env, fetchImpl)
  ]);
  const snapshot = {
    repository,
    issues: Array.isArray(issues) ? issues.filter((item) => !item.pull_request) : [],
    pulls: Array.isArray(pulls) ? pulls : [],
    fetched_at: new Date().toISOString()
  };
  projectSnapshotCache = { key: repository, at: now, value: snapshot };
  return snapshot;
}

function relevanceScore(item, queryTerms, agentTerms, isOpen) {
  const haystack = tokens(`${item.title || ''} ${(item.labels || []).map((label) => label?.name || label || '').join(' ')} ${item.body || ''}`);
  let score = isOpen ? 4 : 0;
  for (const term of queryTerms) if (haystack.has(term)) score += 5;
  for (const term of agentTerms) if (haystack.has(term)) score += 1;
  return score;
}

export async function collectProjectContext(validated, env = process.env, fetchImpl = fetch) {
  try {
    const snapshot = await loadProjectSnapshot(env, fetchImpl);
    const queryTerms = tokens(validated.prompt);
    const agentTerms = tokens(`${validated.agent.name} ${validated.agent.role} ${validated.agent.mission}`);
    const rankedIssues = snapshot.issues
      .map((issue, index) => ({ issue, index, score: relevanceScore(issue, queryTerms, agentTerms, issue.state === 'open') }))
      .sort((a, b) => b.score - a.score || a.index - b.index);
    const rankedPulls = snapshot.pulls
      .map((pull, index) => ({ pull, index, score: relevanceScore(pull, queryTerms, agentTerms, pull.state === 'open') }))
      .sort((a, b) => b.score - a.score || a.index - b.index);

    const selectedIssues = rankedIssues.slice(0, validated.key === 'nomy' ? 16 : 10).map(({ issue }) => issue);
    const selectedPulls = rankedPulls.slice(0, validated.key === 'nomy' ? 12 : 8).map(({ pull }) => pull);
    const lines = [
      `repository=${snapshot.repository}`,
      `snapshot_fetched_at=${snapshot.fetched_at}`,
      'Issues:',
      ...(selectedIssues.length ? selectedIssues.map(issueLine) : ['(none returned)']),
      'Pull requests:',
      ...(selectedPulls.length ? selectedPulls.map(pullLine) : ['(none returned)'])
    ];
    return { available: true, text: boundedString(lines.join('\n'), MAX_PROJECT_CONTEXT_CHARS) };
  } catch (error) {
    return { available: false, text: '', error: String(error?.message || error) };
  }
}

export async function collectThreadContext(validated, env = process.env, fetchImpl = fetch) {
  const channel = String(validated.channel || '').trim();
  const thread = String(validated.thread || '').trim();
  const token = String(env.SLACK_BOT_TOKEN || '').trim();
  if (!channel || !thread || !token) return { available: false, text: '', error: 'slack_thread_context_not_configured' };

  try {
    const params = new URLSearchParams({ channel, ts: thread, limit: '20', inclusive: 'true' });
    const response = await fetchImpl(`https://slack.com/api/conversations.replies?${params.toString()}`, {
      headers: { authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`slack_thread_http_${response.status}`);
    const body = await response.json();
    if (!body?.ok) throw new Error(`slack_thread_api_${body?.error || 'unknown'}`);

    const allowedUsers = csvSet(env.MSH_SLACK_ALLOWED_USERS);
    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter((message) => message?.bot_id || !allowedUsers.size || allowedUsers.has(message?.user))
      .slice(-MAX_THREAD_MESSAGES)
      .map((message) => {
        const speaker = message?.bot_id ? 'MSH agent' : 'Human';
        return `${speaker}: ${boundedString(message?.text, 1200)}`;
      });
    return { available: true, text: boundedString(messages.join('\n'), MAX_THREAD_CHARS) };
  } catch (error) {
    return { available: false, text: '', error: String(error?.message || error) };
  }
}

export async function collectGovernedContext(validated, env = process.env, fetchImpl = fetch) {
  const [project, thread] = await Promise.all([
    collectProjectContext(validated, env, fetchImpl),
    collectThreadContext(validated, env, fetchImpl)
  ]);
  return { project, thread };
}

export async function validateRuntimeInput(input, env = process.env) {
  const expectedToken = String(env.MSH_GOVERNED_RUNTIME_TOKEN || '');
  if (!expectedToken) return { ok: false, status: 503, error: 'runtime_token_not_configured' };

  const agents = await registry();
  const key = String(input?.agent_key || '').trim().toLowerCase();
  const agent = agents[key];
  if (!agent || key === '_organization') return { ok: false, status: 400, error: 'unknown_agent' };
  if (input?.source !== 'slack' || input?.governed !== true) return { ok: false, status: 403, error: 'ungoverned_source' };
  if (String(input?.agent || '') !== agent.name) return { ok: false, status: 400, error: 'agent_identity_mismatch' };
  if (String(input?.role || '') !== agent.role) return { ok: false, status: 400, error: 'agent_role_mismatch' };
  if (String(input?.mission || '') !== agent.mission) return { ok: false, status: 400, error: 'agent_mission_mismatch' };

  const prompt = String(input?.prompt || '').trim();
  if (!prompt || prompt.length > MAX_PROMPT_CHARS) return { ok: false, status: 400, error: 'invalid_prompt' };
  const correlationId = String(input?.correlation_id || '').trim();
  if (!correlationId) return { ok: false, status: 400, error: 'missing_correlation_id' };

  const channel = String(input?.channel || '').trim();
  const thread = String(input?.thread || '').trim();
  return { ok: true, key, agent, prompt, correlationId, channel, thread };
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text.trim();
  for (const item of payload?.output || []) {
    if (item?.type !== 'message') continue;
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text.trim();
    }
  }
  return '';
}

export async function runGovernedAgent(validated, env = process.env, fetchImpl = fetch) {
  const apiKey = String(env.OPENAI_API_KEY || '');
  if (!apiKey) throw Object.assign(new Error('openai_not_configured'), { status: 503 });

  const model = String(env.MSH_AGENT_MODEL || 'gpt-5.6-luna');
  const context = await collectGovernedContext(validated, env, fetchImpl);
  const instructions = [
    `You are ${validated.agent.name}, My Simple Health ${validated.agent.role}.`,
    `Mission: ${validated.agent.mission}`,
    `Normal handoff: ${validated.agent.handoff}`,
    'This is a bounded Slack collaboration turn inside the governed MSH runtime.',
    'Answer the user request directly using the authoritative context packet when it supports the answer.',
    'Treat GitHub project context as durable project evidence and the bounded Slack thread as conversational continuity.',
    'Do not invent project status, roadmap decisions, completed work, blockers, or prior conversation details that are not supported by the context packet.',
    'If authoritative context is unavailable or insufficient for a project-state claim, say what is missing rather than asking the founder to paste information that the runtime should normally retrieve.',
    'Do not mutate GitHub, deploy code, alter durable product state, or claim external actions occurred.',
    'Do not request or expose credentials, secrets, PHI, or private member health data.',
    'Preserve MSH product scope and defer cross-functional scope decisions to Nomy.',
    'Return concise conversational text suitable for a Slack thread reply.'
  ].join('\n');

  const input = [
    '<msh_context>',
    '<authoritative_project_state>',
    context.project.available ? context.project.text : `UNAVAILABLE: ${boundedString(context.project.error, 240)}`,
    '</authoritative_project_state>',
    '<bounded_slack_thread>',
    context.thread.available ? context.thread.text : `UNAVAILABLE: ${boundedString(context.thread.error, 240)}`,
    '</bounded_slack_thread>',
    '</msh_context>',
    '<user_request>',
    validated.prompt,
    '</user_request>'
  ].join('\n');

  const response = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model,
      instructions,
      input,
      max_output_tokens: MAX_OUTPUT_TOKENS
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = new Error(`model_provider_${response.status}${body ? `:${body.slice(0, 200)}` : ''}`);
    error.status = response.status >= 500 || response.status === 429 ? 503 : 502;
    throw error;
  }

  const text = extractOutputText(await response.json());
  if (!text) throw Object.assign(new Error('empty_runtime_response'), { status: 502 });
  return text;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const expected = String(process.env.MSH_GOVERNED_RUNTIME_TOKEN || '');
  if (!expected) return res.status(503).json({ error: 'runtime_token_not_configured' });
  if (!safeEqual(bearerToken(req.headers), expected)) return res.status(401).json({ error: 'unauthorized' });

  const validated = await validateRuntimeInput(req.body, process.env);
  if (!validated.ok) return res.status(validated.status).json({ error: validated.error });

  try {
    const response = await runGovernedAgent(validated, process.env);
    return res.status(200).json({ response, correlation_id: validated.correlationId, agent: validated.agent.name });
  } catch (error) {
    console.error(JSON.stringify({ event: 'governed_runtime_failure', correlation_id: validated.correlationId, agent: validated.agent.name, error: String(error?.message || error) }));
    return res.status(Number(error?.status) || 502).json({ error: 'runtime_failure' });
  }
}
