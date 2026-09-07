import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync(new URL('../src/workflows.ts', import.meta.url), 'utf8');
const activities = fs.readFileSync(new URL('../src/activities.ts', import.meta.url), 'utf8');

test('pilot preserves the required agent sequence', () => {
  for (const stage of ['NOMY', 'SELAH', 'TESSA', 'NOMY_ACCEPTANCE']) {
    assert.match(workflow, new RegExp(`['\\"]${stage}['\\"]`));
  }
});

test('Temporal owns bounded activity retry behavior', () => {
  assert.match(workflow, /activityTimeout\s*=\s*['\"]30 seconds['\"]/);
  assert.match(workflow, /startToCloseTimeout:\s*activityTimeout/);
  assert.match(workflow, /maximumAttempts:\s*3/);
});

test('pilot does not import the quarantined legacy runtime', () => {
  assert.doesNotMatch(workflow, /agent-runtime/);
  assert.doesNotMatch(activities, /agent-runtime/);
});

test('activity idempotency boundaries are restart-safe by construction', () => {
  assert.doesNotMatch(activities, /new Set<string>/);
  assert.match(workflow, /idempotencyKey\s*=\s*`\$\{input\.objectiveId\}:\$\{stage\}:record-stage`/);
  assert.match(workflow, /idempotencyKey\s*=\s*`\$\{input\.objectiveId\}:\$\{stage\}:artifact-stage`/);
  assert.match(activities, /IDEMPOTENCY_KEY_REQUIRED/);
  assert.match(activities, /durable store or an external API's idempotency support/);
});
