const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const ResetToken = require('../models/PasswordResetToken');
const EmailVerificationToken = require('../models/EmailVerificationToken');
const Document = require('../models/Document');
const Version = require('../models/DocumentVersion');
const Folder = require('../models/Folder');
const Share = require('../models/Share');
const Report = require('../models/Report');
const AuditLog = require('../models/AuditLog');
const { putBuffer, getFile, deleteFile } = require('../services/storageService');
const { recordAudit } = require('../services/auditService');

const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
const cookieOptions = () => ({ httpOnly: true, secure: COOKIE_SECURE, sameSite: 'strict', path: '/', maxAge: 12 * 60 * 60 * 1000 });
const baseUrl = () => String(process.env.APP_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
function setSession(res, user) { const token = jwt.sign({ sub: String(user._id), role: user.role, sv: user.sessionVersion || 0 }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '12h', issuer: 'folio-vault', audience: 'folio-web' }); res.cookie('folio_session', token, cookieOptions()); }
function error(status, message, code) { return Object.assign(new Error(message), { status, code }); }
function getMailer() { if (!process.env.SMTP_URL) throw error(503, 'Email delivery is not configured. Contact the site administrator.'); return nodemailer.createTransport(process.env.SMTP_URL); }
function otpHash(code) { return crypto.createHash('sha256').update(`${process.env.OTP_PEPPER || process.env.JWT_SECRET}:${code}`).digest('hex'); }
const randomOtp = () => String(crypto.randomInt(100000, 1000000));

async function issueVerificationCode(user, { force = false } = {}) {
  const now = new Date();
  let token = await EmailVerificationToken.findOne({ userId: user._id }).select('+tokenHash');
  if (token && !force && now - token.lastSentAt < 60_000) throw error(429, 'Please wait a minute before requesting another code.', 'OTP_COOLDOWN');
  const code = randomOtp();
  const values = { tokenHash: otpHash(code), attempts: 0, lastSentAt: now, expiresAt: new Date(now.getTime() + 10 * 60_000) };
  if (token) Object.assign(token, values); else token = new EmailVerificationToken({ userId: user._id, ...values });
  await token.save();
  try {
    await getMailer().sendMail({ from: process.env.SMTP_FROM || 'Folio Vault <no-reply@example.com>', to: user.email, subject: 'Your Folio verification code', text: `Your Folio verification code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`, html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;color:#102038"><p style="color:#397ee8;font-weight:bold;letter-spacing:2px">FOLIO VAULT</p><h1>Verify your email</h1><p>Enter this code to finish creating your account:</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#266fda">${code}</p><p>This code expires in 10 minutes. If you did not request it, ignore this email.</p></div>` });
  } catch (mailError) { console.error('Verification email delivery failed:', mailError.message); throw error(503, 'We could not send your verification email. Please try again shortly.'); }
}

exports.register = async (req, res, next) => { try {
  const name = String(req.body.name || '').trim(); const email = String(req.body.email || '').trim().toLowerCase(); const password = String(req.body.password || '');
  if (!name || name.length > 100 || !/^[^\s@]+@gmail\.com$/i.test(email) || password.length < 8 || password.length > 200) return res.status(400).json({ success: false, message: 'Enter your name, a valid Gmail address, and a password of 8–200 characters.' });
  const existing = await User.findOne({ email }).select('+passwordEnabled');
  if (existing) return res.status(409).json({ success: false, code: existing.emailVerified ? 'ACCOUNT_EXISTS' : 'EMAIL_NOT_VERIFIED', message: existing.emailVerified ? 'An account with this email already exists. Sign in instead.' : 'This email still needs verification. You can resend its code.' });
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), passwordEnabled: true, emailVerified: false, role: 'user' });
  await issueVerificationCode(user); res.status(201).json({ success: true, requiresVerification: true, email: user.email, message: 'A 6-digit verification code was sent to your email.' });
} catch (err) { if (err.code === 11000) return res.status(409).json({ success: false, message: 'An account with this email already exists.' }); next(err); } };

exports.resendVerification = async (req, res, next) => { try {
  const email = String(req.body.email || '').trim().toLowerCase(); const user = await User.findOne({ email, emailVerified: false, status: 'active' });
  if (!user) return res.status(404).json({ success: false, message: 'No account is waiting for verification with this email.' });
  await issueVerificationCode(user); res.json({ success: true, message: 'A new verification code was sent.' });
} catch (err) { next(err); } };

