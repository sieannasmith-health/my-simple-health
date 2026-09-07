import assert from 'node:assert/strict';
import {
  isExecutionApprovalCoordinationGate,
  isHumanApprovalRequired,
  RuntimeReasonCode
} from '../orchestration-policy.mjs';

for (const wording of [
  'Execution is not approved for this run.',
  'The bounded worker cannot continue yet.',
  'Please coordinate the authorization before dispatch.',
  'No additional details are available.'
]) {
  assert.equal(
    isExecutionApprovalCoordinationGate(
      ['status:blocked', 'needs:siea'],
      { reason_code: RuntimeReasonCode.EXECUTION_APPROVAL_REQUIRED, message: wording }
    ),
    true,
    `arbitrary presentation wording must not change structured routing: ${wording}`
  );
}

assert.equal(
  isExecutionApprovalCoordinationGate(
    ['status:blocked', 'needs:siea'],
    { reason_code: RuntimeReasonCode.EXECUTION_APPROVAL_REQUIRED, message: 'anything' }
  ),
  true
);

assert.equal(
  isExecutionApprovalCoordinationGate(
    ['status:blocked', 'needs:siea', 'execution:approved'],
    { reason_code: RuntimeReasonCode.EXECUTION_APPROVAL_REQUIRED, message: 'anything' }
  ),
  false,
  'explicit execution approval must never be normalized away'
);

assert.equal(
  isExecutionApprovalCoordinationGate(
    ['status:blocked', 'needs:siea'],
    { reason_code: RuntimeReasonCode.HUMAN_APPROVAL_REQUIRED, message: 'physical device check' }
  ),
  false,
  'genuine human-only gates remain Siea escalations'
);
assert.equal(
  isHumanApprovalRequired({ reason_code: RuntimeReasonCode.HUMAN_APPROVAL_REQUIRED }),
  true
);

console.log('structured orchestration policy tests passed');
