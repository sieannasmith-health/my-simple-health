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
