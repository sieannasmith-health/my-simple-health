import assert from 'node:assert/strict';
import { resolveRequiredEvidence } from '../evidence-resolver.mjs';

const calls = [];
const github = async path => {
  calls.push(path);
  if (path === '/pulls/173') {
    return {
      number: 173,
      html_url: 'https://example.invalid/pull/173',
      state: 'open',
      draft: false,
      mergeable: true,
      head: { sha: 'abc123', ref: 'fix/runtime' },
      base: { ref: 'main' }
    };
  }
  if (path === '/pulls/173/files?per_page=100') {
    return [{ filename: 'agent-runtime/run-v2.mjs', status: 'modified', additions: 10, deletions: 2, patch: '@@ test @@' }];
  }
  if (path === '/commits/abc123/check-runs?per_page=100') {
    return { check_runs: [{ name: 'runtime-test', status: 'completed', conclusion: 'success' }] };
  }
  if (path === '/commits/abc123/status') {
    return { state: 'success', statuses: [] };
  }
  if (path.startsWith('/pulls?')) return [];
  throw new Error(`Unexpected GitHub call: ${path}`);
};

const state = {
  current_stage: 'QA',
  history: [{ evidence: { pr_number: 173 } }]
};

const result = await resolveRequiredEvidence({
  state,
  issue: { number: 169, body: '' },
  comments: [],
  eventPayload: { pull_request: null },
  github
});

assert.equal(result.required, true);
assert.equal(result.resolved_via, 'STATE_HISTORY');
assert.equal(result.pr.pr_number, 173);
assert.equal(result.pr.head_sha, 'abc123');
assert.equal(result.pr.check_runs[0].conclusion, 'success');
assert.ok(calls.includes('/pulls/173'));

const planning = await resolveRequiredEvidence({
  state: { current_stage: 'INITIAL_TRIAGE', history: [] },
  issue: { number: 169, body: '' },
  comments: [],
  eventPayload: { pull_request: null },
  github
});
assert.equal(planning.required, false);
assert.equal(planning.resolved_via, 'NOT_REQUIRED');

console.log('PASS: null PR payload recovers deterministic evidence for QA and remains optional in triage.');
