const NODE_TYPES = new Set(['objective','agent','decision','artifact','pull_request','test','deployment','blocker','human_gate','evidence']);

export function projectKnowledgeGraph(events, generatedAt = new Date().toISOString()) {
  const nodes = new Map();
  const edges = new Map();

  const ensureNode = (id, type, label = id, provenance = []) => {
    if (!id || !NODE_TYPES.has(type)) return;
    const current = nodes.get(id);
    nodes.set(id, {
      id,
      type,
      label: current?.label || label,
      status: current?.status ?? null,
      properties: current?.properties || {},
      provenance: [...new Set([...(current?.provenance || []), ...provenance])]
    });
  };

  const addEdge = (from, to, type, sourceId, properties = {}) => {
    if (!from || !to || !type) return;
    const key = `${from}|${type}|${to}`;
    const current = edges.get(key);
    edges.set(key, {
      from,
      to,
      type,
      properties: { ...(current?.properties || {}), ...properties },
      provenance: [...new Set([...(current?.provenance || []), sourceId].filter(Boolean))]
    });
  };

  for (const event of events) {
    const sourceId = event?.provenance?.source_id || event?.event_id;
    const subject = event?.subject;
    if (!subject?.id || !subject?.type) continue;
    ensureNode(subject.id, subject.type, event?.payload?.label || subject.id, [sourceId]);

    if (event.objective_id && subject.id !== event.objective_id) {
      ensureNode(event.objective_id, 'objective', event.objective_id, [sourceId]);
    }
    if (event.from_agent) ensureNode(event.from_agent, 'agent', event.from_agent, [sourceId]);
    if (event.to_agent) ensureNode(event.to_agent, 'agent', event.to_agent, [sourceId]);

    if (event.event_type === 'objective.created' && event.actor) {
      ensureNode(event.actor, 'agent', event.actor, [sourceId]);
      addEdge(subject.id, event.actor, 'OWNS', sourceId);
    }
    if (event.event_type === 'assignment.changed' && event.to_agent) {
      addEdge(event.objective_id || subject.id, event.to_agent, 'ASSIGNED_TO', sourceId);
    }
    if (event.event_type === 'handoff.executed' && event.from_agent && event.to_agent) {
      addEdge(event.from_agent, event.to_agent, 'HANDED_OFF_TO', sourceId, { objective_id: event.objective_id || null });
    }
    if (event.relation && event.payload?.related_id) {
      const relatedType = event.payload.related_type || 'artifact';
      ensureNode(event.payload.related_id, relatedType, event.payload.related_label || event.payload.related_id, [sourceId]);
      addEdge(subject.id, event.payload.related_id, event.relation, sourceId);
    }
  }

  return {
    generated_at: generatedAt,
    nodes: [...nodes.values()].sort((a,b) => a.id.localeCompare(b.id)),
    edges: [...edges.values()].sort((a,b) => `${a.from}|${a.type}|${a.to}`.localeCompare(`${b.from}|${b.type}|${b.to}`))
  };
}

export function neighborhood(graph, nodeId, depth = 1) {
  const seen = new Set([nodeId]);
  let frontier = new Set([nodeId]);
  for (let i = 0; i < depth; i += 1) {
    const next = new Set();
    for (const edge of graph.edges || []) {
      if (frontier.has(edge.from) && !seen.has(edge.to)) next.add(edge.to);
      if (frontier.has(edge.to) && !seen.has(edge.from)) next.add(edge.from);
    }
    for (const id of next) seen.add(id);
    frontier = next;
  }
  return {
    nodes: (graph.nodes || []).filter(node => seen.has(node.id)),
    edges: (graph.edges || []).filter(edge => seen.has(edge.from) && seen.has(edge.to))
  };
}
