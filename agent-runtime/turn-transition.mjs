import { resolveAgentEdge } from './agent-graph.mjs';

const SIEA_REASON_CODES = new Set([
  'PHYSICAL_DEVICE_ACTION',
  'ACCOUNT_OWNER_ACTION',
  'EXTERNAL_CREDENTIAL_ACTION',
  'IRREVERSIBLE_OWNER_APPROVAL'
]);

function stageForAgent(agent, fallback) {
  if (agent === 'tessa') return 'QA';
  if (agent === 'selah') return 'IMPLEMENTATION';
  if (agent === 'nomy') return 'PRODUCT_COORDINATION';
  return fallback || 'INITIAL_TRIAGE';
}

export function deriveTransitionFromResult(result, state) {
  if (!result || typeof result.status !== 'string') {
    throw new Error('Missing trusted structured worker result for reconciliation.');
  }

  // Authority routing is based exclusively on machine-readable reason codes.
  // Human-readable messages and a generic requires_human flag are never
  // sufficient to create a Siea-only pause.
  const reasonCode = typeof result.reason_code === 'string' ? result.reason_code : null;

  if (reasonCode === 'EXECUTION_APPROVAL_REQUIRED') {
    return {
      runtimeStatus: 'PENDING',
      assignedAgent: 'nomy',
      nextStage: 'PRODUCT_COORDINATION',
      publicStatus: 'blocked',
      needsHuman: false,
      humanGate: null
    };
  }

  if (SIEA_REASON_CODES.has(reasonCode)) {
    const resumeAgent = result.next_agent || state.assigned_agent || 'nomy';
    return {
      runtimeStatus: 'PAUSED_FOR_SIEA',
      assignedAgent: null,
      nextStage: state.current_stage,
      publicStatus: result.status === 'completed' ? 'blocked' : result.status,
      needsHuman: true,
      humanGate: {
        assignee: 'siea',
        type: 'EXPLICIT_SIEA_REQUEST',
        reason_code: reasonCode,
        action: result.human_request || result.message || 'Siea action required by structured worker result.',
        requested_at: new Date().toISOString(),
        resume_agent: resumeAgent,
        resume_stage: stageForAgent(resumeAgent, state.current_stage)
      }
    };
  }

  // Agent-to-agent routing is control-plane behavior. The graph resolver uses
  // only structured fields and intentionally ignores conversational prose.
  const edge = resolveAgentEdge(result, state);

  // Completing one bounded agent turn does not complete the objective when a
  // graph edge exists. Keep the objective PENDING so the reconciler can
  // immediately ignite the evaluator for the destination node.
  if (edge.toAgent) {
    return {
      runtimeStatus: 'PENDING',
      assignedAgent: edge.toAgent,
      nextStage: stageForAgent(edge.toAgent, state.current_stage),
      publicStatus: result.status,
      needsHuman: false,
      humanGate: null,
      graphTransition: {
        from: edge.fromAgent,
        to: edge.toAgent,
        source: edge.source
      }
    };
  }

  if (edge.terminalCandidate || result.status === 'completed') {
    return {
      runtimeStatus: 'COMPLETED',
      assignedAgent: null,
      nextStage: state.current_stage,
      publicStatus: 'completed',
      needsHuman: false,
      humanGate: null,
      graphTransition: null
    };
  }

  // Nonterminal work with no next graph node remains with its current owner.
  return {
    runtimeStatus: 'PENDING',
    assignedAgent: state.assigned_agent,
    nextStage: stageForAgent(state.assigned_agent, state.current_stage),
    publicStatus: result.status,
    needsHuman: false,
    humanGate: null,
    graphTransition: null
  };
}
