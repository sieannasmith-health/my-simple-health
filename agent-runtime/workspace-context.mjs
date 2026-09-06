import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.md', '.yml', '.yaml',
  '.swift', '.py', '.sh', '.sql', '.txt', '.toml', '.ini', '.xml', '.html', '.css'
]);

const EXCLUDED_SEGMENTS = new Set([
  '.git', 'node_modules', '.build', 'build', 'dist', 'DerivedData', '.next', 'Pods', 'vendor'
]);

function normalizeRelative(root, candidate) {
  const absolute = path.resolve(root, candidate);
  const rootPrefix = `${path.resolve(root)}${path.sep}`;
  if (absolute !== path.resolve(root) && !absolute.startsWith(rootPrefix)) return null;
  return path.relative(root, absolute).split(path.sep).join('/');
}

function safeTrackedPath(filePath) {
  if (!filePath || path.posix.isAbsolute(filePath) || filePath.startsWith('../')) return false;
  const segments = filePath.split('/');
  if (segments.some(segment => EXCLUDED_SEGMENTS.has(segment))) return false;
  return TEXT_EXTENSIONS.has(path.posix.extname(filePath));
}

export function repositoryRoot(env = process.env, cwd = process.cwd()) {
  return path.resolve(env.GITHUB_WORKSPACE || cwd);
}

export function listTrackedWorkspaceFiles(root) {
  const output = execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8' });
  return output.split('\0').filter(Boolean).filter(safeTrackedPath).sort();
}

function objectiveTerms(objectiveText) {
  return [...new Set((objectiveText.toLowerCase().match(/[a-z0-9_-]{4,}/g) || [])
    .filter(term => !['this', 'that', 'with', 'from', 'must', 'should', 'issue', 'objective', 'required', 'acceptance'].includes(term)))]
    .slice(0, 40);
}

function scorePath(filePath, terms) {
  const lower = filePath.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (lower.includes(term)) score += term.length >= 8 ? 5 : 3;
  }
  if (lower.startsWith('agent-runtime/')) score += 2;
  if (lower.includes('/tests/') || lower.includes('.test.')) score += 1;
  if (lower === 'agents.md') score -= 10;
  return score;
}

export function selectWorkspacePaths({ root, explicitPaths = [], objectiveText = '', maxFiles = 8 }) {
  const tracked = listTrackedWorkspaceFiles(root);
  const trackedSet = new Set(tracked);
  const explicit = explicitPaths
    .map(candidate => normalizeRelative(root, candidate))
    .filter(candidate => candidate && trackedSet.has(candidate) && safeTrackedPath(candidate));

  if (explicit.length > 0) {
    return { mode: 'EXPLICIT_PATHS', manifest: tracked, selected: [...new Set(explicit)].slice(0, maxFiles) };
  }

  const terms = objectiveTerms(objectiveText);
  const ranked = tracked
    .map(filePath => ({ filePath, score: scorePath(filePath, terms) }))
    .sort((a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath));

  const positive = ranked.filter(item => item.score > 0).map(item => item.filePath);
  const fallback = ranked.map(item => item.filePath);
  return {
    mode: 'WORKSPACE_FALLBACK',
    manifest: tracked,
    selected: (positive.length > 0 ? positive : fallback).slice(0, maxFiles)
  };
}

export async function hydrateWorkspaceContext({ root, explicitPaths = [], objectiveText = '', maxFiles = 8, maxBytesPerFile = 7000 }) {
  const selection = selectWorkspacePaths({ root, explicitPaths, objectiveText, maxFiles });
  const excerpts = [];

  for (const filePath of selection.selected) {
    const absolute = path.join(root, filePath);
    try {
      const content = await fs.readFile(absolute, 'utf8');
      excerpts.push(`FILE: ${filePath}\n${content.slice(0, maxBytesPerFile)}`);
    } catch {
      // A tracked file can disappear between checkout and hydration only if the workspace mutates.
      // Skip it and preserve the rest of the deterministic context rather than escalating to a human.
    }
  }

  return {
    root,
    mode: selection.mode,
    manifest: selection.manifest,
    selected: selection.selected,
    excerpts
  };
}
