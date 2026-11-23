function viewerDocumentQuery(documentId, userId) {
  return { _id: documentId, isDeleted: false, $or: [{ ownerId: userId }, { sharedWith: userId }] };
}
function documentVisibleTo(document, userId) {
  return String(document.ownerId) === String(userId) || (document.sharedWith || []).some(id => String(id) === String(userId));
}
module.exports = { viewerDocumentQuery, documentVisibleTo };
