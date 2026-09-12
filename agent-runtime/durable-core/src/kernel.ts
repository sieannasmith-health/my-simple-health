import * as crypto from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import { ArtifactPayload, WorkerClaimResult } from './types.js';

export class DurableKernel {
  constructor(private readonly pool: Pool) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  public async claimLease(workerId: string, role: string, idempotencyKey: string): Promise<WorkerClaimResult | null> {
    return this.transaction(async (client) => {
      if (await this.eventExists(client, idempotencyKey)) return null;
      const job = await client.query(
        `SELECT t.task_id, t.version, p.lease_timeout_seconds, p.max_attempts FROM tasks t
         JOIN retry_policies p ON p.policy_id = t.retry_policy_id
         WHERE t.assigned_worker_role = $1 AND t.status = 'READY'
           AND (t.next_eligible_at IS NULL OR t.next_eligible_at <= CURRENT_TIMESTAMP)
         ORDER BY t.created_at, t.task_id LIMIT 1 FOR UPDATE OF t SKIP LOCKED`, [role]);
      if (job.rowCount === 0) return null;
      const row = job.rows[0];
      const attemptCount = await client.query('SELECT COUNT(*)::int AS count FROM task_attempts WHERE task_id = $1', [row.task_id]);
      const attemptNumber = Number(attemptCount.rows[0].count) + 1;
      if (attemptNumber > Number(row.max_attempts)) {
        const failed = await client.query(`UPDATE tasks SET status='TERMINAL_FAILURE', version=version+1, updated_at=CURRENT_TIMESTAMP WHERE task_id=$1 AND status='READY' AND version=$2`, [row.task_id, row.version]);
        if (failed.rowCount !== 1) throw new Error(`Concurrency conflict terminalizing task ${row.task_id}`);
        await this.appendEvent(client, crypto.randomUUID(), 'ATTEMPT_FAILED', row.task_id, { reason: 'MAX_ATTEMPTS' });
        return null;
      }
      const leaseToken = crypto.randomBytes(32).toString('hex');
      const leaseExpiresAt = new Date(Date.now() + Number(row.lease_timeout_seconds) * 1000);
      const updated = await client.query(`UPDATE tasks SET status='LEASED', version=version+1, next_eligible_at=NULL, updated_at=CURRENT_TIMESTAMP WHERE task_id=$1 AND status='READY' AND version=$2`, [row.task_id, row.version]);
      if (updated.rowCount !== 1) throw new Error(`Concurrency conflict leasing task ${row.task_id}`);
      await client.query(`INSERT INTO task_attempts (task_id,worker_id,attempt_number,status,idempotency_key,lease_token_hash,lease_expires_at) VALUES ($1,$2,$3,'ACTIVE',$4,$5,$6)`, [row.task_id, workerId, attemptNumber, idempotencyKey, this.hashToken(leaseToken), leaseExpiresAt]);
      await this.appendEvent(client, idempotencyKey, 'LEASE_GRANTED', row.task_id, { workerId, attemptNumber, leaseExpiresAt });
      return { taskId: row.task_id, leaseToken, leaseExpiresAt, attemptNumber };
    });
  }

  public async startAttempt(taskId: string, leaseToken: string, idempotencyKey: string): Promise<void> {
    await this.transaction(async (client) => {
      if (await this.eventExists(client, idempotencyKey)) return;
      const attempt = await this.lockActiveAttempt(client, taskId, leaseToken);
      const task = await client.query('SELECT version FROM tasks WHERE task_id=$1 FOR UPDATE', [taskId]);
      if (task.rowCount === 0) throw new Error(`Task not found: ${taskId}`);
      const updated = await client.query(`UPDATE tasks SET status='RUNNING',version=version+1,updated_at=CURRENT_TIMESTAMP WHERE task_id=$1 AND status='LEASED' AND version=$2`, [taskId, task.rows[0].version]);
      if (updated.rowCount !== 1) throw new Error(`Invalid start transition for task ${taskId}`);
      await client.query('UPDATE task_attempts SET started_at=COALESCE(started_at,CURRENT_TIMESTAMP) WHERE attempt_id=$1', [attempt.attempt_id]);
      await this.appendEvent(client, idempotencyKey, 'ATTEMPT_STARTED', taskId, { attemptId: attempt.attempt_id });
    });
  }

