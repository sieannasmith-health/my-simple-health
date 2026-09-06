import assert from 'node:assert/strict';
import test from 'node:test';
import { executionApproved } from '../engineering-execution.mjs';

function labelNames(issue) {
  return (issue.labels || []).map(label => typeof label === 'string' ? label : label.name).filter(Boolean);
}

test('Selah may execute only when execution approval is present', () => {
  assert.equal(executionApproved({ labels: ['execution:approved'] }, 'selah', labelNames), true);
  assert.equal(executionApproved({ labels: [] }, 'selah', labelNames), false);
});

test('Nomy observes existing execution approval during Product coordination', () => {
  assert.equal(executionApproved({ labels: ['execution:approved'] }, 'nomy', labelNames), true);
  assert.equal(executionApproved({ labels: [] }, 'nomy', labelNames), false);
});

test('Other agents never receive engineering execution authority', () => {
  assert.equal(executionApproved({ labels: ['execution:approved'] }, 'tessa', labelNames), false);
  assert.equal(executionApproved({ labels: ['execution:approved'] }, 'sage', labelNames), false);
});