exports.verifyEmail = async (req, res, next) => { try {
  const email = String(req.body.email || '').trim().toLowerCase(); const code = String(req.body.code || '').trim();
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: 'Enter the 6-digit code from your email.' });
  const user = await User.findOne({ email, emailVerified: false, status: 'active' }); if (!user) return res.status(404).json({ success: false, message: 'No account is waiting for verification with this email.' });
  const token = await EmailVerificationToken.findOne({ userId: user._id }).select('+tokenHash');
  if (!token || token.expiresAt <= new Date()) { if (token) await token.deleteOne(); return res.status(400).json({ success: false, message: 'This code has expired. Request a new one.' }); }
  if (token.attempts >= 5) return res.status(429).json({ success: false, message: 'Too many incorrect attempts. Request a new code.' });
  const submitted = Buffer.from(otpHash(code)); const expected = Buffer.from(token.tokenHash);
  if (submitted.length !== expected.length || !crypto.timingSafeEqual(submitted, expected)) { await EmailVerificationToken.updateOne({ _id: token._id, attempts: { $lt: 5 } }, { $inc: { attempts: 1 } }); return res.status(400).json({ success: false, message: 'That code is incorrect. Check the email and try again.' }); }
  const consumed = await EmailVerificationToken.findOneAndDelete({ _id: token._id, tokenHash: token.tokenHash, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } });
  if (!consumed) return res.status(409).json({ success: false, message: 'This code was already used or expired. Request a new one.' });
  user.emailVerified = true; user.lastLoginAt = new Date(); await user.save(); setSession(res, user); req.user = user; await recordAudit(req, 'account.register', 'user', user.id, user._id); res.json({ success: true, user: user.toJSON() });
} catch (err) { next(err); } };

exports.login = async (req, res, next) => { try {
  const email = String(req.body.email || '').trim().toLowerCase(); const password = String(req.body.password || '');
  const user = await User.findOne({ email }).select('+passwordHash +passwordEnabled +sessionVersion');
  if (!user || user.status !== 'active' || !user.passwordEnabled || !user.passwordHash || !await bcrypt.compare(password, user.passwordHash)) return res.status(401).json({ success: false, message: 'Email or password is incorrect.' });
  if (!user.emailVerified) return res.status(403).json({ success: false, code: 'EMAIL_NOT_VERIFIED', message: 'Verify your email before signing in.' });
  user.lastLoginAt = new Date(); await user.save(); setSession(res, user); req.user = user; await recordAudit(req, 'auth.login', 'user', user.id, user._id); res.json({ success: true, user: user.toJSON() });
} catch (err) { next(err); } };

exports.googleStart = (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) return res.redirect(`${baseUrl()}/index.html?authError=google-config`);
  const state = crypto.randomBytes(32).toString('base64url');
  res.cookie('folio_oauth_state', state, { httpOnly: true, secure: COOKIE_SECURE, sameSite: 'lax', path: '/api/auth/google', maxAge: 10 * 60 * 1000 });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for (const [key, value] of Object.entries({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: process.env.GOOGLE_REDIRECT_URI, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' })) url.searchParams.set(key, value);
  res.redirect(url.toString());
};

exports.googleCallback = async (req, res) => {
  const fail = reason => res.redirect(`${baseUrl()}/index.html?authError=${encodeURIComponent(reason)}`);
  try {
    const state = String(req.query.state || ''); const savedState = String(req.cookies?.folio_oauth_state || '');
    res.clearCookie('folio_oauth_state', { httpOnly: true, secure: COOKIE_SECURE, sameSite: 'lax', path: '/api/auth/google' });
    if (!state || !savedState || state.length !== savedState.length || !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(savedState))) return fail('state');
    if (req.query.error || !req.query.code || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) return fail('cancelled');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: String(req.query.code), client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: process.env.GOOGLE_REDIRECT_URI, grant_type: 'authorization_code' }) });
    if (!tokenResponse.ok) return fail('exchange'); const tokens = await tokenResponse.json(); if (!tokens.access_token) return fail('exchange');
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (!profileResponse.ok) return fail('profile'); const profile = await profileResponse.json();
    if (!profile.sub || !profile.email || profile.email_verified !== true) return fail('unverified');
    const email = String(profile.email).trim().toLowerCase(); const picture = /^https:\/\/lh3\.googleusercontent\.com\//.test(String(profile.picture || '')) ? String(profile.picture).slice(0, 1000) : '';
    let user = await User.findOne({ googleId: profile.sub }).select('+sessionVersion +avatarKey');
    if (!user) {
      user = await User.findOne({ email }).select('+sessionVersion +avatarKey +googleId');
      if (user) { if (user.googleId && user.googleId !== profile.sub) return fail('link-conflict'); user.googleId = profile.sub; user.emailVerified = true; if (!user.avatarKey) user.avatarUrl = picture || user.avatarUrl; }
      else user = new User({ name: String(profile.name || email.split('@')[0]).slice(0, 100), email, passwordHash: await bcrypt.hash(crypto.randomBytes(48).toString('hex'), 12), passwordEnabled: false, emailVerified: true, googleId: profile.sub, avatarUrl: picture, role: 'user' });
    } else if (!user.avatarKey && picture) user.avatarUrl = picture;
    if (user.status !== 'active') return fail('suspended');
    user.emailVerified = true; user.lastLoginAt = new Date(); await user.save(); setSession(res, user); await recordAudit({ ip: req.ip, user }, 'auth.google_login', 'user', user.id, user._id); return res.redirect(`${baseUrl()}/dashboard.html`);
  } catch (err) { console.error('Google sign-in failed:', err.message); return fail('google'); }
};

