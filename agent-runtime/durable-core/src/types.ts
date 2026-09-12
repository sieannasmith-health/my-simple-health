export type TaskStatus =
  | 'QUEUED'
  | 'READY'
  | 'LEASED'
  | 'RUNNING'
  | 'VALIDATING'
  | 'RETRYABLE_FAILURE'
  | 'TERMINAL_FAILURE'
  | 'BLOCKED'
  | 'NEEDS_HUMAN'
  | 'DONE'
  | 'CANCELLED';

export type AttemptStatus = 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export interface WorkerClaimResult {
  taskId: string;
  leaseToken: string;
  leaseExpiresAt: Date;
  attemptNumber: number;
}

export interface ArtifactPayload {
  uri: string;
  contentType: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  initialBackoffSeconds: number;
  maxBackoffSeconds: number;
  backoffMultiplier: number;
  leaseTimeoutSeconds: number;
}
