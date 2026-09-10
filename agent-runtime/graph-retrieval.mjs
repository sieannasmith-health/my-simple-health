import { neighborhood } from './knowledge-graph.mjs';

function tokens(value = '') {
  return new Set(String(value).toLowerCase().match(/[a-z0-9_:#.-]+/g) || []);
}
function overlap(a, b) {
  let score = 0;
  for (const token of a) if (b.has(token)) score += 1;
  return score;
}
function nodeText(node) {
  return [node.id, node.type, node.label, node.status, JSON.stringify(node.properties || {})].filter(Boolean).join(' ');
}

export function retrieveGraphContext(graph = { nodes: [], edges: [] }, query = '', options = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit || 5), 20));
  const depth = Math.max(0, Math.min(Number(options.depth ?? 2), 4));
  const queryTokens = tokens(query);
  const ranked = (graph.nodes || [])
    .map(node => ({ node, score: overlap(queryTokens, tokens(nodeText(node))) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.node.id.localeCompare(b.node.id))
    .slice(0, limit);

  const selected = new Set();
  const provenance = new Set();
  for (const { node } of ranked) {
    const local = depth > 0 ? neighborhood(graph, node.id, depth) : { nodes: [node], edges: [] };
    for (const item of local.nodes) {
      selected.add(item.id);
      for (const source of item.provenance || []) provenance.add(source);
    }
    for (const edge of local.edges) for (const source of edge.provenance || []) provenance.add(source);
  }

  return {
    query,
    mode: 'local_graph',
    ranked_matches: ranked.map(({ node, score }) => ({ id: node.id, type: node.type, label: node.label, score })),
    context: {
      nodes: (graph.nodes || []).filter(node => selected.has(node.id)),
      edges: (graph.edges || []).filter(edge => selected.has(edge.from) && selected.has(edge.to))
    },
    provenance: [...provenance].sort()
  };
}

export function rejectStaleContext({ canonical, candidate } = {}) {
  const canonicalSequence = Number(canonical?.objective?.sequence_version ?? -1);
  const candidateSequence = Number(candidate?.objective?.sequence_version ?? -1);
  if (candidateSequence < canonicalSequence) return { accepted: false, reason: 'STALE_SEQUENCE' };
  const canonicalGenerated = Date.parse(canonical?.generated_at || 0);
  const candidateGenerated = Date.parse(candidate?.generated_at || 0);
  if (Number.isFinite(canonicalGenerated) && Number.isFinite(candidateGenerated) && candidateGenerated < canonicalGenerated) {
    return { accepted: false, reason: 'STALE_GENERATION' };
  }
  return { accepted: true, reason: 'CURRENT' };
}
