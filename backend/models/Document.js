const mongoose = require('mongoose');
const DocumentSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null, index: true },
  originalName: { type: String, required: true, maxlength: 255 },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  storageKey: { type: String, required: true, unique: true },
  mimeType: { type: String, required: true },
  extension: { type: String, required: true },
  fileSize: { type: Number, required: true, min: 0 },
  category: { type: String, default: 'other', maxlength: 40 },
  description: { type: String, default: '', maxlength: 500 },
  isStarred: { type: Boolean, default: false, index: true },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: Date,
  version: { type: Number, default: 1 },
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  lastOpenedAt: Date
}, { timestamps: true, toJSON: { virtuals: true, transform: (_doc, ret) => { ret.id = String(ret._id); ret.ownerId = String(ret.ownerId); ret.folderId = ret.folderId ? String(ret.folderId) : null; ret.original_name = ret.originalName; ret.file_size = ret.fileSize; ret.created_at = ret.createdAt; ret.is_favorite = ret.isStarred; ret.is_deleted = ret.isDeleted; ret.folder_id = ret.folderId; delete ret._id; delete ret.__v; return ret; } } });
DocumentSchema.index({ ownerId: 1, isDeleted: 1, createdAt: -1 });
DocumentSchema.index({ ownerId: 1, name: 'text', originalName: 'text', description: 'text' });
DocumentSchema.index({ sharedWith: 1, isDeleted: 1 });
module.exports = mongoose.models.Document || mongoose.model('Document', DocumentSchema);
