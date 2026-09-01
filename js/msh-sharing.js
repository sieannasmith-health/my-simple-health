/* My Simple Health — reusable People & Sharing permission model */
(function (global) {
  'use strict';

  const KEY = 'msh_sharing_v1';
  const RESOURCE_TYPES = Object.freeze(['calendar','financial','movement','health']);
  const PERMISSIONS = Object.freeze(['view','collaborate']);
  const clone = value => JSON.parse(JSON.stringify(value));
  const now = () => new Date().toISOString();
  const uid = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;

  function emptyState() {
    return { schemaVersion:1, people:[], grants:[], updatedAt:null };
  }

  function load(storage) {
    const backing = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!backing) return emptyState();
    try {
      const saved = JSON.parse(backing.getItem(KEY) || 'null');
      if (!saved || typeof saved !== 'object') return emptyState();
      return {
        schemaVersion:1,
        people:Array.isArray(saved.people) ? saved.people : [],
        grants:Array.isArray(saved.grants) ? saved.grants : [],
        updatedAt:saved.updatedAt || null
      };
    } catch (_) { return emptyState(); }
  }

  function createRepository(storage) {
    const backing = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    let state = load(backing);
    function save() {
      state.updatedAt = now();
      if (backing) backing.setItem(KEY, JSON.stringify(state));
      return snapshot();
    }
    function snapshot() { return clone(state); }
    return {
      snapshot,
      upsertPerson(input) {
        const data = input || {};
        const email = String(data.email || '').trim().toLowerCase();
        if (!email || !email.includes('@')) throw new Error('A valid email is required.');
        let person = state.people.find(item => item.email === email);
        if (!person) {
          person = { id:uid('person'), email, displayName:String(data.displayName || '').trim() || null, relationship:data.relationship || 'partner', status:'pending', createdAt:now(), acceptedAt:null };
          state.people.push(person);
        }
        return clone(save().people.find(item => item.id === person.id));
      },
      setRelationshipStatus(personId, status) {
        const person = state.people.find(item => item.id === personId);
        if (!person) throw new Error('Sharing person was not found.');
        if (!['pending','accepted','revoked'].includes(status)) throw new Error('Invalid relationship status.');
        person.status = status;
        person.acceptedAt = status === 'accepted' ? now() : person.acceptedAt;
        save();
        return clone(person);
      },
      grant(input) {
        const data = input || {};
        if (!data.personId || !state.people.some(item => item.id === data.personId)) throw new Error('Choose a sharing person first.');
        if (!RESOURCE_TYPES.includes(data.resourceType)) throw new Error('Invalid sharing resource.');
        const permission = PERMISSIONS.includes(data.permission) ? data.permission : 'view';
        const scope = data.scope && typeof data.scope === 'object' ? clone(data.scope) : { mode:'selected' };
        let grant = state.grants.find(item => item.personId === data.personId && item.resourceType === data.resourceType && item.status === 'active');
        if (!grant) {
          grant = { id:uid('grant'), personId:data.personId, resourceType:data.resourceType, permission, scope, status:'active', createdAt:now(), updatedAt:now(), revokedAt:null };
          state.grants.push(grant);
        } else {
          grant.permission = permission;
          grant.scope = scope;
          grant.updatedAt = now();
        }
        save();
        return clone(grant);
      },
      revoke(grantId) {
        const grant = state.grants.find(item => item.id === grantId);
        if (!grant) return null;
        grant.status = 'revoked';
        grant.revokedAt = now();
        grant.updatedAt = now();
        save();
        return clone(grant);
      },
      active(resourceType) {
        return clone(state.grants.filter(item => item.status === 'active' && (!resourceType || item.resourceType === resourceType)));
      }
    };
  }

  const API = Object.freeze({ KEY, RESOURCE_TYPES, PERMISSIONS, emptyState, createRepository });
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  global.MSHSharing = API;
})(typeof window !== 'undefined' ? window : globalThis);