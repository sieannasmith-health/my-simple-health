import test from 'node:test';
import assert from 'node:assert/strict';
import { bearerToken, validateRuntimeInput, runGovernedAgent } from '../api/agent-runtime.js';

const env = { MSH_GOVERNED_RUNTIME_TOKEN: 'test-token', OPENAI_API_KEY: 'test-key', MSH_AGENT_MODEL: 'test-model' };
const input = {
  correlation_id: 'evt-1',
  agent_key: 'iris',
  agent: 'Iris',
  role: 'Research & Insights',
  mission: 'Own member and stakeholder research, comprehension, usability, mixed-method evidence, and interpretation of why people behave as they do.',
  prompt: 'Give me a one-sentence test response.',
  governed: true,
  source: 'slack'
};

test('extracts bearer token', () => {
  assert.equal(bearerToken({ authorization: 'Bearer abc123' }), 'abc123');
  assert.equal(bearerToken({ authorization: 'Basic abc123' }), '');
});

test('validates canonical agent identity and governed Slack source', async () => {
  const result = await validateRuntimeInput(input, env);
  assert.equal(result.ok, true);
  assert.equal(result.agent.name, 'Iris');
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

test('runs model only inside governed runtime and returns text', async () => {
  let request;
  const fetchImpl = async (url, init) => {
    request = { url, init, body: JSON.parse(init.body) };
    return { ok: true, async json() { return { output_text: 'Bridge is live.' }; } };
  };
  const validated = await validateRuntimeInput(input, env);
  const text = await runGovernedAgent(validated, env, fetchImpl);
  assert.equal(text, 'Bridge is live.');
  assert.equal(request.url, 'https://api.openai.com/v1/responses');
  assert.equal(request.body.model, 'test-model');
  assert.equal(request.body.input, input.prompt);
  assert.match(request.body.instructions, /bounded Slack collaboration turn/);
});

test('provider failures are fail-closed', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, async text() { return 'down'; } });
  const validated = await validateRuntimeInput(input, env);
  await assert.rejects(() => runGovernedAgent(validated, env, fetchImpl), /model_provider_500/);
});