exports.me = (req, res) => res.json({ success: true, user: req.user.toJSON() });
exports.logout = async (req, res, next) => { try { if (req.user) { await recordAudit(req, 'auth.logout', 'user', req.user.id, req.user._id); await User.updateOne({ _id: req.user._id }, { $inc: { sessionVersion: 1 } }); } res.clearCookie('folio_session', { ...cookieOptions(), maxAge: undefined }); res.setHeader('Cache-Control', 'no-store'); res.json({ success: true }); } catch (err) { next(err); } };
exports.updateProfile = async (req, res, next) => { try {
  const name = String(req.body.name || '').trim(); if (!name || name.length > 100) return res.status(400).json({ success: false, message: 'Name must be between 1 and 100 characters.' });
  const user = await User.findOneAndUpdate({ _id: req.user._id, status: 'active' }, { $set: { name } }, { new: true, runValidators: true }).select('name email role status storageUsed storageLimit createdAt emailVerified avatarUrl'); if (!user) return res.status(404).json({ success: false, message: 'Account not found.' }); req.user = user; await recordAudit(req, 'profile.update', 'user', user.id, user._id); res.json({ success: true, user });
} catch (err) { next(err); } };

exports.changePassword = async (req, res, next) => { try {
  const current = String(req.body.currentPassword || ''); const password = String(req.body.password || '');
  if (password.length < 8 || password.length > 200) return res.status(400).json({ success: false, message: 'New password must be 8–200 characters.' });
  const user = await User.findById(req.user._id).select('+passwordHash +passwordEnabled +sessionVersion');
  if (!user || user.status !== 'active') return res.status(404).json({ success: false, message: 'Account not found.' });
  if (user.passwordEnabled && (!current || !await bcrypt.compare(current, user.passwordHash))) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
  user.passwordHash = await bcrypt.hash(password, 12); user.passwordEnabled = true; user.sessionVersion += 1; await user.save(); setSession(res, user); await recordAudit({ ip: req.ip, user }, 'auth.password_change', 'user', user.id, user._id); res.json({ success: true, message: 'Password updated. Other sessions have been signed out.' });
} catch (err) { next(err); } };

const imageTypes = { 'image/jpeg': { ext: 'jpg', sig: [0xff, 0xd8, 0xff] }, 'image/png': { ext: 'png', sig: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }, 'image/webp': { ext: 'webp', sig: null } };
exports.uploadAvatar = async (req, res, next) => { try {
  if (!req.file) return res.status(400).json({ success: false, message: 'Choose a PNG, JPEG, or WebP image under 2 MB.' });
  const spec = imageTypes[req.file.mimetype]; const buffer = req.file.buffer;
  const valid = spec?.sig ? buffer.subarray(0, spec.sig.length).equals(Buffer.from(spec.sig)) : spec && buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
  if (!valid) return res.status(400).json({ success: false, message: 'The image contents do not match the selected format.' });
  const key = `avatars/${req.user.id}/${crypto.randomUUID()}.${spec.ext}`; await putBuffer(buffer, key, req.file.mimetype);
  const oldKey = req.user.avatarKey; const user = await User.findByIdAndUpdate(req.user._id, { $set: { avatarKey: key } }, { new: true }).select('name email role status storageUsed storageLimit createdAt emailVerified avatarUrl +avatarKey');
  if (!user) { try { await deleteFile(key); } catch (cleanupError) { console.error('Orphaned avatar cleanup failed:', cleanupError.message); } return res.status(404).json({ success: false, message: 'Account not found.' }); }
  if (oldKey) await deleteFile(oldKey).catch(err => console.error('Old avatar cleanup failed:', err.message)); req.user = user; await recordAudit(req, 'profile.avatar_update', 'user', user.id, user._id); res.json({ success: true, user: user.toJSON() });
} catch (err) { next(err); } };

exports.removeAvatar = async (req, res, next) => { try {
  const user = await User.findById(req.user._id).select('+avatarKey'); if (!user) return res.status(404).json({ success: false, message: 'Account not found.' });
  const oldKey = user.avatarKey; user.avatarKey = ''; await user.save(); if (oldKey) await deleteFile(oldKey); req.user = user; res.json({ success: true, user: user.toJSON() });
} catch (err) { next(err); } };

