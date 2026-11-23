const mongoose = require('mongoose');
const ShareSchema = new mongoose.Schema({ documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true }, ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, sharedWithId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, permission: { type: String, enum: ['view', 'download'], default: 'view' }, createdAt: { type: Date, default: Date.now } });
ShareSchema.index({ documentId: 1, sharedWithId: 1 }, { unique: true });
module.exports = mongoose.models.Share || mongoose.model('Share', ShareSchema);
