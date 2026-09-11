import test from 'node:test';
import assert from 'node:assert/strict';
import { isFreshAddressedHumanComment } from './comment-trigger-policy.mjs';

test('accepts a fresh addressed comment from the comment router', () => {
  assert.equal(isFreshAddressedHumanComment({
    TRIGGER_COMMENT_ID: '12345',
    COMMENT_BODY: 'Aiden: review PR #356'
  }), true);
});

test('accepts leading whitespace and canonical agent-style prefixes', () => {
  assert.equal(isFreshAddressedHumanComment({
    TRIGGER_COMMENT_ID: '12345',
    COMMENT_BODY: '  Vera: review privacy\nmore context'
  }), true);
});

test('does not bypass for autonomous runs without a triggering comment id', () => {
  assert.equal(isFreshAddressedHumanComment({
    COMMENT_BODY: 'Tessa: review QA'
  }), false);
});

test('does not bypass for ordinary unaddressed comments', () => {
  assert.equal(isFreshAddressedHumanComment({
    TRIGGER_COMMENT_ID: '12345',
    COMMENT_BODY: 'please review this PR'
  }), false);
});
