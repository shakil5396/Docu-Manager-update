const mongoose = require('mongoose');

async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error('MONGODB_URI is required.');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, autoIndex: process.env.NODE_ENV !== 'production' });
  if (process.env.NODE_ENV === 'production') await Promise.all(Object.values(mongoose.models).map(model => model.createIndexes()));
  return mongoose.connection;
}

module.exports = { connectDatabase };
