export const ACTIONABLE_WORK_MUST_NOT_IDLE = 'ACTIONABLE_WORK_MUST_NOT_IDLE';

const TERMINAL = new Set(['COMPLETED', 'FAILED']);
const HUMAN = new Set(['PAUSED_FOR_SIEA', 'HUMAN_APPROVAL_REQUIRED', 'INPUT_REQUIRED']);

export function actionableWorkMustNotIdle(state, now = Date.now()) {
  if (!state || TERMINAL.has(state.status) || HUMAN.has(state.status)) {
    return { violation: false, action: 'none', reason: 'terminal_or_human_gate' };
  }
  if (state.status === 'PENDING' && state.assigned_agent) {
    return { violation: true, action: 'dispatch', reason: 'pending_owner_is_actionable' };
  }
  if (state.status === 'ORCHESTRATION_BLOCKED' && !state.human_gate) {
    const recovery = state.recovery;
    if (recovery?.resume_agent && recovery?.resume_stage) {
      const notBefore = recovery.not_before ? Date.parse(recovery.not_before) : 0;
      if (!Number.isFinite(notBefore) || notBefore <= now) {
        return { violation: true, action: 'redrive', reason: 'recovery_checkpoint_is_actionable' };
      }
      return { violation: false, action: 'wait', reason: 'bounded_redrive_cooldown' };
    }
    return { violation: true, action: 'bootstrap_recovery', reason: 'blocked_without_human_gate_or_checkpoint' };
  }
  if (state.status === 'EXECUTING' && state.execution?.lease_expires_at) {
    const expiry = Date.parse(state.execution.lease_expires_at);
    if (Number.isFinite(expiry) && expiry <= now) {
      return { violation: true, action: 'recover_lease', reason: 'execution_lease_expired' };
    }
  }
  return { violation: false, action: 'none', reason: 'no_permitted_immediate_action' };
}

export function assertActionableWorkDoesNotIdle(state, now = Date.now()) {
  const result = actionableWorkMustNotIdle(state, now);
  if (result.violation) {
    const error = new Error(`${ACTIONABLE_WORK_MUST_NOT_IDLE}: ${result.reason}; required_action=${result.action}`);
    error.code = ACTIONABLE_WORK_MUST_NOT_IDLE;
    error.requiredAction = result.action;
    throw error;
  }
  return result;
}
