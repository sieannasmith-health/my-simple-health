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
  true,
  'missing execution approval must be intercepted before a false needs:siea escalation is persisted'
);

assert.equal(
  isExecutionApprovalCoordinationGate(
    ['status:blocked'],
    'Execution is not approved for this run, so the lifecycle canary cannot be executed. Apply the objective-level execution:approved authorization, then route the bounded canary to Selah.'
  ),
  true,
  'Nomy canary blocker wording must remain a Product coordination gate'
);

assert.equal(
  isExecutionApprovalCoordinationGate(
    ['status:blocked'],
    'Lifecycle canary remains blocked because the objective-level `execution:approved` authorization is absent.'
  ),
  true,
  'authorization-is-absent wording must remain a Product coordination gate'
);

console.log('orchestration policy tests passed');
