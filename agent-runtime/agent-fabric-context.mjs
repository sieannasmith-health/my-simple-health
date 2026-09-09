import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const DEFAULT_CONTEXT_PATH = new URL('../msh-context/current-state.json', import.meta.url);

export async function loadDurableContext(path = DEFAULT_CONTEXT_PATH) {
  const raw = await readFile(path, 'utf8');
  const context = JSON.parse(raw);
  if (context?.schema_version !== '1.0') throw new Error('Unsupported MSH durable context schema version.');
  if (!context?.current_product_objective?.id) throw new Error('MSH durable context is missing the current product objective.');
  return context;
}

export function buildEventEnvelope({
  objective,
  actor,
  owner,
  targetAgent,
  allowedAgents,
  allowedTools = [],
  executionApproved = false,
  correlationId = randomUUID(),
  causationId = null,
  ttlMinutes = 10,
  maxHops = 5,
  remainingSteps = 12,
  evidence = [],
  humanGate = null,
  provenance = []
}) {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + ttlMinutes * 60_000);
  return {
    schema_version: '1.0',
    event_id: randomUUID(),
    correlation_id: correlationId,
    causation_id: causationId,
    created_at: createdAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    objective,
    actor,
    owner,
    target_agent: targetAgent,
    state: { status: 'pending', hop_count: 0, max_hops: maxHops, remaining_steps: remainingSteps },
    authority: { allowed_agents: allowedAgents, allowed_tools: allowedTools, execution_approved: executionApproved },
    evidence,
    human_gate: humanGate,
    provenance
  };
}

export function enforceFabricGuards(envelope, now = new Date()) {
  const failures = [];
  if (envelope?.schema_version !== '1.0') failures.push('unsupported_schema_version');
  if (!envelope?.event_id || !envelope?.correlation_id) failures.push('missing_trace_identity');
  if (!envelope?.objective?.id || !envelope?.objective?.summary) failures.push('missing_objective');
  if (!envelope?.actor?.type || !envelope?.actor?.id) failures.push('missing_actor_identity');
  if (!envelope?.target_agent) failures.push('missing_target_agent');
  if (!Array.isArray(envelope?.authority?.allowed_agents) || !envelope.authority.allowed_agents.includes(envelope.target_agent)) failures.push('target_agent_not_allowed');
  if (!Number.isInteger(envelope?.state?.hop_count) || !Number.isInteger(envelope?.state?.max_hops) || envelope.state.hop_count > envelope.state.max_hops) failures.push('hop_limit_exceeded');
  if (!Number.isInteger(envelope?.state?.remaining_steps) || envelope.state.remaining_steps <= 0) failures.push('execution_budget_exhausted');
  const expiry = Date.parse(envelope?.expires_at || '');
  if (!Number.isFinite(expiry) || expiry <= now.getTime()) failures.push('event_expired');
  return { allowed: failures.length === 0, failures };
}

export function hydrateAgentContext({ durableContext, envelope, issueContext = '' }) {
  const objective = durableContext.current_product_objective;
  const invariants = durableContext.architectural_invariants || [];
  return [
    'MSH AGENT FABRIC v1 — DURABLE CONTEXT',
    `Current Product objective: ${objective.title} (${objective.status})`,
    objective.summary,
    '',
    'Authority / operating invariants:',
    ...invariants.map(item => `- ${item}`),
    '',
    `Event correlation: ${envelope.correlation_id}`,
    `Accountable owner: ${envelope.owner}`,
    `Target agent: ${envelope.target_agent}`,
    `Execution budget remaining: ${envelope.state.remaining_steps}`,
    '',
    issueContext ? `ACTIVE GITHUB CONTEXT\n${issueContext}` : ''
  ].filter(Boolean).join('\n');
}

export function nextHop(envelope, { targetAgent, causationId = envelope.event_id } = {}) {
  const next = structuredClone(envelope);
  next.event_id = randomUUID();
  next.causation_id = causationId;
  next.target_agent = targetAgent || envelope.target_agent;
  next.state.hop_count += 1;
  next.state.remaining_steps -= 1;
  return next;
}
