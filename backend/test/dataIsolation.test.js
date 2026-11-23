const test = require('node:test');
const assert = require('node:assert/strict');
const { viewerDocumentQuery, documentVisibleTo } = require('../services/accessPolicy');

test('document query scopes results to owner or explicitly shared account', () => {
  const query = viewerDocumentQuery('doc-1', 'user-a');
  assert.deepEqual(query, { _id: 'doc-1', isDeleted: false, $or: [{ ownerId: 'user-a' }, { sharedWith: 'user-a' }] });
});

test('each independent account sees only owned or explicitly shared records', () => {
  const data = [
    { id: 'a-1', ownerId: 'user-a', sharedWith: [] },
    { id: 'b-1', ownerId: 'user-b', sharedWith: [] },
    { id: 'b-2', ownerId: 'user-b', sharedWith: ['user-a'] },
    { id: 'c-1', ownerId: 'user-c', sharedWith: [] }
  ];
  const visible = user => data.filter(doc => documentVisibleTo(doc, user)).map(doc => doc.id);
  assert.deepEqual(visible('user-a'), ['a-1', 'b-2']);
  assert.deepEqual(visible('user-b'), ['b-1', 'b-2']);
  assert.deepEqual(visible('user-c'), ['c-1']);
});

test('an administrator role does not grant access to a private document', () => {
  const privateDoc = { ownerId: 'user-a', sharedWith: [] };
  assert.equal(documentVisibleTo(privateDoc, 'admin-1'), false);
});
