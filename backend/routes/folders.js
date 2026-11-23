const express = require('express');
const mongoose = require('mongoose');
const Folder = require('../models/Folder');
const Document = require('../models/Document');
const { requireAuth } = require('../middleware/auth');
const { recordAudit } = require('../services/auditService');
const router = express.Router();
router.use(requireAuth);
router.get('/', async (req, res, next) => { try {
  const folders = await Folder.find({ ownerId: req.user._id }).sort({ folderName: 1 }).lean();
  const ids = folders.map(folder => folder._id); const counts = await Document.aggregate([{ $match: { ownerId: req.user._id, folderId: { $in: ids }, isDeleted: false } }, { $group: { _id: '$folderId', count: { $sum: 1 } } }]); const countMap = new Map(counts.map(row => [String(row._id), row.count]));
  res.json({ success: true, folders: folders.map(folder => ({ id: String(folder._id), name: folder.folderName, folderName: folder.folderName, folder_id: folder.parentFolderId ? String(folder.parentFolderId) : null, parentFolderId: folder.parentFolderId ? String(folder.parentFolderId) : null, is_private: folder.isPrivate, isPrivate: folder.isPrivate, document_count: countMap.get(String(folder._id)) || 0, created_at: folder.createdAt })) });
} catch (error) { next(error); } });
router.post('/', async (req, res, next) => { try {
  const name = String(req.body.name || req.body.folderName || '').trim(); const parentId = req.body.parentFolderId || null;
  if (!name || name.length > 80) return res.status(400).json({ success: false, message: 'Folder name must be between 1 and 80 characters.' });
  if (parentId && (!mongoose.isValidObjectId(parentId) || !await Folder.exists({ _id: parentId, ownerId: req.user._id }))) return res.status(400).json({ success: false, message: 'Choose one of your folders as the parent.' });
  const folder = await Folder.create({ ownerId: req.user._id, folderName: name, parentFolderId: parentId, isPrivate: true }); await recordAudit(req, 'folder.create', 'folder', folder.id, req.user._id); res.status(201).json({ success: true, folder: folder.toJSON() });
} catch (error) { if (error.code === 11000) return res.status(409).json({ success: false, message: 'A folder with that name already exists at this level.' }); next(error); } });
router.patch('/:id', async (req, res, next) => { try {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Folder not found.' }); const folder = await Folder.findOne({ _id: req.params.id, ownerId: req.user._id }); if (!folder) return res.status(404).json({ success: false, message: 'Folder not found.' });
  const name = String(req.body.name || req.body.folderName || '').trim(); if (!name || name.length > 80) return res.status(400).json({ success: false, message: 'Folder name must be between 1 and 80 characters.' }); folder.folderName = name; folder.isPrivate = true; await folder.save(); res.json({ success: true, folder: folder.toJSON() });
} catch (error) { if (error.code === 11000) return res.status(409).json({ success: false, message: 'A folder with that name already exists at this level.' }); next(error); } });
router.delete('/:id', async (req, res, next) => { try {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Folder not found.' }); const folder = await Folder.findOneAndDelete({ _id: req.params.id, ownerId: req.user._id }); if (!folder) return res.status(404).json({ success: false, message: 'Folder not found.' }); await Promise.all([Document.updateMany({ ownerId: req.user._id, folderId: folder._id }, { $set: { folderId: null } }), Folder.updateMany({ ownerId: req.user._id, parentFolderId: folder._id }, { $set: { parentFolderId: folder.parentFolderId || null } })]); await recordAudit(req, 'folder.delete', 'folder', folder.id, req.user._id); res.json({ success: true });
} catch (error) { next(error); } });
module.exports = router;
