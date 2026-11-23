const Document = require('../models/Document');
const Share = require('../models/Share');
const mongoose = require('mongoose');
const { viewerDocumentQuery } = require('./accessPolicy');
const buildViewerDocumentQuery = viewerDocumentQuery;
async function getDocumentForViewer(id, user) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await Document.findOne(buildViewerDocumentQuery(id, user._id));
  return doc;
}
async function getOwnedDocument(id, user) { if (!mongoose.isValidObjectId(id)) return null; return Document.findOne({ _id: id, ownerId: user._id }); }
async function getSharedPermission(docId, userId) { return Share.findOne({ documentId: docId, sharedWithId: userId }).select('permission ownerId'); }
module.exports = { buildViewerDocumentQuery, getDocumentForViewer, getOwnedDocument, getSharedPermission };
