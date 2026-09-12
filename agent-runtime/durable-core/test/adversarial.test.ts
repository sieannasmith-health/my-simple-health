import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { Pool } from 'pg';
import { DurableKernel } from '../src/kernel.js';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/asdlc_test';

describe('DurableKernel adversarial execution', () => {
  // Keep application-level contention at 100 callers while bounding physical
  // PostgreSQL connections below the server's default max_connections ceiling.
  const pool = new Pool({ connectionString: databaseUrl, max: 90 });
  const kernel = new DurableKernel(pool);

  beforeAll(async () => {
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE event_ledger, artifacts, task_attempts, task_dependencies, acceptance_criteria, tasks, objectives CASCADE');
    await pool.query(
      `INSERT INTO retry_policies
        (policy_id, max_attempts, initial_backoff_seconds, max_backoff_seconds, backoff_multiplier, lease_timeout_seconds)
       VALUES ('standard-default', 3, 0, 30, 2.0, 30)
       ON CONFLICT (policy_id) DO UPDATE SET max_attempts = 3, initial_backoff_seconds = 0, lease_timeout_seconds = 30`,
    );
  });

  async function createReadyTask(role = 'specialist') {
    const objectiveId = randomUUID();
    const taskId = randomUUID();
    await pool.query('INSERT INTO objectives (objective_id, description) VALUES ($1, $2)', [objectiveId, 'Adversarial objective']);
    await pool.query(
      `INSERT INTO tasks (task_id, parent_objective_id, assigned_worker_role, status, retry_policy_id)
       VALUES ($1, $2, $3, 'READY', 'standard-default')`,
      [taskId, objectiveId, role],
    );
    return { objectiveId, taskId };
  }

  test('100 simultaneous workers cannot double-claim one READY task', async () => {
    const { taskId } = await createReadyTask('concurrent-role');
    const results = await Promise.all(
      Array.from({ length: 100 }, (_, i) => kernel.claimLease(`worker-${i}`, 'concurrent-role', randomUUID())),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    const state = await pool.query('SELECT status FROM tasks WHERE task_id = $1', [taskId]);
    expect(state.rows[0].status).toBe('LEASED');
    const attempts = await pool.query('SELECT COUNT(*)::int AS count FROM task_attempts WHERE task_id = $1', [taskId]);
    expect(attempts.rows[0].count).toBe(1);
  });

  test('duplicate completion is idempotent and creates one artifact', async () => {
    const { taskId } = await createReadyTask();
    const claim = await kernel.claimLease('worker-a', 'specialist', randomUUID());
    expect(claim).not.toBeNull();
    const key = randomUUID();
    const artifacts = [{ uri: 'artifact://bundle', contentType: 'application/json' }];
    await kernel.submitCompletion(taskId, claim!.leaseToken, artifacts, key);
    await kernel.submitCompletion(taskId, claim!.leaseToken, artifacts, key);
    const count = await pool.query('SELECT COUNT(*)::int AS count FROM artifacts WHERE associated_task_id = $1', [taskId]);
    expect(count.rows[0].count).toBe(1);
    const events = await pool.query("SELECT COUNT(*)::int AS count FROM event_ledger WHERE event_type = 'WORKER_COMPLETED' AND associated_task_id = $1", [taskId]);
    expect(events.rows[0].count).toBe(1);
  });

  test('real reclamation expires worker one and fences its stale completion', async () => {
    const { taskId } = await createReadyTask('qa-role');
    const first = await kernel.claimLease('worker-one', 'qa-role', randomUUID());
    expect(first).not.toBeNull();
    await pool.query("UPDATE task_attempts SET lease_expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE task_id = $1", [taskId]);
    await kernel.executeReclamationSweep();
    const expired = await pool.query('SELECT status FROM task_attempts WHERE task_id = $1 ORDER BY attempt_number LIMIT 1', [taskId]);
    expect(expired.rows[0].status).toBe('EXPIRED');
    const ready = await pool.query('SELECT status FROM tasks WHERE task_id = $1', [taskId]);
    expect(ready.rows[0].status).toBe('READY');
    const second = await kernel.claimLease('worker-two', 'qa-role', randomUUID());
    expect(second).not.toBeNull();
    await expect(
      kernel.submitCompletion(taskId, first!.leaseToken, [{ uri: 'artifact://stale', contentType: 'application/json' }], randomUUID()),
    ).rejects.toThrow(/Lease fencing breach/);
    const state = await pool.query('SELECT status FROM tasks WHERE task_id = $1', [taskId]);
    expect(state.rows[0].status).toBe('LEASED');
  });

  test('heartbeat extends a current lease and stale heartbeat is rejected', async () => {
    const { taskId } = await createReadyTask('heartbeat-role');
    const claim = await kernel.claimLease('worker-heartbeat', 'heartbeat-role', randomUUID());
    expect(claim).not.toBeNull();
    const renewed = await kernel.heartbeat(taskId, claim!.leaseToken, randomUUID());
    expect(renewed.getTime()).toBeGreaterThan(Date.now());
    await pool.query("UPDATE task_attempts SET lease_expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE task_id = $1", [taskId]);
    await expect(kernel.heartbeat(taskId, claim!.leaseToken, randomUUID())).rejects.toThrow(/Lease fencing breach/);
  });

  test('attempt start and completion advance through guarded states', async () => {
    const { taskId } = await createReadyTask('engineering-role');
    const claim = await kernel.claimLease('worker-engineering', 'engineering-role', randomUUID());
    await kernel.startAttempt(taskId, claim!.leaseToken, randomUUID());
    let state = await pool.query('SELECT status FROM tasks WHERE task_id = $1', [taskId]);
    expect(state.rows[0].status).toBe('RUNNING');
    await kernel.submitCompletion(taskId, claim!.leaseToken, [{ uri: 'artifact://commit', contentType: 'text/plain' }], randomUUID());
    state = await pool.query('SELECT status FROM tasks WHERE task_id = $1', [taskId]);
    expect(state.rows[0].status).toBe('VALIDATING');
  });

  test('retry exhaustion produces terminal failure', async () => {
    const { taskId } = await createReadyTask('retry-role');
    await pool.query("UPDATE retry_policies SET max_attempts = 1 WHERE policy_id = 'standard-default'");
    const claim = await kernel.claimLease('worker-retry', 'retry-role', randomUUID());
    expect(claim).not.toBeNull();
    await pool.query("UPDATE task_attempts SET lease_expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE task_id = $1", [taskId]);
    await kernel.executeReclamationSweep();
    const state = await pool.query('SELECT status FROM tasks WHERE task_id = $1', [taskId]);
    expect(state.rows[0].status).toBe('TERMINAL_FAILURE');
  });
});
