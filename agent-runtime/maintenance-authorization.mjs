import path from 'node:path';

export const RUNTIME_MAINTENANCE_REASON = 'RUNTIME_MAINTENANCE_APPROVED';
export const RUNTIME_MAINTENANCE_COMMAND = '/approve-maintenance';
export const PROTECTED_RUNTIME_PREFIXES = ['agent-runtime/', '.github/workflows/'];
const FORBIDDEN_NAMES = new Set(['.env', '.npmrc', '.pypirc']);

export function normalizeMaintenancePath(filePath) {
  return path.posix.normalize(String(filePath || '')).replace(/^\.\//, '');
}

export function isPermanentlyForbiddenMaintenancePath(filePath) {
  const normalized = normalizeMaintenancePath(filePath);
  const basename = path.posix.basename(normalized);
  return FORBIDDEN_NAMES.has(basename)
    || /(^|\/)(?:secrets?|credentials?|keys?)(\/|$)/i.test(normalized)
    || /\.(?:pem|p12|pfx|key|der|cer|crt)$/i.test(normalized)
    || /secret|credential|token/i.test(basename);
}

export function isProtectedRuntimePath(filePath) {
  const normalized = normalizeMaintenancePath(filePath);
  return PROTECTED_RUNTIME_PREFIXES.some(prefix => normalized.startsWith(prefix));
}

export function parseMaintenanceApprovalCommand(commentBody) {
  const line = String(commentBody || '').trim();
  if (!line.startsWith(`${RUNTIME_MAINTENANCE_COMMAND} `)) return null;
  const tokens = line.slice(RUNTIME_MAINTENANCE_COMMAND.length).trim().split(/\s+/).filter(Boolean);
  const allowedPaths = [...new Set(tokens.map(normalizeMaintenancePath))];
  if (allowedPaths.length < 1 || allowedPaths.length > 8) return null;
  if (allowedPaths.some(filePath => !filePath || filePath.startsWith('../') || path.posix.isAbsolute(filePath))) return null;
  if (allowedPaths.some(isPermanentlyForbiddenMaintenancePath)) return null;
  if (allowedPaths.some(filePath => !isProtectedRuntimePath(filePath))) return null;
  return allowedPaths;
}

export function createMaintenanceGrant({ issueNumber, approvedBy, allowedPaths, approvedAt, sourceCommentId }) {
  const normalizedPaths = [...new Set((allowedPaths || []).map(normalizeMaintenancePath))];
  if (normalizedPaths.length < 1 || normalizedPaths.length > 8) throw new Error('Maintenance grant requires 1-8 exact protected paths.');
  if (normalizedPaths.some(filePath => !isProtectedRuntimePath(filePath) || isPermanentlyForbiddenMaintenancePath(filePath))) {
    throw new Error('Maintenance grant contains an invalid or permanently forbidden path.');
  }
  return {
    grant_id: `runtime-maintenance:${issueNumber}:${sourceCommentId}`,
    reason_code: RUNTIME_MAINTENANCE_REASON,
    issue_number: Number(issueNumber),
    approved_by: String(approvedBy),
    approved_at: approvedAt || new Date().toISOString(),
    source_comment_id: Number(sourceCommentId),
    allowed_paths: normalizedPaths,
    consumed_at: null
  };
}

export function authorizeMaintenanceFromEvent({ eventName, payload, repositoryOwner, issueNumber, state, now = new Date().toISOString() }) {
  if (eventName !== 'issue_comment') return { state, authorized: false, matchedCommand: false };

  const commentBody = String(payload?.comment?.body || '');
  const allowedPaths = parseMaintenanceApprovalCommand(commentBody);
  if (!allowedPaths) return { state, authorized: false, matchedCommand: false };

  const senderLogin = String(payload?.sender?.login || '').toLowerCase();
  const ownerLogin = String(repositoryOwner || '').toLowerCase();
  if (!senderLogin || !ownerLogin || senderLogin !== ownerLogin) {
    return { state, authorized: false, matchedCommand: true };
  }

  const commentId = Number(payload?.comment?.id || 0);
  if (!commentId) return { state, authorized: false, matchedCommand: true };

  const grant = createMaintenanceGrant({
    issueNumber,
    approvedBy: payload.sender.login,
    allowedPaths,
    approvedAt: payload?.comment?.created_at || now,
    sourceCommentId: commentId
  });

  const nextState = {
    ...state,
    status: 'PENDING',
    current_stage: 'IMPLEMENTATION',
    assigned_agent: 'selah',
    execution: null,
    human_gate: null,
    maintenance_grant: grant,
    history: [...(Array.isArray(state?.history) ? state.history : []), {
      at: now,
      event: 'RUNTIME_MAINTENANCE_GRANTED',
      grant_id: grant.grant_id,
      approved_by: grant.approved_by,
      allowed_paths: grant.allowed_paths
    }].slice(-20)
  };

  return { state: nextState, authorized: true, matchedCommand: true, grant };
}

export function maintenanceGrantAllowsPath({ state, issueNumber, filePath }) {
  const normalized = normalizeMaintenancePath(filePath);
  if (!isProtectedRuntimePath(normalized)) return true;
  const grant = state?.maintenance_grant;
  if (!grant || grant.reason_code !== RUNTIME_MAINTENANCE_REASON) return false;
  if (grant.consumed_at) return false;
  if (Number(grant.issue_number) !== Number(issueNumber)) return false;
  if (!Array.isArray(grant.allowed_paths)) return false;
  return grant.allowed_paths.includes(normalized);
}

export function drainMaintenanceGrant(state, { at = new Date().toISOString(), outcome = 'turn_closed' } = {}) {
  const grant = state?.maintenance_grant;
  if (!grant) return state;
  return {
    ...state,
    maintenance_grant: null,
    history: [...(Array.isArray(state.history) ? state.history : []), {
      at,
      event: 'RUNTIME_MAINTENANCE_GRANT_DRAINED',
      grant_id: grant.grant_id,
      outcome
    }].slice(-20)
  };
}
