import { createHash } from 'node:crypto';

function stableId(parts) {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24);
}

export function runtimeTransitionEvent({ issueNumber, state, transition, result, occurredAt, runId, repository }) {
  const fromAgent = state.assigned_agent || null;
  const toAgent = transition.assignedAgent || null;
  const objectiveId = String(state.objective_id || `github-issue-${issueNumber}`);
  const eventType = transition.needsHuman
    ? 'human_gate.requested'
    : (toAgent && toAgent !== fromAgent ? 'handoff.executed' : 'objective.updated');
  const sourceId = `github:${repository}:issue:${issueNumber}:run:${runId || 'unknown'}:${state.sequence_version || 0}`;

  return {
    event_id: `evt_${stableId([sourceId, eventType, fromAgent || '', toAgent || '', occurredAt])}`,
    event_type: eventType,
    occurred_at: occurredAt,
    actor: fromAgent || 'agent_runtime',
    subject: { type: 'objective', id: objectiveId },
    objective_id: objectiveId,
    from_agent: fromAgent,
    to_agent: toAgent,
    relation: eventType === 'handoff.executed' ? 'HANDED_OFF_TO' : null,
    payload: {
      runtime_status: transition.runtimeStatus,
      public_status: transition.publicStatus,
      stage: transition.nextStage,
      reason_code: result?.reason_code || null,
      graph_transition: transition.graphTransition || null
    },
    provenance: {
      source: 'agent_runtime',
      source_id: sourceId,
      source_url: `https://github.com/${repository}/issues/${issueNumber}`,
      commit_sha: process.env.GITHUB_SHA || null
    },
    correlation_id: objectiveId,
    causation_id: runId ? String(runId) : null
  };
}
