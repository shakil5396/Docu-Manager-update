const mongoose = require('mongoose');
const AuditLogSchema = new mongoose.Schema({ actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, action: { type: String, required: true, index: true }, targetType: String, targetId: String, ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, ip: String, details: mongoose.Schema.Types.Mixed }, { timestamps: { createdAt: true, updatedAt: false } });
AuditLogSchema.index({ createdAt: -1 });
module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
