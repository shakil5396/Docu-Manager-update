const mongoose = require('mongoose');
const EmailVerificationTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  tokenHash: { type: String, required: true, select: false },
  attempts: { type: Number, default: 0, min: 0 },
  lastSentAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: true });
module.exports = mongoose.models.EmailVerificationToken || mongoose.model('EmailVerificationToken', EmailVerificationTokenSchema);
