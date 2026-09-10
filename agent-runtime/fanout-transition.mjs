import { graphForAgent } from './agent-graph.mjs';
import { requestedFanout, startFanout, advanceFanout } from './fanout-join.mjs';

export function stageForAgent(agent, fallback = 'INITIAL_TRIAGE') {
  if (agent === 'tessa') return 'QA';
  if (agent === 'selah') return 'IMPLEMENTATION';
  if (agent === 'nomy') return 'PRODUCT_COORDINATION';
  return fallback;
}

export function resolveFanoutTransition(result, state, at = new Date().toISOString()) {
  const currentAgent = state?.assigned_agent || null;

  if (state?.fanout?.active_agent && state.fanout.active_agent === currentAgent && result?.status === 'completed') {
    const advanced = advanceFanout(state.fanout, currentAgent, at);
    return {
      handled: true,
      fanout: advanced.fanout,
      transition: {
        runtimeStatus: 'PENDING',
        assignedAgent: advanced.next_agent,
        nextStage: stageForAgent(advanced.next_agent, state.current_stage),
        publicStatus: advanced.joined ? 'in_progress' : 'in_progress',
        needsHuman: false,
        humanGate: null,
        graphTransition: {
          from: currentAgent,
          to: advanced.next_agent,
          source: advanced.joined ? 'fanout_join' : 'fanout_sequence'
        }
      }
    };
  }

  const requested = requestedFanout(result, currentAgent);
  if (!requested) return { handled: false, fanout: state?.fanout || null, transition: null };

  const allowed = new Set(graphForAgent(currentAgent));
  const unauthorized = requested.pending.filter(agent => !allowed.has(agent));
  if (unauthorized.length > 0) {
    throw new Error(`Fan-out contains disallowed destinations from ${currentAgent}: ${unauthorized.join(', ')}`);
  }
  if (!allowed.has(requested.join_agent) && requested.join_agent !== currentAgent) {
    throw new Error(`Fan-out join destination is not authorized from ${currentAgent}: ${requested.join_agent}`);
  }

  const started = startFanout(requested, at);
  return {
    handled: true,
    fanout: started,
    transition: {
      runtimeStatus: 'PENDING',
      assignedAgent: started.active_agent,
      nextStage: stageForAgent(started.active_agent, state?.current_stage),
      publicStatus: 'in_progress',
      needsHuman: false,
      humanGate: null,
      graphTransition: {
        from: currentAgent,
        to: started.active_agent,
        source: 'fanout_start'
      }
    }
  };
}
