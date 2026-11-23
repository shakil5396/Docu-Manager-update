const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const ResetToken = require('../models/PasswordResetToken');
const { recordAudit } = require('../services/auditService');
const cookieOptions = () => ({ httpOnly: true, secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 12 * 60 * 60 * 1000 });
function setSession(res, user) { const token = jwt.sign({ sub: String(user._id), role: user.role, sv: user.sessionVersion || 0 }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '12h', issuer: 'folio-vault', audience: 'folio-web' }); res.cookie('folio_session', token, cookieOptions()); }
exports.register = async (req, res, next) => { try {
  const name = String(req.body.name || '').trim(); const email = String(req.body.email || '').trim().toLowerCase(); const password = String(req.body.password || '');
  if (!name || name.length > 100 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 200) return res.status(400).json({ success: false, message: 'Enter a name, valid email, and password of at least 8 characters.' });
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: 'user' });
  req.user = user; setSession(res, user); await recordAudit(req, 'account.register', 'user', user.id, user._id); res.status(201).json({ success: true, user: user.toJSON() });
} catch (error) { if (error.code === 11000) return res.status(409).json({ success: false, message: 'An account with this email already exists.' }); next(error); } };
exports.login = async (req, res, next) => { try {
  const email = String(req.body.email || '').trim().toLowerCase(); const password = String(req.body.password || '');
  const user = await User.findOne({ email }).select('+passwordHash +sessionVersion');
  if (!user || user.status !== 'active' || !await bcrypt.compare(password, user.passwordHash)) return res.status(401).json({ success: false, message: 'Email or password is incorrect.' });
  user.lastLoginAt = new Date(); await user.save(); setSession(res, user); req.user = user; await recordAudit(req, 'auth.login', 'user', user.id, user._id); res.json({ success: true, user: user.toJSON() });
} catch (error) { next(error); } };
exports.me = (req, res) => res.json({ success: true, user: req.user.toJSON() });
exports.logout = async (req, res) => { if (req.user) await recordAudit(req, 'auth.logout', 'user', req.user.id, req.user._id); res.clearCookie('folio_session', { ...cookieOptions(), maxAge: undefined }); res.json({ success: true }); };
exports.updateProfile = async (req, res, next) => { try {
  const name = String(req.body.name || '').trim(); if (!name || name.length > 100) return res.status(400).json({ success: false, message: 'Name must be between 1 and 100 characters.' });
  const user = await User.findByIdAndUpdate(req.user._id, { $set: { name } }, { new: true, runValidators: true }).select('name email role status storageUsed storageLimit createdAt'); req.user = user; await recordAudit(req, 'profile.update', 'user', user.id, user._id); res.json({ success: true, user });
} catch (error) { next(error); } };
exports.forgotPassword = async (req, res, next) => { try {
  const email = String(req.body.email || '').trim().toLowerCase(); const user = await User.findOne({ email, status: 'active' });
  if (user && process.env.SMTP_URL) {
    const token = crypto.randomBytes(32).toString('hex'); await ResetToken.deleteMany({ userId: user._id }); await ResetToken.create({ userId: user._id, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
    const transport = nodemailer.createTransport(process.env.SMTP_URL); const link = `${process.env.APP_BASE_URL || 'http://localhost:5000'}/reset-password.html?token=${token}`;
    try { await transport.sendMail({ from: process.env.SMTP_FROM || 'Folio Vault <no-reply@example.invalid>', to: user.email, subject: 'Reset your Folio Vault password', text: `Use this link within one hour to reset your password: ${link}` }); }
    catch (mailError) { console.error('Password reset delivery failed:', mailError.message); await ResetToken.deleteMany({ userId: user._id }); }
  }
  res.json({ success: true, message: 'If an active account exists for that email and email delivery is configured, a reset link will arrive shortly.' });
} catch (error) { next(error); } };
exports.resetPassword = async (req, res, next) => { try {
  const token = String(req.body.token || ''); const password = String(req.body.password || ''); if (!/^[a-f0-9]{64}$/i.test(token) || password.length < 8 || password.length > 200) return res.status(400).json({ success: false, message: 'The reset link or new password is invalid.' });
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex'); const record = await ResetToken.findOne({ tokenHash, expiresAt: { $gt: new Date() } }); if (!record) return res.status(400).json({ success: false, message: 'This reset link has expired or was already used.' });
  await User.updateOne({ _id: record.userId }, { $set: { passwordHash: await bcrypt.hash(password, 12) }, $inc: { sessionVersion: 1 } }); await ResetToken.deleteMany({ userId: record.userId }); await recordAudit({ ip: req.ip, user: { _id: record.userId } }, 'auth.password_reset', 'user', record.userId, record.userId); res.json({ success: true, message: 'Password updated. Sign in with your new password.' });
} catch (error) { next(error); } };
