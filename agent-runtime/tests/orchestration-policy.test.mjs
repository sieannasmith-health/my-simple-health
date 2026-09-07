import assert from 'node:assert/strict';
import { isExecutionApprovalCoordinationGate, parseStructuredResult, RuntimeReasonCode } from '../orchestration-policy.mjs';

for (const wording of [
  'Execution authority is unavailable.',
  'The worker cannot continue yet.',
  'Please coordinate authorization with Product.',
  'This run is waiting on its safety gate.'
]) {
  assert.equal(
    isExecutionApprovalCoordinationGate(['status:blocked'], RuntimeReasonCode.EXECUTION_APPROVAL_REQUIRED),
    true,
    wording
  );
}

assert.equal(
  isExecutionApprovalCoordinationGate(['status:blocked', 'execution:approved'], RuntimeReasonCode.EXECUTION_APPROVAL_REQUIRED),
  false
);
assert.equal(
  isExecutionApprovalCoordinationGate(['status:blocked'], RuntimeReasonCode.HUMAN_APPROVAL_REQUIRED),
  false,
  'human-only gates must not be converted into Product execution coordination'
);
assert.equal(
  parseStructuredResult('arbitrary prose <!-- MSH_RESULT {"reason_code":"EXECUTION_APPROVAL_REQUIRED"} -->')?.reason_code,
  RuntimeReasonCode.EXECUTION_APPROVAL_REQUIRED
);
assert.equal(parseStructuredResult('Execution is not approved.'), null);
console.log('orchestration policy tests passed');
