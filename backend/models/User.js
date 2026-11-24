const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  passwordEnabled: { type: Boolean, default: true, select: false },
  emailVerified: { type: Boolean, default: true },
  googleId: { type: String, unique: true, sparse: true, select: false },
  avatarUrl: { type: String, default: '' },
  avatarKey: { type: String, default: '', select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
  status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
  storageUsed: { type: Number, default: 0, min: 0 },
  storageLimit: { type: Number, default: 200 * 1024 ** 2, min: 0 },
  sessionVersion: { type: Number, default: 0, select: false },
  lastLoginAt: Date
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, toJSON: { virtuals: true, transform: (_doc, ret) => { ret.id = String(ret._id); ret.hasPassword = Boolean(ret.passwordEnabled); if (ret.avatarKey) ret.avatarUrl = '/api/auth/profile/avatar'; delete ret._id; delete ret.__v; delete ret.passwordHash; delete ret.googleId; delete ret.avatarKey; delete ret.passwordEnabled; return ret; } } });
UserSchema.index({ createdAt: -1 });
module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
