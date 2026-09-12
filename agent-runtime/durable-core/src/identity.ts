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
    const credential = await this.pool.query(
      `SELECT w.worker_id, w.role, w.status, w.trust_level
         FROM worker_credentials c
         JOIN workers w ON w.worker_id = c.worker_id
        WHERE c.secret_hash = $1 AND c.revoked_at IS NULL
          AND (c.expires_at IS NULL OR c.expires_at > CURRENT_TIMESTAMP)
        LIMIT 1`, [hash]);
    if (credential.rowCount === 0) throw new Error('Authentication failed');
    return this.loadWorker(credential.rows[0]);
  }

  public async authenticateAccessToken(secret: string): Promise<AuthenticatedWorker> {
    const hash = this.hashSecret(secret);
    const result = await this.pool.query(
      `SELECT w.worker_id,w.role,w.status,w.trust_level,t.authorities,t.capabilities
         FROM access_tokens t JOIN workers w ON w.worker_id=t.worker_id
        WHERE t.token_hash=$1 AND t.revoked_at IS NULL AND t.expires_at>CURRENT_TIMESTAMP LIMIT 1`, [hash]);
    if (result.rowCount === 0) throw new Error('Authentication failed');
    const row = result.rows[0];
    if (row.status !== 'ACTIVE') throw new Error('Worker inactive');
    return { workerId: row.worker_id, role: row.role, trustLevel: row.trust_level, capabilities: row.capabilities ?? [], authorities: row.authorities ?? [] };
  }

  private async loadWorker(worker: any): Promise<AuthenticatedWorker> {
    if (worker.status !== 'ACTIVE') throw new Error('Worker inactive');
    const capabilities = await this.pool.query('SELECT capability FROM worker_capabilities WHERE worker_id=$1 ORDER BY capability', [worker.worker_id]);
    const authorities = await this.pool.query('SELECT authority FROM worker_authorities WHERE worker_id=$1 ORDER BY authority', [worker.worker_id]);
    return { workerId: worker.worker_id, role: worker.role, trustLevel: worker.trust_level, capabilities: capabilities.rows.map(r => r.capability), authorities: authorities.rows.map(r => r.authority as WorkerAuthority) };
  }

  public async authorizeTaskClaim(worker: AuthenticatedWorker, role: string): Promise<void> {
    if (worker.role !== role) throw new Error('Authority denied');
  }

  public async authorizeTaskMutation(worker: AuthenticatedWorker, taskId: string, leaseToken: string, requiredAuthority: WorkerAuthority): Promise<void> {
    if (!worker.authorities.includes(requiredAuthority)) throw new Error('Authority denied');
    const lease = await this.pool.query(
      `SELECT 1 FROM task_attempts WHERE task_id=$1 AND worker_id=$2 AND lease_token_hash=$3
        AND status='ACTIVE' AND lease_expires_at>CURRENT_TIMESTAMP`,
      [taskId, worker.workerId, this.hashSecret(leaseToken)]);
    if (lease.rowCount === 0) throw new Error('Lease owner mismatch');

    const requirements = await this.pool.query('SELECT capability FROM task_required_capabilities WHERE task_id=$1', [taskId]);
    if (requirements.rows.some(r => !worker.capabilities.includes(r.capability))) throw new Error('Capability denied');

    const authorityRequirements = await this.pool.query('SELECT authority FROM task_required_authorities WHERE task_id=$1', [taskId]);
    if (authorityRequirements.rows.some(r => !worker.authorities.includes(r.authority))) throw new Error('Authority denied');

    const gate = await this.pool.query('SELECT human_approval_required FROM worker_authorities WHERE worker_id=$1 AND authority=$2', [worker.workerId, requiredAuthority]);
    if (gate.rows[0]?.human_approval_required) {
      const approval = await this.pool.query(
        `SELECT 1 FROM task_authority_approvals WHERE task_id=$1 AND authority=$2 AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP) LIMIT 1`, [taskId, requiredAuthority]);
      if (approval.rowCount === 0) throw new Error('Human approval required');
    }
  }

  public async createCredential(workerId: string, ttlSeconds: number | null = null): Promise<{ secret: string; expiresAt: Date | null }> {
    const secret = crypto.randomBytes(32).toString('hex');
    const expiresAt = ttlSeconds == null ? null : new Date(Date.now() + ttlSeconds * 1000);
    await this.pool.query('INSERT INTO worker_credentials (worker_id,secret_hash,expires_at) VALUES ($1,$2,$3)', [workerId, this.hashSecret(secret), expiresAt]);
    return { secret, expiresAt };
  }

  public async issueAccessToken(worker: AuthenticatedWorker, authorities: WorkerAuthority[], capabilities: string[], ttlSeconds = 900): Promise<{ token: string; expiresAt: Date }> {
    if (ttlSeconds < 1 || ttlSeconds > 3600) throw new Error('Invalid token TTL');
    if (authorities.some(a => !worker.authorities.includes(a))) throw new Error('Authority denied');
    if (capabilities.some(c => !worker.capabilities.includes(c))) throw new Error('Capability denied');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await this.pool.query(
      `INSERT INTO access_tokens (worker_id,token_hash,authorities,capabilities,expires_at) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5)`,
      [worker.workerId, this.hashSecret(token), JSON.stringify(authorities), JSON.stringify(capabilities), expiresAt]);
    return { token, expiresAt };
  }
}
