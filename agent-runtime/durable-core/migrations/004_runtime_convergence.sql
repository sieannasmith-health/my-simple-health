CREATE TABLE IF NOT EXISTS external_objective_bindings (
  source_system VARCHAR(50) NOT NULL,
  external_objective_key VARCHAR(255) NOT NULL,
  objective_id UUID NOT NULL REFERENCES objectives(objective_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (source_system, external_objective_key),
  UNIQUE (objective_id)
);

CREATE TABLE IF NOT EXISTS external_task_bindings (
  source_system VARCHAR(50) NOT NULL,
  external_task_key VARCHAR(255) NOT NULL,
  task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (source_system, external_task_key),
  UNIQUE (task_id)
);

CREATE INDEX IF NOT EXISTS idx_external_objective_binding_objective
  ON external_objective_bindings(objective_id);
CREATE INDEX IF NOT EXISTS idx_external_task_binding_task
  ON external_task_bindings(task_id);
