CREATE TABLE IF NOT EXISTS workers (
  worker_id VARCHAR(100) PRIMARY KEY,
  role VARCHAR(100) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','REVOKED')),
  trust_level VARCHAR(30) NOT NULL DEFAULT 'STANDARD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS worker_credentials (
  credential_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id VARCHAR(100) NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
  secret_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS worker_capabilities (
  worker_id VARCHAR(100) NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
  capability VARCHAR(120) NOT NULL,
  PRIMARY KEY (worker_id, capability)
);

CREATE TABLE IF NOT EXISTS worker_authorities (
  worker_id VARCHAR(100) NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
  authority VARCHAR(40) NOT NULL CHECK (authority IN ('READ','PROPOSE','WRITE','REVIEW','MERGE','DEPLOY')),
  human_approval_required BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (worker_id, authority)
);

CREATE TABLE IF NOT EXISTS task_required_capabilities (
  task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  capability VARCHAR(120) NOT NULL,
  PRIMARY KEY (task_id, capability)
);

CREATE TABLE IF NOT EXISTS task_required_authorities (
  task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  authority VARCHAR(40) NOT NULL CHECK (authority IN ('READ','PROPOSE','WRITE','REVIEW','MERGE','DEPLOY')),
  PRIMARY KEY (task_id, authority)
);

CREATE TABLE IF NOT EXISTS task_authority_approvals (
  approval_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  authority VARCHAR(40) NOT NULL CHECK (authority IN ('READ','PROPOSE','WRITE','REVIEW','MERGE','DEPLOY')),
  approved_by VARCHAR(120) NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS access_tokens (
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id VARCHAR(100) NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  authorities JSONB NOT NULL DEFAULT '[]'::jsonb,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_worker_credentials_hash ON worker_credentials(secret_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_access_tokens_hash ON access_tokens(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_required_capability ON task_required_capabilities(capability);
CREATE INDEX IF NOT EXISTS idx_task_required_authority ON task_required_authorities(authority);
CREATE INDEX IF NOT EXISTS idx_task_authority_approval ON task_authority_approvals(task_id, authority) WHERE revoked_at IS NULL;
