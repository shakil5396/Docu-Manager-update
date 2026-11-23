const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
async function main() {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  if (!email || !process.env.MONGODB_URI) throw new Error('Usage: node scripts/promoteAdmin.js account@example.com (with MONGODB_URI set).');
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOneAndUpdate({ email }, { $set: { role: 'admin', status: 'active' }, $inc: { sessionVersion: 1 } }, { new: true }).select('name email role status');
  if (!user) throw new Error('Create that account through the app before promoting it.');
  console.log(`Administrator role granted to ${user.email}.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => { if (mongoose.connection.readyState !== 0) await mongoose.disconnect(); });
