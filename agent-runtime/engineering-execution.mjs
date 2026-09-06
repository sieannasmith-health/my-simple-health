import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const STATE_START = '<!-- MSH_STATE_LOCK -->';
const STATE_END = '<!-- MSH_STATE_LOCK_END -->';
const PROTECTED_PREFIXES = ['.github/workflows/', 'agent-runtime/'];
const FORBIDDEN_NAMES = ['.env', '.npmrc', '.pypirc'];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseState(body = '') {
  const fence = '```';
  const pattern = new RegExp(`${escapeRegExp(STATE_START)}\\s*${fence}json\\s*([\\s\\S]*?)\\s*${fence}\\s*${escapeRegExp(STATE_END)}`);
  const match = String(body || '').match(pattern);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function stateBlock(state) {
  return `${STATE_START}\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\`\n${STATE_END}`;
}

function normalizeImplementationPath(filePath) {
  return path.posix.normalize(filePath).replace(/^\.\//, '');
}

function isPermanentlyForbidden(normalized) {
  const basename = path.posix.basename(normalized);
  return FORBIDDEN_NAMES.includes(basename)
    || /(^|\/)(?:secrets?|credentials?|keys?)(\/|$)/i.test(normalized)
    || /\.(?:pem|p12|pfx|key|der|cer|crt)$/i.test(normalized)
    || /secret|credential|token/i.test(basename);
}

function isProtectedPath(normalized) {
  return PROTECTED_PREFIXES.some(prefix => normalized.startsWith(prefix));
}

export function maintenanceGrantAllowsPath({ issue, filePath }) {
  const normalized = normalizeImplementationPath(filePath);
  if (!isProtectedPath(normalized)) return true;

  const state = parseState(issue?.body || '');
  const grant = state?.maintenance_grant;
  if (!grant || grant.reason_code !== 'RUNTIME_MAINTENANCE_APPROVED') return false;
  if (grant.consumed_at) return false;
  if (Number(grant.issue_number) !== Number(issue?.number)) return false;
  if (!Array.isArray(grant.allowed_paths)) return false;
  return grant.allowed_paths.includes(normalized);
}

export function validateImplementationFiles(files, issue) {
  if (!Array.isArray(files) || files.length < 1 || files.length > 8) {
    throw new Error('Implementation must contain 1-8 file replacements.');
  }

  let totalBytes = 0;
  for (const file of files) {
    if (!file || typeof file.path !== 'string' || typeof file.content !== 'string') {
      throw new Error('Each implementation file requires path and content strings.');
    }

    const normalized = normalizeImplementationPath(file.path);
    if (!normalized || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
      throw new Error(`Unsafe implementation path: ${file.path}`);
    }
    if (isPermanentlyForbidden(normalized)) {
      throw new Error(`Implementation path is permanently protected from secrets/credentials access: ${normalized}`);
    }
    if (isProtectedPath(normalized) && !maintenanceGrantAllowsPath({ issue, filePath: normalized })) {
      throw new Error(`Implementation path is protected from self-modification without a valid scoped maintenance grant: ${normalized}`);
    }

    totalBytes += Buffer.byteLength(file.content, 'utf8');
  }

  if (totalBytes > 250_000) throw new Error('Implementation payload exceeds 250 KB safety limit.');
}

async function consumeMaintenanceGrant(issue, files, github) {
  const protectedPaths = files
    .map(file => normalizeImplementationPath(file.path))
    .filter(isProtectedPath);
  if (protectedPaths.length === 0) return;

  const state = parseState(issue.body || '');
  const grant = state?.maintenance_grant;
  if (!grant || grant.reason_code !== 'RUNTIME_MAINTENANCE_APPROVED' || grant.consumed_at) {
    throw new Error('Protected runtime implementation attempted without an unconsumed maintenance grant.');
  }
  if (Number(grant.issue_number) !== Number(issue.number)) {
    throw new Error('Maintenance grant issue scope does not match current issue.');
  }
  if (!protectedPaths.every(filePath => grant.allowed_paths?.includes(filePath))) {
    throw new Error('Maintenance grant path scope does not cover the requested protected implementation files.');
  }

  const fresh = await github(`/issues/${issue.number}`);
  const freshState = parseState(fresh.body || '');
  const freshGrant = freshState?.maintenance_grant;
  if (!freshGrant || freshGrant.reason_code !== 'RUNTIME_MAINTENANCE_APPROVED' || freshGrant.consumed_at) {
    throw new Error('Maintenance grant is missing or already consumed in authoritative state.');
  }
  if (freshGrant.grant_id !== grant.grant_id || Number(freshGrant.issue_number) !== Number(issue.number)) {
    throw new Error('Maintenance grant changed before consumption.');
  }
  if (!protectedPaths.every(filePath => freshGrant.allowed_paths?.includes(filePath))) {
    throw new Error('Authoritative maintenance grant no longer covers requested protected paths.');
  }

  const consumedAt = new Date().toISOString();
  const nextState = {
    ...freshState,
    maintenance_grant: {
      ...freshGrant,
      consumed_at: consumedAt
    },
    history: [...(Array.isArray(freshState.history) ? freshState.history : []), {
      at: consumedAt,
      event: 'RUNTIME_MAINTENANCE_GRANT_CONSUMED',
      grant_id: freshGrant.grant_id,
      paths: protectedPaths
    }].slice(-20),
    updated_at: consumedAt
  };
  const pattern = new RegExp(`${escapeRegExp(STATE_START)}[\\s\\S]*?${escapeRegExp(STATE_END)}`);
  const body = pattern.test(fresh.body || '')
    ? (fresh.body || '').replace(pattern, stateBlock(nextState))
    : `${fresh.body || ''}\n\n${stateBlock(nextState)}`.trim();
  await github(`/issues/${issue.number}`, { method: 'PATCH', body: JSON.stringify({ body }) });
  issue.body = body;
  console.log(`[MAINTENANCE_ELEVATION] Consumed scoped runtime maintenance grant ${freshGrant.grant_id}.`);
}

export function executionApproved(issue, agentKey, labelNames) {
  const approved = labelNames(issue).includes('execution:approved');
  if (agentKey === 'nomy') return approved;
  return agentKey === 'selah' && approved;
}

export async function applyImplementation({ issue, result, github, labelNames }) {
  const impl = result.implementation;
  if (!impl) return null;
  if (!executionApproved(issue, 'selah', labelNames)) {
    throw new Error('Implementation returned without execution:approved authority.');
  }

  validateImplementationFiles(impl.files, issue);
  await consumeMaintenanceGrant(issue, impl.files, github);

  const branch = `agent/issue-${issue.number}-selah-${Date.now()}`;
  execFileSync('git', ['config', 'user.name', 'MSH Selah Agent'], { stdio: 'inherit' });
  execFileSync('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], { stdio: 'inherit' });
  execFileSync('git', ['checkout', '-b', branch], { stdio: 'inherit' });

  for (const file of impl.files) {
    const normalized = normalizeImplementationPath(file.path);
    const localPath = path.resolve(process.cwd(), normalized);
    const root = `${path.resolve(process.cwd())}${path.sep}`;
    if (!localPath.startsWith(root)) throw new Error(`Resolved path escaped repository root: ${normalized}`);
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, file.content, 'utf8');
  }

  execFileSync('git', ['add', '--', ...impl.files.map(file => normalizeImplementationPath(file.path))], { stdio: 'inherit' });
  const diff = execFileSync('git', ['diff', '--cached', '--stat'], { encoding: 'utf8' }).trim();
  if (!diff) throw new Error('Implementation produced no repository changes.');

  execFileSync('git', ['commit', '-m', `Agent implementation for #${issue.number}: ${issue.title}`.slice(0, 200)], { stdio: 'inherit' });
  execFileSync('git', ['push', '--set-upstream', 'origin', branch], { stdio: 'inherit' });

  const pr = await github('/pulls', {
    method: 'POST',
    body: JSON.stringify({
      title: `[Agent] ${issue.title}`.slice(0, 240),
      head: branch,
      base: 'main',
      body: `Automated engineering proposal for #${issue.number}.\n\n${impl.summary}\n\nCreated under explicit execution authority${impl.files.some(file => isProtectedPath(normalizeImplementationPath(file.path))) ? ' and a consumed, scoped runtime-maintenance grant' : ''}. CI and QA review remain required before Product acceptance.`,
      maintainer_can_modify: true
    })
  });

  return { branch, prNumber: pr.number, prUrl: pr.html_url, diff };
}
