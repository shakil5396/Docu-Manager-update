const AuditLog = require('../models/AuditLog');
async function recordAudit(req, action, targetType, targetId, ownerId, details = {}) {
  try { await AuditLog.create({ actorId: req.user?._id, action, targetType, targetId: String(targetId || ''), ownerId, ip: req.ip, details }); }
  catch (error) { console.error('Audit write failed:', error.message); }
}
module.exports = { recordAudit };
