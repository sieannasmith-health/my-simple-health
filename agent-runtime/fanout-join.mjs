const DEFAULT_JOIN_AGENT = 'nomy';

function uniqAgents(values = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(value => String(value || '').trim().toLowerCase())
    .filter(Boolean))];
}

export function requestedFanout(result = {}, currentAgent = null) {
  const nextAgents = uniqAgents(result.next_agents).filter(agent => agent !== currentAgent);
  if (nextAgents.length < 2) return null;
  return {
    join_agent: String(result.join_agent || DEFAULT_JOIN_AGENT).trim().toLowerCase() || DEFAULT_JOIN_AGENT,
    pending: nextAgents,
    completed: [],
    active_agent: null,
    started_at: null,
    joined_at: null
  };
}

export function startFanout(fanout, at = new Date().toISOString()) {
  if (!fanout || fanout.pending.length === 0) return null;
  const [activeAgent, ...rest] = fanout.pending;
  return { ...fanout, pending: rest, active_agent: activeAgent, started_at: fanout.started_at || at };
}

export function advanceFanout(fanout, finishedAgent, at = new Date().toISOString()) {
  if (!fanout) return null;
  const completed = uniqAgents([...(fanout.completed || []), finishedAgent]);
  if ((fanout.pending || []).length > 0) {
    const [activeAgent, ...rest] = fanout.pending;
    return { fanout: { ...fanout, pending: rest, completed, active_agent: activeAgent }, next_agent: activeAgent, joined: false };
  }
  return {
    fanout: { ...fanout, pending: [], completed, active_agent: null, joined_at: at },
    next_agent: fanout.join_agent || DEFAULT_JOIN_AGENT,
    joined: true
  };
}
