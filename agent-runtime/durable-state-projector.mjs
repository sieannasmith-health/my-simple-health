import { Pool } from 'pg';

const START = '<!-- MSH_STATE_LOCK -->';
const END = '<!-- MSH_STATE_LOCK_END -->';
const DATABASE_URL = process.env.DURABLE_RUNTIME_DATABASE_URL || process.env.DATABASE_URL || '';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseState(body = '') {
  const pattern = new RegExp(`${escapeRegExp(START)}\\s*\`\`\`json\\s*([\\s\\S]*?)\\s*\`\`\`\\s*${escapeRegExp(END)}`);
  const match = body.match(pattern);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function stateBlock(state) {
  return `${START}\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\`\n${END}`;
}

export async function readDurableProjection({ repository, issueNumber, pool = null }) {
  if (!DATABASE_URL && !pool) throw new Error('DURABLE_RUNTIME_DATABASE_URL is required for durable state projection.');
  const ownsPool = !pool;
  const db = pool || new Pool({ connectionString: DATABASE_URL, max: 3 });
  try {
    const externalObjectiveKey = `${repository}#${issueNumber}`;
    const result = await db.query(
      `SELECT o.objective_id, o.status AS objective_status,
              t.task_id, t.status AS task_status, t.assigned_worker_role,
              t.updated_at, a.attempt_id, a.status AS attempt_status,
              a.attempt_number, a.failure_class
         FROM external_objective_bindings eob
         JOIN objectives o ON o.objective_id=eob.objective_id
         LEFT JOIN tasks t ON t.parent_objective_id=o.objective_id
         LEFT JOIN LATERAL (
           SELECT attempt_id,status,attempt_number,failure_class
             FROM task_attempts
            WHERE task_id=t.task_id
            ORDER BY attempt_number DESC LIMIT 1
         ) a ON TRUE
        WHERE eob.source_system='github' AND eob.external_objective_key=$1
        ORDER BY t.updated_at DESC NULLS LAST
        LIMIT 1`,
      [externalObjectiveKey],
    );
    if (result.rowCount === 0) return null;
    const row = result.rows[0];
    return {
      authority: 'postgres',
      objective_id: row.objective_id,
      objective_status: row.objective_status,
      task_id: row.task_id,
      task_status: row.task_status,
      assigned_worker_role: row.assigned_worker_role,
      attempt_id: row.attempt_id,
      attempt_status: row.attempt_status,
      attempt_number: row.attempt_number,
      failure_class: row.failure_class,
      projected_at: new Date().toISOString(),
    };
  } finally {
    if (ownsPool) await db.end();
  }
}

export async function projectDurableStateToGitHub({ repository, issueNumber, token, pool = null }) {
  if (!token || !repository || !issueNumber) return null;
  const projection = await readDurableProjection({ repository, issueNumber, pool });
  if (!projection) return null;

  const [owner, repo] = repository.split('/');
  const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
  const response = await fetch(`${apiBase}/issues/${issueNumber}`, { headers });
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${await response.text()}`);
  const issue = await response.json();
  const current = parseState(issue.body || '');
  if (!current) return projection;

  const next = { ...current, durable_runtime: projection };
  const pattern = new RegExp(`${escapeRegExp(START)}[\\s\\S]*?${escapeRegExp(END)}`);
  const body = pattern.test(issue.body || '')
    ? (issue.body || '').replace(pattern, stateBlock(next))
    : `${issue.body || ''}\n\n${stateBlock(next)}`.trim();
  const patch = await fetch(`${apiBase}/issues/${issueNumber}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ body }),
  });
  if (!patch.ok) throw new Error(`GitHub ${patch.status}: ${await patch.text()}`);
  return projection;
}
