import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { hydrateWorkspaceContext, repositoryRoot, selectWorkspacePaths } from '../workspace-context.mjs';

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'msh-workspace-context-'));
  execFileSync('git', ['-C', root, 'init', '-q']);
  fs.mkdirSync(path.join(root, 'agent-runtime', 'tests'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'agent-runtime', 'state-hydrated-runner.mjs'), 'const reason_code = true;\n');
  fs.writeFileSync(path.join(root, 'agent-runtime', 'post-turn-reconciler.mjs'), 'const normalize = true;\n');
  fs.writeFileSync(path.join(root, 'agent-runtime', 'tests', 'reason-code.test.mjs'), 'test reason code\n');
  fs.writeFileSync(path.join(root, 'src', 'unrelated.js'), 'console.log("unrelated");\n');
  execFileSync('git', ['-C', root, 'add', '.']);
  return root;
}

test('repositoryRoot prefers GITHUB_WORKSPACE over cwd', () => {
  assert.equal(repositoryRoot({ GITHUB_WORKSPACE: '/tmp/workspace' }, '/tmp/cwd'), path.resolve('/tmp/workspace'));
  assert.equal(repositoryRoot({}, '/tmp/cwd'), path.resolve('/tmp/cwd'));
});

test('workspace fallback selects tracked files when no explicit paths are supplied', () => {
  const root = makeRepo();
  try {
    const result = selectWorkspacePaths({
      root,
      explicitPaths: [],
      objectiveText: 'Replace runtime reason_code normalization and reconciliation behavior',
      maxFiles: 3
    });
    assert.equal(result.mode, 'WORKSPACE_FALLBACK');
    assert.ok(result.selected.length > 0);
    assert.ok(result.selected.some(file => file.startsWith('agent-runtime/')));
    assert.ok(result.manifest.includes('agent-runtime/state-hydrated-runner.mjs'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('explicit tracked files take precedence over workspace fallback', () => {
  const root = makeRepo();
  try {
    const result = selectWorkspacePaths({
      root,
      explicitPaths: ['src/unrelated.js'],
      objectiveText: 'runtime reason code',
      maxFiles: 8
    });
    assert.equal(result.mode, 'EXPLICIT_PATHS');
    assert.deepEqual(result.selected, ['src/unrelated.js']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('hydration returns bounded file contents from the checked-out tree', async () => {
  const root = makeRepo();
  try {
    const result = await hydrateWorkspaceContext({
      root,
      explicitPaths: [],
      objectiveText: 'state hydrated runtime reason_code',
      maxFiles: 2,
      maxBytesPerFile: 20
    });
    assert.equal(result.mode, 'WORKSPACE_FALLBACK');
    assert.ok(result.excerpts.length > 0);
    assert.ok(result.excerpts.every(excerpt => excerpt.startsWith('FILE: ')));
    assert.ok(result.excerpts.join('\n').includes('agent-runtime/'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
