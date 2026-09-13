import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { Pool } from 'pg';
import request from 'supertest';
import { DurableKernel } from '../src/kernel.js';
import { IdentityAuthorityService } from '../src/identity.js';
import { createWorkerApi } from '../src/worker-api.js';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/asdlc_test';

describe('Identity and authority integration', () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 20 });
  const kernel = new DurableKernel(pool);
  const identity = new IdentityAuthorityService(pool);
  const app = createWorkerApi(kernel, identity);

  beforeAll(async () => { await pool.query('SELECT 1'); });
  afterAll(async () => { await pool.end(); });
  beforeEach(async () => {
    await pool.query('TRUNCATE access_tokens, task_authority_approvals, task_required_authorities, task_required_capabilities, worker_authorities, worker_capabilities, worker_credentials, workers, event_ledger, artifacts, task_attempts, task_dependencies, acceptance_criteria, tasks, objectives CASCADE');
    await pool.query(`INSERT INTO retry_policies (policy_id,max_attempts,initial_backoff_seconds,max_backoff_seconds,backoff_multiplier,lease_timeout_seconds) VALUES ('standard-default',3,0,30,2.0,30) ON CONFLICT (policy_id) DO UPDATE SET max_attempts=3,initial_backoff_seconds=0,lease_timeout_seconds=30`);
  });

  async function worker(workerId: string, role: string, authorities = ['WRITE'], capabilities: string[] = []) {
    await pool.query('INSERT INTO workers(worker_id,role) VALUES($1,$2)', [workerId, role]);
    for (const value of authorities) await pool.query('INSERT INTO worker_authorities(worker_id,authority) VALUES($1,$2)', [workerId, value]);
    for (const value of capabilities) await pool.query('INSERT INTO worker_capabilities(worker_id,capability) VALUES($1,$2)', [workerId, value]);
    return identity.createCredential(workerId);
  }
  async function task(role: string) {
    const objectiveId = randomUUID(), taskId = randomUUID();
    await pool.query('INSERT INTO objectives(objective_id,description) VALUES($1,$2)', [objectiveId, 'Authority objective']);
    await pool.query(`INSERT INTO tasks(task_id,parent_objective_id,assigned_worker_role,status,retry_policy_id) VALUES($1,$2,$3,'READY','standard-default')`, [taskId, objectiveId, role]);
    return taskId;
  }
  async function claim(secret: string, role: string) {
    const response = await request(app).post('/v1/worker/claims').set('Authorization', `Bearer ${secret}`).send({ role, idempotencyKey: randomUUID() }).expect(200);
    return response.body as { taskId: string; leaseToken: string };
  }

  test('rejects unauthenticated claims and client-asserted identity', async () => {
    await request(app).post('/v1/worker/claims').send({ role: 'engineering', idempotencyKey: randomUUID() }).expect(401);
    const credential = await worker('worker-a', 'engineering');
    await task('engineering');
    await request(app).post('/v1/worker/claims').set('Authorization', `Bearer ${credential.secret}`).send({ workerId: 'worker-b', role: 'engineering', idempotencyKey: randomUUID() }).expect(400);
  });

  test('prevents another authenticated worker from using a stolen lease token', async () => {
    const owner = await worker('worker-owner', 'engineering');
    const attacker = await worker('worker-attacker', 'engineering');
    const taskId = await task('engineering');
    const lease = await claim(owner.secret, 'engineering');
    await request(app).post(`/v1/tasks/${taskId}/start`).set('Authorization', `Bearer ${attacker.secret}`).send({ leaseToken: lease.leaseToken, idempotencyKey: randomUUID() }).expect(403).expect(({body}) => expect(body.error).toBe('FORBIDDEN'));
  });

  test('rejects revoked credentials', async () => {
    const credential = await worker('worker-revoked', 'engineering');
    await pool.query('UPDATE worker_credentials SET revoked_at=CURRENT_TIMESTAMP WHERE worker_id=$1', ['worker-revoked']);
    await request(app).post('/v1/worker/claims').set('Authorization', `Bearer ${credential.secret}`).send({ role: 'engineering', idempotencyKey: randomUUID() }).expect(401);
  });

  test('requires durable human approval for a gated authority', async () => {
    const credential = await worker('worker-gated', 'engineering');
    await pool.query(`UPDATE worker_authorities SET human_approval_required=TRUE WHERE worker_id='worker-gated' AND authority='WRITE'`);
    const taskId = await task('engineering');
    const lease = await claim(credential.secret, 'engineering');
    const body = { leaseToken: lease.leaseToken, idempotencyKey: randomUUID() };
    await request(app).post(`/v1/tasks/${taskId}/start`).set('Authorization', `Bearer ${credential.secret}`).send(body).expect(403).expect(({body}) => expect(body.error).toBe('HUMAN_APPROVAL_REQUIRED'));
    await pool.query(`INSERT INTO task_authority_approvals(task_id,authority,approved_by) VALUES($1,'WRITE','human-operator')`, [taskId]);
    await request(app).post(`/v1/tasks/${taskId}/start`).set('Authorization', `Bearer ${credential.secret}`).send({ ...body, idempotencyKey: randomUUID() }).expect(204);
  });

  test('scoped tokens cannot escalate authority or capability', async () => {
    const credential = await worker('worker-scoped', 'engineering', ['WRITE'], ['code.repository.write']);
    await request(app).post('/v1/auth/tokens').set('Authorization', `Bearer ${credential.secret}`).send({ authorities: ['DEPLOY'], capabilities: [], ttlSeconds: 300 }).expect(403);
    await request(app).post('/v1/auth/tokens').set('Authorization', `Bearer ${credential.secret}`).send({ authorities: ['WRITE'], capabilities: ['release.testflight'], ttlSeconds: 300 }).expect(403);
    const issued = await request(app).post('/v1/auth/tokens').set('Authorization', `Bearer ${credential.secret}`).send({ authorities: ['WRITE'], capabilities: ['code.repository.write'], ttlSeconds: 300 }).expect(201);
    expect(issued.body.token).toMatch(/^[a-f0-9]{64}$/);
  });
});
