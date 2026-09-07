export function historyAfterLatestMaintenanceGrant(history) {
  const entries = Array.isArray(history) ? history : [];
  let latestGrantIndex = -1;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index]?.event === 'RUNTIME_MAINTENANCE_GRANTED') {
      latestGrantIndex = index;
      break;
    }
  }
  return latestGrantIndex >= 0 ? entries.slice(latestGrantIndex + 1) : entries;
}

export function isBlockedWithoutNewEvidence(entry) {
  if (!entry || entry.event) return false;
  if (entry.status !== 'COMPLETED' || entry.result_status !== 'blocked') return false;
  return !entry.evidence;
}

function evidenceFingerprint(entry) {
  if (!entry?.evidence) return null;
  const evidence = entry.evidence;
  return JSON.stringify({
    pr_number: evidence.pr_number ?? null,
    head_sha: evidence.head_sha ?? null,
    combined_status: evidence.combined_status ?? null,
    resolved_via: evidence.resolved_via ?? null,
    changed_files: Array.isArray(evidence.changed_files) ? evidence.changed_files : null
  });
}

function isNonProgressTurn(entry) {
  if (!entry || entry.event || entry.status !== 'COMPLETED') return false;
  return entry.result_status === 'blocked' || entry.result_status === 'in_progress';
}

export function hasLivelock(state, blockedTurnLimit = 3) {
  if (state?.maintenance_grant && !state.maintenance_grant.consumed_at) return false;
  const scoped = historyAfterLatestMaintenanceGrant(state?.history);
  const turns = scoped.filter(entry => !entry?.event);
  if (turns.length < blockedTurnLimit) return false;

  const window = turns.slice(-blockedTurnLimit);
  if (window.every(isBlockedWithoutNewEvidence)) return true;

  if (!window.every(isNonProgressTurn)) return false;
  if (!window.some(entry => entry.result_status === 'blocked')) return false;

  const fingerprints = window.map(evidenceFingerprint);
  if (fingerprints.some(fingerprint => !fingerprint)) return false;
  return new Set(fingerprints).size === 1;
}
