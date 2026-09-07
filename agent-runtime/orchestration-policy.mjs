export const RuntimeReasonCode = Object.freeze({
  NONE: 'NONE',
  EXECUTION_APPROVAL_REQUIRED: 'EXECUTION_APPROVAL_REQUIRED',
  HUMAN_APPROVAL_REQUIRED: 'HUMAN_APPROVAL_REQUIRED'
});

export function isExecutionApprovalCoordinationGate(labels, reasonCode) {
  const names = Array.isArray(labels) ? labels.filter(Boolean) : [];
  return names.includes('status:blocked')
    && reasonCode === RuntimeReasonCode.EXECUTION_APPROVAL_REQUIRED
    && !names.includes('execution:approved');
}

export function isHumanApprovalGate(reasonCode) {
  return reasonCode === RuntimeReasonCode.HUMAN_APPROVAL_REQUIRED;
}

export function parseStructuredResult(comment = '') {
  const match = String(comment).match(/<!--\\s*MSH_RESULT\\s+({[\\s\\S]*?})\\s*-->/i);
  if (!match) return null;
  try {
    const value = JSON.parse(match[1]);
    return typeof value?.reason_code === 'string' ? value : null;
  } catch {
    return null;
  }
}
