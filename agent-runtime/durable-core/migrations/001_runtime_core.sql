CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE asdlc_event_type AS ENUM (
    'OBJECTIVE_CREATED',
    'TASK_CREATED',
    'TASK_ACTIVATED',
    'LEASE_GRANTED',
    'ATTEMPT_STARTED',
    'LEASE_RENEWED',
    'WORKER_COMPLETED',
    'VALIDATION_PASSED',
    'VALIDATION_FAILED',
    'LEASE_EXPIRED',
    'ATTEMPT_FAILED',
    'HUMAN_INTERVENTION_REQUIRED',
    'OBJECTIVE_COMPLETED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM (
    'QUEUED', 'READY', 'LEASED', 'RUNNING', 'VALIDATING',
    'RETRYABLE_FAILURE', 'TERMINAL_FAILURE', 'BLOCKED',
    'NEEDS_HUMAN', 'DONE', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attempt_status AS ENUM ('ACTIVE', 'COMPLETED', 'FAILED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS retry_policies (
  policy_id VARCHAR(50) PRIMARY KEY,
  max_attempts INT NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  initial_backoff_seconds INT NOT NULL DEFAULT 10 CHECK (initial_backoff_seconds >= 0),
  max_backoff_seconds INT NOT NULL DEFAULT 300 CHECK (max_backoff_seconds >= 0),
  backoff_multiplier DOUBLE PRECISION NOT NULL DEFAULT 2.0 CHECK (backoff_multiplier >= 1.0),
  lease_timeout_seconds INT NOT NULL DEFAULT 60 CHECK (lease_timeout_seconds > 0)
);

CREATE TABLE IF NOT EXISTS objectives (
  objective_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_objective_id UUID NOT NULL REFERENCES objectives(objective_id) ON DELETE CASCADE,
  assigned_worker_role VARCHAR(100) NOT NULL,
  status task_status NOT NULL DEFAULT 'QUEUED',
  retry_policy_id VARCHAR(50) NOT NULL REFERENCES retry_policies(policy_id),
  version INT NOT NULL DEFAULT 1,
  input_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  next_eligible_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on_task_id),
  CONSTRAINT chk_self_dependency CHECK (task_id <> depends_on_task_id)
);

CREATE TABLE IF NOT EXISTS acceptance_criteria (
  criterion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  assertion_type VARCHAR(50) NOT NULL,
  expected_value TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PASSED', 'FAILED')),
  validation_result JSONB
);

CREATE TABLE IF NOT EXISTS task_attempts (
  attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  worker_id VARCHAR(100) NOT NULL,
  attempt_number INT NOT NULL CHECK (attempt_number > 0),
  status attempt_status NOT NULL DEFAULT 'ACTIVE',
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,
  lease_token_hash VARCHAR(64) NOT NULL UNIQUE,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_expires_at TIMESTAMPTZ NOT NULL,
  failure_class VARCHAR(100),
  error_log TEXT,
  UNIQUE (task_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS event_ledger (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  event_type asdlc_event_type NOT NULL,
  associated_task_id UUID REFERENCES tasks(task_id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  associated_task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  uri TEXT NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_dispatch ON tasks (assigned_worker_role, status, next_eligible_at);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_parent ON task_dependencies (depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_task_attempts_active_lease ON task_attempts (lease_expires_at) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_event_ledger_task_time ON event_ledger (associated_task_id, timestamp);

INSERT INTO retry_policies (
  policy_id, max_attempts, initial_backoff_seconds, max_backoff_seconds,
  backoff_multiplier, lease_timeout_seconds
) VALUES ('standard-default', 3, 1, 30, 2.0, 30)
ON CONFLICT (policy_id) DO NOTHING;
