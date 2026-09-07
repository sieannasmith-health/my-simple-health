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

  if (result.requires_human) {
    return {
      runtimeStatus: 'HUMAN_APPROVAL_REQUIRED',
      assignedAgent: 'human',
      nextStage: state.current_stage,
      publicStatus: result.status === 'completed' ? 'blocked' : result.status,
      needsHuman: true
    };
  }

  if (result.status === 'completed') {
    return {
      runtimeStatus: 'COMPLETED',
      assignedAgent: null,
      nextStage: state.current_stage,
      publicStatus: 'completed',
      needsHuman: false
    };
  }

  let assignedAgent = result.next_agent || null;
  if (!assignedAgent && result.status === 'review_requested') assignedAgent = 'tessa';
  if (!assignedAgent && result.status === 'ready_for_product') assignedAgent = 'nomy';
  if (!assignedAgent && result.status === 'blocked') assignedAgent = 'nomy';
  if (!assignedAgent) assignedAgent = state.assigned_agent;

  return {
    runtimeStatus: 'PENDING',
    assignedAgent,
    nextStage: stageForAgent(assignedAgent, state.current_stage),
    publicStatus: result.status,
    needsHuman: false
  };
}
