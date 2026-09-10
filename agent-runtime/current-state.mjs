import { projectKnowledgeGraph, neighborhood } from './knowledge-graph.mjs';

function eventsFromState(state = {}) {
  const events = [];
  for (const entry of Array.isArray(state.history) ? state.history : []) {
    if (entry?.knowledge_event) events.push(entry.knowledge_event);
  }
  if (state.last_knowledge_event && !events.some(event => event.event_id === state.last_knowledge_event.event_id)) {
    events.push(state.last_knowledge_event);
  }
  return events;
}

export function currentStateSnapshot(state = {}, generatedAt = new Date().toISOString()) {
  const events = eventsFromState(state);
  const graph = projectKnowledgeGraph(events, generatedAt);
  const objectiveId = state.objective_id || state.objective?.id || `issue:${state.issue_number || 'unknown'}`;
  return {
    generated_at: generatedAt,
    objective: {
      id: objectiveId,
      status: state.status || null,
      stage: state.current_stage || null,
      assigned_agent: state.assigned_agent || null,
      human_gate: state.human_gate || null,
      retry_count: state.retry_count ?? 0,
      sequence_version: state.sequence_version ?? 0
    },
    latest_transition: state.last_graph_transition || null,
    latest_event: state.last_knowledge_event || null,
    event_count: events.length,
    graph,
    objective_context: graph.nodes.some(node => node.id === objectiveId)
      ? neighborhood(graph, objectiveId, 2)
      : { nodes: [], edges: [] }
  };
}

export function answerProjectStatus(state = {}, generatedAt = new Date().toISOString()) {
  const snapshot = currentStateSnapshot(state, generatedAt);
  const objective = snapshot.objective;
  return {
    question: 'Where are we in the project now?',
    answer: {
      status: objective.status,
      current_stage: objective.stage,
      current_owner: objective.assigned_agent,
      needs_siea: Boolean(objective.human_gate),
      human_gate: objective.human_gate,
      latest_transition: snapshot.latest_transition,
      evidence_event_id: snapshot.latest_event?.event_id || null,
      event_count: snapshot.event_count
    },
    provenance: snapshot.latest_event?.provenance || null,
    snapshot
  };
}
