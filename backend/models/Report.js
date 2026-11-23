const mongoose = require('mongoose');
const ReportSchema = new mongoose.Schema({ reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true }, ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, reason: { type: String, required: true, maxlength: 500 }, status: { type: String, enum: ['open', 'reviewed', 'dismissed'], default: 'open', index: true }, reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, reviewedAt: Date }, { timestamps: true });
ReportSchema.index({ status: 1, createdAt: -1 });
module.exports = mongoose.models.Report || mongoose.model('Report', ReportSchema);
