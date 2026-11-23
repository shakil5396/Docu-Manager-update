const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Document = require('../models/Document');
const Report = require('../models/Report');
const AuditLog = require('../models/AuditLog');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { recordAudit } = require('../services/auditService');
const router = express.Router(); router.use(requireAuth, requireAdmin);
router.get('/overview', async (req, res, next) => { try {
  const [users, activeUsers, docs, storage, openReports] = await Promise.all([User.countDocuments(), User.countDocuments({ status: 'active' }), Document.countDocuments({ isDeleted: false }), User.aggregate([{ $group: { _id: null, total: { $sum: '$storageUsed' } } }]), Report.countDocuments({ status: 'open' })]);
  await recordAudit(req, 'admin.overview.view', 'admin', 'overview', null); res.json({ success: true, stats: { users, activeUsers, documents: docs, storageUsed: storage[0]?.total || 0, openReports } });
} catch (error) { next(error); } });
router.get('/users', async (req, res, next) => { try {
  const search = String(req.query.search || '').trim().slice(0, 100); const query = search ? { $or: [{ name: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }, { email: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }] } : {};
  const users = await User.find(query).select('name email role status storageUsed storageLimit createdAt lastLoginAt').sort({ createdAt: -1 }).limit(200).lean(); await recordAudit(req, 'admin.users.view', 'admin', 'users', null, { count: users.length }); res.json({ success: true, users: users.map(u => ({ id: String(u._id), name: u.name, email: u.email, role: u.role, status: u.status, storageUsed: u.storageUsed, storageLimit: u.storageLimit, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt })) });
} catch (error) { next(error); } });
router.patch('/users/:id/status', async (req, res, next) => { try {
  if (!mongoose.isValidObjectId(req.params.id) || String(req.params.id) === String(req.user._id)) return res.status(400).json({ success: false, message: 'This account status cannot be changed.' }); const status = req.body.status; if (!['active', 'suspended'].includes(status)) return res.status(400).json({ success: false, message: 'Choose active or suspended.' }); const user = await User.findByIdAndUpdate(req.params.id, { $set: { status }, $inc: { sessionVersion: 1 } }, { new: true }).select('name email role status'); if (!user) return res.status(404).json({ success: false, message: 'User not found.' }); await recordAudit(req, `admin.user.${status}`, 'user', user.id, user._id); res.json({ success: true, user });
} catch (error) { next(error); } });
router.get('/reports', async (req, res, next) => { try {
  const reports = await Report.find({ status: req.query.status || 'open' }).populate('reporterId', 'name email').populate('ownerId', 'name email').populate('documentId', 'name originalName category').sort({ createdAt: -1 }).limit(200).lean(); await recordAudit(req, 'admin.reports.view', 'admin', 'reports', null, { count: reports.length }); res.json({ success: true, reports: reports.map(r => ({ id: String(r._id), reason: r.reason, status: r.status, createdAt: r.createdAt, reporter: r.reporterId, owner: r.ownerId, document: r.documentId ? { id: String(r.documentId._id), name: r.documentId.name, originalName: r.documentId.originalName, category: r.documentId.category } : null })) });
} catch (error) { next(error); } });
router.patch('/reports/:id', async (req, res, next) => { try { if (!['reviewed', 'dismissed'].includes(req.body.status)) return res.status(400).json({ success: false, message: 'Choose reviewed or dismissed.' }); const report = await Report.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status, reviewedBy: req.user._id, reviewedAt: new Date() } }, { new: true }); if (!report) return res.status(404).json({ success: false, message: 'Report not found.' }); await recordAudit(req, `admin.report.${req.body.status}`, 'report', report.id, report.ownerId, { documentId: String(report.documentId) }); res.json({ success: true }); } catch (error) { next(error); } });
router.get('/audit', async (req, res, next) => { try { const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100).select('-ip').lean(); await recordAudit(req, 'admin.audit.view', 'admin', 'audit', null); res.json({ success: true, logs }); } catch (error) { next(error); } });
module.exports = router;
