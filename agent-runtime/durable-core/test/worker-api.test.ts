import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { Pool } from 'pg';
import request from 'supertest';
import { DurableKernel } from '../src/kernel.js';
import { createWorkerApi } from '../src/worker-api.js';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/asdlc_test';

describe('Worker API integration', () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 20 });
  const kernel = new DurableKernel(pool);
  const app = createWorkerApi(kernel);

  beforeAll(async () => { await pool.query('SELECT 1'); });
  afterAll(async () => { await pool.end(); });

  beforeEach(async () => {
    await pool.query('TRUNCATE event_ledger, artifacts, task_attempts, task_dependencies, acceptance_criteria, tasks, objectives CASCADE');
    await pool.query(
      `INSERT INTO retry_policies
        (policy_id, max_attempts, initial_backoff_seconds, max_backoff_seconds, backoff_multiplier, lease_timeout_seconds)
       VALUES ('standard-default', 3, 0, 30, 2.0, 30)
       ON CONFLICT (policy_id) DO UPDATE SET max_attempts=3, initial_backoff_seconds=0, lease_timeout_seconds=30`,
    );
  });

  async function createReadyTask(role = 'api-role') {
    const objectiveId = randomUUID();
    const taskId = randomUUID();
    await pool.query('INSERT INTO objectives (objective_id, description) VALUES ($1, $2)', [objectiveId, 'Worker API objective']);
    await pool.query(
      `INSERT INTO tasks (task_id, parent_objective_id, assigned_worker_role, status, retry_policy_id)
       VALUES ($1, $2, $3, 'READY', 'standard-default')`,
      [taskId, objectiveId, role],
    );
    return { objectiveId, taskId };
  }

  async function claim(role = 'api-role') {
    const response = await request(app)
      .post('/v1/worker/claims')
      .send({ role, idempotencyKey: randomUUID() })
      .expect(200);
    return response.body as { taskId: string; leaseToken: string; leaseExpiresAt: string; attemptNumber: number };
  }

  test('rejects malformed contracts', async () => {
    await request(app)
      .post('/v1/worker/claims')
      .send({ role: '' })
      .expect(400)
      .expect(({ body }) => { expect(body.error).toBe('INVALID_CONTRACT'); });
  });

  test('claims, starts, heartbeats, registers artifact, and completes a task', async () => {
    const { taskId } = await createReadyTask();
    const lease = await claim();
    expect(lease.taskId).toBe(taskId);
    await request(app).post(`/v1/tasks/${taskId}/start`).send({ leaseToken: lease.leaseToken, idempotencyKey: randomUUID() }).expect(204);
    const heartbeat = await request(app).post(`/v1/tasks/${taskId}/heartbeat`).send({ leaseToken: lease.leaseToken, idempotencyKey: randomUUID() }).expect(200);
    expect(Date.parse(heartbeat.body.leaseExpiresAt)).toBeGreaterThan(Date.now());
    await request(app).post(`/v1/tasks/${taskId}/artifacts`).send({ leaseToken: lease.leaseToken, idempotencyKey: randomUUID(), artifact: { uri: 'artifact://api-log', contentType: 'application/json' } }).expect(201);
    await request(app).post(`/v1/tasks/${taskId}/complete`).send({ leaseToken: lease.leaseToken, idempotencyKey: randomUUID(), artifacts: [{ uri: 'artifact://final', contentType: 'application/json' }] }).expect(204);
    const task = await pool.query('SELECT status FROM tasks WHERE task_id=$1', [taskId]);
    expect(task.rows[0].status).toBe('VALIDATING');
    const artifacts = await pool.query('SELECT COUNT(*)::int AS count FROM artifacts WHERE associated_task_id=$1', [taskId]);
    expect(artifacts.rows[0].count).toBe(2);
  });

  test('returns 409 when a stale lease attempts a protected mutation', async () => {
    const { taskId } = await createReadyTask('stale-role');
    const lease = await claim('stale-role');
    await pool.query("UPDATE task_attempts SET lease_expires_at=CURRENT_TIMESTAMP-INTERVAL '1 second' WHERE task_id=$1", [taskId]);
    await request(app).post(`/v1/tasks/${taskId}/heartbeat`).send({ leaseToken: lease.leaseToken, idempotencyKey: randomUUID() }).expect(409).expect(({ body }) => { expect(body.error).toBe('LEASE_FENCED'); });
  });

  test('records explicit failure and returns task to the retry pool', async () => {
    const { taskId } = await createReadyTask('failure-role');
    const lease = await claim('failure-role');
    await request(app).post(`/v1/tasks/${taskId}/fail`).send({ leaseToken: lease.leaseToken, idempotencyKey: randomUUID(), failureClass: 'TOOL_ERROR', errorLog: 'simulated failure' }).expect(204);
    const task = await pool.query('SELECT status FROM tasks WHERE task_id=$1', [taskId]);
    expect(task.rows[0].status).toBe('READY');
    const attempt = await pool.query('SELECT status, failure_class FROM task_attempts WHERE task_id=$1', [taskId]);
    expect(attempt.rows[0].status).toBe('FAILED');
    expect(attempt.rows[0].failure_class).toBe('TOOL_ERROR');
  });

  test('duplicate artifact request is idempotent', async () => {
    const { taskId } = await createReadyTask('artifact-role');
    const lease = await claim('artifact-role');
    const idempotencyKey = randomUUID();
    const body = { leaseToken: lease.leaseToken, idempotencyKey, artifact: { uri: 'artifact://once', contentType: 'text/plain' } };
    await request(app).post(`/v1/tasks/${taskId}/artifacts`).send(body).expect(201);
    await request(app).post(`/v1/tasks/${taskId}/artifacts`).send(body).expect(201);
    const count = await pool.query('SELECT COUNT(*)::int AS count FROM artifacts WHERE associated_task_id=$1', [taskId]);
    expect(count.rows[0].count).toBe(1);
  });
});
