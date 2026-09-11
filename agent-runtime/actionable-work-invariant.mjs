export const ACTIONABLE_WORK_MUST_NOT_IDLE = 'ACTIONABLE_WORK_MUST_NOT_IDLE';

const TERMINAL = new Set(['COMPLETED', 'FAILED']);
const HUMAN = new Set(['PAUSED_FOR_SIEA', 'HUMAN_APPROVAL_REQUIRED', 'INPUT_REQUIRED']);

export function decideActionableWork(state, now = Date.now(), maxRedrivesDefault = 2) {
  if (!state) return { action: 'none', reason: 'missing_state' };
  if (TERMINAL.has(state.status)) return { action: 'none', reason: 'terminal' };
  if (HUMAN.has(state.status)) return { action: 'wait', reason: 'human_gate' };

  if (state.status === 'PENDING') {
    if (state.assigned_agent) return { action: 'dispatch', reason: 'pending_owner_is_actionable' };
    return { action: 'none', reason: 'pending_without_owner' };
  }

  if (state.status === 'EXECUTING') {
    const expiry = Date.parse(state.execution?.lease_expires_at || '');
    if (Number.isFinite(expiry) && expiry <= now) return { action: 'recover_lease', reason: 'execution_lease_expired' };
    return { action: 'wait', reason: 'active_execution_lease' };
  }

  if (state.status === 'ORCHESTRATION_BLOCKED' && !state.human_gate) {
    const recovery = state.recovery;
    if (!recovery?.resume_agent || !recovery?.resume_stage) {
      return { action: 'bootstrap_recovery', reason: 'blocked_without_recovery_checkpoint' };
    }
    const redriveCount = Number(state.redrive_count || 0);
    const maxRedrives = Number(state.max_redrives || maxRedrivesDefault);
    if (redriveCount >= maxRedrives) return { action: 'none', reason: 'redrive_budget_exhausted' };
    const notBefore = recovery.not_before ? Date.parse(recovery.not_before) : 0;
    if (Number.isFinite(notBefore) && notBefore > now) return { action: 'wait', reason: 'bounded_redrive_cooldown' };
    return { action: 'redrive', reason: 'recovery_checkpoint_is_actionable' };
  }

  return { action: 'none', reason: 'no_permitted_immediate_action' };
}

export function actionableWorkMustNotIdle(state, now = Date.now(), maxRedrivesDefault = 2) {
  const decision = decideActionableWork(state, now, maxRedrivesDefault);
  const actionable = new Set(['dispatch', 'recover_lease', 'bootstrap_recovery', 'redrive']);
  return { ...decision, violation: actionable.has(decision.action) };
}

export function assertActionableWorkDoesNotIdle(state, now = Date.now(), maxRedrivesDefault = 2) {
  const result = actionableWorkMustNotIdle(state, now, maxRedrivesDefault);
  if (!result.violation) return result;
  const error = new Error(`${ACTIONABLE_WORK_MUST_NOT_IDLE}: ${result.reason}; required_action=${result.action}`);
  error.code = ACTIONABLE_WORK_MUST_NOT_IDLE;
  error.requiredAction = result.action;
  throw error;
}
