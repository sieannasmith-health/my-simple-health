import express, { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { DurableKernel } from './kernel.js';
import { AuthenticatedWorker, IdentityAuthorityService, WorkerAuthority } from './identity.js';

const idempotency = z.string().min(1).max(255);
const leaseToken = z.string().min(32).max(256);
const taskId = z.string().uuid();
const authority = z.enum(['READ','PROPOSE','WRITE','REVIEW','MERGE','DEPLOY']);
const artifact = z.object({ uri: z.string().min(1).max(2048), contentType: z.string().min(1).max(100) }).strict();
const claimSchema = z.object({ role: z.string().min(1).max(100), idempotencyKey: idempotency }).strict();
const leasedTaskSchema = z.object({ leaseToken, idempotencyKey: idempotency }).strict();
const artifactSchema = leasedTaskSchema.extend({ artifact });
const completionSchema = leasedTaskSchema.extend({ artifacts: z.array(artifact).max(100).default([]) });
const failureSchema = leasedTaskSchema.extend({ failureClass: z.string().min(1).max(100), errorLog: z.string().max(20000).nullable().optional() });
const tokenSchema = z.object({
  authorities: z.array(authority).max(10),
  capabilities: z.array(z.string().min(1).max(120)).max(50),
  ttlSeconds: z.number().int().min(1).max(3600).default(900),
}).strict();

type AuthenticatedRequest = Request & { worker?: AuthenticatedWorker };

export function createWorkerApi(kernel: DurableKernel, identity?: IdentityAuthorityService) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  if (identity) app.use(asyncRoute(async (req: AuthenticatedRequest, _res, next) => {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) throw new Error('Authentication failed');
    const secret = header.slice(7).trim();
    if (!secret) throw new Error('Authentication failed');
    try { req.worker = await identity.authenticateAccessToken(secret); }
    catch { req.worker = await identity.authenticateBearer(secret); }
    next();
  }));

  app.post('/v1/auth/tokens', asyncRoute(async (req: AuthenticatedRequest, res) => {
    if (!identity) throw new Error('Authentication failed');
    const worker = requireWorker(req, identity);
    const body = tokenSchema.parse(req.body);
    const issued = await identity.issueAccessToken(worker, body.authorities, body.capabilities, body.ttlSeconds);
    return res.status(201).json(issued);
  }));

  app.post('/v1/worker/claims', asyncRoute(async (req: AuthenticatedRequest, res) => {
    const body = claimSchema.parse(req.body); const worker = requireWorker(req, identity);
    if (identity) await identity.authorizeTaskClaim(worker, body.role);
    const claim = await kernel.claimLease(worker.workerId, body.role, body.idempotencyKey);
    if (!claim) return res.status(204).end();
    return res.status(200).json(claim);
  }));

  app.post('/v1/tasks/:taskId/start', leasedRoute(identity, 'WRITE', async (kernel, taskIdValue, body) => { await kernel.startAttempt(taskIdValue, body.leaseToken, body.idempotencyKey); }, kernel));
  app.post('/v1/tasks/:taskId/heartbeat', asyncRoute(async (req: AuthenticatedRequest, res) => {
    const params = z.object({ taskId }).parse(req.params); const body = leasedTaskSchema.parse(req.body); const worker = requireWorker(req, identity);
    await authorize(identity, worker, params.taskId, body.leaseToken, 'WRITE');
    const leaseExpiresAt = await kernel.heartbeat(params.taskId, body.leaseToken, body.idempotencyKey); return res.status(200).json({ leaseExpiresAt });
  }));
  app.post('/v1/tasks/:taskId/artifacts', asyncRoute(async (req: AuthenticatedRequest, res) => {
    const params = z.object({ taskId }).parse(req.params); const body = artifactSchema.parse(req.body); const worker = requireWorker(req, identity);
    await authorize(identity, worker, params.taskId, body.leaseToken, 'WRITE');
    await kernel.registerArtifact(params.taskId, body.leaseToken, body.artifact, body.idempotencyKey); return res.status(201).end();
  }));
  app.post('/v1/tasks/:taskId/complete', asyncRoute(async (req: AuthenticatedRequest, res) => {
    const params = z.object({ taskId }).parse(req.params); const body = completionSchema.parse(req.body); const worker = requireWorker(req, identity);
    await authorize(identity, worker, params.taskId, body.leaseToken, 'WRITE');
    await kernel.submitCompletion(params.taskId, body.leaseToken, body.artifacts, body.idempotencyKey); return res.status(204).end();
  }));
  app.post('/v1/tasks/:taskId/fail', asyncRoute(async (req: AuthenticatedRequest, res) => {
    const params = z.object({ taskId }).parse(req.params); const body = failureSchema.parse(req.body); const worker = requireWorker(req, identity);
    await authorize(identity, worker, params.taskId, body.leaseToken, 'WRITE');
    await kernel.failAttempt(params.taskId, body.leaseToken, body.failureClass, body.errorLog ?? null, body.idempotencyKey); return res.status(204).end();
  }));

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) return res.status(400).json({ error: 'INVALID_CONTRACT', issues: error.issues });
    const message = error instanceof Error ? error.message : 'Unknown runtime error';
    if (/Authentication failed|Worker inactive/.test(message)) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    if (/Human approval required/.test(message)) return res.status(403).json({ error: 'HUMAN_APPROVAL_REQUIRED' });
    if (/Authority denied|Capability denied|Lease owner mismatch/.test(message)) return res.status(403).json({ error: 'FORBIDDEN' });
    if (/Lease fencing breach/.test(message)) return res.status(409).json({ error: 'LEASE_FENCED' });
    if (/Invalid .* transition|Concurrency conflict/.test(message)) return res.status(409).json({ error: 'STATE_CONFLICT' });
    if (/Task not found/.test(message)) return res.status(404).json({ error: 'TASK_NOT_FOUND' });
    if (/Invalid token TTL/.test(message)) return res.status(400).json({ error: 'INVALID_TOKEN_SCOPE' });
    return res.status(500).json({ error: 'RUNTIME_ERROR' });
  });
  return app;
}

function leasedRoute(identity: IdentityAuthorityService | undefined, authority: WorkerAuthority, action: (kernel: DurableKernel, taskIdValue: string, body: z.infer<typeof leasedTaskSchema>) => Promise<void>, kernel: DurableKernel) {
  return asyncRoute(async (req: AuthenticatedRequest, res) => {
    const params = z.object({ taskId }).parse(req.params); const body = leasedTaskSchema.parse(req.body); const worker = requireWorker(req, identity);
    await authorize(identity, worker, params.taskId, body.leaseToken, authority); await action(kernel, params.taskId, body); return res.status(204).end();
  });
}
function requireWorker(req: AuthenticatedRequest, identity?: IdentityAuthorityService): AuthenticatedWorker {
  if (req.worker) return req.worker;
  if (!identity) return { workerId: 'legacy-worker', role: String(req.body?.role ?? 'legacy'), trustLevel: 'LEGACY', capabilities: [], authorities: ['WRITE'] };
  throw new Error('Authentication failed');
}
async function authorize(identity: IdentityAuthorityService | undefined, worker: AuthenticatedWorker, taskIdValue: string, token: string, authority: WorkerAuthority) { if (identity) await identity.authorizeTaskMutation(worker, taskIdValue, token, authority); }
function asyncRoute(handler: (req: any, res: Response, next: NextFunction) => Promise<Response | void>) { return (req: Request, res: Response, next: NextFunction) => { void handler(req, res, next).catch(next); }; }
