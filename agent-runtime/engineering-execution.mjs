import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function validateImplementationFiles(files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > 8) {
    throw new Error('Implementation must contain 1-8 file replacements.');
  }

  const forbiddenPrefixes = ['.github/', 'agent-runtime/'];
  const forbiddenNames = ['.env', '.npmrc', '.pypirc'];
  let totalBytes = 0;

  for (const file of files) {
    if (!file || typeof file.path !== 'string' || typeof file.content !== 'string') {
      throw new Error('Each implementation file requires path and content strings.');
    }
    const normalized = path.posix.normalize(file.path).replace(/^\.\//, '');
    if (!normalized || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
      throw new Error(`Unsafe implementation path: ${file.path}`);
    }
    if (forbiddenPrefixes.some(prefix => normalized.startsWith(prefix)) || forbiddenNames.includes(path.posix.basename(normalized))) {
      throw new Error(`Implementation path is protected from self-modification or secrets: ${normalized}`);
    }
    if (/secret|credential|token/i.test(path.posix.basename(normalized))) {
      throw new Error(`Implementation path rejected because it may contain sensitive material: ${normalized}`);
    }
    totalBytes += Buffer.byteLength(file.content, 'utf8');
  }

  if (totalBytes > 250_000) throw new Error('Implementation payload exceeds 250 KB safety limit.');
}

export function executionApproved(issue, agentKey, labelNames) {
  return agentKey === 'selah' && labelNames(issue).includes('execution:approved');
}

export async function applyImplementation({ issue, result, github, labelNames }) {
  const impl = result.implementation;
  if (!impl) return null;
  if (!executionApproved(issue, 'selah', labelNames)) {
    throw new Error('Implementation returned without execution:approved authority.');
  }

  validateImplementationFiles(impl.files);
  const branch = `agent/issue-${issue.number}-selah-${Date.now()}`;

  execFileSync('git', ['config', 'user.name', 'MSH Selah Agent'], { stdio: 'inherit' });
  execFileSync('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], { stdio: 'inherit' });
  execFileSync('git', ['checkout', '-b', branch], { stdio: 'inherit' });

  for (const file of impl.files) {
    const normalized = path.posix.normalize(file.path).replace(/^\.\//, '');
    const localPath = path.resolve(process.cwd(), normalized);
    const root = `${path.resolve(process.cwd())}${path.sep}`;
    if (!localPath.startsWith(root)) throw new Error(`Resolved path escaped repository root: ${normalized}`);
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, file.content, 'utf8');
  }

  execFileSync('git', ['add', '--', ...impl.files.map(file => path.posix.normalize(file.path).replace(/^\.\//, ''))], { stdio: 'inherit' });
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
      body: `Automated engineering proposal for #${issue.number}.\n\n${impl.summary}\n\nCreated under the explicit execution:approved gate. CI and QA review remain required before Product acceptance.`,
      maintainer_can_modify: true
    })
  });

  return { branch, prNumber: pr.number, prUrl: pr.html_url, diff };
}