  public async heartbeat(taskId: string, leaseToken: string, idempotencyKey: string): Promise<Date> {
    return this.transaction(async (client) => {
      if (await this.eventExists(client, idempotencyKey)) {
        const existing = await client.query('SELECT lease_expires_at FROM task_attempts WHERE task_id=$1 AND lease_token_hash=$2', [taskId, this.hashToken(leaseToken)]);
        if (existing.rowCount === 0) throw new Error('Lease fencing breach');
        return existing.rows[0].lease_expires_at;
      }
      const attempt = await this.lockActiveAttempt(client, taskId, leaseToken);
      const policy = await client.query(`SELECT p.lease_timeout_seconds FROM tasks t JOIN retry_policies p ON p.policy_id=t.retry_policy_id WHERE t.task_id=$1`, [taskId]);
      const leaseExpiresAt = new Date(Date.now() + Number(policy.rows[0].lease_timeout_seconds) * 1000);
      await client.query('UPDATE task_attempts SET last_heartbeat_at=CURRENT_TIMESTAMP,lease_expires_at=$1 WHERE attempt_id=$2', [leaseExpiresAt, attempt.attempt_id]);
      await this.appendEvent(client, idempotencyKey, 'LEASE_RENEWED', taskId, { attemptId: attempt.attempt_id, leaseExpiresAt });
      return leaseExpiresAt;
    });
  }

  public async registerArtifact(taskId: string, leaseToken: string, artifact: ArtifactPayload, idempotencyKey: string): Promise<void> {
    await this.transaction(async (client) => {
      if (await this.eventExists(client, idempotencyKey)) return;
      const attempt = await this.lockActiveAttempt(client, taskId, leaseToken);
      const task = await client.query('SELECT status FROM tasks WHERE task_id=$1 FOR UPDATE', [taskId]);
      if (task.rowCount === 0 || !['LEASED','RUNNING'].includes(task.rows[0].status)) throw new Error(`Invalid artifact transition for task ${taskId}`);
      await client.query('INSERT INTO artifacts (associated_task_id,uri,content_type) VALUES ($1,$2,$3)', [taskId, artifact.uri, artifact.contentType]);
      await this.appendEvent(client, idempotencyKey, 'ARTIFACT_REGISTERED', taskId, { attemptId: attempt.attempt_id, uri: artifact.uri, contentType: artifact.contentType });
    });
  }

  public async submitCompletion(taskId: string, leaseToken: string, artifacts: ArtifactPayload[], idempotencyKey: string): Promise<void> {
    await this.transaction(async (client) => {
      if (await this.eventExists(client, idempotencyKey)) return;
      const attempt = await this.lockActiveAttempt(client, taskId, leaseToken);
      const task = await client.query('SELECT status,version FROM tasks WHERE task_id=$1 FOR UPDATE', [taskId]);
      if (task.rowCount === 0) throw new Error(`Task not found: ${taskId}`);
      if (!['LEASED','RUNNING'].includes(task.rows[0].status)) throw new Error(`Invalid completion transition from ${task.rows[0].status}`);
      for (const artifact of artifacts) await client.query('INSERT INTO artifacts (associated_task_id,uri,content_type) VALUES ($1,$2,$3)', [taskId, artifact.uri, artifact.contentType]);
      const attemptUpdate = await client.query(`UPDATE task_attempts SET status='COMPLETED',finished_at=CURRENT_TIMESTAMP WHERE attempt_id=$1 AND status='ACTIVE'`, [attempt.attempt_id]);
      if (attemptUpdate.rowCount !== 1) throw new Error(`Concurrency conflict completing attempt ${attempt.attempt_id}`);
      const updated = await client.query(`UPDATE tasks SET status='VALIDATING',version=version+1,updated_at=CURRENT_TIMESTAMP WHERE task_id=$1 AND status=$2 AND version=$3`, [taskId, task.rows[0].status, task.rows[0].version]);
      if (updated.rowCount !== 1) throw new Error(`Concurrency conflict completing task ${taskId}`);
      await this.appendEvent(client, idempotencyKey, 'WORKER_COMPLETED', taskId, { attemptId: attempt.attempt_id, artifactCount: artifacts.length });
    });
  }

  public async failAttempt(taskId: string, leaseToken: string, failureClass: string, errorLog: string | null, idempotencyKey: string): Promise<void> {
    await this.transaction(async (client) => {
      if (await this.eventExists(client, idempotencyKey)) return;
      const attempt = await this.lockActiveAttempt(client, taskId, leaseToken);
      const task = await client.query('SELECT status,version FROM tasks WHERE task_id=$1 FOR UPDATE', [taskId]);
      if (task.rowCount === 0 || !['LEASED','RUNNING'].includes(task.rows[0].status)) throw new Error(`Invalid failure transition for task ${taskId}`);
      const attemptUpdate = await client.query(`UPDATE task_attempts SET status='FAILED',finished_at=CURRENT_TIMESTAMP,failure_class=$2,error_log=$3 WHERE attempt_id=$1 AND status='ACTIVE'`, [attempt.attempt_id, failureClass, errorLog]);
      if (attemptUpdate.rowCount !== 1) throw new Error(`Concurrency conflict failing attempt ${attempt.attempt_id}`);
      const updated = await client.query(`UPDATE tasks SET status='RETRYABLE_FAILURE',version=version+1,updated_at=CURRENT_TIMESTAMP WHERE task_id=$1 AND status=$2 AND version=$3`, [taskId, task.rows[0].status, task.rows[0].version]);
      if (updated.rowCount !== 1) throw new Error(`Concurrency conflict failing task ${taskId}`);
      await this.appendEvent(client, idempotencyKey, 'ATTEMPT_FAILED', taskId, { attemptId: attempt.attempt_id, failureClass });
    });
    await this.executeReclamationSweep();
  }

