const jwt = require('jsonwebtoken');
const User = require('../models/User');
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.folio_session || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    if (!token) return res.status(401).json({ success: false, message: 'Sign in to continue.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'folio-vault' });
    const user = await User.findById(payload.sub).select('name email role status storageUsed storageLimit createdAt emailVerified avatarUrl +avatarKey +passwordEnabled +sessionVersion');
    if (!user || user.status !== 'active' || Number(payload.sv || 0) !== Number(user.sessionVersion || 0)) return res.status(401).json({ success: false, message: 'This account session is unavailable.' });
    req.user = user;
    next();
  } catch (error) { if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') return res.status(401).json({ success: false, message: 'Your session has expired. Sign in again.' }); next(error); }
}
function requireAdmin(req, res, next) { if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Administrator access is required.' }); next(); }
module.exports = { requireAuth, requireAdmin };
