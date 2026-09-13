import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DURABLE_RUNTIME_DATABASE_URL || process.env.DATABASE_URL || '';
const SOURCE_SYSTEM = 'github';

function requireDatabase() {
  if (!DATABASE_URL) throw new Error('DURABLE_RUNTIME_DATABASE_URL is required for authoritative runtime convergence.');
}

function stableKey(parts) {
  return createHash('sha256').update(parts.join(':')).digest('hex');
}

export class RuntimeConvergenceBridge {
  constructor(pool = null) {
    requireDatabase();
    this.pool = pool || new Pool({ connectionString: DATABASE_URL, max: 5 });
    this.ownsPool = !pool;
  }

  async close() { if (this.ownsPool) await this.pool.end(); }

  async ensureTurn({ repository, issueNumber, issueTitle, agentKey, stage, sequenceVersion = 0, correlationId = null, causationId = null }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const externalObjectiveKey = `${repository}#${issueNumber}`;
      const objectiveId = await this.ensureObjective(client, externalObjectiveKey, issueTitle);
      const externalTaskKey = `${externalObjectiveKey}:${sequenceVersion}:${agentKey}`;
      const taskId = await this.ensureTask(client, objectiveId, externalTaskKey, agentKey, { repository, issueNumber, stage, sequenceVersion, correlationId, causationId });
      const attempt = await this.ensureAttempt(client, taskId, agentKey, externalTaskKey);
      await client.query('COMMIT');
      return { objectiveId, taskId, ...attempt, externalObjectiveKey, externalTaskKey };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async completeTurn({ taskId, attemptId, status, nextAgent = null, requiresHuman = false, reasonCode = null, message = '', correlationId = null, causationId = null }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const locked = await client.query(
        `SELECT t.status, t.version, a.status AS attempt_status FROM tasks t JOIN task_attempts a ON a.task_id=t.task_id AND a.attempt_id=$2 WHERE t.task_id=$1 FOR UPDATE OF t,a`,
        [taskId, attemptId],
      );
      if (locked.rowCount === 0) throw new Error(`Durable turn not found for task ${taskId}`);
      if (locked.rows[0].attempt_status === 'COMPLETED' || locked.rows[0].attempt_status === 'FAILED') { await client.query('COMMIT'); return; }

      const humanGate = Boolean(requiresHuman);
      const terminalStatus = humanGate ? 'NEEDS_HUMAN' : 'DONE';
      await client.query(`UPDATE task_attempts SET status='COMPLETED', finished_at=CURRENT_TIMESTAMP WHERE attempt_id=$1 AND status='ACTIVE'`, [attemptId]);
      await client.query(
        `UPDATE tasks SET status=$2::task_status, version=version+1, updated_at=CURRENT_TIMESTAMP, input_context=input_context || $3::jsonb WHERE task_id=$1`,
        [taskId, terminalStatus, JSON.stringify({ status, nextAgent, requiresHuman: humanGate, reasonCode, message, correlationId, causationId })],
      );
      await client.query(
        `INSERT INTO event_ledger (idempotency_key,event_type,associated_task_id,payload) VALUES ($1,$2::asdlc_event_type,$3,$4::jsonb) ON CONFLICT (idempotency_key) DO NOTHING`,
        [stableKey(['github-turn-complete', taskId, attemptId]), humanGate ? 'HUMAN_INTERVENTION_REQUIRED' : 'WORKER_COMPLETED', taskId, JSON.stringify({ status, nextAgent, requiresHuman: humanGate, reasonCode, correlationId, causationId })],
      );
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async failTurn({ taskId, attemptId, error, correlationId = null, causationId = null }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE task_attempts SET status='FAILED', finished_at=CURRENT_TIMESTAMP, failure_class='RUNTIME_ERROR', error_log=$2 WHERE attempt_id=$1 AND status='ACTIVE'`, [attemptId, String(error || 'Unknown runtime failure').slice(0, 20000)]);
      await client.query(`UPDATE tasks SET status='RETRYABLE_FAILURE', version=version+1, updated_at=CURRENT_TIMESTAMP WHERE task_id=$1 AND status IN ('LEASED','RUNNING')`, [taskId]);
      await client.query(
        `INSERT INTO event_ledger (idempotency_key,event_type,associated_task_id,payload) VALUES ($1,'ATTEMPT_FAILED',$2,$3::jsonb) ON CONFLICT (idempotency_key) DO NOTHING`,
        [stableKey(['github-turn-fail', taskId, attemptId]), taskId, JSON.stringify({ correlationId, causationId, error: String(error || '') })],
      );
      await client.query('COMMIT');
    } catch (failure) { await client.query('ROLLBACK'); throw failure; }
    finally { client.release(); }
  }

  async ensureObjective(client, externalObjectiveKey, description) {
    const existing = await client.query(`SELECT objective_id FROM external_objective_bindings WHERE source_system=$1 AND external_objective_key=$2`, [SOURCE_SYSTEM, externalObjectiveKey]);
    if (existing.rowCount) return existing.rows[0].objective_id;
    const created = await client.query(`INSERT INTO objectives (description,status) VALUES ($1,'IN_PROGRESS') RETURNING objective_id`, [description || externalObjectiveKey]);
    const objectiveId = created.rows[0].objective_id;
    await client.query(`INSERT INTO external_objective_bindings (source_system,external_objective_key,objective_id) VALUES ($1,$2,$3) ON CONFLICT (source_system,external_objective_key) DO NOTHING`, [SOURCE_SYSTEM, externalObjectiveKey, objectiveId]);
    await client.query(`INSERT INTO event_ledger (idempotency_key,event_type,payload) VALUES ($1,'OBJECTIVE_CREATED',$2::jsonb) ON CONFLICT (idempotency_key) DO NOTHING`, [stableKey(['objective', externalObjectiveKey]), JSON.stringify({ objectiveId, externalObjectiveKey })]);
    return objectiveId;
  }

  async ensureTask(client, objectiveId, externalTaskKey, agentKey, context) {
    const existing = await client.query(`SELECT task_id FROM external_task_bindings WHERE source_system=$1 AND external_task_key=$2`, [SOURCE_SYSTEM, externalTaskKey]);
    if (existing.rowCount) return existing.rows[0].task_id;
    const created = await client.query(`INSERT INTO tasks (parent_objective_id,assigned_worker_role,status,retry_policy_id,input_context) VALUES ($1,$2,'READY','standard-default',$3::jsonb) RETURNING task_id`, [objectiveId, agentKey, JSON.stringify(context)]);
    const taskId = created.rows[0].task_id;
    await client.query(`INSERT INTO external_task_bindings (source_system,external_task_key,task_id) VALUES ($1,$2,$3) ON CONFLICT (source_system,external_task_key) DO NOTHING`, [SOURCE_SYSTEM, externalTaskKey, taskId]);
    await client.query(`INSERT INTO event_ledger (idempotency_key,event_type,associated_task_id,payload) VALUES ($1,'TASK_CREATED',$2,$3::jsonb) ON CONFLICT (idempotency_key) DO NOTHING`, [stableKey(['task', externalTaskKey]), taskId, JSON.stringify({ externalTaskKey, agentKey })]);
    return taskId;
  }

  async ensureAttempt(client, taskId, agentKey, externalTaskKey) {
    const prior = await client.query(`SELECT attempt_id,status,attempt_number FROM task_attempts WHERE task_id=$1 ORDER BY attempt_number DESC LIMIT 1`, [taskId]);
    if (prior.rowCount && ['ACTIVE','COMPLETED'].includes(prior.rows[0].status)) {
      return { attemptId: prior.rows[0].attempt_id, attemptNumber: prior.rows[0].attempt_number, duplicate: true, redrive: false };
    }

    const attemptNumber = prior.rowCount ? Number(prior.rows[0].attempt_number) + 1 : 1;
    const idempotencyKey = stableKey(['attempt', externalTaskKey, String(attemptNumber)]);
    const tokenHash = stableKey(['github-runtime-lease', taskId, randomUUID()]);
    const created = await client.query(
      `INSERT INTO task_attempts (task_id,worker_id,attempt_number,status,idempotency_key,lease_token_hash,started_at,lease_expires_at) VALUES ($1,$2,$3,'ACTIVE',$4,$5,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + INTERVAL '10 minutes') RETURNING attempt_id`,
      [taskId, `github-runtime:${agentKey}`, attemptNumber, idempotencyKey, tokenHash],
    );
    await client.query(`UPDATE tasks SET status='RUNNING',version=version+1,updated_at=CURRENT_TIMESTAMP WHERE task_id=$1 AND status IN ('READY','RETRYABLE_FAILURE')`, [taskId]);
    await client.query(`INSERT INTO event_ledger (idempotency_key,event_type,associated_task_id,payload) VALUES ($1,'ATTEMPT_STARTED',$2,$3::jsonb) ON CONFLICT (idempotency_key) DO NOTHING`, [stableKey(['attempt-start', externalTaskKey, String(attemptNumber)]), taskId, JSON.stringify({ workerId: `github-runtime:${agentKey}`, attemptNumber })]);
    return { attemptId: created.rows[0].attempt_id, attemptNumber, duplicate: false, redrive: attemptNumber > 1 };
  }
}
