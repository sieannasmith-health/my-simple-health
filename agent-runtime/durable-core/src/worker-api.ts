import express, { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { DurableKernel } from './kernel.js';

const idempotency = z.string().min(1).max(255);
const leaseToken = z.string().min(32).max(256);
const taskId = z.string().uuid();
const artifact = z.object({ uri: z.string().min(1).max(2048), contentType: z.string().min(1).max(100) }).strict();

const claimSchema = z.object({ workerId: z.string().min(1).max(100), role: z.string().min(1).max(100), idempotencyKey: idempotency }).strict();
const leasedTaskSchema = z.object({ leaseToken, idempotencyKey: idempotency }).strict();
const artifactSchema = leasedTaskSchema.extend({ artifact });
const completionSchema = leasedTaskSchema.extend({ artifacts: z.array(artifact).max(100).default([]) });
const failureSchema = leasedTaskSchema.extend({ failureClass: z.string().min(1).max(100), errorLog: z.string().max(20000).nullable().optional() });

export function createWorkerApi(kernel: DurableKernel) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  app.post('/v1/worker/claims', asyncRoute(async (req, res) => {
    const body = claimSchema.parse(req.body);
    const claim = await kernel.claimLease(body.workerId, body.role, body.idempotencyKey);
    if (!claim) return res.status(204).end();
    return res.status(200).json(claim);
  }));

  app.post('/v1/tasks/:taskId/start', asyncRoute(async (req, res) => {
    const params = z.object({ taskId }).parse(req.params); const body = leasedTaskSchema.parse(req.body);
    await kernel.startAttempt(params.taskId, body.leaseToken, body.idempotencyKey); return res.status(204).end();
  }));

  app.post('/v1/tasks/:taskId/heartbeat', asyncRoute(async (req, res) => {
    const params = z.object({ taskId }).parse(req.params); const body = leasedTaskSchema.parse(req.body);
    const leaseExpiresAt = await kernel.heartbeat(params.taskId, body.leaseToken, body.idempotencyKey);
    return res.status(200).json({ leaseExpiresAt });
  }));

  app.post('/v1/tasks/:taskId/artifacts', asyncRoute(async (req, res) => {
    const params = z.object({ taskId }).parse(req.params); const body = artifactSchema.parse(req.body);
    await kernel.registerArtifact(params.taskId, body.leaseToken, body.artifact, body.idempotencyKey); return res.status(201).end();
  }));

  app.post('/v1/tasks/:taskId/complete', asyncRoute(async (req, res) => {
    const params = z.object({ taskId }).parse(req.params); const body = completionSchema.parse(req.body);
    await kernel.submitCompletion(params.taskId, body.leaseToken, body.artifacts, body.idempotencyKey); return res.status(204).end();
  }));

  app.post('/v1/tasks/:taskId/fail', asyncRoute(async (req, res) => {
    const params = z.object({ taskId }).parse(req.params); const body = failureSchema.parse(req.body);
    await kernel.failAttempt(params.taskId, body.leaseToken, body.failureClass, body.errorLog ?? null, body.idempotencyKey); return res.status(204).end();
  }));

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) return res.status(400).json({ error: 'INVALID_CONTRACT', issues: error.issues });
    const message = error instanceof Error ? error.message : 'Unknown runtime error';
    if (/Lease fencing breach/.test(message)) return res.status(409).json({ error: 'LEASE_FENCED' });
    if (/Invalid .* transition|Concurrency conflict/.test(message)) return res.status(409).json({ error: 'STATE_CONFLICT' });
    if (/Task not found/.test(message)) return res.status(404).json({ error: 'TASK_NOT_FOUND' });
    return res.status(500).json({ error: 'RUNTIME_ERROR' });
  });
  return app;
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<Response | void>) {
  return (req: Request, res: Response, next: NextFunction) => { void handler(req, res).catch(next); };
}
