import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { RuntimeConvergenceBridge } from '../src/convergence-bridge.mjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const bridge = new RuntimeConvergenceBridge(pool);

beforeAll(async () => {
  await pool.query('SELECT 1');
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await pool.query(`TRUNCATE external_task_bindings, external_objective_bindings, task_authority_approvals, access_tokens, task_required_authorities, task_required_capabilities, worker_authorities, worker_capabilities, worker_credentials, workers, artifacts, event_ledger, task_attempts, acceptance_criteria, task_dependencies, tasks, objectives CASCADE`);
});

describe('RuntimeConvergenceBridge', () => {
  it('maps duplicate GitHub dispatches to one objective, task, and attempt', async () => {
    const input = {
      repository: 'example/product',
      issueNumber: 382,
      issueTitle: 'Team huddle',
      agentKey: 'product',
      stage: 'PRODUCT_COORDINATION',
      sequenceVersion: 7,
      correlationId: 'corr-382',
      causationId: 'cause-1',
    };
    const first = await bridge.ensureTurn(input);
    const second = await bridge.ensureTurn(input);
    expect(second.objectiveId).toBe(first.objectiveId);
    expect(second.taskId).toBe(first.taskId);
    expect(second.attemptId).toBe(first.attemptId);
    expect(second.duplicate).toBe(true);

    const counts = await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM objectives) AS objectives,
      (SELECT COUNT(*)::int FROM tasks) AS tasks,
      (SELECT COUNT(*)::int FROM task_attempts) AS attempts`);
    expect(counts.rows[0]).toEqual({ objectives: 1, tasks: 1, attempts: 1 });
  });

  it('persists a successful bounded turn as durable DONE state', async () => {
    const turn = await bridge.ensureTurn({
      repository: 'example/product', issueNumber: 382, issueTitle: 'Team huddle',
      agentKey: 'engineering', stage: 'IMPLEMENTATION', sequenceVersion: 8,
    });
    await bridge.completeTurn({
      taskId: turn.taskId, attemptId: turn.attemptId, status: 'completed', nextAgent: 'qa', message: 'implementation complete',
    });
    const task = await pool.query('SELECT status FROM tasks WHERE task_id=$1', [turn.taskId]);
    const attempt = await pool.query('SELECT status FROM task_attempts WHERE attempt_id=$1', [turn.attemptId]);
    expect(task.rows[0].status).toBe('DONE');
    expect(attempt.rows[0].status).toBe('COMPLETED');
  });

  it('persists human-only escalation as NEEDS_HUMAN', async () => {
    const turn = await bridge.ensureTurn({
      repository: 'example/product', issueNumber: 382, issueTitle: 'Team huddle',
      agentKey: 'security', stage: 'REVIEW', sequenceVersion: 9,
    });
    await bridge.completeTurn({
      taskId: turn.taskId, attemptId: turn.attemptId, status: 'blocked', requiresHuman: true, reasonCode: 'CREDENTIAL_REQUIRED',
    });
    const task = await pool.query('SELECT status FROM tasks WHERE task_id=$1', [turn.taskId]);
    expect(task.rows[0].status).toBe('NEEDS_HUMAN');
  });

  it('records runtime failure as retryable durable work', async () => {
    const turn = await bridge.ensureTurn({
      repository: 'example/product', issueNumber: 382, issueTitle: 'Team huddle',
      agentKey: 'research', stage: 'INITIAL_TRIAGE', sequenceVersion: 10,
    });
    await bridge.failTurn({ taskId: turn.taskId, attemptId: turn.attemptId, error: new Error('worker disappeared') });
    const task = await pool.query('SELECT status FROM tasks WHERE task_id=$1', [turn.taskId]);
    const attempt = await pool.query('SELECT status,failure_class FROM task_attempts WHERE attempt_id=$1', [turn.attemptId]);
    expect(task.rows[0].status).toBe('RETRYABLE_FAILURE');
    expect(attempt.rows[0]).toEqual({ status: 'FAILED', failure_class: 'RUNTIME_ERROR' });
  });
});
