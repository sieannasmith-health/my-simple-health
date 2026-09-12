import * as crypto from 'node:crypto';
import { Pool } from 'pg';

export type WorkerAuthority = 'READ' | 'PROPOSE' | 'WRITE' | 'REVIEW' | 'MERGE' | 'DEPLOY';

export interface AuthenticatedWorker {
  workerId: string;
  role: string;
  trustLevel: string;
  capabilities: string[];
  authorities: WorkerAuthority[];
}

export class IdentityAuthorityService {
  constructor(private readonly pool: Pool) {}

  private hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  public async authenticateBearer(secret: string): Promise<AuthenticatedWorker> {
    const hash = this.hashSecret(secret);
    const result = await this.pool.query(
      `SELECT w.worker_id, w.role, w.status, w.trust_level
         FROM worker_credentials c
         JOIN workers w ON w.worker_id = c.worker_id
        WHERE c.secret_hash = $1
          AND c.revoked_at IS NULL
          AND (c.expires_at IS NULL OR c.expires_at > CURRENT_TIMESTAMP)
        LIMIT 1`,
      [hash],
    );
    if (result.rowCount === 0) throw new Error('Authentication failed');
    const worker = result.rows[0];
    if (worker.status !== 'ACTIVE') throw new Error('Worker inactive');

    const capabilities = await this.pool.query('SELECT capability FROM worker_capabilities WHERE worker_id=$1 ORDER BY capability', [worker.worker_id]);
    const authorities = await this.pool.query('SELECT authority FROM worker_authorities WHERE worker_id=$1 ORDER BY authority', [worker.worker_id]);
    return {
      workerId: worker.worker_id,
      role: worker.role,
      trustLevel: worker.trust_level,
      capabilities: capabilities.rows.map((row) => row.capability),
      authorities: authorities.rows.map((row) => row.authority as WorkerAuthority),
    };
  }

  public async authorizeTaskClaim(worker: AuthenticatedWorker, role: string): Promise<void> {
    if (worker.role !== role) throw new Error('Authority denied');
  }

  public async authorizeTaskMutation(worker: AuthenticatedWorker, taskId: string, requiredAuthority: WorkerAuthority): Promise<void> {
    if (!worker.authorities.includes(requiredAuthority)) throw new Error('Authority denied');

    const requirements = await this.pool.query(
      `SELECT capability FROM task_required_capabilities WHERE task_id=$1`,
      [taskId],
    );
    const missing = requirements.rows.map((row) => row.capability).filter((capability) => !worker.capabilities.includes(capability));
    if (missing.length > 0) throw new Error('Capability denied');

    const authorityRequirements = await this.pool.query(
      `SELECT authority FROM task_required_authorities WHERE task_id=$1`,
      [taskId],
    );
    const missingAuthority = authorityRequirements.rows.map((row) => row.authority).find((authority) => !worker.authorities.includes(authority));
    if (missingAuthority) throw new Error('Authority denied');
  }

  public async createCredential(workerId: string, ttlSeconds: number | null = null): Promise<{ secret: string; expiresAt: Date | null }> {
    const secret = crypto.randomBytes(32).toString('hex');
    const expiresAt = ttlSeconds == null ? null : new Date(Date.now() + ttlSeconds * 1000);
    await this.pool.query(
      `INSERT INTO worker_credentials (worker_id, secret_hash, expires_at) VALUES ($1,$2,$3)`,
      [workerId, this.hashSecret(secret), expiresAt],
    );
    return { secret, expiresAt };
  }
}
