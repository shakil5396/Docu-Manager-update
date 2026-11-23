const mongoose = require('mongoose');
const FolderSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  folderName: { type: String, required: true, trim: true, maxlength: 80 },
  parentFolderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  isPrivate: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'createdAt', updatedAt: false }, toJSON: { virtuals: true, transform: (_doc, ret) => { ret.id = String(ret._id); ret.ownerId = String(ret.ownerId); ret.folder_id = ret.parentFolderId ? String(ret.parentFolderId) : null; ret.is_private = ret.isPrivate; ret.name = ret.folderName; delete ret._id; delete ret.__v; delete ret.parentFolderId; return ret; } } });
FolderSchema.index({ ownerId: 1, folderName: 1 }, { unique: true });
module.exports = mongoose.models.Folder || mongoose.model('Folder', FolderSchema);
