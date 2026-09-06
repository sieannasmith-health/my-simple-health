import test, { after, before } from 'node:test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  Timestamp
} from 'firebase/firestore';

const projectId = 'demo-msh-core-authority';
let environment;

function parseEmulatorHost() {
  const raw = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [host, port] = raw.split(':');
  return { host, port: Number(port) };
}

function validRecord(ownerID, recordID) {
  const now = Timestamp.fromMillis(1_800_000_000_000);
  return {
    recordID,
    ownerID,
    domain: 'focus',
    recordType: 'focus.selection',
    schemaVersion: '1.0.0',
    provenance: 'USER_STATED',
    authority: 'member',
    lifecycleStatus: 'ACTIVE',
    sourceRecordIDs: [],
    createdAt: now,
    updatedAt: now
  };
}

before(async () => {
  const rules = await readFile(new URL('../firebase/firestore.rules', import.meta.url), 'utf8');
  const { host, port } = parseEmulatorHost();
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules, host, port }
  });
});

after(async () => {
  await environment?.cleanup();
});

test('authenticated member can create and read only their own Core record', async () => {
  const member = environment.authenticatedContext('member-a').firestore();
  const own = doc(member, 'users/member-a/coreRecords/focus-1');

  await assertSucceeds(setDoc(own, validRecord('member-a', 'focus-1')));
  const snapshot = await assertSucceeds(getDoc(own));
  assert.equal(snapshot.data().ownerID, 'member-a');
});

test('another authenticated member cannot read or write a different member namespace', async () => {
  const owner = environment.authenticatedContext('member-a').firestore();
  const other = environment.authenticatedContext('member-b').firestore();
  const ownerRef = doc(owner, 'users/member-a/coreRecords/focus-isolation');
  const crossReadRef = doc(other, 'users/member-a/coreRecords/focus-isolation');
  const crossWriteRef = doc(other, 'users/member-a/coreRecords/cross-write');

  await assertSucceeds(setDoc(ownerRef, validRecord('member-a', 'focus-isolation')));
  await assertFails(getDoc(crossReadRef));
  await assertFails(setDoc(crossWriteRef, validRecord('member-a', 'cross-write')));
});

test('unauthenticated clients cannot read Core member state', async () => {
  const guest = environment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(guest, 'users/member-a/coreRecords/focus-1')));
});

test('member cannot create a record whose ownerID disagrees with the UID namespace', async () => {
  const member = environment.authenticatedContext('member-a').firestore();
  const ref = doc(member, 'users/member-a/coreRecords/bad-owner');
  await assertFails(setDoc(ref, validRecord('member-b', 'bad-owner')));
});

test('Core records cannot be hard-deleted by clients', async () => {
  const member = environment.authenticatedContext('member-a').firestore();
  const ref = doc(member, 'users/member-a/coreRecords/no-hard-delete');
  await assertSucceeds(setDoc(ref, validRecord('member-a', 'no-hard-delete')));
  await assertFails(deleteDoc(ref));
});
