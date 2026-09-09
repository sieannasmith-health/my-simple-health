const GRAPH = Object.freeze({
  nomy: Object.freeze(['mira', 'iris', 'ellis', 'reese', 'genesis', 'selah', 'tessa']),
  mira: Object.freeze(['nomy']),
  iris: Object.freeze(['nomy']),
  ellis: Object.freeze(['nomy']),
  reese: Object.freeze(['nomy']),
  genesis: Object.freeze(['nomy']),
  selah: Object.freeze(['tessa', 'nomy']),
  tessa: Object.freeze(['selah', 'nomy'])
});

export class AgentGraphTransitionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'AgentGraphTransitionError';
    this.details = details;
  }
}

export function graphForAgent(agent) {
  return GRAPH[agent] || Object.freeze([]);
}

export function isAllowedEdge(fromAgent, toAgent) {
  if (!fromAgent || !toAgent) return false;
  return graphForAgent(fromAgent).includes(toAgent);
}

export function defaultNextAgent(result, state) {
  if (result?.next_agent) return result.next_agent;
  if (result?.status === 'review_requested') return 'tessa';
  if (result?.status === 'changes_requested' && state?.assigned_agent === 'tessa') return 'selah';
  if (result?.status === 'ready_for_product') return 'nomy';
  if (result?.status === 'blocked') return 'nomy';
  return null;
}

/**
 * Resolve an agent-to-agent transition as control-plane state, never from
 * conversational prose. Human-readable `message` is intentionally ignored.
 */
export function resolveAgentEdge(result, state) {
  const fromAgent = state?.assigned_agent || null;
  const requestedNextAgent = defaultNextAgent(result, state);

  if (!requestedNextAgent) {
    return {
      fromAgent,
      toAgent: null,
      terminalCandidate: result?.status === 'completed',
      source: 'none'
    };
  }

  if (requestedNextAgent === fromAgent) {
    throw new AgentGraphTransitionError('Self-handoff is not allowed in MSH Agent Graph v1.', {
      fromAgent,
      toAgent: requestedNextAgent
    });
  }

  if (!isAllowedEdge(fromAgent, requestedNextAgent)) {
    throw new AgentGraphTransitionError(`Disallowed agent graph edge: ${fromAgent || '(none)'} -> ${requestedNextAgent}.`, {
      fromAgent,
      toAgent: requestedNextAgent,
      allowed: graphForAgent(fromAgent)
    });
  }

  return {
    fromAgent,
    toAgent: requestedNextAgent,
    terminalCandidate: false,
    source: result?.next_agent ? 'explicit' : 'status_default'
  };
}

export function graphSnapshot() {
  return Object.fromEntries(Object.entries(GRAPH).map(([agent, edges]) => [agent, [...edges]]));
}
