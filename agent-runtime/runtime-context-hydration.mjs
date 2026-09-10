import { currentStateSnapshot } from './current-state.mjs';
import { retrieveGraphContext, rejectStaleContext } from './graph-retrieval.mjs';

function objectiveQuery({ issue = {}, state = {}, agentKey = '' } = {}) {
  return [
    issue.title || '',
    `issue:${issue.number || state.issue_number || ''}`,
    state.objective_id || state.objective?.id || '',
    state.current_stage || '',
    state.assigned_agent || agentKey || '',
    agentKey || ''
  ].filter(Boolean).join(' ');
}

export function hydrateRuntimeContext({ issue = {}, state = {}, agentKey = '', candidateSnapshot = null, generatedAt = new Date().toISOString() } = {}) {
  const canonical = currentStateSnapshot({
    ...state,
    issue_number: issue.number || state.issue_number,
    objective_id: state.objective_id || state.objective?.id || `github-issue-${issue.number || state.issue_number || 'unknown'}`
  }, generatedAt);

  if (candidateSnapshot) {
    const freshness = rejectStaleContext({ canonical, candidate: candidateSnapshot });
    if (!freshness.accepted) {
      return {
        canonical,
        retrieval: retrieveGraphContext(canonical.graph, objectiveQuery({ issue, state, agentKey }), { limit: 8, depth: 2 }),
        candidate: null,
        candidate_freshness: freshness
      };
    }
  }

  return {
    canonical,
    retrieval: retrieveGraphContext(canonical.graph, objectiveQuery({ issue, state, agentKey }), { limit: 8, depth: 2 }),
    candidate: candidateSnapshot,
    candidate_freshness: candidateSnapshot ? { accepted: true, reason: 'CURRENT' } : null
  };
}

export function renderRuntimeContextHydration(hydrated = {}) {
  const snapshot = hydrated.canonical || {};
  const retrieval = hydrated.retrieval || { ranked_matches: [], context: { nodes: [], edges: [] }, provenance: [] };
  return [
    'CURRENT DURABLE PROJECT STATE:',
    JSON.stringify(snapshot.objective || {}, null, 2),
    '',
    'GRAPH-RETRIEVED CURRENT CONTEXT:',
    JSON.stringify({
      ranked_matches: retrieval.ranked_matches || [],
      nodes: retrieval.context?.nodes || [],
      edges: retrieval.context?.edges || [],
      provenance: retrieval.provenance || [],
      candidate_freshness: hydrated.candidate_freshness || null
    }, null, 2)
  ].join('\n');
}
