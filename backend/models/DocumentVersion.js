const mongoose = require('mongoose');
const VersionSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  version: { type: Number, required: true },
  storageKey: { type: String, required: true, unique: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
}, { toJSON: { transform: (_doc, ret) => { ret.id = String(ret._id); delete ret._id; delete ret.__v; return ret; } } });
VersionSchema.index({ documentId: 1, version: -1 });
module.exports = mongoose.models.DocumentVersion || mongoose.model('DocumentVersion', VersionSchema);
