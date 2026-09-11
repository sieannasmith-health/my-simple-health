import test from 'node:test';
import assert from 'node:assert/strict';
import { bearerToken, collectProjectContext, collectThreadContext, validateRuntimeInput, runGovernedAgent } from '../api/agent-runtime.js';

const env = {
  MSH_GOVERNED_RUNTIME_TOKEN: 'test-token',
  OPENAI_API_KEY: 'test-key',
  MSH_AGENT_MODEL: 'test-model',
  MSH_GITHUB_REPOSITORY: 'test/repo',
  SLACK_BOT_TOKEN: 'xoxb-test',
  MSH_SLACK_ALLOWED_USERS: 'U_SIEA,U_BRANDON'
};
const input = {
  correlation_id: 'evt-1',
  agent_key: 'iris',
  agent: 'Iris',
  role: 'Research & Insights',
  mission: 'Own member and stakeholder research, comprehension, usability, mixed-method evidence, and interpretation of why people behave as they do.',
  prompt: 'Give me a one-sentence test response.',
  channel: 'C1',
  thread: '123.456',
  governed: true,
  source: 'slack'
};

const okJson = (value) => ({ ok: true, async json() { return value; }, async text() { return JSON.stringify(value); } });

function contextualFetch(capture = {}) {
  return async (url, init = {}) => {
    const target = String(url);
    if (target.includes('/issues?')) {
      return okJson([{ number: 401, state: 'open', title: 'Roadmap sequencing and release gates', labels: [{ name: 'product' }], updated_at: '2026-09-11T23:00:00Z', body: '' }]);
    }
    if (target.includes('/pulls?')) {
      return okJson([{ number: 402, state: 'open', title: 'Runtime context acquisition', updated_at: '2026-09-11T23:05:00Z', merged_at: null }]);
    }
    if (target.includes('slack.com/api/conversations.replies')) {
      return okJson({ ok: true, messages: [
        { user: 'U_SIEA', text: 'Iris: review the current research plan' },
        { bot_id: 'B1', text: 'Iris replied with the first finding.' },
        { user: 'U_SIEA', text: 'What changed since then?' }
      ] });
    }
    if (target === 'https://api.openai.com/v1/responses') {
      capture.request = { url: target, init, body: JSON.parse(init.body) };
      return okJson({ output_text: 'Bridge is live with context.' });
    }
    throw new Error(`unexpected_url:${target}`);
  };
}

test('extracts bearer token', () => {
  assert.equal(bearerToken({ authorization: 'Bearer abc123' }), 'abc123');
  assert.equal(bearerToken({ authorization: 'Basic abc123' }), '');
});

test('validates canonical agent identity and governed Slack source', async () => {
  const result = await validateRuntimeInput(input, env);
  assert.equal(result.ok, true);
  assert.equal(result.agent.name, 'Iris');
  assert.equal(result.channel, 'C1');
  assert.equal(result.thread, '123.456');
});

test('rejects unknown agent and identity drift', async () => {
  assert.equal((await validateRuntimeInput({ ...input, agent_key: 'unknown' }, env)).error, 'unknown_agent');
  assert.equal((await validateRuntimeInput({ ...input, role: 'Wrong role' }, env)).error, 'agent_role_mismatch');
  assert.equal((await validateRuntimeInput({ ...input, governed: false }, env)).error, 'ungoverned_source');
});

test('fails closed when runtime token is not configured', async () => {
  const result = await validateRuntimeInput(input, { ...env, MSH_GOVERNED_RUNTIME_TOKEN: '' });
  assert.equal(result.status, 503);
  assert.equal(result.error, 'runtime_token_not_configured');
});

test('retrieves bounded authoritative GitHub project context', async () => {
  const validated = await validateRuntimeInput(input, { ...env, MSH_GITHUB_REPOSITORY: 'context/repo' });
  const context = await collectProjectContext(validated, { ...env, MSH_GITHUB_REPOSITORY: 'context/repo' }, contextualFetch());
  assert.equal(context.available, true);
  assert.match(context.text, /#401 \| open \| Roadmap sequencing and release gates/);
  assert.match(context.text, /PR #402 \| open \| Runtime context acquisition/);
});

test('retrieves only bounded originating Slack thread context', async () => {
  const validated = await validateRuntimeInput(input, env);
  const context = await collectThreadContext(validated, env, contextualFetch());
  assert.equal(context.available, true);
  assert.match(context.text, /Human: Iris: review the current research plan/);
  assert.match(context.text, /MSH agent: Iris replied with the first finding/);
});

test('runs model with governed project and thread context', async () => {
  const capture = {};
  const fetchImpl = contextualFetch(capture);
  const validated = await validateRuntimeInput(input, env);
  const text = await runGovernedAgent(validated, env, fetchImpl);
  assert.equal(text, 'Bridge is live with context.');
  assert.equal(capture.request.url, 'https://api.openai.com/v1/responses');
  assert.equal(capture.request.body.model, 'test-model');
  assert.match(capture.request.body.input, /<authoritative_project_state>/);
  assert.match(capture.request.body.input, /Roadmap sequencing and release gates/);
  assert.match(capture.request.body.input, /<bounded_slack_thread>/);
  assert.match(capture.request.body.input, /What changed since then\?/);
  assert.match(capture.request.body.input, /Give me a one-sentence test response\./);
  assert.match(capture.request.body.instructions, /Do not invent project status/);
});

test('context outages degrade explicitly but model provider failures remain fail-closed', async () => {
  const fetchImpl = async (url) => {
    if (String(url) === 'https://api.openai.com/v1/responses') return { ok: false, status: 500, async text() { return 'down'; } };
    return { ok: false, status: 503, async json() { return {}; }, async text() { return 'unavailable'; } };
  };
  const validated = await validateRuntimeInput(input, { ...env, MSH_GITHUB_REPOSITORY: 'failure/repo' });
  await assert.rejects(() => runGovernedAgent(validated, { ...env, MSH_GITHUB_REPOSITORY: 'failure/repo' }, fetchImpl), /model_provider_500/);
});
