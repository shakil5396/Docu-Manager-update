const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
  status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
  storageUsed: { type: Number, default: 0, min: 0 },
  storageLimit: { type: Number, default: 5 * 1024 ** 3, min: 0 },
  sessionVersion: { type: Number, default: 0, select: false },
  lastLoginAt: Date
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, toJSON: { virtuals: true, transform: (_doc, ret) => { ret.id = String(ret._id); delete ret._id; delete ret.__v; delete ret.passwordHash; return ret; } } });
UserSchema.index({ createdAt: -1 });
module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
