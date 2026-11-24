const mongoose = require('mongoose');
let connectionPromise;
let indexPromise;

mongoose.connection.on('disconnected', () => {
  connectionPromise = undefined;
  indexPromise = undefined;
});

async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error('MONGODB_URI is required.');
  mongoose.set('strictQuery', true);
  if (mongoose.connection.readyState !== 1) {
    connectionPromise ||= mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, autoIndex: process.env.NODE_ENV !== 'production' }).then(() => mongoose.connection).catch(error => {
      connectionPromise = undefined;
      throw error;
    });
    await connectionPromise;
  }
  if (process.env.NODE_ENV === 'production') {
    indexPromise ||= Promise.all(Object.values(mongoose.models).map(model => model.createIndexes())).catch(error => {
      indexPromise = undefined;
      throw error;
    });
    await indexPromise;
  }
  return mongoose.connection;
}

module.exports = { connectDatabase };
