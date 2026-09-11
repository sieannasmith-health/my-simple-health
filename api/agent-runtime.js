import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const MAX_PROMPT_CHARS = 5000;
const MAX_OUTPUT_TOKENS = 1200;

let registryPromise;

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

  return { ok: true, key, agent, prompt, correlationId };
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
  const instructions = [
    `You are ${validated.agent.name}, My Simple Health ${validated.agent.role}.`,
    `Mission: ${validated.agent.mission}`,
    `Normal handoff: ${validated.agent.handoff}`,
    'This is a bounded Slack collaboration turn inside the governed MSH runtime.',
    'Answer only the user request. Do not mutate GitHub, deploy code, alter durable product state, or claim external actions occurred.',
    'Do not request or expose credentials, secrets, PHI, or private member health data.',
    'Preserve MSH product scope and defer cross-functional scope decisions to Nomy.',
    'Return concise conversational text suitable for a Slack thread reply.'
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
      input: validated.prompt,
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
