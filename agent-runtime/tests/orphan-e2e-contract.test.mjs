import assert from 'node:assert/strict';
import fs from 'node:fs';

const evaluator = fs.readFileSync('.github/workflows/msh-agent-state-evaluator.yml', 'utf8');
const e2e = fs.readFileSync('.github/workflows/msh-agent-orphan-e2e.yml', 'utf8');
const runtime = fs.readFileSync('.github/workflows/msh-agent-runtime.yml', 'utf8');

assert.match(evaluator, /repository_dispatch:\s*\n\s*types:\s*\[msh-watchdog-sweep\]/);
assert.match(evaluator, /github\.event_name == 'schedule' \|\| github\.event_name == 'repository_dispatch'/);
assert.match(evaluator, /Responsible:/);

assert.match(e2e, /labels:\s*\[\]/, 'synthetic issue contract should begin without orchestration labels');
assert.match(e2e, /msh-watchdog-sweep/);
assert.doesNotMatch(e2e, /issue_number.*dispatch/i, 'blind watchdog trigger must not receive issue-specific context');
assert.match(e2e, /needs:siea/);

assert.match(runtime, /run-name: MSH Agent Runtime • #\$\{\{ inputs\.issue_number \}\} • \$\{\{ inputs\.agent \}\}/);

console.log('orphan E2E contract tests passed');
