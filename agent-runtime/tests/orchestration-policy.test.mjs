import assert from 'node:assert/strict';
import { isExecutionApprovalCoordinationGate } from '../orchestration-policy.mjs';

assert.equal(
  isExecutionApprovalCoordinationGate(
    ['status:blocked', 'needs:siea'],
    'Execution is not approved for this run. SIEA CHECK: Approve an execution run.'
  ),
  true,
  'missing execution approval must route to Product coordination, not Siea'
);

assert.equal(
  isExecutionApprovalCoordinationGate(
    ['status:blocked', 'needs:siea', 'execution:approved'],
    'Execution is not approved for this run.'
  ),
  false,
  'an explicit execution approval must never be normalized away'
);

assert.equal(
  isExecutionApprovalCoordinationGate(
    ['status:blocked', 'needs:siea'],
    'A physical-device permission must be granted on the iPhone.'
  ),
  false,
  'real human-only gates must remain Siea escalations'
);

assert.equal(
  isExecutionApprovalCoordinationGate(
    ['status:blocked'],
    'Execution is not approved for this run.'
  ),
  false,
  'normalization only applies after a false needs:siea escalation was actually produced'
);

console.log('orchestration policy tests passed');