  public async executeReclamationSweep(): Promise<void> {
    await this.transaction(async (client) => {
      const expired = await client.query(`SELECT a.attempt_id,a.task_id,t.status,t.version FROM task_attempts a JOIN tasks t ON t.task_id=a.task_id WHERE a.status='ACTIVE' AND a.lease_expires_at<CURRENT_TIMESTAMP FOR UPDATE OF a,t SKIP LOCKED`);
      for (const attempt of expired.rows) {
        if (!['LEASED','RUNNING'].includes(attempt.status)) continue;
        const attemptUpdate = await client.query(`UPDATE task_attempts SET status='EXPIRED',finished_at=CURRENT_TIMESTAMP,failure_class='TIMEOUT' WHERE attempt_id=$1 AND status='ACTIVE'`, [attempt.attempt_id]);
        if (attemptUpdate.rowCount !== 1) continue;
        const updated = await client.query(`UPDATE tasks SET status='RETRYABLE_FAILURE',version=version+1,updated_at=CURRENT_TIMESTAMP WHERE task_id=$1 AND status=$2 AND version=$3`, [attempt.task_id, attempt.status, attempt.version]);
        if (updated.rowCount !== 1) throw new Error(`Concurrency conflict expiring task ${attempt.task_id}`);
        await this.appendEvent(client, crypto.randomUUID(), 'LEASE_EXPIRED', attempt.task_id, { attemptId: attempt.attempt_id });
      }
      const retryable = await client.query(`SELECT t.task_id,t.version,p.max_attempts,p.initial_backoff_seconds,p.max_backoff_seconds,p.backoff_multiplier FROM tasks t JOIN retry_policies p ON p.policy_id=t.retry_policy_id WHERE t.status='RETRYABLE_FAILURE' FOR UPDATE OF t SKIP LOCKED`);
      for (const task of retryable.rows) {
        const count = await client.query('SELECT COUNT(*)::int AS count FROM task_attempts WHERE task_id=$1', [task.task_id]);
        const attempts = Number(count.rows[0].count);
        if (attempts >= Number(task.max_attempts)) {
          const updated = await client.query(`UPDATE tasks SET status='TERMINAL_FAILURE',version=version+1,updated_at=CURRENT_TIMESTAMP WHERE task_id=$1 AND status='RETRYABLE_FAILURE' AND version=$2`, [task.task_id, task.version]);
          if (updated.rowCount !== 1) throw new Error(`Concurrency conflict terminalizing task ${task.task_id}`);
          await this.appendEvent(client, crypto.randomUUID(), 'ATTEMPT_FAILED', task.task_id, { reason: 'MAX_ATTEMPTS' });
          continue;
        }
        const exponent = Math.max(0, attempts - 1);
        const backoff = Math.min(Number(task.max_backoff_seconds), Math.round(Number(task.initial_backoff_seconds) * Math.pow(Number(task.backoff_multiplier), exponent)));
        const updated = await client.query(`UPDATE tasks SET status='READY',version=version+1,next_eligible_at=CURRENT_TIMESTAMP+($3*INTERVAL '1 second'),updated_at=CURRENT_TIMESTAMP WHERE task_id=$1 AND status='RETRYABLE_FAILURE' AND version=$2`, [task.task_id, task.version, backoff]);
        if (updated.rowCount !== 1) throw new Error(`Concurrency conflict retrying task ${task.task_id}`);
        await this.appendEvent(client, crypto.randomUUID(), 'TASK_ACTIVATED', task.task_id, { retry: true, backoffSeconds: backoff });
      }
    });
  }

  private async lockActiveAttempt(client: PoolClient, taskId: string, leaseToken: string) {
    const result = await client.query(`SELECT attempt_id FROM task_attempts WHERE task_id=$1 AND lease_token_hash=$2 AND status='ACTIVE' AND lease_expires_at>CURRENT_TIMESTAMP FOR UPDATE`, [taskId, this.hashToken(leaseToken)]);
    if (result.rowCount === 0) throw new Error(`Lease fencing breach for task ${taskId}`);
    return result.rows[0];
  }
  private async eventExists(client: PoolClient, idempotencyKey: string): Promise<boolean> { const result = await client.query('SELECT 1 FROM event_ledger WHERE idempotency_key=$1', [idempotencyKey]); return (result.rowCount ?? 0) > 0; }
  private async appendEvent(client: PoolClient, idempotencyKey: string, eventType: string, taskId: string, payload: unknown): Promise<void> { await client.query(`INSERT INTO event_ledger (idempotency_key,event_type,associated_task_id,payload) VALUES ($1,$2,$3,$4::jsonb)`, [idempotencyKey,eventType,taskId,JSON.stringify(payload ?? {})]); }
}