exports.avatar = async (req, res, next) => { try {
  const user = await User.findById(req.user._id).select('+avatarKey'); if (!user?.avatarKey) return res.status(404).end();
  const file = await getFile(user.avatarKey); res.setHeader('Content-Type', file.ContentType); res.setHeader('Content-Length', file.ContentLength); res.setHeader('Content-Disposition', 'inline'); res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); file.Body.on('error', () => res.destroy()); file.Body.pipe(res);
} catch (err) { next(err); } };

exports.deleteAccount = async (req, res, next) => { try {
  const user = await User.findById(req.user._id).select('+passwordHash +passwordEnabled +avatarKey');
  if (!user || user.status !== 'active') return res.status(404).json({ success: false, message: 'Account not found.' });
  if (String(req.body.confirmEmail || '').trim().toLowerCase() !== user.email) return res.status(400).json({ success: false, message: 'Type your account email exactly to confirm deletion.' });
  if (user.passwordEnabled && !await bcrypt.compare(String(req.body.password || ''), user.passwordHash)) return res.status(400).json({ success: false, message: 'Password is incorrect.' });
  const docs = await Document.find({ ownerId: user._id }).select('_id storageKey fileSize'); const ids = docs.map(doc => doc._id); const versions = await Version.find({ ownerId: user._id }).select('storageKey fileSize');
  for (const objectKey of [...docs.map(doc => doc.storageKey), ...versions.map(version => version.storageKey), user.avatarKey].filter(Boolean)) await deleteFile(objectKey);
  await Document.updateMany({ sharedWith: user._id }, { $pull: { sharedWith: user._id } });
  await Promise.all([
    Version.deleteMany({ ownerId: user._id }),
    Share.deleteMany({ $or: [{ ownerId: user._id }, { sharedWithId: user._id }, { documentId: { $in: ids } }] }),
    Report.deleteMany({ $or: [{ reporterId: user._id }, { ownerId: user._id }, { documentId: { $in: ids } }] }),
    Document.deleteMany({ ownerId: user._id }), Folder.deleteMany({ ownerId: user._id }),
    ResetToken.deleteMany({ userId: user._id }), EmailVerificationToken.deleteMany({ userId: user._id }),
    AuditLog.deleteMany({ $or: [{ actorId: user._id }, { ownerId: user._id }] })
  ]);
  await user.deleteOne(); res.clearCookie('folio_session', { ...cookieOptions(), maxAge: undefined }); res.json({ success: true, message: 'Your account and its stored documents have been deleted.' });
} catch (err) { next(err); } };

exports.forgotPassword = async (req, res, next) => { try {
  const email = String(req.body.email || '').trim().toLowerCase(); const user = await User.findOne({ email, status: 'active', emailVerified: true });
  if (user && process.env.SMTP_URL) {
    const token = crypto.randomBytes(32).toString('hex'); await ResetToken.deleteMany({ userId: user._id }); await ResetToken.create({ userId: user._id, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
    const transport = nodemailer.createTransport(process.env.SMTP_URL); const link = `${baseUrl()}/reset-password.html?token=${token}`;
    try { await transport.sendMail({ from: process.env.SMTP_FROM || 'Folio Vault <no-reply@example.com>', to: user.email, subject: 'Reset your Folio Vault password', text: `Use this link within one hour to reset your password: ${link}` }); }
    catch (mailError) { console.error('Password reset delivery failed:', mailError.message); await ResetToken.deleteMany({ userId: user._id }); }
  }
  res.json({ success: true, message: 'If an active account exists and email delivery is configured, a reset link will arrive shortly.' });
} catch (err) { next(err); } };

exports.resetPassword = async (req, res, next) => { try {
  const token = String(req.body.token || ''); const password = String(req.body.password || ''); if (!/^[a-f0-9]{64}$/i.test(token) || password.length < 8 || password.length > 200) return res.status(400).json({ success: false, message: 'The reset link or new password is invalid.' });
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex'); const record = await ResetToken.findOne({ tokenHash, expiresAt: { $gt: new Date() } }); if (!record) return res.status(400).json({ success: false, message: 'This reset link has expired or was already used.' });
  await User.updateOne({ _id: record.userId }, { $set: { passwordHash: await bcrypt.hash(password, 12), passwordEnabled: true }, $inc: { sessionVersion: 1 } }); await ResetToken.deleteMany({ userId: record.userId }); await recordAudit({ ip: req.ip, user: { _id: record.userId } }, 'auth.password_reset', 'user', record.userId, record.userId); res.json({ success: true, message: 'Password updated. Sign in with your new password.' });
} catch (err) { next(err); } };
