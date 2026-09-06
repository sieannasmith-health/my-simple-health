import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  RUNTIME_MAINTENANCE_REASON,
  isPermanentlyForbiddenMaintenancePath,
  isProtectedRuntimePath,
  maintenanceGrantAllowsPath,
  normalizeMaintenancePath
} from './maintenance-authorization.mjs';

export function validateImplementationFiles(files, issueNumber, state) {
  if (!Array.isArray(files) || files.length < 1 || files.length > 8) {
    throw new Error('Implementation must contain 1-8 file replacements.');
  }

  let totalBytes = 0;
  for (const file of files) {
    if (!file || typeof file.path !== 'string' || typeof file.content !== 'string') {
      throw new Error('Each implementation file requires path and content strings.');
    }

    const normalized = normalizeMaintenancePath(file.path);
    if (!normalized || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
      throw new Error(`Unsafe implementation path: ${file.path}`);
    }
    if (isPermanentlyForbiddenMaintenancePath(normalized)) {
      throw new Error(`Implementation path is permanently protected from secrets/credentials access: ${normalized}`);
    }
    if (isProtectedRuntimePath(normalized) && !maintenanceGrantAllowsPath({ state, issueNumber, filePath: normalized })) {
      throw new Error(`Implementation path is protected from self-modification without a valid scoped maintenance grant: ${normalized}`);
    }

    totalBytes += Buffer.byteLength(file.content, 'utf8');
  }

  if (totalBytes > 250_000) throw new Error('Implementation payload exceeds 250 KB safety limit.');
}

function protectedImplementationPaths(files) {
  return files
    .map(file => normalizeMaintenancePath(file.path))
    .filter(isProtectedRuntimePath);
}

export function executionApproved(issue, agentKey, labelNames) {
  const approved = labelNames(issue).includes('execution:approved');
  if (agentKey === 'nomy') return approved;
  return agentKey === 'selah' && approved;
}

export async function applyImplementation({ issue, state, result, github, labelNames }) {
  const impl = result.implementation;
  if (!impl) return null;
  if (!executionApproved(issue, 'selah', labelNames)) {
    throw new Error('Implementation returned without execution:approved authority.');
  }

  validateImplementationFiles(impl.files, issue.number, state);
  const protectedPaths = protectedImplementationPaths(impl.files);
  const grant = state?.maintenance_grant || null;

  if (protectedPaths.length > 0) {
    if (!grant || grant.reason_code !== RUNTIME_MAINTENANCE_REASON || grant.consumed_at) {
      throw new Error('Protected runtime implementation attempted without an unconsumed maintenance grant.');
    }
    if (Number(grant.issue_number) !== Number(issue.number)) {
      throw new Error('Maintenance grant issue scope does not match current issue.');
    }
    if (!protectedPaths.every(filePath => grant.allowed_paths?.includes(filePath))) {
      throw new Error('Maintenance grant path scope does not cover the requested protected implementation files.');
    }
  }

  const branch = `agent/issue-${issue.number}-selah-${Date.now()}`;
  execFileSync('git', ['config', 'user.name', 'MSH Selah Agent'], { stdio: 'inherit' });
  execFileSync('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], { stdio: 'inherit' });
  execFileSync('git', ['checkout', '-b', branch], { stdio: 'inherit' });

  for (const file of impl.files) {
    const normalized = normalizeMaintenancePath(file.path);
    const localPath = path.resolve(process.cwd(), normalized);
    const root = `${path.resolve(process.cwd())}${path.sep}`;
    if (!localPath.startsWith(root)) throw new Error(`Resolved path escaped repository root: ${normalized}`);
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, file.content, 'utf8');
  }

  execFileSync('git', ['add', '--', ...impl.files.map(file => normalizeMaintenancePath(file.path))], { stdio: 'inherit' });
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
      body: `Automated engineering proposal for #${issue.number}.\n\n${impl.summary}\n\nCreated under explicit execution authority${protectedPaths.length > 0 ? ' and a scoped runtime-maintenance grant' : ''}. CI and QA review remain required before Product acceptance.`,
      maintainer_can_modify: true
    })
  });

  return {
    branch,
    prNumber: pr.number,
    prUrl: pr.html_url,
    diff,
    maintenanceGrantId: protectedPaths.length > 0 ? grant.grant_id : null,
    protectedPaths
  };
}
