import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/msh-sharing.js';

const sharing = globalThis.MSHSharing;

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key){ return values.has(key) ? values.get(key) : null; },
    setItem(key,value){ values.set(key,String(value)); },
    removeItem(key){ values.delete(key); }
  };
}

test('Calendar and Financial grants remain independently scoped', () => {
  const repo = sharing.createRepository(memoryStorage());
  const person = repo.upsertPerson({email:'partner@example.com',displayName:'Partner'});
  repo.grant({personId:person.id,resourceType:'calendar',permission:'view',scope:{mode:'selected_layers',layers:['movement','care']}});
  repo.grant({personId:person.id,resourceType:'financial',permission:'collaborate',scope:{mode:'selected_areas',areas:['household_budget']}});

  const calendar = repo.active('calendar');
  const financial = repo.active('financial');
  assert.equal(calendar.length,1);
  assert.equal(financial.length,1);
  assert.deepEqual(calendar[0].scope.layers,['movement','care']);
  assert.deepEqual(financial[0].scope.areas,['household_budget']);
  assert.equal(calendar[0].permission,'view');
  assert.equal(financial[0].permission,'collaborate');
});

test('revoking Calendar access does not revoke Financial access', () => {
  const repo = sharing.createRepository(memoryStorage());
  const person = repo.upsertPerson({email:'partner@example.com'});
  const calendar = repo.grant({personId:person.id,resourceType:'calendar',scope:{mode:'selected_layers',layers:['life']}});
  repo.grant({personId:person.id,resourceType:'financial',scope:{mode:'selected_areas',areas:['goals']}});

  repo.revoke(calendar.id);
  assert.equal(repo.active('calendar').length,0);
  assert.equal(repo.active('financial').length,1);
});

test('new people remain pending until a connected account accepts', () => {
  const repo = sharing.createRepository(memoryStorage());
  const person = repo.upsertPerson({email:'partner@example.com'});
  assert.equal(person.status,'pending');
});