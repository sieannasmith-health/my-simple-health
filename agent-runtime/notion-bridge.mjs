import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const DEFAULT_MODEL = 'gpt-5.6-luna';

export function parseAgentTarget(text, agents) {
  const value = String(text || '').trim();
  const explicit = value.match(/^@?([A-Za-z][A-Za-z0-9_-]*)\s*:/);
  if (explicit) {
    const key = explicit[1].toLowerCase();
    if (agents[key]) return key;
  }
  return 'nomy';
}

export function verifyNotionSignature(rawBody, signature, verificationToken) {
  if (!verificationToken || !signature) return false;
  const expected = `sha256=${crypto.createHmac('sha256', verificationToken).update(rawBody).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function extractPlainText(comment) {
  return (comment?.rich_text || []).map(part => part?.plain_text || part?.text?.content || '').join('').trim();
}

export function isIntegrationAuthored(comment, integrationUserId) {
  return Boolean(integrationUserId && comment?.created_by?.id === integrationUserId);
}

export async function loadAgents() {
  return JSON.parse(await fs.readFile(new URL('./agents.json', import.meta.url), 'utf8'));
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  for (const item of payload?.output || []) {
    if (item?.type !== 'message') continue;
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return '';
}

export async function runAgent({ agentKey, message, taskContext = '', agents, openaiKey, model = DEFAULT_MODEL }) {
  const agent = agents[agentKey] || agents.nomy;
  const prompt = `You are ${agent.name}, MSH ${agent.role}.\nMission: ${agent.mission}\nNormal handoff: ${agent.handoff}\n\nYou are replying inside an internal MSH Notion task discussion. Stay inside the task scope. Do not expose secrets, credentials, private founder chat, member health data, or member financial data. If the request needs a different specialist, say which MSH agent should own the next step. Never claim an external action occurred unless the supplied context demonstrates it.\n\nTask context:\n${taskContext || '(not available)'}\n\nHuman message:\n${message}\n\nReply concisely as ${agent.name}.`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: prompt, reasoning: { effort: 'medium' } })
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  const output = extractOutputText(await response.json()).trim();
  if (!output) throw new Error('OpenAI response contained no output text.');
  return `${agent.name}: ${output}`;
}
