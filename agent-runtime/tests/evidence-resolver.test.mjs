import assert from 'node:assert/strict';
import { resolveRequiredEvidence } from '../evidence-resolver.mjs';

function pr(number, { state = 'open', sha = `sha${number}`, ref = `fix/${number}` } = {}) {
  return {
    number,
    html_url: `https://example.invalid/pull/${number}`,
    state,
    draft: false,
    mergeable: true,
    head: { sha, ref },
    base: { ref: 'main' }
  };
}

{
  const calls = [];
  const github = async path => {
    calls.push(path);
    if (path === '/pulls/173') return pr(173, { sha: 'abc123', ref: 'fix/runtime' });
    if (path === '/pulls/173/files?per_page=100') {
      return [{ filename: 'agent-runtime/run-v2.mjs', status: 'modified', additions: 10, deletions: 2, patch: '@@ test @@' }];
    }
    if (path === '/commits/abc123/check-runs?per_page=100') {
      return { check_runs: [{ name: 'runtime-test', status: 'completed', conclusion: 'success' }] };
    }
    if (path === '/commits/abc123/status') return { state: 'success', statuses: [] };
    if (path.startsWith('/pulls?')) return [];
    throw new Error(`Unexpected GitHub call: ${path}`);
  };

  const result = await resolveRequiredEvidence({
    state: { current_stage: 'QA', history: [{ evidence: { pr_number: 173 } }] },
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
}

{
  const github = async path => {
    if (path === '/pulls/209') return pr(209, { state: 'closed', sha: 'old209', ref: 'agent/issue-195-old' });
    if (path === '/pulls/209/files?per_page=100') return [{ filename: 'agent-runtime/state-evaluator.mjs', status: 'modified', additions: 1, deletions: 1, patch: '@@ old @@' }];
    if (path === '/commits/old209/check-runs?per_page=100') return { check_runs: [] };
    if (path === '/commits/old209/status') return { state: 'failure', statuses: [] };

    if (path === '/pulls/220') return pr(220, { state: 'open', sha: 'new220', ref: 'agent/issue-195-selah' });
    if (path === '/pulls/220/files?per_page=100') return [{ filename: 'agent-runtime/turn-transition.mjs', status: 'modified', additions: 20, deletions: 3, patch: '@@ new @@' }];
    if (path === '/commits/new220/check-runs?per_page=100') {
      return { check_runs: [{ name: 'MSH Agent Runtime Structural Test', status: 'completed', conclusion: 'success' }] };
    }
    if (path === '/commits/new220/status') return { state: 'success', statuses: [] };

    if (path.startsWith('/pulls?')) {
      return [
        { number: 220, title: 'Fix #195', body: 'Relates to #195', head: { ref: 'agent/issue-195-selah' } },
        { number: 209, title: 'Old #195', body: 'Relates to #195', head: { ref: 'agent/issue-195-old' } }
      ];
    }
    throw new Error(`Unexpected GitHub call: ${path}`);
  };

  const result = await resolveRequiredEvidence({
    state: {
      current_stage: 'QA',
      evidence: { pr_number: 209 },
      history: [{ evidence: { pr_number: 209 } }]
    },
    issue: { number: 195, body: 'Current implementation is PR #220. Prior PR #209 is superseded.' },
    comments: [{ body: 'Review PR #220 head new220.' }],
    eventPayload: { pull_request: null },
    github
  });

  assert.equal(result.required, true);
  assert.equal(result.resolved_via, 'ACTIVE_ISSUE_ASSOCIATION');
  assert.equal(result.pr.pr_number, 220, 'One active issue-associated PR must outrank closed stale history');
  assert.equal(result.pr.head_sha, 'new220');
  assert.equal(result.pr.check_runs[0].conclusion, 'success');
}

{
  const calls = [];
  const github = async path => {
    calls.push(path);
    if (path === '/pulls/324') return pr(324, { sha: 'head324', ref: 'selah/agent-os-runtime-hydration' });
    if (path === '/pulls/324/files?per_page=100') return [{ filename: 'agent-runtime/agent-graph.mjs', status: 'modified', additions: 25, deletions: 22, patch: '@@ routing @@' }];
    if (path === '/commits/head324/check-runs?per_page=100') return { check_runs: [{ name: 'MSH Agent Runtime Structural Test', status: 'completed', conclusion: 'success' }] };
    if (path === '/commits/head324/status') return { state: 'success', statuses: [] };
    throw new Error(`Unexpected GitHub call: ${path}`);
  };

  const result = await resolveRequiredEvidence({
    state: { current_stage: 'QA', history: [] },
    issue: { number: 324, body: '', pull_request: { url: 'https://api.github.com/repos/example/repo/pulls/324' } },
    comments: [],
    eventPayload: { pull_request: null },
    github
  });

  assert.equal(result.required, true);
  assert.equal(result.resolved_via, 'CURRENT_PR_THREAD');
  assert.equal(result.pr.pr_number, 324);
  assert.equal(result.pr.head_sha, 'head324');
  assert.ok(calls.includes('/pulls/324'));
  assert.ok(!calls.some(path => path.startsWith('/pulls?')), 'PR-thread evidence must not fall through to association search');
}

{
  const github = async path => {
    if (path.startsWith('/pulls?')) return [];
    throw new Error(`Unexpected GitHub call: ${path}`);
  };
  const planning = await resolveRequiredEvidence({
    state: { current_stage: 'INITIAL_TRIAGE', history: [] },
    issue: { number: 169, body: '' },
    comments: [],
    eventPayload: { pull_request: null },
    github
  });
  assert.equal(planning.required, false);
  assert.equal(planning.resolved_via, 'NOT_REQUIRED');
}

console.log('PASS: QA evidence resolves current PR threads, prefers the one active issue PR over closed stale history, and remains optional in triage.');
