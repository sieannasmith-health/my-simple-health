import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('ios/MySimpleHealthApp/App/MSHAccountSessionBar.swift', 'utf8');

test('account menu exposes the restored account and sharing actions', () => {
  for (const label of ['Account', 'People & Sharing', 'Invite Someone', 'Appearance', 'Privacy & Permissions', 'Help', 'Sign Out']) {
    assert.ok(source.includes(label), `missing ${label}`);
  }
});

test('invite uses the iOS share sheet and does not claim to grant data access', () => {
  assert.match(source, /ShareLink\(/);
  assert.match(source, /https:\/\/mysimplehealth\.org\//);
  assert.match(source, /does not share any health information/i);
  assert.match(source, /never grants access/i);
});
