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

export function hasLivelock(state, blockedTurnLimit = 3) {
  if (state?.maintenance_grant && !state.maintenance_grant.consumed_at) return false;
  const scoped = historyAfterLatestMaintenanceGrant(state?.history);
  const turns = scoped.filter(entry => !entry?.event);
  if (turns.length < blockedTurnLimit) return false;
  return turns.slice(-blockedTurnLimit).every(isBlockedWithoutNewEvidence);
}
