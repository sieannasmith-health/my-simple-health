const EXECUTION_APPROVAL_REQUIRED = 'EXECUTION_APPROVAL_REQUIRED';
const HUMAN_APPROVAL_REQUIRED = 'HUMAN_APPROVAL_REQUIRED';

export const RuntimeReasonCode = Object.freeze({
  EXECUTION_APPROVAL_REQUIRED,
  HUMAN_APPROVAL_REQUIRED
});

function reasonCodeFromResult(result) {
  if (typeof result === 'string') return result;
  return result && typeof result.reason_code === 'string' ? result.reason_code : null;
}

/**
 * Missing execution authority is a Product coordination gate. This decision
 * intentionally consumes only the structured worker result; comment wording
 * is presentation and must never influence routing.
 */
export function isExecutionApprovalCoordinationGate(labels, structuredResult = null) {
  const names = Array.isArray(labels) ? labels.filter(Boolean) : [];
  const reasonCode = reasonCodeFromResult(structuredResult);

  return !names.includes('execution:approved')
    && names.includes('status:blocked')
    && reasonCode === EXECUTION_APPROVAL_REQUIRED;
}

export function isHumanApprovalRequired(structuredResult = null) {
  return reasonCodeFromResult(structuredResult) === HUMAN_APPROVAL_REQUIRED;
}

export function reasonCodeOf(structuredResult = null) {
  return reasonCodeFromResult(structuredResult);
}
