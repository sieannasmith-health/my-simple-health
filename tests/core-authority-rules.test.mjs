import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rules = await readFile(new URL('../firebase/firestore.rules', import.meta.url), 'utf8');

function coreBlock() {
  const start = rules.indexOf('match /users/{userID}/coreRecords/{recordID}');
  assert.notEqual(start, -1, 'Core member record match must exist');
  const end = rules.indexOf('// Plaid access tokens', start);
  assert.notEqual(end, -1, 'Core rules block must terminate before Plaid rules');
  return rules.slice(start, end);
}

test('Core records require the authenticated Firebase UID namespace', () => {
  assert.match(rules, /function ownsCoreMemberNamespace\(userID\)[\s\S]*request\.auth\.uid == userID/);
  assert.match(coreBlock(), /allow read: if ownsCoreMemberNamespace\(userID\)/);
  assert.match(coreBlock(), /allow create: if ownsCoreMemberNamespace\(userID\)/);
  assert.match(coreBlock(), /allow update: if ownsCoreMemberNamespace\(userID\)/);
});

test('Core records reject cross-member ownership and unstable record identity', () => {
  assert.match(rules, /data\.recordID == recordID/);
  assert.match(rules, /data\.ownerID == userID/);
  assert.match(rules, /request\.resource\.data\.ownerID == resource\.data\.ownerID/);
  assert.match(rules, /request\.resource\.data\.recordID == resource\.data\.recordID/);
});

test('Core authority and provenance are constrained to approved values', () => {
  for (const value of ['USER_STATED', 'USER_CONFIRMED', 'SYSTEM_OBSERVED', 'MODEL_INFERRED']) {
    assert.ok(rules.includes(`"${value}"`));
  }
  for (const value of ['member', 'external_source', 'system_derived', 'model_inference']) {
    assert.ok(rules.includes(`"${value}"`));
  }
});

test('Core records cannot be hard-deleted by clients and unmatched access stays denied', () => {
  assert.match(coreBlock(), /allow delete: if false/);
  assert.match(rules, /match \/\{document=\*\*\}[\s\S]*allow read, write: if false/);
});
