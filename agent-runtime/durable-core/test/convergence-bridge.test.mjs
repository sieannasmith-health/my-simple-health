import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { RuntimeConvergenceBridge } from '../src/convergence-bridge.mjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const bridge = new RuntimeConvergenceBridge(pool);

beforeAll(async () => { await pool.query('SELECT 1'); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => {
  await pool.query(`TRUNCATE external_task_bindings, external_objective_bindings, task_authority_approvals, access_tokens, task_required_authorities, task_required_capabilities, worker_authorities, worker_capabilities, worker_credentials, workers, artifacts, event_ledger, task_attempts, acceptance_criteria, task_dependencies, tasks, objectives CASCADE`);
});

function turn(agentKey, sequenceVersion) {
  return { repository: 'example/product', issueNumber: 382, issueTitle: '17-worker team huddle', agentKey, stage: 'PRODUCT_COORDINATION', sequenceVersion, correlationId: 'github-issue-382', causationId: `run-${sequenceVersion}` };
}

describe('RuntimeConvergenceBridge', () => {
  it('collapses duplicate wakeups onto one objective, task, and active attempt', async () => {
    const first = await bridge.ensureTurn(turn('orchestrator', 7));
    const second = await bridge.ensureTurn(turn('orchestrator', 7));
    expect(second.objectiveId).toBe(first.objectiveId);
    expect(second.taskId).toBe(first.taskId);
    expect(second.attemptId).toBe(first.attemptId);
    expect(second.duplicate).toBe(true);
    const counts = await pool.query(`SELECT (SELECT COUNT(*)::int FROM objectives) objectives,(SELECT COUNT(*)::int FROM tasks) tasks,(SELECT COUNT(*)::int FROM task_attempts) attempts`);
    expect(counts.rows[0]).toEqual({ objectives: 1, tasks: 1, attempts: 1 });
  });

  it('treats ordinary blocked handoff as completed work, not a human gate', async () => {
    const active = await bridge.ensureTurn(turn('orchestrator', 8));
    await bridge.completeTurn({ taskId: active.taskId, attemptId: active.attemptId, status: 'blocked', nextAgent: 'health-data', requiresHuman: false });
    const task = await pool.query('SELECT status FROM tasks WHERE task_id=$1', [active.taskId]);
    expect(task.rows[0].status).toBe('DONE');
  });

  it('persists explicit human-only escalation as NEEDS_HUMAN', async () => {
    const active = await bridge.ensureTurn(turn('security', 9));
    await bridge.completeTurn({ taskId: active.taskId, attemptId: active.attemptId, status: 'blocked', requiresHuman: true, reasonCode: 'CREDENTIAL_REQUIRED' });
    const task = await pool.query('SELECT status FROM tasks WHERE task_id=$1', [active.taskId]);
    expect(task.rows[0].status).toBe('NEEDS_HUMAN');
  });

  it('redrives a failed turn with a new attempt and preserves one durable task', async () => {
    const first = await bridge.ensureTurn(turn('research', 10));
    await bridge.failTurn({ taskId: first.taskId, attemptId: first.attemptId, error: new Error('worker disappeared') });
    const second = await bridge.ensureTurn(turn('research', 10));
    expect(second.taskId).toBe(first.taskId);
    expect(second.attemptId).not.toBe(first.attemptId);
    expect(second.attemptNumber).toBe(2);
    expect(second.redrive).toBe(true);
    await bridge.completeTurn({ taskId: second.taskId, attemptId: second.attemptId, status: 'completed' });
    const task = await pool.query('SELECT status FROM tasks WHERE task_id=$1', [first.taskId]);
    const attempts = await pool.query('SELECT status,attempt_number FROM task_attempts WHERE task_id=$1 ORDER BY attempt_number', [first.taskId]);
    expect(task.rows[0].status).toBe('DONE');
    expect(attempts.rows).toEqual([{ status: 'FAILED', attempt_number: 1 }, { status: 'COMPLETED', attempt_number: 2 }]);
  });

  it('replays an issue-382-style multi-worker huddle as one objective with bounded durable tasks', async () => {
    const sequence = [
      ['engineering', 1, 'review_requested', 'orchestrator'],
      ['orchestrator', 3, 'blocked', 'health-data'],
      ['health-data', 5, 'review_requested', 'orchestrator'],
      ['orchestrator', 7, 'blocked', 'security'],
      ['security', 9, 'review_requested', 'orchestrator'],
      ['orchestrator', 11, 'blocked', 'qa'],
      ['qa', 13, 'review_requested', 'orchestrator'],
    ];
    let objectiveId = null;
    for (const [agent, seq, status, nextAgent] of sequence) {
      const active = await bridge.ensureTurn(turn(agent, seq));
      objectiveId ||= active.objectiveId;
      expect(active.objectiveId).toBe(objectiveId);
      await bridge.completeTurn({ taskId: active.taskId, attemptId: active.attemptId, status, nextAgent, requiresHuman: false });
    }
    const counts = await pool.query(`SELECT (SELECT COUNT(*)::int FROM objectives) objectives,(SELECT COUNT(*)::int FROM tasks) tasks,(SELECT COUNT(*)::int FROM task_attempts) attempts,(SELECT COUNT(*)::int FROM tasks WHERE status='DONE') done`);
    expect(counts.rows[0]).toEqual({ objectives: 1, tasks: 7, attempts: 7, done: 7 });
  });
});
