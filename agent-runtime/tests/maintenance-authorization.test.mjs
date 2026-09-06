import assert from 'node:assert/strict';
import {
  authorizeMaintenanceFromEvent,
  createMaintenanceGrant,
  drainMaintenanceGrant
} from '../maintenance-authorization.mjs';
import { validateImplementationFiles } from '../engineering-execution.mjs';
import { clearMaintenanceGrant } from '../maintenance-cleanup.mjs';

const issueNumber = 195;
const protectedFile = 'agent-runtime/engineering-execution.mjs';
const workflowFile = '.github/workflows/msh-agent-runtime.yml';

const baseState = {
  version: 1,
  current_stage: 'IMPLEMENTATION',
  assigned_agent: 'human',
  status: 'HUMAN_APPROVAL_REQUIRED',
  retry_count: 0,
  max_retries: 3,
  history: [],
  execution: null
};

{
  const result = authorizeMaintenanceFromEvent({
    eventName: 'issue_comment',
    repositoryOwner: 'sieannasmith-health',
    issueNumber,
    state: baseState,
    payload: {
      sender: { login: 'someone-else' },
      comment: { id: 1, body: `/approve-maintenance ${protectedFile}`, created_at: '2026-09-06T23:50:00Z' }
    }
  });
  assert.equal(result.authorized, false);
  assert.equal(result.matchedCommand, true);
  assert.equal(result.state, baseState);
}

let grantedState;
{
  const result = authorizeMaintenanceFromEvent({
    eventName: 'issue_comment',
    repositoryOwner: 'sieannasmith-health',
    issueNumber,
    state: baseState,
    payload: {
      sender: { login: 'sieannasmith-health' },
      comment: { id: 42, body: `/approve-maintenance ${protectedFile}`, created_at: '2026-09-06T23:51:00Z' }
    }
  });
  assert.equal(result.authorized, true);
  assert.deepEqual(result.grant.allowed_paths, [protectedFile]);
  assert.equal(result.state.status, 'PENDING');
  assert.equal(result.state.assigned_agent, 'selah');
  grantedState = result.state;
}

assert.throws(
  () => validateImplementationFiles([{ path: protectedFile, content: '// test' }], issueNumber, baseState),
  /protected from self-modification/
);

assert.doesNotThrow(
  () => validateImplementationFiles([{ path: protectedFile, content: '// test' }], issueNumber, grantedState)
);

assert.throws(
  () => validateImplementationFiles([{ path: workflowFile, content: 'name: test' }], issueNumber, grantedState),
  /protected from self-modification/
);

assert.throws(
  () => createMaintenanceGrant({
    issueNumber,
    approvedBy: 'sieannasmith-health',
    allowedPaths: ['agent-runtime/secrets/token.mjs'],
    sourceCommentId: 43
  }),
  /invalid or permanently forbidden path/
);

for (const outcome of ['success', 'blocked', 'failed']) {
  const state = {
    ...grantedState,
    maintenance_grant: { ...grantedState.maintenance_grant, grant_id: `grant-${outcome}` }
  };
  const drained = drainMaintenanceGrant(state, { at: '2026-09-06T23:52:00Z', outcome });
  assert.equal(drained.maintenance_grant, null);
  assert.equal(drained.current_stage, state.current_stage);
  assert.equal(drained.assigned_agent, state.assigned_agent);
  assert.equal(drained.execution, state.execution);
  assert.equal(drained.history.at(-1).event, 'RUNTIME_MAINTENANCE_GRANT_DRAINED');
  assert.equal(drained.history.at(-1).outcome, outcome);
}

{
  const activeExecution = {
    claimed_at: '2026-09-06T23:53:00Z',
    lease_expires_at: '2026-09-07T00:13:00Z',
    attempt: 1
  };
  const crashState = {
    ...grantedState,
    status: 'EXECUTING',
    assigned_agent: 'selah',
    execution: activeExecution
  };
  const start = '<!-- MSH_STATE_LOCK -->';
  const end = '<!-- MSH_STATE_LOCK_END -->';
  const body = `${start}\n\`\`\`json\n${JSON.stringify(crashState, null, 2)}\n\`\`\`\n${end}`;
  let patchedBody = null;

  const fetchImpl = async (url, options = {}) => {
    if (!options.method || options.method === 'GET') {
      return new Response(JSON.stringify({ body }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    assert.equal(options.method, 'PATCH');
    patchedBody = JSON.parse(options.body).body;
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const cleared = await clearMaintenanceGrant({
    token: 'test-token',
    repository: 'sieannasmith-health/my-simple-health',
    issueNumber,
    fetchImpl,
    outcome: 'runtime_failure'
  });
  assert.equal(cleared, true);
  assert.ok(patchedBody);

  const stateMatch = patchedBody.match(/<!-- MSH_STATE_LOCK -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- MSH_STATE_LOCK_END -->/);
  assert.ok(stateMatch);
  const persisted = JSON.parse(stateMatch[1]);
  assert.equal(persisted.maintenance_grant, null);
  assert.deepEqual(persisted.execution, activeExecution);
  assert.equal(persisted.status, 'EXECUTING');
  assert.equal(persisted.assigned_agent, 'selah');
  assert.equal(persisted.history.at(-1).event, 'RUNTIME_MAINTENANCE_GRANT_DRAINED');
  assert.equal(persisted.history.at(-1).outcome, 'runtime_failure');
}

console.log('maintenance authorization security contract passed');
